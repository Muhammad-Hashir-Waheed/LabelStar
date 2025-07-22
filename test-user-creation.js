const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testUserCreation() {
  const testUser = {
    name: "Test User",
    email: "testuser@example.com",
    password: "TestPassword123",
    role: "user"
  };

  try {
    console.log('Testing user creation...');
    console.log('User details:', testUser);
    
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testUser.email,
      password: testUser.password,
      email_confirm: true,
      user_metadata: {
        name: testUser.name,
      },
    });

    if (authError) {
      console.error('Error creating user in auth:', authError);
      return;
    }

    console.log('✅ User created successfully in auth');
    console.log('User ID:', authData.user.id);

    // Update profile with additional info
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        name: testUser.name,
        role: testUser.role,
      })
      .eq("id", authData.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
    } else {
      console.log('✅ Profile updated successfully');
    }

    console.log('\n🎉 User creation test completed successfully!');
    console.log('Test user can now sign in with:');
    console.log('Email:', testUser.email);
    console.log('Password:', testUser.password);

    // Clean up - delete the test user
    console.log('\n🧹 Cleaning up test user...');
    const { error: deleteError } = await supabase.auth.admin.deleteUser(authData.user.id);
    
    if (deleteError) {
      console.error('Error deleting test user:', deleteError);
    } else {
      console.log('✅ Test user deleted successfully');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testUserCreation(); 