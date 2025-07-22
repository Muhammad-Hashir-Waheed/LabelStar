const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdminUser() {
  try {
    // Create the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'hashirwaheed07@outlook.com',
      password: 'hashir361999',
    });

    if (authError) throw authError;

    console.log('User created successfully:', authData);

    // Update the user's role to admin
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('email', 'hashirwaheed07@outlook.com');

    if (updateError) throw updateError;

    console.log('User role updated to admin successfully');
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

createAdminUser(); 