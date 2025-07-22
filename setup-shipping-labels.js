const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
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

async function setupShippingLabels() {
  try {
    console.log('🚀 Setting up shipping labels table...');
    
    // Create shipping_labels table
    console.log('Creating shipping_labels table...');
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });
    
    if (tableError) {
      console.error('❌ Error creating table:', tableError);
      return;
    }

    // Enable RLS
    console.log('Enabling RLS...');
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;'
    });
    
    if (rlsError) {
      console.error('❌ Error enabling RLS:', rlsError);
      return;
    }

    // Create policies
    console.log('Creating RLS policies...');
    const policies = [
      `CREATE POLICY "Users can view their own labels" ON shipping_labels
        FOR SELECT USING (
          user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
          )
        );`,
      `CREATE POLICY "Users can insert their own labels" ON shipping_labels
        FOR INSERT WITH CHECK (
          user_id = auth.uid()
        );`,
      `CREATE POLICY "Users can update their own labels" ON shipping_labels
        FOR UPDATE USING (
          user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
          )
        );`,
      `CREATE POLICY "Admins can manage all labels" ON shipping_labels
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
          )
        );`
    ];

    for (const policy of policies) {
      const { error } = await supabase.rpc('exec_sql', { sql: policy });
      if (error && !error.message.includes('already exists')) {
        console.error('❌ Error creating policy:', error);
      }
    }

    // Create indexes
    console.log('Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_shipping_labels_user_id ON shipping_labels(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_shipping_labels_created_at ON shipping_labels(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_shipping_labels_tracking_number ON shipping_labels(tracking_number);',
      'CREATE INDEX IF NOT EXISTS idx_shipping_labels_status ON shipping_labels(status);'
    ];

    for (const index of indexes) {
      const { error } = await supabase.rpc('exec_sql', { sql: index });
      if (error) {
        console.error('❌ Error creating index:', error);
      }
    }

    // Grant permissions
    console.log('Granting permissions...');
    const { error: grantError } = await supabase.rpc('exec_sql', {
      sql: 'GRANT SELECT, INSERT, UPDATE ON shipping_labels TO authenticated;'
    });
    
    if (grantError) {
      console.error('❌ Error granting permissions:', grantError);
    }
    
    console.log('✅ Shipping labels table setup completed successfully!');
    console.log('');
    console.log('📋 What was created:');
    console.log('- shipping_labels table for storing label history');
    console.log('- Row-level security policies');
    console.log('- Indexes for performance');
    console.log('');
    console.log('🎉 Users can now:');
    console.log('- Generate labels that are automatically saved');
    console.log('- View their label history in the dashboard');
    console.log('- Download previously generated labels');
    console.log('- Track which labels have been downloaded');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

setupShippingLabels(); 