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

async function refreshSchemaCache() {
  console.log('🔄 Refreshing schema cache and recreating functions...');

  try {
    // Drop and recreate the functions to refresh the schema cache
    console.log('🗑️ Dropping existing functions...');
    
    await supabase.rpc('exec_sql', {
      sql: `
        DROP FUNCTION IF EXISTS bulk_upload_tracking_ids(TEXT[], UUID);
        DROP FUNCTION IF EXISTS assign_tracking_ids_to_user(UUID, INTEGER, UUID);
        DROP FUNCTION IF EXISTS consume_tracking_id_for_label(UUID, UUID);
        DROP FUNCTION IF EXISTS get_tracking_id_stats();
        DROP FUNCTION IF EXISTS validate_usps_tracking_number(TEXT);
      `
    });
    console.log('✅ Functions dropped');

    // Recreate the functions
    console.log('📝 Recreating functions...');
    
    // Validation function
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION validate_usps_tracking_number(tracking_number TEXT)
        RETURNS BOOLEAN AS $$
        BEGIN
          RETURN tracking_number ~ '^[0-9]{20,22}$';
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
      `
    });

    // Bulk upload function
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
      `
    });

    // Assign function
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
      `
    });

    // Consume function
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
      `
    });

    // Stats function
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

    // Grant permissions
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

    console.log('✅ All functions recreated and permissions granted');
    console.log('🔄 Schema cache should now be refreshed');

  } catch (error) {
    console.error('❌ Error refreshing schema cache:', error);
  }
}

refreshSchemaCache(); 