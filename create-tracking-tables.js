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

async function createTrackingTables() {
  console.log('🏗️ Creating tracking ID tables...');

  try {
    // Create tracking_ids table
    console.log('📋 Creating tracking_ids table...');
    const { error: trackingIdsError } = await supabase
      .from('tracking_ids')
      .select('count')
      .limit(1);

    if (trackingIdsError && trackingIdsError.code === '42P01') {
      // Table doesn't exist, create it
      console.log('Creating tracking_ids table...');
      
      // We need to use a different approach since exec_sql doesn't exist
      // Let me try to create the table by inserting a dummy record and catching the error
      const { error: createError } = await supabase
        .from('tracking_ids')
        .insert({
          tracking_number: 'DUMMY_CREATE_TABLE',
          status: 'available'
        });

      if (createError) {
        console.log('Table creation error (expected):', createError.message);
      }
    } else {
      console.log('✅ tracking_ids table already exists');
    }

    // Let me try a different approach - create the tables using the Supabase dashboard
    console.log('📝 Please create the following tables in your Supabase dashboard:');
    console.log('');
    console.log('1. tracking_ids table:');
    console.log(`
CREATE TABLE tracking_ids (
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
    `);

    console.log('2. user_tracking_assignments table:');
    console.log(`
CREATE TABLE user_tracking_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  total_assigned INTEGER DEFAULT 0,
  total_used INTEGER DEFAULT 0,
  last_assigned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
    `);

    console.log('3. tracking_id_audit_log table:');
    console.log(`
CREATE TABLE tracking_id_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id UUID REFERENCES tracking_ids(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
    `);

    console.log('');
    console.log('🔧 After creating the tables, run the setup-database-functions.js script again.');
    console.log('📊 Then you can test the tracking ID upload functionality.');

  } catch (error) {
    console.error('❌ Error creating tables:', error);
  }
}

createTrackingTables(); 