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

async function simpleUploadTest() {
  console.log('🧪 Testing simple tracking ID upload...');

  try {
    // Test tracking numbers
    const trackingNumbers = [
      '9405536207565275376438',
      '9405536207565275376439',
      '9405536207565275376440',
      '9405536207565275376441',
      '9405536207565275376442'
    ];

    console.log('📤 Uploading tracking numbers:', trackingNumbers);

    // Insert tracking IDs directly
    const { data, error } = await supabase
      .from('tracking_ids')
      .insert(
        trackingNumbers.map(trackingNumber => ({
          tracking_number: trackingNumber,
          status: 'available',
          created_by: '00000000-0000-0000-0000-000000000000' // Dummy UUID for testing
        }))
      )
      .select();

    if (error) {
      console.error('❌ Error inserting tracking IDs:', error);
      return;
    }

    console.log('✅ Successfully uploaded tracking IDs:', data);

    // Test getting stats
    const { data: stats, error: statsError } = await supabase
      .from('tracking_ids')
      .select('status')
      .eq('status', 'available');

    if (statsError) {
      console.error('❌ Error getting stats:', statsError);
    } else {
      console.log('📊 Available tracking IDs:', stats.length);
    }

    console.log('🎉 Simple upload test completed successfully!');

  } catch (error) {
    console.error('❌ Error in simple upload test:', error);
  }
}

simpleUploadTest(); 