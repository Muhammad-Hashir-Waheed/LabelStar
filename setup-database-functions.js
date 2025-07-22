const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabaseFunctions() {
  console.log('🚀 Setting up database functions...');

  try {
    // 1. Create validation function
    console.log('📝 Creating validation function...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION validate_usps_tracking_number(tracking_number TEXT)
        RETURNS BOOLEAN AS $$
        BEGIN
          -- Remove spaces and check if it's a valid USPS tracking number
          -- USPS tracking numbers are typically 20-22 digits
          RETURN tracking_number ~ '^[0-9]{20,22}$';
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
      `
    });
    console.log('✅ Validation function created');

    // 2. Create bulk upload function
    console.log('📝 Creating bulk upload function...');
    await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });
    console.log('✅ Bulk upload function created');

    // 3. Create assign function
    console.log('📝 Creating assign function...');
    await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });
    console.log('✅ Assign function created');

    // 4. Create consume function
    console.log('📝 Creating consume function...');
    await supabase.rpc('exec_sql', {
      sql: `
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

          -- Mark the tracking ID as used
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
      `
    });
    console.log('✅ Consume function created');

    // 5. Create stats function
    console.log('📝 Creating stats function...');
    await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });
    console.log('✅ Stats function created');

    // 6. Grant permissions
    console.log('🔑 Granting permissions...');
    await supabase.rpc('exec_sql', {
      sql: `
        GRANT EXECUTE ON FUNCTION validate_usps_tracking_number(TEXT) TO authenticated;
        GRANT EXECUTE ON FUNCTION bulk_upload_tracking_ids(TEXT[], UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION assign_tracking_ids_to_user(UUID, INTEGER, UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION consume_tracking_id_for_label(UUID, UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION get_tracking_id_stats() TO authenticated;
      `
    });
    console.log('✅ Permissions granted');

    console.log('🎉 All database functions have been created successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Go to /admin/tracking-ids to upload tracking IDs');
    console.log('2. Assign tracking IDs to users');
    console.log('3. Users can now generate labels with tracking IDs');

  } catch (error) {
    console.error('❌ Error setting up database functions:', error);
    process.exit(1);
  }
}

setupDatabaseFunctions(); 