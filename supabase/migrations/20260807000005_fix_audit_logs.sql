-- =============================================================
-- FIX 5: Remove 'product_id' from audit_logs insert and add 'role'
-- Run this in the Supabase SQL Editor.
-- =============================================================

CREATE OR REPLACE FUNCTION public.fn_receive_box(
  p_barcode     text,
  p_warehouse_id uuid,
  p_user_id     uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role         text;
  v_box          record;
  v_warehouse    record;
  v_scan         record;
  v_receipt_id   uuid;
BEGIN
  IF p_barcode IS NULL OR trim(p_barcode) = '' THEN
    RAISE EXCEPTION 'Invalid barcode: barcode cannot be empty.';
  END IF;
  IF p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Invalid warehouse: warehouse must be specified.';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to receive stock.';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'warehouse', 'warehouse_manager', 'manager') THEN
    INSERT INTO public.audit_logs (user_id, role, action, entity_type, barcode, details)
    VALUES (auth.uid(), COALESCE(v_role, 'unknown'), 'unauthorized_receive_attempt', 'warehouse_receipts', p_barcode,
            jsonb_build_object('warehouse_id', p_warehouse_id));
    RAISE EXCEPTION 'You do not have permission to receive stock.';
  END IF;

  SELECT id INTO v_warehouse FROM public.warehouses WHERE id = p_warehouse_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Warehouse not found.'; END IF;

  SELECT * INTO v_box FROM public.boxes WHERE barcode = p_barcode;
  IF NOT FOUND THEN RAISE EXCEPTION 'Barcode not found: this box has not been produced yet.'; END IF;

  IF v_box.status = 'in_warehouse' THEN
    RAISE EXCEPTION 'Duplicate receiving rejected: this box has already been received into a warehouse.';
  END IF;
  IF v_box.status NOT IN ('produced') THEN
    RAISE EXCEPTION 'Invalid state transition: box is currently ''%''. Only produced boxes can be received.', v_box.status;
  END IF;

  -- 7. Insert into warehouse_receipts
  INSERT INTO public.warehouse_receipts (barcode, warehouse_id, product_id, received_by, received_at)
  VALUES (p_barcode, p_warehouse_id, v_box.product_id, p_user_id, now())
  RETURNING id INTO v_receipt_id;

  -- 8. Update box status → in_warehouse
  UPDATE public.boxes
  SET status = 'in_warehouse', current_warehouse_id = p_warehouse_id, updated_at = now()
  WHERE barcode = p_barcode;

  -- 9. Insert stock movement (inventory +1)
  INSERT INTO public.stock_movements (barcode, product_id, warehouse_id, movement_type, quantity, user_id, created_at)
  VALUES (p_barcode, v_box.product_id, p_warehouse_id, 'RECEIVE', 1, p_user_id, now());

  -- 10. Insert barcode history
  INSERT INTO public.barcode_history (barcode, action, product_id, warehouse_id, user_id, performed_at)
  VALUES (p_barcode, 'RECEIVED', v_box.product_id, p_warehouse_id, p_user_id, now());

  -- 11. Insert audit log (schema: id, user_id, role, action, entity_type, entity_id, barcode, warehouse_id, details, created_at)
  INSERT INTO public.audit_logs (user_id, role, action, entity_type, entity_id, warehouse_id, barcode, details)
  VALUES (auth.uid(), v_role, 'box_received', 'warehouse_receipts', v_receipt_id, p_warehouse_id, p_barcode,
          jsonb_build_object('product_id', v_box.product_id,
                             'received_by', p_user_id, 'previous_status', v_box.status));

EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'Duplicate receiving%' OR SQLERRM LIKE 'Barcode not found%'
  OR SQLERRM LIKE 'Invalid state transition%' OR SQLERRM LIKE 'Warehouse not found%'
  OR SQLERRM LIKE 'You do not have permission%' OR SQLERRM LIKE 'Invalid barcode%'
  OR SQLERRM LIKE 'You must be logged in%' OR SQLERRM LIKE 'Invalid warehouse%'
  THEN RAISE; END IF;
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, entity_type, barcode, details)
    VALUES (auth.uid(), 'receive_system_error', 'warehouse_receipts', p_barcode,
            jsonb_build_object('error', SQLERRM, 'barcode', p_barcode));
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE EXCEPTION 'Receiving failed due to a system error: %. Please retry.', SQLERRM;
END;
$$;
