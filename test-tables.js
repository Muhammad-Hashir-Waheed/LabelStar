const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testTables() {
  try {
    console.log('🔍 Testing database tables...');

    // Test shipping_labels table
    console.log('\n1. Testing shipping_labels table...');
    const { data: labelsData, error: labelsError } = await supabase
      .from('shipping_labels')
      .select('*')
      .limit(1);

    if (labelsError) {
      console.log('❌ shipping_labels table does not exist or has issues');
      console.log('Error:', labelsError.message);
    } else {
      console.log('✅ shipping_labels table exists and is accessible');
    }

    // Test label_quotas table
    console.log('\n2. Testing label_quotas table...');
    const { data: quotasData, error: quotasError } = await supabase
      .from('label_quotas')
      .select('*')
      .limit(1);

    if (quotasError) {
      console.log('❌ label_quotas table does not exist or has issues');
      console.log('Error:', quotasError.message);
    } else {
      console.log('✅ label_quotas table exists and is accessible');
    }

    // Test system_settings table
    console.log('\n3. Testing system_settings table...');
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1);

    if (settingsError) {
      console.log('❌ system_settings table does not exist or has issues');
      console.log('Error:', settingsError.message);
    } else {
      console.log('✅ system_settings table exists and is accessible');
    }

    // Test profiles table
    console.log('\n4. Testing profiles table...');
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (profilesError) {
      console.log('❌ profiles table does not exist or has issues');
      console.log('Error:', profilesError.message);
    } else {
      console.log('✅ profiles table exists and is accessible');
      console.log('Number of profiles:', profilesData?.length || 0);
    }

    console.log('\n📋 Summary:');
    if (labelsError) console.log('❌ shipping_labels: Missing');
    else console.log('✅ shipping_labels: OK');
    
    if (quotasError) console.log('❌ label_quotas: Missing');
    else console.log('✅ label_quotas: OK');
    
    if (settingsError) console.log('❌ system_settings: Missing');
    else console.log('✅ system_settings: OK');
    
    if (profilesError) console.log('❌ profiles: Missing');
    else console.log('✅ profiles: OK');

    if (labelsError || quotasError || settingsError) {
      console.log('\n🔧 To fix missing tables:');
      console.log('1. Go to your Supabase Dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and paste the contents of fix-database-tables.sql');
      console.log('4. Run the script');
      console.log('5. Refresh your application');
    } else {
      console.log('\n🎉 All tables are working correctly!');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testTables(); 