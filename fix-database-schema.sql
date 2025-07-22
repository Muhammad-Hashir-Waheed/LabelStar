-- Step 1: Add full_name column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Update existing records to use email as full_name if it's null
UPDATE profiles SET full_name = email WHERE full_name IS NULL;
UPDATE profiles SET role = 'user' WHERE role IS NULL;

-- Step 2: Create tracking_ids table with proper foreign key
CREATE TABLE IF NOT EXISTS tracking_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'used')),
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  used_at TIMESTAMP WITH TIME ZONE,
  used_in_label UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_tracking_ids_assigned_to FOREIGN KEY (assigned_to) REFERENCES auth.users(id)
);

-- Step 3: Create user_tracking_assignments table
CREATE TABLE IF NOT EXISTS user_tracking_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  total_assigned INTEGER DEFAULT 0,
  total_used INTEGER DEFAULT 0,
  last_assigned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create tracking_id_audit_log table
CREATE TABLE IF NOT EXISTS tracking_id_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id UUID REFERENCES tracking_ids(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: Create the get_tracking_id_stats function
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
          'full_name', p.full_name,
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

-- Step 6: Create bulk_upload_tracking_ids function
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

-- Step 7: Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_tracking_id_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_upload_tracking_ids(TEXT[], UUID) TO authenticated;

-- Step 8: Enable RLS and create policies
ALTER TABLE tracking_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tracking_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_id_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies for tracking_ids
CREATE POLICY "Admins can manage all tracking IDs" ON tracking_ids
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Policies for user_tracking_assignments
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

-- Policies for tracking_id_audit_log
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