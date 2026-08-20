-- =============================================================
-- Phase 4: Dispatch Fix
-- Run this in the Supabase SQL Editor.
--
-- Replaces fn_dispatch_box to align with Phase 1-3 working schemas.
-- Preserves existing tables and Phase 1-3 logic.
-- =============================================================

CREATE OR REPLACE FUNCTION public.fn_dispatch_box(
  p_barcode      text,
  p_order_id     uuid,
  p_warehouse_id uuid,
  p_user_id      uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role          text;
  v_box           record;
  v_order         record;
  v_dispatch_id   uuid;
BEGIN
  -- 1. Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to dispatch stock.';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'dispatch', 'dispatch_manager', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized: you do not have permission to dispatch stock.';
  END IF;

  -- 2. Validate inputs
  IF p_barcode IS NULL OR trim(p_barcode) = '' THEN
    RAISE EXCEPTION 'Invalid barcode: barcode cannot be empty.';
  END IF;
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Invalid order: order must be specified.';
  END IF;
  IF p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Invalid warehouse: warehouse must be specified.';
  END IF;

  -- 3. Box exists & correct status
  SELECT * INTO v_box FROM public.boxes WHERE barcode = p_barcode;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barcode not found: this box does not exist.';
  END IF;

  IF v_box.status = 'dispatched' THEN
    RAISE EXCEPTION 'Duplicate dispatch: this box is already dispatched.';
  END IF;
  
  IF v_box.status != 'allocated' THEN
    RAISE EXCEPTION 'Cannot dispatch: box is currently ''%''. Box must be allocated first.', v_box.status;
  END IF;

  -- 4. Box belongs to this warehouse
  IF v_box.current_warehouse_id IS NULL OR v_box.current_warehouse_id != p_warehouse_id THEN
    RAISE EXCEPTION 'Box does not belong to this warehouse.';
  END IF;

  -- 5. Box belongs to this order
  IF v_box.current_order_id IS NULL OR v_box.current_order_id != p_order_id THEN
    RAISE EXCEPTION 'Box is not allocated to this order.';
  END IF;

  -- 6. Order exists and is approved
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;
  IF v_order.status NOT IN ('approved', 'pending') THEN
    RAISE EXCEPTION 'Order is not valid for dispatch. Current status: %.', v_order.status;
  END IF;

  -- 7. Insert Dispatch Record
  INSERT INTO public.dispatches (barcode, order_id, product_id, warehouse_id, dispatched_by)
  VALUES (p_barcode, p_order_id, v_box.product_id, p_warehouse_id, auth.uid())
  RETURNING id INTO v_dispatch_id;

  -- 8. Update Box (Status -> dispatched, keep current_order_id, clear warehouse)
  UPDATE public.boxes
  SET status = 'dispatched', current_warehouse_id = NULL, updated_at = now()
  WHERE barcode = p_barcode;

  -- 9. Stock movement: OUT
  INSERT INTO public.stock_movements (barcode, product_id, warehouse_id, movement_type, quantity, user_id, created_at)
  VALUES (p_barcode, v_box.product_id, p_warehouse_id, 'OUT', 1, auth.uid(), now());

  -- 10. Barcode history: DISPATCHED
  INSERT INTO public.barcode_history (barcode, action, product_id, warehouse_id, order_id, user_id, performed_at)
  VALUES (p_barcode, 'DISPATCHED', v_box.product_id, p_warehouse_id, p_order_id, auth.uid(), now());

  -- 11. Audit log
  INSERT INTO public.audit_logs (user_id, role, action, entity_type, entity_id, warehouse_id, barcode, details)
  VALUES (auth.uid(), v_role, 'box_dispatched', 'dispatches', v_dispatch_id, p_warehouse_id, p_barcode,
          jsonb_build_object('order_id', p_order_id, 'product_id', v_box.product_id));

  -- Return
  RETURN jsonb_build_object(
    'dispatch_id', v_dispatch_id,
    'barcode', p_barcode,
    'order_id', p_order_id,
    'status', 'dispatched'
  );

EXCEPTION WHEN OTHERS THEN
  -- Re-raise known business errors
  IF SQLERRM LIKE 'Duplicate dispatch%' OR SQLERRM LIKE 'Barcode not found%'
  OR SQLERRM LIKE 'Cannot dispatch%' OR SQLERRM LIKE 'Order not found%'
  OR SQLERRM LIKE 'Order is not valid%' OR SQLERRM LIKE 'Box is not allocated%'
  OR SQLERRM LIKE 'Box does not belong%' OR SQLERRM LIKE 'Unauthorized%'
  OR SQLERRM LIKE 'Invalid barcode%' OR SQLERRM LIKE 'Invalid order%'
  OR SQLERRM LIKE 'Invalid warehouse%' OR SQLERRM LIKE 'You must be logged in%'
  THEN RAISE; END IF;

  -- Log system errors
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, entity_type, barcode, details)
    VALUES (auth.uid(), 'dispatch_system_error', 'dispatches', p_barcode,
            jsonb_build_object('error', SQLERRM, 'barcode', p_barcode));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RAISE EXCEPTION 'Dispatch failed due to a system error: %. Please retry.', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_dispatch_box(text, uuid, uuid, uuid) TO authenticated;
