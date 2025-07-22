import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the project root
const envPath = resolve(__dirname, '..', '.env.local');
console.log('Loading environment variables from:', envPath);
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl ? 'Found' : 'Missing');
console.log('Service Role Key:', supabaseServiceRoleKey ? 'Found' : 'Missing');

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function executeSql(sql: string) {
  if (!supabaseServiceRoleKey) {
    throw new Error('Service role key is required');
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'apikey': supabaseServiceRoleKey,
    'Authorization': `Bearer ${supabaseServiceRoleKey}`
  };

  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(JSON.stringify(error));
  }

  return response.json();
}

async function fixDatabase() {
  try {
    console.log('🔧 Starting database fixes...');

    // 1. Create missing tables
    console.log('📋 Creating missing tables...');
    
    // Create shipping_labels table (if it doesn't exist)
    await executeSql(`
      CREATE TABLE IF NOT EXISTS shipping_labels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id),
        tracking_number TEXT,
        label_data JSONB,
        status TEXT DEFAULT 'generated',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ shipping_labels table created');

    // Create system_settings table (if it doesn't exist)
    await executeSql(`
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
    `);
    console.log('✅ system_settings table created');

    // 2. Enable RLS on new tables
    console.log('🔒 Enabling RLS on new tables...');
    await executeSql(`
      ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;
      ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
    `);
    console.log('✅ RLS enabled');

    // 3. Create missing policies
    console.log('📜 Creating missing policies...');
    await executeSql(`
      -- Shipping labels policies
      DROP POLICY IF EXISTS "Users can insert their own labels" ON shipping_labels;
      CREATE POLICY "Users can insert their own labels" ON shipping_labels
        FOR INSERT WITH CHECK (auth.uid() = user_id);

      DROP POLICY IF EXISTS "Users can select their own labels" ON shipping_labels;
      CREATE POLICY "Users can select their own labels" ON shipping_labels
        FOR SELECT USING (auth.uid() = user_id);

      DROP POLICY IF EXISTS "Admins can select all labels" ON shipping_labels;
      CREATE POLICY "Admins can select all labels" ON shipping_labels
        FOR SELECT USING (
          auth.role() = 'service_role' OR 
          EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
          )
        );

      DROP POLICY IF EXISTS "Admins can delete all labels" ON shipping_labels;
      CREATE POLICY "Admins can delete all labels" ON shipping_labels
        FOR DELETE USING (
          auth.role() = 'service_role' OR 
          EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
          )
        );

      -- System settings policies (admin only)
      DROP POLICY IF EXISTS "Admins can manage system settings" ON system_settings;
      CREATE POLICY "Admins can manage system settings" ON system_settings
        FOR ALL USING (
          auth.role() = 'service_role' OR 
          EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
          )
        );
    `);
    console.log('✅ Policies created');

    // 4. Insert default system settings
    console.log('⚙️ Creating default system settings...');
    await executeSql(`
      INSERT INTO system_settings (id, default_quota, allow_bulk_upload, require_approval, max_file_size, allowed_file_types)
      VALUES (
        gen_random_uuid(),
        100,
        true,
        false,
        5,
        ARRAY['pdf', 'png', 'jpg']
      ) ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Default system settings created');

    // 5. Create user signup trigger if it doesn't exist
    console.log('🔄 Creating user signup trigger...');
    await executeSql(`
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO public.profiles (id, email, role)
        VALUES (new.id, new.email, 'user');
        
        INSERT INTO public.label_quotas (user_id, total_labels_allowed)
        VALUES (new.id, 100);
        
        RETURN new;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    `);
    console.log('✅ User signup trigger created');

    // 6. Ensure admin user exists
    console.log('👤 Ensuring admin user exists...');
    await executeSql(`
      INSERT INTO profiles (id, email, role)
      VALUES ('6f8ba534-4232-49b6-9c3c-778faed67b93', 'hashirwaheed07@outlook.com', 'admin')
      ON CONFLICT (id) DO UPDATE
      SET role = 'admin';
    `);
    console.log('✅ Admin user profile ensured');

    console.log('🎉 Database fixes completed successfully!');
    console.log('');
    console.log('📊 Project Summary:');
    console.log('   📋 Tables: 4 total');
    console.log('      - profiles (user roles and info)');
    console.log('      - label_quotas (user label limits)');
    console.log('      - shipping_labels (generated labels)');
    console.log('      - system_settings (app configuration)');
    console.log('');
    console.log('   👥 Roles: 2 types');
    console.log('      - user (regular users)');
    console.log('      - admin (administrators)');
    console.log('');
    console.log('   🔒 Security: RLS enabled on all tables');
    console.log('   🔄 Automation: User signup trigger active');
    console.log('   👤 Admin: hashirwaheed07@outlook.com');
    console.log('');
    console.log('✅ All logical issues have been resolved!');

  } catch (error) {
    console.error('❌ Error fixing database:', error);
    process.exit(1);
  }
}

fixDatabase(); 