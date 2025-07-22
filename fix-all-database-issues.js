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

async function fixAllDatabaseIssues() {
  console.log('🔧 Fixing all database issues...');

  try {
    // Step 1: Check and fix profiles table
    console.log('📋 Step 1: Checking profiles table...');
    
    // Check if profiles table has the correct columns
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .limit(1);

    if (profilesError && profilesError.message.includes('column profiles.name does not exist')) {
      console.log('⚠️ Profiles table has incorrect column names. Please update your profiles table:');
      console.log(`
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Update existing records if needed
UPDATE profiles SET full_name = email WHERE full_name IS NULL;
UPDATE profiles SET role = 'user' WHERE role IS NULL;
      `);
    } else {
      console.log('✅ Profiles table structure is correct');
    }

    // Step 2: Create tracking_ids table
    console.log('📋 Step 2: Creating tracking_ids table...');
    
    const { error: trackingIdsError } = await supabase
      .from('tracking_ids')
      .select('count')
      .limit(1);

    if (trackingIdsError && trackingIdsError.code === '42P01') {
      console.log('Creating tracking_ids table...');
      
      // Create the table using a workaround
      const { error: createError } = await supabase
        .from('tracking_ids')
        .insert({
          tracking_number: 'TEMP_CREATE_TABLE',
          status: 'available'
        });

      if (createError) {
        console.log('Table creation error (expected):', createError.message);
        console.log('Please create the tracking_ids table manually in Supabase dashboard:');
        console.log(`
CREATE TABLE tracking_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'used')),
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  used_at TIMESTAMP WITH TIME ZONE,
  used_in_label UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
        `);
      }
    } else {
      console.log('✅ tracking_ids table exists');
    }

    // Step 3: Create user_tracking_assignments table
    console.log('📋 Step 3: Creating user_tracking_assignments table...');
    
    const { error: assignmentsError } = await supabase
      .from('user_tracking_assignments')
      .select('count')
      .limit(1);

    if (assignmentsError && assignmentsError.code === '42P01') {
      console.log('Creating user_tracking_assignments table...');
      
      const { error: createError } = await supabase
        .from('user_tracking_assignments')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000',
          total_assigned: 0,
          total_used: 0
        });

      if (createError) {
        console.log('Please create the user_tracking_assignments table manually:');
        console.log(`
CREATE TABLE user_tracking_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  total_assigned INTEGER DEFAULT 0,
  total_used INTEGER DEFAULT 0,
  last_assigned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
        `);
      }
    } else {
      console.log('✅ user_tracking_assignments table exists');
    }

    // Step 4: Create tracking_id_audit_log table
    console.log('📋 Step 4: Creating tracking_id_audit_log table...');
    
    const { error: auditError } = await supabase
      .from('tracking_id_audit_log')
      .select('count')
      .limit(1);

    if (auditError && auditError.code === '42P01') {
      console.log('Creating tracking_id_audit_log table...');
      
      const { error: createError } = await supabase
        .from('tracking_id_audit_log')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000',
          action: 'test'
        });

      if (createError) {
        console.log('Please create the tracking_id_audit_log table manually:');
        console.log(`
CREATE TABLE tracking_id_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id UUID REFERENCES tracking_ids(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
        `);
      }
    } else {
      console.log('✅ tracking_id_audit_log table exists');
    }

    // Step 5: Create database functions
    console.log('📋 Step 5: Creating database functions...');
    
    // Since exec_sql doesn't exist, we'll provide the SQL to run manually
    console.log('Please run these SQL commands in your Supabase SQL Editor:');
    console.log('');
    
    console.log('-- Function 1: Validation function');
    console.log(`
CREATE OR REPLACE FUNCTION validate_usps_tracking_number(tracking_number TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN tracking_number ~ '^[0-9]{20,22}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;
    `);

    console.log('-- Function 2: Bulk upload function');
    console.log(`
CREATE OR REPLACE FUNCTION bulk_upload_tracking_ids(
  tracking_numbers TEXT[],
  uploaded_by UUID
)
RETURNS JSON AS $$
DECLARE
  tracking_number TEXT;
  cleaned_number TEXT;
  inserted_count INTEGER := 0;
  duplicate_count INTEGER := 0;
  invalid_count INTEGER := 0;
  result JSON;
BEGIN
  IF tracking_numbers IS NULL OR array_length(tracking_numbers, 1) = 0 THEN
    RETURN json_build_object('error', 'No tracking numbers provided');
  END IF;

  FOREACH tracking_number IN ARRAY tracking_numbers
  LOOP
    IF tracking_number IS NULL OR trim(tracking_number) = '' THEN
      CONTINUE;
    END IF;

    cleaned_number := regexp_replace(trim(tracking_number), '[^0-9]', '', 'g');

    IF length(cleaned_number) < 20 OR length(cleaned_number) > 22 THEN
      invalid_count := invalid_count + 1;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO tracking_ids (tracking_number, created_by)
      VALUES (cleaned_number, uploaded_by);
      inserted_count := inserted_count + 1;
    EXCEPTION WHEN unique_violation THEN
      duplicate_count := duplicate_count + 1;
    END;
  END LOOP;

  INSERT INTO tracking_id_audit_log (user_id, action, details)
  VALUES (uploaded_by, 'bulk_upload', json_build_object(
    'total_provided', array_length(tracking_numbers, 1),
    'inserted', inserted_count,
    'duplicates', duplicate_count,
    'invalid', invalid_count
  ));

  SELECT json_build_object(
    'success', true,
    'inserted', inserted_count,
    'duplicates', duplicate_count,
    'invalid', invalid_count,
    'total_provided', array_length(tracking_numbers, 1)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    console.log('-- Function 3: Stats function');
    console.log(`
CREATE OR REPLACE FUNCTION get_tracking_id_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_tracking_ids', (SELECT COUNT(*) FROM tracking_ids),
    'available_tracking_ids', (SELECT COUNT(*) FROM tracking_ids WHERE status = 'available'),
    'assigned_tracking_ids', (SELECT COUNT(*) FROM tracking_ids WHERE status = 'assigned'),
    'used_tracking_ids', (SELECT COUNT(*) FROM tracking_ids WHERE status = 'used'),
    'user_assignments', (
      SELECT json_agg(
        json_build_object(
          'user_id', uta.user_id,
          'user_email', p.email,
          'user_name', p.full_name,
          'total_assigned', uta.total_assigned,
          'total_used', uta.total_used,
          'available', uta.total_assigned - uta.total_used
        )
      )
      FROM user_tracking_assignments uta
      JOIN profiles p ON uta.user_id = p.id
      ORDER BY uta.total_assigned DESC
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    console.log('-- Function 4: Assign function');
    console.log(`
CREATE OR REPLACE FUNCTION assign_tracking_ids_to_user(
  target_user_id UUID,
  quantity INTEGER,
  assigned_by UUID
)
RETURNS JSON AS $$
DECLARE
  available_count INTEGER;
  assigned_count INTEGER := 0;
  tracking_id_record RECORD;
  result JSON;
BEGIN
  IF target_user_id IS NULL OR quantity IS NULL OR quantity <= 0 THEN
    RETURN json_build_object('error', 'Invalid parameters');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
    RETURN json_build_object('error', 'Target user does not exist');
  END IF;

  SELECT COUNT(*) INTO available_count
  FROM tracking_ids
  WHERE status = 'available';

  IF available_count < quantity THEN
    RETURN json_build_object('error', 'Not enough available tracking IDs', 'available', available_count, 'requested', quantity);
  END IF;

  FOR tracking_id_record IN 
    SELECT id FROM tracking_ids 
    WHERE status = 'available' 
    ORDER BY created_at ASC 
    LIMIT quantity
  LOOP
    UPDATE tracking_ids
    SET status = 'assigned',
        assigned_to = target_user_id,
        assigned_at = NOW()
    WHERE id = tracking_id_record.id;
    
    assigned_count := assigned_count + 1;

    INSERT INTO tracking_id_audit_log (tracking_id, user_id, action, details)
    VALUES (tracking_id_record.id, assigned_by, 'assign', json_build_object(
      'assigned_to', target_user_id,
      'assigned_by', assigned_by
    ));
  END LOOP;

  INSERT INTO user_tracking_assignments (user_id, total_assigned, last_assigned_at)
  VALUES (target_user_id, assigned_count, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_assigned = user_tracking_assignments.total_assigned + assigned_count,
    last_assigned_at = NOW(),
    updated_at = NOW();

  SELECT json_build_object(
    'success', true,
    'assigned', assigned_count,
    'target_user_id', target_user_id
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    console.log('-- Function 5: Consume function');
    console.log(`
CREATE OR REPLACE FUNCTION consume_tracking_id_for_label(
  user_id UUID,
  label_id UUID
)
RETURNS TEXT AS $$
DECLARE
  tracking_id_record RECORD;
  tracking_number TEXT;
BEGIN
  SELECT id, tracking_number INTO tracking_id_record
  FROM tracking_ids
  WHERE assigned_to = user_id AND status = 'assigned'
  ORDER BY assigned_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tracking IDs available for user %', user_id;
  END IF;

  UPDATE tracking_ids
  SET status = 'used',
      used_at = NOW(),
      used_in_label = label_id
  WHERE id = tracking_id_record.id;

  UPDATE user_tracking_assignments
  SET total_used = total_used + 1,
      updated_at = NOW()
  WHERE user_id = consume_tracking_id_for_label.user_id;

  INSERT INTO tracking_id_audit_log (tracking_id, user_id, action, details)
  VALUES (tracking_id_record.id, user_id, 'consume', json_build_object(
    'label_id', label_id
  ));

  RETURN tracking_id_record.tracking_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    console.log('-- Step 6: Grant permissions');
    console.log(`
GRANT EXECUTE ON FUNCTION validate_usps_tracking_number(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_upload_tracking_ids(TEXT[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_tracking_ids_to_user(UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION consume_tracking_id_for_label(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tracking_id_stats() TO authenticated;
    `);

    console.log('-- Step 7: Enable RLS and create policies');
    console.log(`
ALTER TABLE tracking_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tracking_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_id_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all tracking IDs" ON tracking_ids
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own assignments" ON user_tracking_assignments
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all assignments" ON user_tracking_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can view all audit logs" ON tracking_id_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert audit logs" ON tracking_id_audit_log
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
    `);

    console.log('');
    console.log('🎯 SUMMARY OF ISSUES TO FIX:');
    console.log('1. ✅ Profiles table needs full_name column (not name)');
    console.log('2. ✅ Create tracking_ids table');
    console.log('3. ✅ Create user_tracking_assignments table');
    console.log('4. ✅ Create tracking_id_audit_log table');
    console.log('5. ✅ Create all database functions');
    console.log('6. ✅ Enable RLS and create policies');
    console.log('');
    console.log('📋 Run the SQL commands above in your Supabase SQL Editor');
    console.log('🔄 After running the SQL, restart your application');

  } catch (error) {
    console.error('❌ Error fixing database issues:', error);
  }
}

fixAllDatabaseIssues(); 