-- =============================================================
-- Phase 5: Delivery Fixes
-- Creates secure RPCs for delivery workflow, bypassing RLS issues.
-- =============================================================

-- Drop legacy overloads to prevent PostgREST ambiguity
DROP FUNCTION IF EXISTS public.fn_deliver_box(text, uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.fn_deliver_box(character varying, uuid, uuid, uuid, character varying);
DROP FUNCTION IF EXISTS public.fn_complete_delivery(uuid, text, text, text, uuid, text);
DROP FUNCTION IF EXISTS public.fn_complete_delivery(uuid, character varying, character varying, text, uuid, character varying);

-- 1. Create fn_create_delivery
CREATE OR REPLACE FUNCTION public.fn_create_delivery(
  p_order_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role       text;
  v_order      record;
  v_delivery_id uuid;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to create a delivery.';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'dispatch', 'dispatch_manager', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot create deliveries.', v_role;
  END IF;

  -- Validate order
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  -- Insert delivery
  INSERT INTO public.deliveries (order_id, status)
  VALUES (p_order_id, 'pending')
  RETURNING id INTO v_delivery_id;

  RETURN v_delivery_id;
END;
$$;


-- 2. Rewrite fn_deliver_box
CREATE OR REPLACE FUNCTION public.fn_deliver_box(
  p_barcode      text,
  p_order_id     uuid,
  p_delivery_id  uuid,
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
  -- Columns: id, delivery_id, barcode, order_id, scanned_by, scanned_at
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


-- 3. Rewrite fn_complete_delivery
CREATE OR REPLACE FUNCTION public.fn_complete_delivery(
  p_delivery_id    uuid,
  p_receiver_name  text,
  p_receiver_phone text,
  p_notes          text,
  p_user_id        uuid
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

  -- 5. Update Order Status (optional depending on logic, but generally partial vs full)
  -- We just set to 'delivered' as a simpliciation, the frontend can refine if needed.
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
