-- =============================================================
-- Phase 9: Product Correction & Stock Integrity
-- =============================================================

-- 1. Create correction_records table
CREATE TABLE IF NOT EXISTS public.correction_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text NOT NULL,
  correction_type text NOT NULL, -- 'production', 'warehouse', 'dispatch_reversal'
  performed_by uuid NOT NULL REFERENCES public.profiles(id),
  performed_at timestamptz DEFAULT now(),
  reason text NOT NULL,
  old_product_id uuid REFERENCES public.products(id),
  new_product_id uuid REFERENCES public.products(id),
  old_warehouse_id uuid REFERENCES public.warehouses(id),
  new_warehouse_id uuid REFERENCES public.warehouses(id),
  old_order_id uuid REFERENCES public.orders(id),
  new_order_id uuid REFERENCES public.orders(id),
  old_status text,
  new_status text,
  notes text,
  status text NOT NULL DEFAULT 'completed'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_correction_records_barcode ON public.correction_records(barcode);
CREATE INDEX IF NOT EXISTS idx_correction_records_type ON public.correction_records(correction_type);
CREATE INDEX IF NOT EXISTS idx_correction_records_date ON public.correction_records(performed_at);

-- Enable RLS
ALTER TABLE public.correction_records ENABLE ROW LEVEL SECURITY;

-- Admins and Managers can select all. Others can't see it (or only what's permitted).
CREATE POLICY "correction_records_strict_select" ON public.correction_records FOR SELECT TO authenticated
USING (
  public.auth_user_role() IN ('admin', 'manager', 'production_manager', 'warehouse_manager', 'dispatch_manager', 'reports')
);

CREATE POLICY "correction_records_strict_insert" ON public.correction_records FOR INSERT TO authenticated
WITH CHECK (
  public.auth_user_role() IN ('admin', 'manager', 'production_manager', 'warehouse_manager', 'dispatch_manager')
);


-- 2. Add status column to dispatches if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dispatches' AND column_name='status') THEN
    ALTER TABLE public.dispatches ADD COLUMN status text NOT NULL DEFAULT 'completed';
  END IF;
END $$;


-- 3. Function: Production Correction
CREATE OR REPLACE FUNCTION public.fn_correct_production_box(
  p_barcode text,
  p_new_product_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_box record;
  v_uid uuid := auth.uid();
  v_correction_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_barcode IS NULL OR trim(p_barcode) = '' THEN RAISE EXCEPTION 'Barcode required'; END IF;
  IF p_new_product_id IS NULL THEN RAISE EXCEPTION 'New product required'; END IF;
  IF p_reason IS NULL OR trim(p_reason) = '' THEN RAISE EXCEPTION 'Reason required'; END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'production_manager', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized: Only Admin or Production Manager can correct production.';
  END IF;

  SELECT * INTO v_box FROM public.boxes WHERE barcode = p_barcode;
  IF NOT FOUND THEN RAISE EXCEPTION 'Barcode not found'; END IF;

  IF v_box.product_id = p_new_product_id THEN
    RAISE EXCEPTION 'New product must be different from current product';
  END IF;

  IF v_box.status NOT IN ('produced', 'in_warehouse') THEN
    RAISE EXCEPTION 'Box must be in produced or in_warehouse status to correct production (current: %)', v_box.status;
  END IF;

  -- Create Correction Record
  INSERT INTO public.correction_records (
    barcode, correction_type, performed_by, reason, 
    old_product_id, new_product_id, old_status, new_status
  ) VALUES (
    p_barcode, 'production', v_uid, p_reason, 
    v_box.product_id, p_new_product_id, v_box.status, v_box.status
  ) RETURNING id INTO v_correction_id;

  -- Perform stock adjustments if it's already in warehouse
  IF v_box.status = 'in_warehouse' THEN
    -- Stock OUT for old product
    INSERT INTO public.stock_movements (barcode, product_id, warehouse_id, movement_type, quantity, user_id)
    VALUES (p_barcode, v_box.product_id, v_box.current_warehouse_id, 'CORRECTION_OUT', -1, v_uid);
    
    -- Stock IN for new product
    INSERT INTO public.stock_movements (barcode, product_id, warehouse_id, movement_type, quantity, user_id)
    VALUES (p_barcode, p_new_product_id, v_box.current_warehouse_id, 'CORRECTION_IN', 1, v_uid);
    
    -- Update warehouse_receipts
    UPDATE public.warehouse_receipts SET product_id = p_new_product_id WHERE barcode = p_barcode;
  END IF;

  -- Always update production_scans
  UPDATE public.production_scans SET product_id = p_new_product_id WHERE barcode = p_barcode;

  -- Update boxes
  UPDATE public.boxes SET product_id = p_new_product_id, updated_at = now() WHERE barcode = p_barcode;

  -- Add to barcode history
  INSERT INTO public.barcode_history (barcode, action, product_id, warehouse_id, user_id, notes)
  VALUES (p_barcode, 'CORRECTION_PRODUCTION', p_new_product_id, v_box.current_warehouse_id, v_uid, p_reason);

  -- Add audit log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, barcode, details)
  VALUES (v_uid, 'production_box_corrected', 'correction_records', v_correction_id, p_barcode, 
    jsonb_build_object('old_product', v_box.product_id, 'new_product', p_new_product_id, 'reason', p_reason));

END;
$$;


-- 4. Function: Warehouse Correction
CREATE OR REPLACE FUNCTION public.fn_correct_warehouse_box(
  p_barcode text,
  p_new_warehouse_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_box record;
  v_uid uuid := auth.uid();
  v_correction_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_barcode IS NULL OR trim(p_barcode) = '' THEN RAISE EXCEPTION 'Barcode required'; END IF;
  IF p_new_warehouse_id IS NULL THEN RAISE EXCEPTION 'New warehouse required'; END IF;
  IF p_reason IS NULL OR trim(p_reason) = '' THEN RAISE EXCEPTION 'Reason required'; END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'warehouse_manager', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized: Only Admin or Warehouse Manager can correct warehouse.';
  END IF;

  SELECT * INTO v_box FROM public.boxes WHERE barcode = p_barcode;
  IF NOT FOUND THEN RAISE EXCEPTION 'Barcode not found'; END IF;

  IF v_box.current_warehouse_id = p_new_warehouse_id THEN
    RAISE EXCEPTION 'New warehouse must be different from current warehouse';
  END IF;

  IF v_box.status != 'in_warehouse' THEN
    RAISE EXCEPTION 'Box must be in in_warehouse status to correct warehouse (current: %)', v_box.status;
  END IF;

  -- Create Correction Record
  INSERT INTO public.correction_records (
    barcode, correction_type, performed_by, reason, 
    old_warehouse_id, new_warehouse_id, old_status, new_status
  ) VALUES (
    p_barcode, 'warehouse', v_uid, p_reason, 
    v_box.current_warehouse_id, p_new_warehouse_id, v_box.status, v_box.status
  ) RETURNING id INTO v_correction_id;

  -- Stock OUT for old warehouse
  INSERT INTO public.stock_movements (barcode, product_id, warehouse_id, movement_type, quantity, user_id)
  VALUES (p_barcode, v_box.product_id, v_box.current_warehouse_id, 'CORRECTION_OUT', -1, v_uid);
  
  -- Stock IN for new warehouse
  INSERT INTO public.stock_movements (barcode, product_id, warehouse_id, movement_type, quantity, user_id)
  VALUES (p_barcode, v_box.product_id, p_new_warehouse_id, 'CORRECTION_IN', 1, v_uid);
  
  -- Update warehouse_receipts (take the most recent one)
  UPDATE public.warehouse_receipts 
  SET warehouse_id = p_new_warehouse_id 
  WHERE id = (SELECT id FROM public.warehouse_receipts WHERE barcode = p_barcode ORDER BY received_at DESC LIMIT 1);

  -- Update boxes
  UPDATE public.boxes SET current_warehouse_id = p_new_warehouse_id, updated_at = now() WHERE barcode = p_barcode;

  -- Add to barcode history
  INSERT INTO public.barcode_history (barcode, action, product_id, warehouse_id, user_id, notes)
  VALUES (p_barcode, 'CORRECTION_WAREHOUSE', v_box.product_id, p_new_warehouse_id, v_uid, p_reason);

  -- Add audit log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, barcode, details)
  VALUES (v_uid, 'warehouse_box_corrected', 'correction_records', v_correction_id, p_barcode, 
    jsonb_build_object('old_warehouse', v_box.current_warehouse_id, 'new_warehouse', p_new_warehouse_id, 'reason', p_reason));

END;
$$;


-- 5. Function: Dispatch Reversal
CREATE OR REPLACE FUNCTION public.fn_reverse_dispatch(
  p_barcode text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_box record;
  v_dispatch record;
  v_uid uuid := auth.uid();
  v_correction_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_barcode IS NULL OR trim(p_barcode) = '' THEN RAISE EXCEPTION 'Barcode required'; END IF;
  IF p_reason IS NULL OR trim(p_reason) = '' THEN RAISE EXCEPTION 'Reason required'; END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'dispatch_manager', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized: Only Admin or Dispatch Manager can reverse dispatch.';
  END IF;

  SELECT * INTO v_box FROM public.boxes WHERE barcode = p_barcode;
  IF NOT FOUND THEN RAISE EXCEPTION 'Barcode not found'; END IF;

  IF v_box.status != 'dispatched' THEN
    RAISE EXCEPTION 'Box must be dispatched to reverse dispatch (current: %)', v_box.status;
  END IF;

  -- Find original dispatch
  SELECT * INTO v_dispatch FROM public.dispatches WHERE barcode = p_barcode AND status = 'completed' ORDER BY dispatched_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Could not find active dispatch record for this barcode'; END IF;

  -- Create Correction Record
  INSERT INTO public.correction_records (
    barcode, correction_type, performed_by, reason, 
    old_status, new_status, old_warehouse_id, new_warehouse_id, old_order_id, new_order_id
  ) VALUES (
    p_barcode, 'dispatch_reversal', v_uid, p_reason, 
    'dispatched', 'allocated', v_dispatch.warehouse_id, v_dispatch.warehouse_id, v_dispatch.order_id, v_dispatch.order_id
  ) RETURNING id INTO v_correction_id;

  -- Stock IN back to warehouse
  INSERT INTO public.stock_movements (barcode, product_id, warehouse_id, movement_type, quantity, user_id)
  VALUES (p_barcode, v_box.product_id, v_dispatch.warehouse_id, 'REVERSE_DISPATCH_IN', 1, v_uid);
  
  -- Update dispatch record
  UPDATE public.dispatches SET status = 'reversed' WHERE id = v_dispatch.id;

  -- Update boxes: put back to allocated (it belongs to the order but is in warehouse)
  UPDATE public.boxes SET status = 'allocated', current_warehouse_id = v_dispatch.warehouse_id, updated_at = now() WHERE barcode = p_barcode;

  -- Add to barcode history
  INSERT INTO public.barcode_history (barcode, action, product_id, warehouse_id, user_id, notes)
  VALUES (p_barcode, 'DISPATCH_REVERSED', v_box.product_id, v_dispatch.warehouse_id, v_uid, p_reason);

  -- Add audit log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, barcode, details)
  VALUES (v_uid, 'dispatch_reversed', 'correction_records', v_correction_id, p_barcode, 
    jsonb_build_object('order_id', v_dispatch.order_id, 'reason', p_reason));

END;
$$;
