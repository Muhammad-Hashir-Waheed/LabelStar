-- Complete Database Setup for Tracking ID and Shipping Label System
-- Run this entire script in your Supabase SQL Editor

-- ========================================
-- 1. TRACKING ID TABLES
-- ========================================

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

-- ========================================
-- 2. SHIPPING LABELS TABLE
-- ========================================

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

-- ========================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE tracking_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tracking_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_id_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 4. CREATE INDEXES
-- ========================================

-- Tracking IDs indexes
CREATE INDEX IF NOT EXISTS idx_tracking_ids_status ON tracking_ids(status);
CREATE INDEX IF NOT EXISTS idx_tracking_ids_assigned_to ON tracking_ids(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tracking_ids_tracking_number ON tracking_ids(tracking_number);
CREATE INDEX IF NOT EXISTS idx_user_tracking_assignments_user_id ON user_tracking_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_id_audit_log_tracking_id ON tracking_id_audit_log(tracking_id);
CREATE INDEX IF NOT EXISTS idx_tracking_id_audit_log_user_id ON tracking_id_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_id_audit_log_created_at ON tracking_id_audit_log(created_at);

-- Shipping labels indexes
CREATE INDEX IF NOT EXISTS idx_shipping_labels_user_id ON shipping_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_created_at ON shipping_labels(created_at);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_tracking_number ON shipping_labels(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_status ON shipping_labels(status);

-- ========================================
-- 5. CREATE RLS POLICIES
-- ========================================

-- Tracking IDs policies
CREATE POLICY "Admins can manage all tracking IDs" ON tracking_ids
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their assigned tracking IDs" ON tracking_ids
  FOR SELECT USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update their assigned tracking IDs" ON tracking_ids
  FOR UPDATE USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- User tracking assignments policies
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

-- Audit log policies
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

-- Shipping labels policies
CREATE POLICY "Users can view their own labels" ON shipping_labels
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can insert their own labels" ON shipping_labels
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "Users can update their own labels" ON shipping_labels
  FOR UPDATE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all labels" ON shipping_labels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ========================================
-- 6. CREATE FUNCTIONS
-- ========================================

-- Function to validate USPS tracking number format
CREATE OR REPLACE FUNCTION validate_usps_tracking_number(tracking_number TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Remove spaces and check if it's a valid USPS tracking number
  -- USPS tracking numbers are typically 20-22 digits
  RETURN tracking_number ~ '^[0-9]{20,22}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to bulk upload tracking IDs
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
  -- Validate input
  IF tracking_numbers IS NULL OR array_length(tracking_numbers, 1) = 0 THEN
    RETURN json_build_object('error', 'No tracking numbers provided');
  END IF;

  -- Process each tracking number
  FOREACH tracking_number IN ARRAY tracking_numbers
  LOOP
    -- Skip empty strings
    IF tracking_number IS NULL OR trim(tracking_number) = '' THEN
      CONTINUE;
    END IF;

    -- Clean the tracking number (remove spaces, dashes, etc.)
    cleaned_number := regexp_replace(trim(tracking_number), '[^0-9]', '', 'g');

    -- Validate USPS tracking number format
    IF NOT validate_usps_tracking_number(cleaned_number) THEN
      invalid_count := invalid_count + 1;
      CONTINUE;
    END IF;

    -- Try to insert the tracking number
    BEGIN
      INSERT INTO tracking_ids (tracking_number, created_by)
      VALUES (cleaned_number, uploaded_by);
      inserted_count := inserted_count + 1;
    EXCEPTION WHEN unique_violation THEN
      duplicate_count := duplicate_count + 1;
    END;
  END LOOP;

  -- Log the bulk upload
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

-- Function to assign tracking IDs to users
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
  -- Validate inputs
  IF target_user_id IS NULL OR quantity IS NULL OR quantity <= 0 THEN
    RETURN json_build_object('error', 'Invalid parameters');
  END IF;

  -- Check if target user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
    RETURN json_build_object('error', 'Target user does not exist');
  END IF;

  -- Get count of available tracking IDs
  SELECT COUNT(*) INTO available_count
  FROM tracking_ids
  WHERE status = 'available';

  IF available_count < quantity THEN
    RETURN json_build_object('error', 'Not enough available tracking IDs', 'available', available_count, 'requested', quantity);
  END IF;

  -- Assign tracking IDs
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

    -- Log the assignment
    INSERT INTO tracking_id_audit_log (tracking_id, user_id, action, details)
    VALUES (tracking_id_record.id, assigned_by, 'assign', json_build_object(
      'assigned_to', target_user_id,
      'assigned_by', assigned_by
    ));
  END LOOP;

  -- Update user assignment record
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

-- Function to consume a tracking ID for label generation
CREATE OR REPLACE FUNCTION consume_tracking_id_for_label(
  user_id UUID,
  label_id UUID
)
RETURNS TEXT AS $$
DECLARE
  tracking_id_record RECORD;
  tracking_number TEXT;
BEGIN
  -- Get an available tracking ID for the user
  SELECT id, tracking_number INTO tracking_id_record
  FROM tracking_ids
  WHERE assigned_to = user_id AND status = 'assigned'
  ORDER BY assigned_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tracking IDs available for user %', user_id;
  END IF;

  -- Mark tracking ID as used
  UPDATE tracking_ids
  SET status = 'used',
      used_at = NOW(),
      used_in_label = label_id
  WHERE id = tracking_id_record.id;

  -- Update user assignment record
  UPDATE user_tracking_assignments
  SET total_used = total_used + 1,
      updated_at = NOW()
  WHERE user_id = consume_tracking_id_for_label.user_id;

  -- Log the consumption
  INSERT INTO tracking_id_audit_log (tracking_id, user_id, action, details)
  VALUES (tracking_id_record.id, user_id, 'consume', json_build_object(
    'label_id', label_id
  ));

  RETURN tracking_id_record.tracking_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get tracking ID statistics
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
          'user_name', p.name,
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

-- ========================================
-- 7. GRANT PERMISSIONS
-- ========================================

GRANT EXECUTE ON FUNCTION bulk_upload_tracking_ids(TEXT[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_tracking_ids_to_user(UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION consume_tracking_id_for_label(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tracking_id_stats() TO authenticated;
GRANT SELECT, INSERT, UPDATE ON shipping_labels TO authenticated;

-- ========================================
-- 8. CREATE VIEWS
-- ========================================

-- Tracking ID overview view
CREATE OR REPLACE VIEW tracking_id_overview AS
SELECT 
  t.id,
  t.tracking_number,
  t.status,
  t.assigned_to,
  t.assigned_at,
  t.used_at,
  t.used_in_label,
  t.created_at,
  p.email as assigned_user_email,
  p.name as assigned_user_name
FROM tracking_ids t
LEFT JOIN profiles p ON t.assigned_to = p.id
ORDER BY t.created_at DESC;

-- Shipping label overview view
CREATE OR REPLACE VIEW shipping_label_overview AS
SELECT 
  sl.id,
  sl.tracking_number,
  sl.recipient_name,
  sl.recipient_city,
  sl.recipient_state,
  sl.status,
  sl.created_at,
  sl.updated_at,
  p.email as user_email,
  p.name as user_name
FROM shipping_labels sl
LEFT JOIN profiles p ON sl.user_id = p.id
ORDER BY sl.created_at DESC;

GRANT SELECT ON tracking_id_overview TO authenticated;
GRANT SELECT ON shipping_label_overview TO authenticated;

-- ========================================
-- 9. COMMENTS
-- ========================================

COMMENT ON TABLE tracking_ids IS 'Stores all USPS tracking IDs with their current status';
COMMENT ON TABLE user_tracking_assignments IS 'Tracks how many tracking IDs are assigned to each user';
COMMENT ON TABLE tracking_id_audit_log IS 'Audit log for all tracking ID operations';
COMMENT ON TABLE shipping_labels IS 'Stores generated shipping labels with tracking information';
COMMENT ON VIEW tracking_id_overview IS 'Overview of all tracking IDs with user information';
COMMENT ON VIEW shipping_label_overview IS 'Overview of all shipping labels with user information';

-- ========================================
-- SETUP COMPLETE!
-- ========================================

-- The database is now ready for the tracking ID and shipping label system!
-- Users can now:
-- 1. Generate labels that are automatically saved
-- 2. View their label history in the dashboard
-- 3. Download previously generated labels
-- 4. Track which labels have been downloaded
-- 5. Manage tracking ID assignments (admins)
-- 6. Upload tracking IDs in bulk (admins) 