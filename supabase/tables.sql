-- Table: profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  PRIMARY KEY (id)
);

-- Table: label_quotas
CREATE TABLE IF NOT EXISTS label_quotas (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  total_labels_allowed INTEGER NOT NULL DEFAULT 0,
  labels_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: labels_generated (renamed to shipping_labels for consistency)
CREATE TABLE IF NOT EXISTS shipping_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  tracking_number TEXT,
  label_data JSONB,
  status TEXT DEFAULT 'generated',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: system_settings
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

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Label quotas policies
CREATE POLICY "Users can view their own quota" ON label_quotas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own quota labels_used" ON label_quotas
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all quotas" ON label_quotas
  FOR ALL USING (
    auth.role() = 'service_role' OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Shipping labels policies
CREATE POLICY "Users can insert their own labels" ON shipping_labels
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select their own labels" ON shipping_labels
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can select all labels" ON shipping_labels
  FOR SELECT USING (
    auth.role() = 'service_role' OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete all labels" ON shipping_labels
  FOR DELETE USING (
    auth.role() = 'service_role' OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- System settings policies (admin only)
CREATE POLICY "Admins can manage system settings" ON system_settings
  FOR ALL USING (
    auth.role() = 'service_role' OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create trigger for new user signups
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

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default system settings
INSERT INTO system_settings (id, default_quota, allow_bulk_upload, require_approval, max_file_size, allowed_file_types)
VALUES (
  gen_random_uuid(),
  100,
  true,
  false,
  5,
  ARRAY['pdf', 'png', 'jpg']
) ON CONFLICT DO NOTHING;

-- Insert admin user profile (if not exists)
INSERT INTO profiles (id, email, role)
VALUES ('6f8ba534-4232-49b6-9c3c-778faed67b93', 'hashirwaheed07@outlook.com', 'admin')
ON CONFLICT (id) DO UPDATE
SET role = 'admin'; 