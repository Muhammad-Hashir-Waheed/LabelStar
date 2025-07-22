-- Shipping Labels Table for storing label history
-- This script creates the necessary table for storing generated shipping labels

-- 1. Create shipping_labels table
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

-- 2. Enable RLS on shipping_labels table
ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for shipping_labels
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

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shipping_labels_user_id ON shipping_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_created_at ON shipping_labels(created_at);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_tracking_number ON shipping_labels(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_status ON shipping_labels(status);

-- 5. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shipping_labels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger for updated_at
CREATE TRIGGER shipping_labels_updated_at
  BEFORE UPDATE ON shipping_labels
  FOR EACH ROW
  EXECUTE FUNCTION update_shipping_labels_updated_at();

-- 7. Grant permissions
GRANT SELECT, INSERT, UPDATE ON shipping_labels TO authenticated;

-- 8. Create view for label overview
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

GRANT SELECT ON shipping_label_overview TO authenticated;

COMMENT ON TABLE shipping_labels IS 'Stores generated shipping labels with tracking information';
COMMENT ON VIEW shipping_label_overview IS 'Overview of all shipping labels with user information'; 