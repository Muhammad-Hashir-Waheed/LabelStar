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

async function debugTableStructure() {
  console.log('🔍 Debugging table structure...');

  try {
    // Check if tracking_ids table exists and get its structure
    const { data: tableInfo, error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'tracking_ids'
        ORDER BY ordinal_position;
      `
    });

    if (tableError) {
      console.error('❌ Error getting table structure:', tableError);
    } else {
      console.log('📋 tracking_ids table structure:');
      console.table(tableInfo);
    }

    // Check if there are any existing records
    const { data: existingRecords, error: recordsError } = await supabase
      .from('tracking_ids')
      .select('*')
      .limit(5);

    if (recordsError) {
      console.error('❌ Error getting existing records:', recordsError);
    } else {
      console.log('📊 Existing records:', existingRecords);
    }

    // Try to insert a single record to see the exact error
    console.log('🧪 Testing single record insert...');
    const { data: singleInsert, error: singleError } = await supabase
      .from('tracking_ids')
      .insert({
        tracking_number: '9405536207565275376438',
        status: 'available'
      })
      .select();

    if (singleError) {
      console.error('❌ Single insert error:', singleError);
      console.error('Error details:', JSON.stringify(singleError, null, 2));
    } else {
      console.log('✅ Single insert successful:', singleInsert);
    }

  } catch (error) {
    console.error('❌ Error in debug:', error);
  }
}

debugTableStructure(); 