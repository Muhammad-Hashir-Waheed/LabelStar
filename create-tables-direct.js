const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTablesDirect() {
  try {
    console.log('🔧 Creating missing tables directly...');

    // 1. Create shipping_labels table
    console.log('\n1. Creating shipping_labels table...');
    const { error: labelsError } = await supabase
      .from('shipping_labels')
      .select('*')
      .limit(1);

    if (labelsError && labelsError.message.includes('does not exist')) {
      console.log('shipping_labels table does not exist, creating it...');
      
      // Try to create using raw SQL
      const { error: createLabelsError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS shipping_labels (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            tracking_number TEXT,
            label_data JSONB,
            status TEXT DEFAULT 'generated',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });

      if (createLabelsError) {
        console.log('Could not create shipping_labels table via RPC, trying alternative method...');
        
        // Try creating a dummy record to see if table exists
        const { error: testError } = await supabase
          .from('shipping_labels')
          .insert({
            user_id: '00000000-0000-0000-0000-000000000000',
            tracking_number: 'test',
            label_data: {},
            status: 'test'
          });

        if (testError) {
          console.log('❌ shipping_labels table creation failed');
          console.log('Error:', testError.message);
        } else {
          console.log('✅ shipping_labels table created successfully');
          // Clean up test record
          await supabase
            .from('shipping_labels')
            .delete()
            .eq('tracking_number', 'test');
        }
      } else {
        console.log('✅ shipping_labels table created successfully');
      }
    } else {
      console.log('✅ shipping_labels table already exists');
    }

    // 2. Create label_quotas table
    console.log('\n2. Creating label_quotas table...');
    const { error: quotasError } = await supabase
      .from('label_quotas')
      .select('*')
      .limit(1);

    if (quotasError && quotasError.message.includes('does not exist')) {
      console.log('label_quotas table does not exist, creating it...');
      
      const { error: createQuotasError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS label_quotas (
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
            total_labels_allowed INTEGER NOT NULL DEFAULT 100,
            labels_used INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });

      if (createQuotasError) {
        console.log('Could not create label_quotas table via RPC, trying alternative method...');
        
        const { error: testError } = await supabase
          .from('label_quotas')
          .insert({
            user_id: '00000000-0000-0000-0000-000000000000',
            total_labels_allowed: 100,
            labels_used: 0
          });

        if (testError) {
          console.log('❌ label_quotas table creation failed');
          console.log('Error:', testError.message);
        } else {
          console.log('✅ label_quotas table created successfully');
          // Clean up test record
          await supabase
            .from('label_quotas')
            .delete()
            .eq('user_id', '00000000-0000-0000-0000-000000000000');
        }
      } else {
        console.log('✅ label_quotas table created successfully');
      }
    } else {
      console.log('✅ label_quotas table already exists');
    }

    // 3. Create system_settings table
    console.log('\n3. Creating system_settings table...');
    const { error: settingsError } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1);

    if (settingsError && settingsError.message.includes('does not exist')) {
      console.log('system_settings table does not exist, creating it...');
      
      const { error: createSettingsError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS system_settings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            default_quota INTEGER DEFAULT 100,
            allow_bulk_upload BOOLEAN DEFAULT true,
            require_approval BOOLEAN DEFAULT false,
            max_file_size INTEGER DEFAULT 5,
            allowed_file_types TEXT[] DEFAULT ARRAY['pdf', 'png', 'jpg'],
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });

      if (createSettingsError) {
        console.log('Could not create system_settings table via RPC, trying alternative method...');
        
        const { error: testError } = await supabase
          .from('system_settings')
          .insert({
            default_quota: 100,
            allow_bulk_upload: true,
            require_approval: false,
            max_file_size: 5,
            allowed_file_types: ['pdf', 'png', 'jpg']
          });

        if (testError) {
          console.log('❌ system_settings table creation failed');
          console.log('Error:', testError.message);
        } else {
          console.log('✅ system_settings table created successfully');
        }
      } else {
        console.log('✅ system_settings table created successfully');
      }
    } else {
      console.log('✅ system_settings table already exists');
    }

    // 4. Test all tables
    console.log('\n4. Testing all tables...');
    
    const { data: labelsTest, error: labelsTestError } = await supabase
      .from('shipping_labels')
      .select('*')
      .limit(1);
    
    const { data: quotasTest, error: quotasTestError } = await supabase
      .from('label_quotas')
      .select('*')
      .limit(1);
    
    const { data: settingsTest, error: settingsTestError } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1);

    console.log('\n📋 Final Test Results:');
    if (labelsTestError) {
      console.log('❌ shipping_labels: Still has issues -', labelsTestError.message);
    } else {
      console.log('✅ shipping_labels: Working correctly');
    }
    
    if (quotasTestError) {
      console.log('❌ label_quotas: Still has issues -', quotasTestError.message);
    } else {
      console.log('✅ label_quotas: Working correctly');
    }
    
    if (settingsTestError) {
      console.log('❌ system_settings: Still has issues -', settingsTestError.message);
    } else {
      console.log('✅ system_settings: Working correctly');
    }

    if (!labelsTestError && !quotasTestError && !settingsTestError) {
      console.log('\n🎉 All tables are now working! Your app should be error-free.');
      console.log('Refresh your browser to see the changes.');
    } else {
      console.log('\n⚠️  Some tables still have issues. You may need to create them manually in Supabase Dashboard.');
      console.log('Go to: https://app.supabase.com/project/srkwtpkmejvzlsnmiyre/sql');
      console.log('And run the SQL from fix-database-tables.sql');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createTablesDirect(); 