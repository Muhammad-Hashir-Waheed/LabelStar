const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testTrackingTables() {
  console.log('🔍 Testing tracking ID tables and functions...');

  try {
    // Test if tables exist
    console.log('📋 Checking tables...');
    
    const { data: trackingIdsTable, error: trackingIdsError } = await supabase
      .from('tracking_ids')
      .select('count')
      .limit(1);
    
    if (trackingIdsError) {
      console.log('❌ tracking_ids table does not exist or is not accessible');
      console.log('Creating tracking_ids table...');
      
      await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS tracking_ids (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tracking_number TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'used')),
            created_by UUID REFERENCES auth.users(id),
            assigned_to UUID REFERENCES auth.users(id),
            assigned_at TIMESTAMP WITH TIME ZONE,
            used_at TIMESTAMP WITH TIME ZONE,
            used_in_label UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });
      console.log('✅ tracking_ids table created');
    } else {
      console.log('✅ tracking_ids table exists');
    }

    const { data: assignmentsTable, error: assignmentsError } = await supabase
      .from('user_tracking_assignments')
      .select('count')
      .limit(1);
    
    if (assignmentsError) {
      console.log('❌ user_tracking_assignments table does not exist');
      console.log('Creating user_tracking_assignments table...');
      
      await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS user_tracking_assignments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) UNIQUE,
            total_assigned INTEGER DEFAULT 0,
            total_used INTEGER DEFAULT 0,
            last_assigned_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });
      console.log('✅ user_tracking_assignments table created');
    } else {
      console.log('✅ user_tracking_assignments table exists');
    }

    const { data: auditTable, error: auditError } = await supabase
      .from('tracking_id_audit_log')
      .select('count')
      .limit(1);
    
    if (auditError) {
      console.log('❌ tracking_id_audit_log table does not exist');
      console.log('Creating tracking_id_audit_log table...');
      
      await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS tracking_id_audit_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tracking_id UUID REFERENCES tracking_ids(id),
            user_id UUID REFERENCES auth.users(id),
            action TEXT NOT NULL,
            details JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });
      console.log('✅ tracking_id_audit_log table created');
    } else {
      console.log('✅ tracking_id_audit_log table exists');
    }

    // Test if functions exist
    console.log('🔧 Testing functions...');
    
    const { data: bulkUploadTest, error: bulkUploadError } = await supabase.rpc('bulk_upload_tracking_ids', {
      tracking_numbers: ['9405536207565275376438'],
      uploaded_by: '00000000-0000-0000-0000-000000000000'
    });
    
    if (bulkUploadError) {
      console.log('❌ bulk_upload_tracking_ids function error:', bulkUploadError.message);
    } else {
      console.log('✅ bulk_upload_tracking_ids function works');
    }

    const { data: statsTest, error: statsError } = await supabase.rpc('get_tracking_id_stats');
    
    if (statsError) {
      console.log('❌ get_tracking_id_stats function error:', statsError.message);
    } else {
      console.log('✅ get_tracking_id_stats function works');
      console.log('📊 Current stats:', statsTest);
    }

    console.log('🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Error testing tables:', error);
  }
}

testTrackingTables(); 