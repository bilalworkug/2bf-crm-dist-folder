-- =============================================================
-- Phase 9.1: Bulk Production Correction & Safe RPC
-- =============================================================

-- Create safe function for bulk corrections that validates the old product
CREATE OR REPLACE FUNCTION public.fn_correct_production_box_safe(
  p_barcode text,
  p_expected_before_product_id uuid,
  p_new_product_id uuid,
  p_reason text,
  p_notes text DEFAULT NULL
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
  IF p_expected_before_product_id IS NULL THEN RAISE EXCEPTION 'Expected before product required'; END IF;
  IF p_new_product_id IS NULL THEN RAISE EXCEPTION 'New product required'; END IF;
  IF p_reason IS NULL OR trim(p_reason) = '' THEN RAISE EXCEPTION 'Reason required'; END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'production_manager', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized: Only Admin or Production Manager can correct production.';
  END IF;

  SELECT * INTO v_box FROM public.boxes WHERE barcode = p_barcode;
  IF NOT FOUND THEN RAISE EXCEPTION 'Barcode not found'; END IF;

  IF v_box.product_id != p_expected_before_product_id THEN
    RAISE EXCEPTION 'Box product does not match expected before product';
  END IF;

  IF v_box.product_id = p_new_product_id THEN
    RAISE EXCEPTION 'New product must be different from current product';
  END IF;

  IF v_box.status NOT IN ('produced', 'in_warehouse') THEN
    RAISE EXCEPTION 'Box must be in produced or in_warehouse status to correct production (current: %)', v_box.status;
  END IF;

  -- Create Correction Record
  INSERT INTO public.correction_records (
    barcode, correction_type, performed_by, reason, notes,
    old_product_id, new_product_id, old_status, new_status
  ) VALUES (
    p_barcode, 'production', v_uid, p_reason, p_notes,
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
    jsonb_build_object('old_product', v_box.product_id, 'new_product', p_new_product_id, 'reason', p_reason, 'notes', p_notes));

END;
$$;
