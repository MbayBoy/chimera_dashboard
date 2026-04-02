-- Chimera v5.1 - Backup History & RBAC Schema
-- Migration: 20260227160000_backup_rbac_schema.sql

-- ============================================================
-- STEP 1: Add role constraint to user_profiles (already has role TEXT)
-- Update default role values to match RBAC system
-- ============================================================

-- Update existing user role to 'admin' if it's 'user'
UPDATE public.user_profiles SET role = 'admin' WHERE role = 'user' AND email LIKE '%admin%';

-- ============================================================
-- STEP 2: Create Backup_History table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.backup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id TEXT NOT NULL UNIQUE,
  restore_point_name TEXT NOT NULL,
  backup_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  database_size_mb DECIMAL(10,2) DEFAULT 0.00,
  table_count INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  backup_type TEXT NOT NULL DEFAULT 'scheduled',
  compression_ratio DECIMAL(5,2) DEFAULT 1.00,
  included_tables JSONB DEFAULT '[]',
  integrity_verified BOOLEAN DEFAULT false,
  retention_days INT DEFAULT 30,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backup_history_timestamp ON public.backup_history(backup_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_backup_history_status ON public.backup_history(status);

-- ============================================================
-- STEP 3: Enable RLS
-- ============================================================
ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 4: Helper functions for RBAC (BEFORE policies)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- STEP 5: RLS Policies for backup_history
-- ============================================================
DROP POLICY IF EXISTS "authenticated_view_backups" ON public.backup_history;
CREATE POLICY "authenticated_view_backups"
ON public.backup_history
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "admin_manage_backups" ON public.backup_history;
CREATE POLICY "admin_manage_backups"
ON public.backup_history
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- STEP 6: Update user_profiles RLS to allow admin to manage all users
-- ============================================================
DROP POLICY IF EXISTS "admin_manage_all_users" ON public.user_profiles;
CREATE POLICY "admin_manage_all_users"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (id = auth.uid() OR public.is_admin());

-- ============================================================
-- STEP 7: Mock backup data
-- ============================================================
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM public.user_profiles LIMIT 1;

  IF admin_id IS NOT NULL THEN
    INSERT INTO public.backup_history (
      id, backup_id, restore_point_name, backup_timestamp, database_size_mb,
      table_count, status, backup_type, compression_ratio, included_tables,
      integrity_verified, retention_days, notes, created_by
    ) VALUES
    (
      gen_random_uuid(),
      'bkp_20260227_030000',
      'Daily Backup - Feb 27 2026',
      NOW() - INTERVAL '1 hour',
      2847.50, 13, 'completed', 'scheduled', 3.2,
      '["servers","domains","contacts","campaigns","system_logs","anomalies","user_profiles","costs","transactions","contact_lists","campaign_queue","verification_jobs","complaint_reports"]'::jsonb,
      true, 30, 'Automated daily backup completed successfully', admin_id
    ),
    (
      gen_random_uuid(),
      'bkp_20260226_030000',
      'Daily Backup - Feb 26 2026',
      NOW() - INTERVAL '25 hours',
      2801.20, 13, 'completed', 'scheduled', 3.1,
      '["servers","domains","contacts","campaigns","system_logs","anomalies","user_profiles","costs","transactions","contact_lists","campaign_queue","verification_jobs","complaint_reports"]'::jsonb,
      true, 30, 'Automated daily backup completed successfully', admin_id
    ),
    (
      gen_random_uuid(),
      'bkp_20260225_030000',
      'Daily Backup - Feb 25 2026',
      NOW() - INTERVAL '49 hours',
      2756.80, 13, 'completed', 'scheduled', 3.0,
      '["servers","domains","contacts","campaigns","system_logs","anomalies","user_profiles","costs","transactions","contact_lists","campaign_queue","verification_jobs","complaint_reports"]'::jsonb,
      true, 30, 'Automated daily backup completed successfully', admin_id
    ),
    (
      gen_random_uuid(),
      'bkp_20260224_030000',
      'Daily Backup - Feb 24 2026',
      NOW() - INTERVAL '73 hours',
      2710.40, 13, 'completed', 'scheduled', 2.9,
      '["servers","domains","contacts","campaigns","system_logs","anomalies","user_profiles","costs","transactions","contact_lists","campaign_queue","verification_jobs","complaint_reports"]'::jsonb,
      true, 30, 'Automated daily backup completed successfully', admin_id
    ),
    (
      gen_random_uuid(),
      'bkp_20260223_030000',
      'Daily Backup - Feb 23 2026',
      NOW() - INTERVAL '97 hours',
      2698.10, 13, 'failed', 'scheduled', 0,
      '[]'::jsonb,
      false, 30, 'Backup failed: disk space insufficient on backup volume', admin_id
    ),
    (
      gen_random_uuid(),
      'bkp_20260222_030000',
      'Daily Backup - Feb 22 2026',
      NOW() - INTERVAL '121 hours',
      2645.30, 13, 'completed', 'scheduled', 2.8,
      '["servers","domains","contacts","campaigns","system_logs","anomalies","user_profiles","costs","transactions","contact_lists","campaign_queue","verification_jobs","complaint_reports"]'::jsonb,
      true, 30, 'Automated daily backup completed successfully', admin_id
    ),
    (
      gen_random_uuid(),
      'bkp_manual_20260221',
      'Pre-Deploy Snapshot - Feb 21 2026',
      NOW() - INTERVAL '145 hours',
      2612.70, 13, 'completed', 'manual', 2.7,
      '["servers","domains","contacts","campaigns","system_logs","anomalies","user_profiles","costs","transactions","contact_lists","campaign_queue","verification_jobs","complaint_reports"]'::jsonb,
      true, 90, 'Manual backup before v5.0 deployment', admin_id
    )
    ON CONFLICT (backup_id) DO NOTHING;

    -- Log backup operations to system_logs
    INSERT INTO public.system_logs (id, log_level, source, message)
    VALUES
      (gen_random_uuid(), 'INFO', 'BackupScheduler', 'Daily backup bkp_20260227_030000 completed successfully. Size: 2847.50 MB, Tables: 13, Compression: 3.2x'),
      (gen_random_uuid(), 'ERROR', 'BackupScheduler', 'Daily backup bkp_20260223_030000 FAILED: disk space insufficient on backup volume. Alert escalated.'),
      (gen_random_uuid(), 'INFO', 'BackupScheduler', 'Manual backup bkp_manual_20260221 created by admin. Retention: 90 days')
    ON CONFLICT (id) DO NOTHING;

    -- Update admin user role
    UPDATE public.user_profiles SET role = 'admin' WHERE id = admin_id;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;
