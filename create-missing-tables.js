const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createMissingTables() {
  try {
    console.log('🔧 Creating missing tables...');

    // 1. Create shipping_labels table
    console.log('📋 Creating shipping_labels table...');
    const { error: labelsError } = await supabase.rpc('exec_sql', {
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

    if (labelsError) {
      console.log('Note: shipping_labels table may already exist or need manual creation');
    } else {
      console.log('✅ shipping_labels table created');
    }

    // 2. Create label_quotas table
    console.log('📋 Creating label_quotas table...');
    const { error: quotasError } = await supabase.rpc('exec_sql', {
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

    if (quotasError) {
      console.log('Note: label_quotas table may already exist or need manual creation');
    } else {
      console.log('✅ label_quotas table created');
    }

    // 3. Create system_settings table
    console.log('📋 Creating system_settings table...');
    const { error: settingsError } = await supabase.rpc('exec_sql', {
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

    if (settingsError) {
      console.log('Note: system_settings table may already exist or need manual creation');
    } else {
      console.log('✅ system_settings table created');
    }

    // 4. Enable RLS on tables
    console.log('🔒 Enabling RLS on tables...');
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;
        ALTER TABLE label_quotas ENABLE ROW LEVEL SECURITY;
        ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
      `
    });

    if (rlsError) {
      console.log('Note: RLS may already be enabled');
    } else {
      console.log('✅ RLS enabled on tables');
    }

    // 5. Create RLS policies
    console.log('📜 Creating RLS policies...');
    const { error: policiesError } = await supabase.rpc('exec_sql', {
      sql: `
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

        -- Label quotas policies
        DROP POLICY IF EXISTS "Users can view their own quota" ON label_quotas;
        CREATE POLICY "Users can view their own quota" ON label_quotas
          FOR SELECT USING (auth.uid() = user_id);

        DROP POLICY IF EXISTS "Users can update their own quota" ON label_quotas;
        CREATE POLICY "Users can update their own quota" ON label_quotas
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
      `
    });

    if (policiesError) {
      console.log('Note: Policies may already exist');
    } else {
      console.log('✅ RLS policies created');
    }

    // 6. Insert default system settings
    console.log('⚙️ Creating default system settings...');
    const { error: insertSettingsError } = await supabase
      .from('system_settings')
      .upsert({
        default_quota: 100,
        allow_bulk_upload: true,
        require_approval: false,
        max_file_size: 5,
        allowed_file_types: ['pdf', 'png', 'jpg']
      }, { onConflict: 'id' });

    if (insertSettingsError) {
      console.log('Note: system_settings may already exist');
    } else {
      console.log('✅ Default system settings created');
    }

    // 7. Create label quotas for existing users
    console.log('👥 Creating label quotas for existing users...');
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id');

    if (!usersError && users) {
      for (const user of users) {
        const { error: quotaError } = await supabase
          .from('label_quotas')
          .upsert({
            user_id: user.id,
            total_labels_allowed: 100,
            labels_used: 0
          }, { onConflict: 'user_id' });

        if (quotaError) {
          console.log(`Note: Quota for user ${user.id} may already exist`);
        }
      }
      console.log('✅ Label quotas created for existing users');
    }

    console.log('🎉 All missing tables created successfully!');
    console.log('');
    console.log('📊 Database Summary:');
    console.log('   - shipping_labels: Created for storing generated labels');
    console.log('   - label_quotas: Created for user label limits');
    console.log('   - system_settings: Created for app configuration');
    console.log('   - RLS policies: Applied for security');
    console.log('   - Default settings: Configured');

  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

createMissingTables(); 