-- =============================================================
-- Phase 14: Secure RPCs
-- Replace all RPCs that accept p_user_id with auth.uid()
-- =============================================================

-- Drop vulnerable overloads
DROP FUNCTION IF EXISTS public.fn_produce_box(text, uuid, uuid);
DROP FUNCTION IF EXISTS public.fn_receive_box(text, uuid, uuid);
DROP FUNCTION IF EXISTS public.fn_dispatch_box(text, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.fn_deliver_box(text, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.fn_complete_delivery(uuid, text, text, text, uuid);

-- =============================================================
-- 1. Secure fn_produce_box
-- =============================================================
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
  VALUES (p_barcode, p_product_id, auth.uid(), now());

  INSERT INTO public.barcode_history (barcode, action, product_id, user_id, performed_at)
  VALUES (p_barcode, 'produced', p_product_id, auth.uid(), now());

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


-- =============================================================
-- 2. Secure fn_receive_box
-- =============================================================
CREATE OR REPLACE FUNCTION public.fn_receive_box(
  p_barcode      text,
  p_warehouse_id uuid
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
  VALUES (p_barcode, p_warehouse_id, v_box.product_id, auth.uid(), now())
  RETURNING id INTO v_receipt_id;

  -- 8. Update box status → in_warehouse
  UPDATE public.boxes
  SET status = 'in_warehouse', current_warehouse_id = p_warehouse_id, updated_at = now()
  WHERE barcode = p_barcode;

  -- 9. Insert stock movement (inventory +1)
  INSERT INTO public.stock_movements (barcode, product_id, warehouse_id, movement_type, quantity, user_id, created_at)
  VALUES (p_barcode, v_box.product_id, p_warehouse_id, 'RECEIVE', 1, auth.uid(), now());

  -- 10. Insert barcode history
  INSERT INTO public.barcode_history (barcode, action, product_id, warehouse_id, user_id, performed_at)
  VALUES (p_barcode, 'RECEIVED', v_box.product_id, p_warehouse_id, auth.uid(), now());

  -- 11. Insert audit log
  INSERT INTO public.audit_logs (user_id, role, action, entity_type, entity_id, warehouse_id, barcode, details)
  VALUES (auth.uid(), v_role, 'box_received', 'warehouse_receipts', v_receipt_id, p_warehouse_id, p_barcode,
          jsonb_build_object('product_id', v_box.product_id,
                             'received_by', auth.uid(), 'previous_status', v_box.status));

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


-- =============================================================
-- 3. Secure fn_dispatch_box
-- =============================================================
CREATE OR REPLACE FUNCTION public.fn_dispatch_box(
  p_barcode      text,
  p_order_id     uuid,
  p_warehouse_id uuid
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


-- =============================================================
-- 4. Secure fn_deliver_box
-- =============================================================
CREATE OR REPLACE FUNCTION public.fn_deliver_box(
  p_barcode      text,
  p_order_id     uuid,
  p_delivery_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role          text;
  v_box           record;
  v_delivery      record;
  v_order         record;
BEGIN
  -- 1. Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to record deliveries.';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'dispatch', 'dispatch_manager', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot record deliveries.', v_role;
  END IF;

  -- 2. Validate inputs
  IF p_barcode IS NULL OR trim(p_barcode) = '' THEN
    RAISE EXCEPTION 'Invalid barcode.';
  END IF;
  IF p_delivery_id IS NULL THEN
    RAISE EXCEPTION 'Invalid delivery ID.';
  END IF;

  -- 3. Validate Delivery
  SELECT * INTO v_delivery FROM public.deliveries WHERE id = p_delivery_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery not found.';
  END IF;
  IF v_delivery.status != 'pending' THEN
    RAISE EXCEPTION 'Cannot scan boxes for a delivery that is %.', v_delivery.status;
  END IF;
  IF v_delivery.order_id != p_order_id THEN
    RAISE EXCEPTION 'Delivery order ID mismatch.';
  END IF;

  -- 4. Validate Order
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  -- 5. Box exists & correct status
  SELECT * INTO v_box FROM public.boxes WHERE barcode = p_barcode;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barcode not found: %', p_barcode;
  END IF;

  IF v_box.status = 'delivered' THEN
    RAISE EXCEPTION 'Duplicate delivery: this box is already delivered.';
  END IF;
  
  IF v_box.status != 'dispatched' THEN
    RAISE EXCEPTION 'Cannot deliver: box is currently ''%''. Box must be dispatched first.', v_box.status;
  END IF;

  -- 6. Box belongs to this order
  IF v_box.current_order_id IS NULL OR v_box.current_order_id != p_order_id THEN
    RAISE EXCEPTION 'Box does not belong to this order.';
  END IF;

  -- 7. Insert Delivery Item
  INSERT INTO public.delivery_items (delivery_id, barcode, order_id, scanned_by, scanned_at)
  VALUES (p_delivery_id, p_barcode, p_order_id, auth.uid(), now());

  -- 8. Update Box
  UPDATE public.boxes
  SET status = 'delivered', customer_id = v_order.customer_id, updated_at = now()
  WHERE barcode = p_barcode;

  -- 9. No extra stock movement (OUT was done in Dispatch)

  -- 10. Barcode history: DELIVERED
  INSERT INTO public.barcode_history (barcode, action, product_id, order_id, customer_id, user_id, performed_at)
  VALUES (p_barcode, 'DELIVERED', v_box.product_id, p_order_id, v_order.customer_id, auth.uid(), now());

  -- 11. Audit log
  INSERT INTO public.audit_logs (user_id, role, action, entity_type, entity_id, barcode, details)
  VALUES (auth.uid(), v_role, 'box_delivered', 'delivery_items', p_delivery_id, p_barcode,
          jsonb_build_object('order_id', p_order_id, 'customer_id', v_order.customer_id));

  RETURN jsonb_build_object('status', 'delivered', 'barcode', p_barcode);
END;
$$;


-- =============================================================
-- 5. Secure fn_complete_delivery
-- =============================================================
CREATE OR REPLACE FUNCTION public.fn_complete_delivery(
  p_delivery_id    uuid,
  p_receiver_name  text,
  p_receiver_phone text,
  p_notes          text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role          text;
  v_delivery      record;
  v_scanned_count int;
BEGIN
  -- 1. Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to complete a delivery.';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'dispatch', 'dispatch_manager', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot complete deliveries.', v_role;
  END IF;

  -- 2. Validate Delivery
  SELECT * INTO v_delivery FROM public.deliveries WHERE id = p_delivery_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery not found.';
  END IF;

  -- 3. Check if any boxes were scanned
  SELECT count(*) INTO v_scanned_count FROM public.delivery_items WHERE delivery_id = p_delivery_id;
  IF v_scanned_count = 0 THEN
    RAISE EXCEPTION 'No boxes have been scanned for this delivery.';
  END IF;

  -- 4. Complete Delivery
  UPDATE public.deliveries
  SET status = 'delivered',
      receiver_name = p_receiver_name,
      receiver_phone = p_receiver_phone,
      delivery_notes = p_notes,
      delivered_by = auth.uid(),
      delivered_at = now(),
      updated_at = now()
  WHERE id = p_delivery_id;

  -- 5. Update Order Status
  UPDATE public.orders
  SET status = 'delivered', updated_at = now()
  WHERE id = v_delivery.order_id;

  -- 6. Audit log
  INSERT INTO public.audit_logs (user_id, role, action, entity_type, entity_id, details)
  VALUES (auth.uid(), v_role, 'delivery_completed', 'deliveries', p_delivery_id,
          jsonb_build_object('order_id', v_delivery.order_id, 'scanned_count', v_scanned_count));

  RETURN jsonb_build_object('status', 'success', 'delivery_id', p_delivery_id);
END;
$$;
