-- 20260805000000_fix_production_scan.sql

-- 1. Fix user_has_role to handle auth.uid() mismatch by falling back to email matching.
-- This ensures that if auth.users and profiles get out of sync on ID, the mapping still works securely.
CREATE OR REPLACE FUNCTION public.user_has_role(allowed_roles text[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN auth.users u ON u.email = p.email
    WHERE (p.id = auth.uid() OR u.id = auth.uid()) 
      AND p.role = ANY(allowed_roles)
  );
$$;

-- 2. Fix get_current_role mapping
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN
    SELECT p.role INTO v_role 
    FROM public.profiles p 
    JOIN auth.users u ON u.email = p.email 
    WHERE u.id = auth.uid();
  END IF;
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix get_current_warehouse_id mapping
CREATE OR REPLACE FUNCTION public.get_current_warehouse_id()
RETURNS uuid AS $$
DECLARE
  v_wh_id uuid;
BEGIN
  SELECT warehouse_id INTO v_wh_id FROM public.profiles WHERE id = auth.uid();
  IF v_wh_id IS NULL THEN
    SELECT p.warehouse_id INTO v_wh_id 
    FROM public.profiles p 
    JOIN auth.users u ON u.email = p.email 
    WHERE u.id = auth.uid();
  END IF;
  RETURN v_wh_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-create the write_production_scans policy to include production_manager.
-- We drop and re-create it.
DROP POLICY IF EXISTS "write_production_scans" ON public.production_scans;
CREATE POLICY "write_production_scans" ON public.production_scans FOR ALL
  TO authenticated
  USING (public.user_has_role(ARRAY['admin', 'production', 'production_manager', 'manager']))
  WITH CHECK (public.user_has_role(ARRAY['admin', 'production', 'production_manager', 'manager']));

-- 5. Create or Replace fn_produce_box with SECURITY INVOKER
-- SECURITY INVOKER ensures it runs with the privileges of the caller (the authenticated user).
-- This means policies that apply to 'authenticated' will properly evaluate, preventing RLS violations.
CREATE OR REPLACE FUNCTION public.fn_produce_box(
  p_barcode text,
  p_product_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Validate inputs
  IF p_barcode IS NULL OR p_barcode = '' THEN
    RAISE EXCEPTION 'Barcode cannot be empty';
  END IF;

  -- Insert into production_scans
  INSERT INTO public.production_scans (barcode, product_id, scanned_by, scanned_at)
  VALUES (p_barcode, p_product_id, p_user_id, now());

  -- Insert into boxes
  -- Assuming boxes has barcode and product_id at a minimum.
  INSERT INTO public.boxes (barcode, product_id)
  VALUES (p_barcode, p_product_id);

  -- Insert into barcode_history
  INSERT INTO public.barcode_history (barcode, action, product_id, user_id, performed_at)
  VALUES (p_barcode, 'produced', p_product_id, p_user_id, now());
END;
$$;
