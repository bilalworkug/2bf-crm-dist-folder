-- =============================================================
-- DEFINITIVE FIX: Production Scanning RLS + RPC
-- Run this ENTIRE script in the Supabase SQL Editor.
-- =============================================================

-- 0. Drop ALL old overloads of fn_produce_box
DROP FUNCTION IF EXISTS public.fn_produce_box(character varying, uuid, uuid, character varying);
DROP FUNCTION IF EXISTS public.fn_produce_box(text, uuid, uuid);

-- 1. Fix RLS policies on production_scans
--    Remove the broken write policy that uses user_has_role() (which queries auth.users)
--    Replace with a simple, correct policy.
DROP POLICY IF EXISTS "write_production_scans" ON public.production_scans;
DROP POLICY IF EXISTS "Allow all modifications if authenticated" ON public.production_scans;
DROP POLICY IF EXISTS "Production scans visibility" ON public.production_scans;
DROP POLICY IF EXISTS "read_production_scans" ON public.production_scans;
DROP POLICY IF EXISTS "production_scans_select" ON public.production_scans;
DROP POLICY IF EXISTS "production_scans_insert" ON public.production_scans;
DROP POLICY IF EXISTS "production_scans_admin_modify" ON public.production_scans;
DROP POLICY IF EXISTS "production_scans_admin_delete" ON public.production_scans;

-- SELECT: any authenticated user (excluding accounts)
CREATE POLICY "production_scans_select" ON public.production_scans
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: only production-related roles can insert directly (as a safety net; the RPC is the primary path)
CREATE POLICY "production_scans_insert" ON public.production_scans
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'production', 'production_manager', 'manager')
    )
  );

-- UPDATE/DELETE: admin only
CREATE POLICY "production_scans_admin_modify" ON public.production_scans
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "production_scans_admin_delete" ON public.production_scans
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- 2. Fix RLS policies on barcode_history (same issue)
DROP POLICY IF EXISTS "Barcode history visibility" ON public.barcode_history;
DROP POLICY IF EXISTS "Allow all modifications if authenticated" ON public.barcode_history;
DROP POLICY IF EXISTS "barcode_history_select" ON public.barcode_history;
DROP POLICY IF EXISTS "barcode_history_insert" ON public.barcode_history;

CREATE POLICY "barcode_history_select" ON public.barcode_history
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "barcode_history_insert" ON public.barcode_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- 3. Recreate fn_produce_box as SECURITY DEFINER with search_path pinned
CREATE OR REPLACE FUNCTION public.fn_produce_box(
  p_barcode text,
  p_product_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_count integer;
BEGIN
  -- 1. Validate inputs
  IF p_barcode IS NULL OR p_barcode = '' THEN
    RAISE EXCEPTION 'Invalid barcode.';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in.';
  END IF;

  -- 2. Internal Role Validation (queries profiles directly, NOT auth.users)
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  
  IF v_role IS NULL OR v_role NOT IN ('admin', 'production', 'production_manager', 'manager') THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'unauthorized_scan_attempt', 'production_scans', NULL,
            jsonb_build_object('barcode', p_barcode, 'role', COALESCE(v_role, 'unknown')));
    RAISE EXCEPTION 'You do not have permission to record production scans.';
  END IF;

  -- 3. Duplicate Prevention
  SELECT count(*) INTO v_count FROM public.production_scans WHERE barcode = p_barcode;
  IF v_count > 0 THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'duplicate_scan_attempt', 'production_scans', NULL,
            jsonb_build_object('barcode', p_barcode));
    RAISE EXCEPTION 'Barcode already exists.';
  END IF;

  -- 4. Perform insertions
  INSERT INTO public.boxes (barcode, product_id)
  VALUES (p_barcode, p_product_id);

  INSERT INTO public.production_scans (barcode, product_id, scanned_by, scanned_at)
  VALUES (p_barcode, p_product_id, p_user_id, now());

  INSERT INTO public.barcode_history (barcode, action, product_id, user_id, performed_at)
  VALUES (p_barcode, 'produced', p_product_id, p_user_id, now());

  -- 5. Audit log success
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'scan_produced', 'production_scans', NULL,
          jsonb_build_object('barcode', p_barcode, 'product_id', p_product_id));

EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('Barcode already exists.', 'You do not have permission to record production scans.', 'Invalid barcode.', 'You must be logged in.') THEN
      RAISE;
    ELSE
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (auth.uid(), 'scan_error', 'production_scans', NULL,
              jsonb_build_object('barcode', p_barcode, 'error', SQLERRM));
      RAISE EXCEPTION 'Scan failed due to a system error. Please retry.';
    END IF;
END;
$$;
