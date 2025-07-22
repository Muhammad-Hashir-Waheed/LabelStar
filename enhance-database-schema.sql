-- Enhance database schema for comprehensive user management
-- This script should be run in your Supabase SQL Editor

-- 1. Add name field to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS name TEXT;

-- 2. Add status field to profiles table for user management
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 3. Add last_login field to track user activity
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- 4. Add created_by field to track who created the user (for admin-created users)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 5. Create user_activity_log table for tracking user actions
CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Enable RLS on user_activity_log
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- 7. Create policies for user_activity_log
CREATE POLICY "Users can view their own activity" ON user_activity_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity" ON user_activity_log
  FOR SELECT USING (
    auth.role() = 'service_role' OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert activity logs" ON user_activity_log
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR 
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 8. Update existing profiles to have default name if null
UPDATE profiles 
SET name = COALESCE(name, email) 
WHERE name IS NULL;

-- 9. Create function to log user activity
CREATE OR REPLACE FUNCTION log_user_activity(
  p_user_id UUID,
  p_action TEXT,
  p_details JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_activity_log (user_id, action, details, ip_address, user_agent)
  VALUES (p_user_id, p_action, p_details, p_ip_address, p_user_agent);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create function to update last login
CREATE OR REPLACE FUNCTION update_last_login(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles 
  SET last_login = NOW() 
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Update the handle_new_user function to include name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, status)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'name', new.email), 'user', 'active');
  
  INSERT INTO public.label_quotas (user_id, total_labels_allowed)
  VALUES (new.id, 100);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Create admin user management policies
-- Allow admins to manage all profiles
CREATE POLICY "Admins can manage all profiles" ON profiles
  FOR ALL USING (
    auth.role() = 'service_role' OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 13. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_created_at ON user_activity_log(created_at);

-- 14. Create view for user statistics
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
  p.id,
  p.email,
  p.name,
  p.role,
  p.status,
  p.created_at,
  p.last_login,
  COUNT(sl.id) as total_labels,
  COALESCE(lq.total_labels_allowed, 0) as quota_allowed,
  COALESCE(lq.labels_used, 0) as quota_used,
  CASE 
    WHEN p.last_login > NOW() - INTERVAL '7 days' THEN 'active'
    WHEN p.last_login > NOW() - INTERVAL '30 days' THEN 'recent'
    ELSE 'inactive'
  END as activity_status
FROM profiles p
LEFT JOIN shipping_labels sl ON p.id = sl.user_id
LEFT JOIN label_quotas lq ON p.id = lq.user_id
GROUP BY p.id, p.email, p.name, p.role, p.status, p.created_at, p.last_login, lq.total_labels_allowed, lq.labels_used;

-- 15. Grant permissions on the view
GRANT SELECT ON user_statistics TO authenticated;

-- 16. Create function to get dashboard statistics
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles WHERE status = 'active'),
    'total_admins', (SELECT COUNT(*) FROM profiles WHERE role = 'admin' AND status = 'active'),
    'total_labels', (SELECT COUNT(*) FROM shipping_labels),
    'labels_today', (SELECT COUNT(*) FROM shipping_labels WHERE created_at >= CURRENT_DATE),
    'active_users_7d', (SELECT COUNT(*) FROM profiles WHERE last_login >= NOW() - INTERVAL '7 days'),
    'new_users_today', (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE),
    'quota_usage', (
      SELECT json_build_object(
        'total_quota', COALESCE(SUM(total_labels_allowed), 0),
        'used_quota', COALESCE(SUM(labels_used), 0),
        'usage_percentage', CASE 
          WHEN SUM(total_labels_allowed) > 0 
          THEN ROUND((SUM(labels_used)::DECIMAL / SUM(total_labels_allowed)::DECIMAL) * 100, 2)
          ELSE 0 
        END
      )
      FROM label_quotas
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 17. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;

-- 18. Update existing admin user to have a name
UPDATE profiles 
SET name = 'Hashir Waheed' 
WHERE email = 'hashirwaheed07@outlook.com' AND name IS NULL;

-- 19. Create function to create user with proper validation
CREATE OR REPLACE FUNCTION create_user_by_admin(
  p_email TEXT,
  p_name TEXT,
  p_password TEXT,
  p_role TEXT DEFAULT 'user',
  p_created_by UUID
)
RETURNS JSON AS $$
DECLARE
  new_user_id UUID;
  result JSON;
BEGIN
  -- Validate inputs
  IF p_email IS NULL OR p_name IS NULL OR p_password IS NULL THEN
    RETURN json_build_object('error', 'Email, name, and password are required');
  END IF;
  
  IF p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN json_build_object('error', 'Invalid email format');
  END IF;
  
  IF p_role NOT IN ('user', 'admin') THEN
    RETURN json_build_object('error', 'Invalid role. Must be user or admin');
  END IF;
  
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM profiles WHERE email = p_email) THEN
    RETURN json_build_object('error', 'User with this email already exists');
  END IF;
  
  -- Create user in auth.users (this will trigger the handle_new_user function)
  -- Note: This requires the service role to create users
  -- For now, we'll create the profile directly and return instructions
  
  -- Create profile directly
  INSERT INTO profiles (id, email, name, role, status, created_by)
  VALUES (gen_random_uuid(), p_email, p_name, p_role, 'active', p_created_by)
  RETURNING id INTO new_user_id;
  
  -- Create label quota
  INSERT INTO label_quotas (user_id, total_labels_allowed)
  VALUES (new_user_id, 100);
  
  -- Log the activity
  PERFORM log_user_activity(p_created_by, 'user_created', 
    json_build_object('created_user_id', new_user_id, 'email', p_email, 'role', p_role));
  
  SELECT json_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', p_email,
    'name', p_name,
    'role', p_role,
    'message', 'User profile created. User needs to be created in auth system with password: ' || p_password
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 20. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION create_user_by_admin(TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;

COMMENT ON TABLE profiles IS 'User profiles with enhanced fields for comprehensive user management';
COMMENT ON TABLE user_activity_log IS 'Log of user activities for audit and analytics';
COMMENT ON VIEW user_statistics IS 'Comprehensive view of user statistics and activity'; 