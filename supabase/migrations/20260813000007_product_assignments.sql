-- =========================================================================
-- Phase 18: Dynamic Product Catalog & Production User Assignments
-- =========================================================================

-- 1. Add active column to products
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'active') THEN
    ALTER TABLE public.products ADD COLUMN active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- 2. Create product_production_assignments table
CREATE TABLE IF NOT EXISTS public.product_production_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  production_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  active BOOLEAN DEFAULT true,
  UNIQUE(product_id, production_user_id)
);

-- RLS for assignments
ALTER TABLE public.product_production_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
CREATE POLICY "Admins can manage product assignments"
  ON public.product_production_assignments
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Production users can read their own active assignments
CREATE POLICY "Production users can read their own assignments"
  ON public.product_production_assignments
  FOR SELECT
  USING (
    production_user_id = auth.uid()
  );


-- 4. Harden fn_produce_box to enforce product assignments
CREATE OR REPLACE FUNCTION public.fn_produce_box(
  p_barcode text,
  p_product_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_count integer;
  v_product_active boolean;
  v_assigned boolean;
BEGIN
  -- 1. Validate inputs
  IF p_barcode IS NULL OR p_barcode = '' THEN
    RAISE EXCEPTION 'Invalid barcode.';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in.';
  END IF;

  -- 2. Internal Role Validation
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  
  IF v_role IS NULL OR v_role NOT IN ('admin', 'production', 'production_manager', 'manager') THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'unauthorized_scan_attempt', 'production_scans', NULL,
            jsonb_build_object('barcode', p_barcode, 'role', COALESCE(v_role, 'unknown')));
    RAISE EXCEPTION 'You do not have permission to record production scans.';
  END IF;

  -- 3. Product Active Check
  SELECT active INTO v_product_active FROM public.products WHERE id = p_product_id;
  IF v_product_active IS NULL THEN
    RAISE EXCEPTION 'Product does not exist.';
  END IF;
  
  IF NOT v_product_active THEN
    RAISE EXCEPTION 'You cannot produce a deactivated product.';
  END IF;

  -- 4. Assignment Check (only strict for production roles)
  IF v_role = 'production' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.product_production_assignments
      WHERE product_id = p_product_id
        AND production_user_id = auth.uid()
        AND active = true
    ) INTO v_assigned;

    IF NOT v_assigned THEN
      RAISE EXCEPTION 'You are not assigned to produce this product.';
    END IF;
  END IF;

  -- 5. Duplicate Prevention
  SELECT count(*) INTO v_count FROM public.production_scans WHERE barcode = p_barcode;
  IF v_count > 0 THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'duplicate_scan_attempt', 'production_scans', NULL,
            jsonb_build_object('barcode', p_barcode));
    RAISE EXCEPTION 'Barcode already exists.';
  END IF;

  -- 6. Perform insertions
  INSERT INTO public.boxes (barcode, product_id)
  VALUES (p_barcode, p_product_id);

  INSERT INTO public.production_scans (barcode, product_id, scanned_by, scanned_at)
  VALUES (p_barcode, p_product_id, auth.uid(), now());

  INSERT INTO public.barcode_history (barcode, action, product_id, user_id, performed_at)
  VALUES (p_barcode, 'produced', p_product_id, auth.uid(), now());

  -- 7. Audit log success
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'scan_produced', 'production_scans', NULL,
          jsonb_build_object('barcode', p_barcode, 'product_id', p_product_id));

EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN (
      'Barcode already exists.', 
      'You do not have permission to record production scans.', 
      'Invalid barcode.', 
      'You must be logged in.',
      'Product does not exist.',
      'You cannot produce a deactivated product.',
      'You are not assigned to produce this product.'
    ) THEN
      RAISE;
    ELSE
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (auth.uid(), 'scan_error', 'production_scans', NULL,
              jsonb_build_object('barcode', p_barcode, 'error', SQLERRM));
      RAISE EXCEPTION 'Scan failed due to a system error. Please retry.';
    END IF;
END;
$$;
