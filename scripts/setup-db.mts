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

async function setupDatabase() {
  try {
    console.log('🚀 Starting database setup...');

    // Create profiles table
    await executeSql(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID REFERENCES auth.users ON DELETE CASCADE,
        email TEXT UNIQUE,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
        PRIMARY KEY (id)
      );
    `);
    console.log('✅ Profiles table created');

    // Create label_quotas table
    await executeSql(`
      CREATE TABLE IF NOT EXISTS label_quotas (
        user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
        total_labels_allowed INTEGER NOT NULL DEFAULT 0,
        labels_used INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Label quotas table created');

    // Create shipping_labels table (renamed from labels_generated)
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
    console.log('✅ Shipping labels table created');

    // Create system_settings table
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
    console.log('✅ System settings table created');

    // Enable RLS on all tables
    await executeSql(`
      ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE label_quotas ENABLE ROW LEVEL SECURITY;
      ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;
      ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
    `);
    console.log('✅ RLS enabled on all tables');

    // Create policies
    await executeSql(`
      -- Profiles policies
      DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
      CREATE POLICY "Public profiles are viewable by everyone" ON profiles
        FOR SELECT USING (true);

      DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
      CREATE POLICY "Users can insert their own profile" ON profiles
        FOR INSERT WITH CHECK (auth.uid() = id);

      DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
      CREATE POLICY "Users can update their own profile" ON profiles
        FOR UPDATE USING (auth.uid() = id);

      -- Label quotas policies
      DROP POLICY IF EXISTS "Users can view their own quota" ON label_quotas;
      CREATE POLICY "Users can view their own quota" ON label_quotas
        FOR SELECT USING (auth.uid() = user_id);

      DROP POLICY IF EXISTS "Users can update their own quota labels_used" ON label_quotas;
      CREATE POLICY "Users can update their own quota labels_used" ON label_quotas
        FOR UPDATE USING (auth.uid() = user_id);

      DROP POLICY IF EXISTS "Admins can manage all quotas" ON label_quotas;
      CREATE POLICY "Admins can manage all quotas" ON label_quotas
        FOR ALL USING (
          auth.role() = 'service_role' OR 
          EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
          )
        );

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
    console.log('✅ All policies created');

    // Create trigger for new user signups
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

    // Insert default system settings
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

    // Insert admin user profile
    await executeSql(`
      INSERT INTO profiles (id, email, role)
      VALUES ('6f8ba534-4232-49b6-9c3c-778faed67b93', 'hashirwaheed07@outlook.com', 'admin')
      ON CONFLICT (id) DO UPDATE
      SET role = 'admin';
    `);
    console.log('✅ Admin user profile created');

    console.log('🎉 Database setup completed successfully!');
    console.log('📊 Summary:');
    console.log('   - 4 tables created: profiles, label_quotas, shipping_labels, system_settings');
    console.log('   - 2 roles supported: user, admin');
    console.log('   - RLS enabled on all tables');
    console.log('   - Admin user: hashirwaheed07@outlook.com');
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase(); 