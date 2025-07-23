# E-Con Den: USPS Shipping Label & Tracking ID Management

## Overview

**E-Con Den** is a web application for managing USPS shipping labels and tracking IDs, designed for organizations that need to assign, track, and audit shipping label usage across multiple users. It features robust admin controls, user dashboards, and secure, scalable tracking ID management.

---

## Features

### User Features

- **Dashboard**: View assigned, used, and available tracking IDs.
- **Label Generation**: Create USPS shipping labels with assigned tracking IDs.
- **Label History**: Access and download all previously generated labels.
- **Bulk Upload**: Generate multiple labels at once via spreadsheet upload.
- **Role-based Access**: Users see only their own data; admins have full oversight.

### Admin Features

- **Tracking ID Management**: Upload, assign, and revoke USPS tracking IDs in bulk.
- **User Assignment**: Allocate tracking ID quotas to users.
- **Statistics Dashboard**: Monitor label and tracking ID usage.
- **Audit Trail**: Track all tracking ID operations.
- **Label Oversight**: View, search, and manage all generated labels.

### Security

- **Row-Level Security (RLS)**: Ensures users only access their own data.
- **Admin Controls**: Only admins can manage tracking IDs and view all labels.
- **Audit Logging**: All tracking ID operations are logged.

---

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS, Radix UI
- **Backend/DB**: Supabase (Postgres, Auth, RLS)
- **PDF/Barcode**: jsPDF, next-barcode, qrcode.react
- **Other**: XLSX for spreadsheet import/export

---

## Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd <your-repo-directory>
```

### 2. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 3. Environment Variables

Create a `.env.local` file with your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### 4. Database Setup

#### a. Tracking ID System

Run the setup script to create tracking ID tables and functions:

```bash
node setup-tracking-ids.js
```

#### b. Shipping Labels Table

Run the SQL in `setup-shipping-labels.sql` in your Supabase SQL editor to create the `shipping_labels` table and related policies.

#### c. (Optional) Other Setup Scripts

You may also want to run:
- `setup-database-functions.js`
- `setup-shipping-labels.js`

### 5. Start the App

```bash
npm run dev
# or
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## Usage

### User Flow

1. **Login**: Users sign in and are redirected to their dashboard.
2. **Dashboard**: See tracking ID status and label history.
3. **Generate Label**: Create a new shipping label (only if tracking IDs are available).
4. **Bulk Upload**: Upload a spreadsheet to generate multiple labels.
5. **Download/View**: Access and download previously generated labels.

### Admin Flow

1. **Login**: Admins access the admin dashboard.
2. **Tracking IDs**: Upload and assign tracking IDs to users.
3. **User Management**: Assign quotas, revoke access, and monitor usage.
4. **Label Oversight**: View, search, and manage all labels in the system.

---

## File Structure

```
app/
  admin/           # Admin dashboard and management pages
  user/            # User dashboard and label generation
  single-label/    # Individual label view
  auth/            # Authentication pages
components/        # Reusable UI components
lib/               # Utility functions (Supabase, tracking, etc.)
scripts/           # Setup and migration scripts
public/            # Static assets
```

---

## Database Schema

- **tracking_ids**: All USPS tracking IDs, status, assignment, and usage.
- **user_tracking_assignments**: Tracks user quotas and usage.
- **tracking_id_audit_log**: Logs all tracking ID operations.
- **shipping_labels**: Stores all generated shipping labels and metadata.

See `setup-tracking-ids.js` and `setup-shipping-labels.sql` for full schema and policies.

---

## Troubleshooting

- **"No tracking IDs available"**: Admin must assign more tracking IDs.
- **"Label not found"**: Ensure the `shipping_labels` table exists and is populated.
- **Permission denied**: Check RLS policies and Supabase permissions.
- **Missing environment variables**: Ensure `.env.local` is set up correctly.

---

## Support

- Check browser console and network tab for errors.
- Review Supabase logs for database issues.
- See `USER_DASHBOARD_SETUP.md` and `TRACKING_ID_README.md` for detailed guides.

---

## License

MIT (or your chosen license)

---

**For more details, see the included `USER_DASHBOARD_SETUP.md` and `TRACKING_ID_README.md` files.**
