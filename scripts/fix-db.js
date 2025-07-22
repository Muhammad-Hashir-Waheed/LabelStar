const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl ? 'Found' : 'Missing');
console.log('Service Role Key:', supabaseServiceRoleKey ? 'Found' : 'Missing');

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixDatabase() {
  try {
    console.log('🔧 Starting database fixes...');

    // 1. Create shipping_labels table if it doesn't exist
    console.log('📋 Creating shipping_labels table...');
    const { error: createLabelsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS shipping_labels (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES auth.users(id),
          tracking_number TEXT,
          label_data JSONB,
          status TEXT DEFAULT 'generated',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (createLabelsError) {
      console.log('Note: shipping_labels table may already exist or need manual creation');
    } else {
      console.log('✅ shipping_labels table created');
    }

    // 2. Create system_settings table if it doesn't exist
    console.log('📋 Creating system_settings table...');
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
      console.log('Note: system_settings table may already exist or need manual creation');
    } else {
      console.log('✅ system_settings table created');
    }

    // 3. Insert default system settings
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

    // 4. Ensure admin user exists
    console.log('👤 Ensuring admin user exists...');
    const { error: adminError } = await supabase
      .from('profiles')
      .upsert({
        id: '6f8ba534-4232-49b6-9c3c-778faed67b93',
        email: 'hashirwaheed07@outlook.com',
        role: 'admin'
      }, { onConflict: 'id' });

    if (adminError) {
      console.log('Note: Admin user may already exist');
    } else {
      console.log('✅ Admin user profile ensured');
    }

    console.log('🎉 Database fixes completed!');
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
    console.log('   👤 Admin: hashirwaheed07@outlook.com');
    console.log('');
    console.log('⚠️  Note: Some tables may need to be created manually in Supabase dashboard');
    console.log('   if the RPC method is not available.');

  } catch (error) {
    console.error('❌ Error fixing database:', error);
    console.log('');
    console.log('💡 Manual Steps Required:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run the SQL from supabase/tables.sql');
    console.log('4. This will create all missing tables and fix the issues');
  }
}

fixDatabase(); 