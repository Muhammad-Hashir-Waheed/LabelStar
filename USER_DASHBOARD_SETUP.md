# User Dashboard Setup Guide

## Overview
This guide explains how to set up the user dashboard with tracking ID management and label history functionality.

## Features Implemented

### 1. User Dashboard (`/user`)
- **Tracking ID Status**: Shows assigned, used, and available tracking IDs
- **Label History**: Displays all generated labels with download/view options
- **Quick Actions**: Generate new labels, view history, download labels

### 2. Label History System
- **Persistent Storage**: All generated labels are saved to the database
- **Cross-Session Access**: Users can access their labels even after logout/login
- **Download Tracking**: Tracks which labels have been downloaded
- **Label Viewing**: Individual label pages for detailed viewing

### 3. Enhanced Navigation
- **Sidebar Navigation**: Clean sidebar navigation for users
- **Removed Top Nav**: Navigation options removed from top navbar
- **Role-Based Routing**: Users redirected to `/user` dashboard after login

## Database Setup Required

### Create shipping_labels table in Supabase:

```sql
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

-- Enable RLS
ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shipping_labels_user_id ON shipping_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_created_at ON shipping_labels(created_at);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_tracking_number ON shipping_labels(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_status ON shipping_labels(status);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON shipping_labels TO authenticated;
```

## Files Created/Modified

### New Files:
- `app/user/page.tsx` - User dashboard
- `app/user/layout.tsx` - User layout with sidebar
- `app/user/user-layout.css` - User layout styles
- `app/single-label/[id]/page.tsx` - Individual label view page
- `setup-shipping-labels.sql` - Database setup SQL
- `setup-shipping-labels.js` - Database setup script

### Modified Files:
- `components/navigation.tsx` - Removed navigation options
- `app/auth/sign-in/page.tsx` - Updated redirect to `/user`
- `app/shipping-label/page.tsx` - Added label saving functionality

## Setup Steps

1. **Run the tracking ID setup** (if not already done):
   ```bash
   node setup-tracking-ids.js
   ```

2. **Create the shipping_labels table** in Supabase:
   - Go to your Supabase dashboard
   - Navigate to SQL Editor
   - Run the SQL commands above

3. **Test the system**:
   - Login as a user
   - Navigate to `/user` dashboard
   - Generate a label
   - Check the label history
   - Test logout/login to verify persistence

## User Experience Flow

1. **Login**: User logs in and is redirected to `/user` dashboard
2. **Dashboard View**: User sees tracking ID status and recent label history
3. **Generate Label**: User clicks "Generate New Label" to go to label generator
4. **Label Creation**: Label is generated and automatically saved to database
5. **History Access**: User can view/download labels from dashboard
6. **Persistence**: Labels remain accessible after logout/login

## Features

### Tracking ID Management
- Real-time status display
- Usage statistics
- Low quantity warnings
- Quick access to label generation

### Label History
- Complete label history
- Download status tracking
- Individual label viewing
- Search and filter capabilities (future enhancement)

### Security
- Row-level security policies
- User-specific data access
- Admin oversight capabilities
- Secure label storage

## Future Enhancements

1. **Label Search**: Add search functionality to label history
2. **Bulk Operations**: Download multiple labels at once
3. **Label Templates**: Save and reuse label templates
4. **Export Options**: CSV/Excel export of label history
5. **Advanced Filtering**: Filter by date, status, recipient, etc.
6. **Label Analytics**: Usage statistics and reports

## Troubleshooting

### Common Issues:

1. **"Label not found" error**: Check if shipping_labels table exists
2. **Permission denied**: Verify RLS policies are correctly set
3. **Missing tracking IDs**: Ensure tracking ID system is set up
4. **Layout issues**: Check if user layout CSS is loaded

### Debug Steps:

1. Check browser console for errors
2. Verify database table structure
3. Test RLS policies in Supabase
4. Check user authentication status
5. Verify environment variables

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify all database tables and policies are created
3. Ensure tracking ID system is properly set up
4. Test with a fresh user account 