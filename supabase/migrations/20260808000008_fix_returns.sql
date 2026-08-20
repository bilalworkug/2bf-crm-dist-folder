-- =============================================================
-- Phase 6: Returns Security Hardening
-- Preserves ALL existing return logic. Only hardens security.
-- =============================================================

-- Drop ALL legacy overloads to prevent PostgREST ambiguity
DROP FUNCTION IF EXISTS public.fn_request_return(text, uuid, uuid, text, text, uuid, text);
DROP FUNCTION IF EXISTS public.fn_request_return(character varying, uuid, uuid, text, character varying, uuid, character varying);
DROP FUNCTION IF EXISTS public.fn_request_return(character varying, uuid, uuid, character varying, character varying, uuid, character varying);
DROP FUNCTION IF EXISTS public.fn_approve_return(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.fn_approve_return(uuid, uuid, character varying);


-- =============================================
-- 1. fn_request_return (Security Hardened)
-- =============================================
CREATE OR REPLACE FUNCTION public.fn_request_return(
  p_barcode      text,
  p_order_id     uuid,
  p_warehouse_id uuid,
  p_reason       text,
  p_condition    text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role          text;
  v_box           record;
  v_order         record;
  v_return_id     uuid;
  v_return_number text;
BEGIN
  -- 1. Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to request a return.';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'manager', 'warehouse', 'sales') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot request returns.', v_role;
  END IF;

  -- 2. Validate inputs
  IF p_barcode IS NULL OR trim(p_barcode) = '' THEN
    RAISE EXCEPTION 'Invalid barcode.';
  END IF;

  -- 3. Box exists & correct status
  SELECT * INTO v_box FROM public.boxes WHERE barcode = p_barcode;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barcode not found';
  END IF;

  IF v_box.status NOT IN ('dispatched', 'delivered') THEN
    RAISE EXCEPTION 'Box must be dispatched or delivered to be returned. Current status: %', v_box.status;
  END IF;

  -- 4. Validate order
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  -- 5. Generate return number
  v_return_id := gen_random_uuid();
  v_return_number := 'RET-' || substring(v_return_id::text from 1 for 8);

  -- 6. Insert return record (preserving all existing columns)
  INSERT INTO public.returns (
    id, barcode, product_id, warehouse_id, return_type, reason, quantity,
    status, return_number, order_id, customer_id, condition,
    approval_status, requested_by, processed_at
  ) VALUES (
    v_return_id, p_barcode, v_box.product_id, p_warehouse_id, 'customer', p_reason, 1,
    'pending', v_return_number, p_order_id, v_order.customer_id, p_condition,
    'pending', auth.uid(), now()
  );

  -- 7. Barcode history: RETURN_REQUESTED
  INSERT INTO public.barcode_history (barcode, action, product_id, warehouse_id, order_id, customer_id, user_id, performed_at)
  VALUES (p_barcode, 'RETURN_REQUESTED', v_box.product_id, p_warehouse_id, p_order_id, v_order.customer_id, auth.uid(), now());

  -- 8. Audit log
  INSERT INTO public.audit_logs (user_id, role, action, entity_type, entity_id, barcode, warehouse_id, details)
  VALUES (auth.uid(), v_role, 'REQUEST_RETURN', 'returns', v_return_id, p_barcode, p_warehouse_id,
          jsonb_build_object('order_id', p_order_id, 'condition', p_condition, 'reason', p_reason));

  RETURN v_return_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_request_return(text, uuid, uuid, text, text) TO authenticated;


-- =============================================
-- 2. fn_approve_return (Security Hardened)
-- =============================================
CREATE OR REPLACE FUNCTION public.fn_approve_return(
  p_return_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role    text;
  v_return  record;
  v_box     record;
BEGIN
  -- 1. Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to approve returns.';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized: only admin and manager can approve returns.';
  END IF;

  -- 2. Validate return
  SELECT * INTO v_return FROM public.returns WHERE id = p_return_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Return not found.';
  END IF;

  IF v_return.approval_status = 'approved' THEN
    RAISE EXCEPTION 'Return is already approved.';
  END IF;

  -- 3. Get box
  SELECT * INTO v_box FROM public.boxes WHERE barcode = v_return.barcode;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Box not found for barcode: %', v_return.barcode;
  END IF;

  -- 4. Update return record
  UPDATE public.returns
  SET approval_status = 'approved',
      status = 'approved',
      approved_by = auth.uid(),
      approved_at = now()
  WHERE id = p_return_id;

  -- 5. Update box status
  IF v_return.condition = 'damaged' THEN
    UPDATE public.boxes SET status = 'damaged', current_warehouse_id = v_return.warehouse_id, updated_at = now()
    WHERE barcode = v_return.barcode;
  ELSIF v_return.condition = 'expired' THEN
    UPDATE public.boxes SET status = 'damaged', current_warehouse_id = v_return.warehouse_id, updated_at = now()
    WHERE barcode = v_return.barcode;
  ELSE
    UPDATE public.boxes SET status = 'returned', current_warehouse_id = v_return.warehouse_id, updated_at = now()
    WHERE barcode = v_return.barcode;
  END IF;

  -- 6. Stock movement: IN (inventory restored)
  INSERT INTO public.stock_movements (barcode, product_id, warehouse_id, movement_type, quantity, user_id, created_at)
  VALUES (v_return.barcode, v_return.product_id, v_return.warehouse_id, 'IN', 1, auth.uid(), now());

  -- 7. Barcode history: RETURN_APPROVED
  INSERT INTO public.barcode_history (barcode, action, product_id, warehouse_id, order_id, customer_id, user_id, performed_at)
  VALUES (v_return.barcode, 'RETURN_APPROVED', v_return.product_id, v_return.warehouse_id, v_return.order_id, v_return.customer_id, auth.uid(), now());

  -- 8. Audit log
  INSERT INTO public.audit_logs (user_id, role, action, entity_type, entity_id, barcode, warehouse_id, details)
  VALUES (auth.uid(), v_role, 'APPROVE_RETURN', 'returns', p_return_id, v_return.barcode, v_return.warehouse_id,
          jsonb_build_object('order_id', v_return.order_id, 'condition', v_return.condition));

  RETURN jsonb_build_object('status', 'approved', 'return_id', p_return_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_approve_return(uuid) TO authenticated;
