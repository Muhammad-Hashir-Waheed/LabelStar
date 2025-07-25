const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupTrackingIds() {
  try {
    console.log('🚀 Setting up Tracking ID Management...');

    // 1. Create tracking_ids table
    console.log('📋 Creating tracking_ids table...');
    const { error: trackingIdsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS tracking_ids (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tracking_number TEXT UNIQUE NOT NULL,
          status TEXT DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'used')),
          assigned_to UUID REFERENCES auth.users(id),
          assigned_at TIMESTAMP WITH TIME ZONE,
          used_at TIMESTAMP WITH TIME ZONE,
          used_in_label UUID REFERENCES shipping_labels(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_by UUID REFERENCES auth.users(id),
          notes TEXT
        );
      `
    });

    if (trackingIdsError) {
      console.log('Note: tracking_ids table may already exist');
    } else {
      console.log('✅ tracking_ids table created');
    }

    // 2. Create user_tracking_assignments table
    console.log('📋 Creating user_tracking_assignments table...');
    const { error: assignmentsError } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });

    if (assignmentsError) {
      console.log('Note: user_tracking_assignments table may already exist');
    } else {
      console.log('✅ user_tracking_assignments table created');
    }

    // 3. Create tracking_id_audit_log table
    console.log('📋 Creating tracking_id_audit_log table...');
    const { error: auditError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS tracking_id_audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tracking_id UUID REFERENCES tracking_ids(id),
          user_id UUID REFERENCES auth.users(id),
          action TEXT NOT NULL,
          details JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (auditError) {
      console.log('Note: tracking_id_audit_log table may already exist');
    } else {
      console.log('✅ tracking_id_audit_log table created');
    }

    // 4. Enable RLS
    console.log('🔒 Enabling RLS...');
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE tracking_ids ENABLE ROW LEVEL SECURITY;
        ALTER TABLE user_tracking_assignments ENABLE ROW LEVEL SECURITY;
        ALTER TABLE tracking_id_audit_log ENABLE ROW LEVEL SECURITY;
      `
    });
    console.log('✅ RLS enabled');

    // 5. Create indexes
    console.log('📊 Creating indexes...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_tracking_ids_status ON tracking_ids(status);
        CREATE INDEX IF NOT EXISTS idx_tracking_ids_assigned_to ON tracking_ids(assigned_to);
        CREATE INDEX IF NOT EXISTS idx_tracking_ids_tracking_number ON tracking_ids(tracking_number);
        CREATE INDEX IF NOT EXISTS idx_user_tracking_assignments_user_id ON user_tracking_assignments(user_id);
        CREATE INDEX IF NOT EXISTS idx_tracking_id_audit_log_tracking_id ON tracking_id_audit_log(tracking_id);
        CREATE INDEX IF NOT EXISTS idx_tracking_id_audit_log_user_id ON tracking_id_audit_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_tracking_id_audit_log_created_at ON tracking_id_audit_log(created_at);
      `
    });
    console.log('✅ Indexes created');

    // 6. Create functions
    console.log('⚙️ Creating functions...');
    
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

    console.log('✅ Functions created');

    // 7. Create RLS policies
    console.log('🔐 Creating RLS policies...');
    await supabase.rpc('exec_sql', {
      sql: `
        DROP POLICY IF EXISTS "Admins can manage all tracking IDs" ON tracking_ids;
        CREATE POLICY "Admins can manage all tracking IDs" ON tracking_ids
          FOR ALL USING (
            auth.role() = 'service_role' OR 
            EXISTS (
              SELECT 1 FROM profiles 
              WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
            )
          );

        DROP POLICY IF EXISTS "Users can view their assigned tracking IDs" ON tracking_ids;
        CREATE POLICY "Users can view their assigned tracking IDs" ON tracking_ids
          FOR SELECT USING (
            assigned_to = auth.uid() OR
            EXISTS (
              SELECT 1 FROM profiles 
              WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
            )
          );

        DROP POLICY IF EXISTS "Users can view their own assignments" ON user_tracking_assignments;
        CREATE POLICY "Users can view their own assignments" ON user_tracking_assignments
          FOR SELECT USING (
            user_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM profiles 
              WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
            )
          );

        DROP POLICY IF EXISTS "Admins can manage all assignments" ON user_tracking_assignments;
        CREATE POLICY "Admins can manage all assignments" ON user_tracking_assignments
          FOR ALL USING (
            auth.role() = 'service_role' OR 
            EXISTS (
              SELECT 1 FROM profiles 
              WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
            )
          );

        DROP POLICY IF EXISTS "Admins can view all audit logs" ON tracking_id_audit_log;
        CREATE POLICY "Admins can view all audit logs" ON tracking_id_audit_log
          FOR SELECT USING (
            auth.role() = 'service_role' OR 
            EXISTS (
              SELECT 1 FROM profiles 
              WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
            )
          );
      `
    });
    console.log('✅ RLS policies created');

    // 8. Grant permissions
    console.log('🔑 Granting permissions...');
    await supabase.rpc('exec_sql', {
      sql: `
        GRANT EXECUTE ON FUNCTION bulk_upload_tracking_ids(TEXT[], UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION assign_tracking_ids_to_user(UUID, INTEGER, UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION consume_tracking_id_for_label(UUID, UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION get_tracking_id_stats() TO authenticated;
      `
    });
    console.log('✅ Permissions granted');

    // 9. Create assignments for existing users
    console.log('👥 Creating assignments for existing users...');
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id');

    if (!usersError && users) {
      for (const user of users) {
        await supabase
          .from('user_tracking_assignments')
          .upsert({
            user_id: user.id,
            total_assigned: 0,
            total_used: 0
          }, { onConflict: 'user_id' });
      }
      console.log(`✅ Created assignments for ${users.length} existing users`);
    }

    console.log('🎉 Tracking ID Management setup completed successfully!');
    console.log('');
    console.log('📊 What was created:');
    console.log('   - tracking_ids table (stores all tracking IDs)');
    console.log('   - user_tracking_assignments table (user quotas)');
    console.log('   - tracking_id_audit_log table (audit trail)');
    console.log('   - 4 database functions (upload, assign, consume, stats)');
    console.log('   - RLS policies for security');
    console.log('   - Indexes for performance');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. Go to /admin/tracking-ids to manage tracking IDs');
    console.log('   2. Upload tracking IDs via CSV/XLSX');
    console.log('   3. Assign tracking IDs to users');
    console.log('   4. Users can now generate labels with tracking IDs');

  } catch (error) {
    console.error('❌ Error setting up Tracking ID Management:', error);
    process.exit(1);
  }
}

setupTrackingIds();
