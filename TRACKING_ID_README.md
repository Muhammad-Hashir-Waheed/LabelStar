# Tracking ID Management System

## Overview
This system adds comprehensive Tracking ID Management functionality to your USPS shipping label application. It allows admins to upload, assign, and manage USPS tracking IDs, while users can only generate labels when they have available tracking IDs.

## Features

### Admin Features
- ✅ **Bulk Upload**: Upload tracking IDs via CSV/XLSX files
- ✅ **User Assignment**: Assign specific quantities to users
- ✅ **Statistics Dashboard**: View totals, assignments, and usage
- ✅ **Revoke Functionality**: Remove assignments from users
- ✅ **Audit Trail**: Track all operations

### User Features
- ✅ **Quota Display**: Show available tracking IDs
- ✅ **Automatic Consumption**: Tracking IDs consumed when labels generated
- ✅ **Prevention**: Users can't generate labels without tracking IDs

### Technical Features
- ✅ **Data Integrity**: Unique tracking IDs, no reuse
- ✅ **Performance**: Indexed tables, efficient queries
- ✅ **Scalability**: Handles thousands of tracking IDs
- ✅ **Security**: RLS policies, admin-only functions

## Database Schema

### Tables Created
1. **`tracking_ids`** - Stores all USPS tracking IDs with status
2. **`user_tracking_assignments`** - Tracks user quotas and assignments
3. **`tracking_id_audit_log`** - Audit trail for all operations

### Functions Created
1. **`bulk_upload_tracking_ids()`** - Upload tracking IDs from CSV
2. **`assign_tracking_ids_to_user()`** - Assign IDs to users
3. **`consume_tracking_id_for_label()`** - Consume ID for label generation
4. **`get_tracking_id_stats()`** - Get statistics

## Setup Instructions

### 1. Run Database Setup
```bash
node setup-tracking-ids.js
```

### 2. Access Admin Interface
Navigate to `/admin/tracking-ids` to:
- Upload tracking IDs via CSV/XLSX
- Assign tracking IDs to users
- View statistics and assignments
- Revoke assignments if needed

### 3. User Experience
Users will see a tracking ID dashboard on the shipping label page showing:
- Available tracking IDs
- Usage statistics
- Generate button (disabled if no IDs available)

## File Structure

```
├── app/admin/tracking-ids/page.tsx    # Admin tracking ID management
├── components/TrackingIdDashboard.tsx  # User tracking ID dashboard
├── lib/trackingIdUtils.ts             # Utility functions
├── setup-tracking-ids.js              # Database setup script
└── tracking-id-schema.sql             # Database schema
```

## Usage Examples

### Upload Tracking IDs
1. Prepare CSV file with tracking numbers (one per line)
2. Go to Admin → Tracking IDs → Upload Tracking IDs
3. Select file and upload
4. System validates and imports tracking numbers

### Assign to Users
1. Go to Admin → Tracking IDs → Assign to User
2. Select user and quantity
3. System assigns tracking IDs from available pool

### Generate Labels
1. Users see tracking ID status on shipping label page
2. Click "Generate Label with Tracking ID"
3. System automatically consumes one tracking ID
4. Label generated with valid tracking number

## Tracking Number Format
- **Input**: `9300 1201 1141 1476 2251 30` (with or without spaces)
- **Storage**: `9300120111411476225130` (cleaned)
- **Display**: `9300 1201 1141 1476 2251 30` (formatted)

## Security
- RLS policies ensure users can only see their own assignments
- Admins can manage all tracking IDs
- Audit trail tracks all operations
- No tracking ID reuse (once used, never available again)

## Performance
- Indexed tables for fast queries
- Efficient bulk operations
- Scalable to thousands of tracking IDs
- Optimized for concurrent usage

## Troubleshooting

### Common Issues
1. **"No tracking IDs available"** - Admin needs to assign tracking IDs
2. **"Invalid tracking number format"** - Ensure 20-22 digit numbers
3. **"Not enough available tracking IDs"** - Upload more tracking IDs

### Database Issues
1. Run setup script again if tables missing
2. Check RLS policies if access denied
3. Verify function permissions

## Support
For issues or questions, check:
1. Database logs for errors
2. Browser console for frontend errors
3. Network tab for API failures 