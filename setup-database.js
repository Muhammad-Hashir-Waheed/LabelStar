const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabase() {
  try {
    console.log('🚀 Setting up database tables...');
    
    // 1. Create tracking_ids table
    console.log('Creating tracking_ids table...');
    const { error: trackingIdsError } = await supabase
      .from('tracking_ids')
      .select('id')
      .limit(1);
    
    if (trackingIdsError && trackingIdsError.code === '42P01') {
      console.log('tracking_ids table does not exist, creating...');
      // You'll need to create this table manually in Supabase
      console.log('Please create the tracking_ids table manually in Supabase SQL Editor');
    }

    // 2. Create user_tracking_assignments table
    console.log('Creating user_tracking_assignments table...');
    const { error: assignmentsError } = await supabase
      .from('user_tracking_assignments')
      .select('id')
      .limit(1);
    
    if (assignmentsError && assignmentsError.code === '42P01') {
      console.log('user_tracking_assignments table does not exist, creating...');
      // You'll need to create this table manually in Supabase
      console.log('Please create the user_tracking_assignments table manually in Supabase SQL Editor');
    }

    // 3. Create shipping_labels table
    console.log('Creating shipping_labels table...');
    const { error: shippingLabelsError } = await supabase
      .from('shipping_labels')
      .select('id')
      .limit(1);
    
    if (shippingLabelsError && shippingLabelsError.code === '42P01') {
      console.log('shipping_labels table does not exist, creating...');
      // You'll need to create this table manually in Supabase
      console.log('Please create the shipping_labels table manually in Supabase SQL Editor');
    }

    console.log('');
    console.log('❌ Tables need to be created manually in Supabase');
    console.log('');
    console.log('📋 Please run the following SQL in your Supabase SQL Editor:');
    console.log('');
    console.log('=== TRACKING ID TABLES ===');
    console.log(`
-- Create tracking_ids table
CREATE TABLE IF NOT EXISTS tracking_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'used')),
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  used_at TIMESTAMP WITH TIME ZONE,
  used_in_label UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Create user_tracking_assignments table
CREATE TABLE IF NOT EXISTS user_tracking_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  total_assigned INTEGER NOT NULL DEFAULT 0,
  total_used INTEGER NOT NULL DEFAULT 0,
  last_assigned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create tracking_id_audit_log table
CREATE TABLE IF NOT EXISTS tracking_id_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id UUID REFERENCES tracking_ids(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
    `);
    
    console.log('=== SHIPPING LABELS TABLE ===');
    console.log(`
-- Create shipping_labels table
CREATE TABLE IF NOT EXISTS shipping_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,
  recipient_name TEXT,
  recipient_city TEXT,
  recipient_state TEXT,
  recipient_zip TEXT,
  recipient_street TEXT,
  sender_state TEXT,
  sender_city TEXT,
  sender_zip TEXT,
  sender_street TEXT,
  label_data JSONB,
  status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'downloaded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
    `);

    console.log('=== ENABLE RLS AND CREATE POLICIES ===');
    console.log(`
-- Enable RLS on all tables
ALTER TABLE tracking_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tracking_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_id_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;

-- Create policies (run these after creating the tables)
-- You can find the complete policies in the setup files
    `);

    console.log('');
    console.log('✅ After creating the tables, the system will work properly!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupDatabase(); 