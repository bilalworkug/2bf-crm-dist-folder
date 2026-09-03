-- =============================================================
-- Phase 29: Order Fulfillment, Dispatch, Handover & Completion
-- =============================================================

-- 1. Create order_handovers table
CREATE TABLE IF NOT EXISTS public.order_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  handover_number text UNIQUE NOT NULL,
  handover_date timestamptz NOT NULL DEFAULT now(),
  recipient_type text NOT NULL DEFAULT 'customer', -- 'customer' | 'representative' | 'transporter_3pl'
  recipient_name text NOT NULL,
  recipient_phone text,
  recipient_national_id text,
  driver_name text,
  transport_company text,
  vehicle_plate text,
  cartons_handed_over integer NOT NULL DEFAULT 0,
  waybill_number text,
  notes text,
  signature_data text,
  handed_over_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_handovers_order_id ON public.order_handovers(order_id);
CREATE INDEX IF NOT EXISTS idx_order_handovers_customer_id ON public.order_handovers(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_handovers_handover_date ON public.order_handovers(handover_date);

-- Enable RLS on order_handovers
ALTER TABLE public.order_handovers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_handovers_select" ON public.order_handovers;
CREATE POLICY "order_handovers_select" ON public.order_handovers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "order_handovers_insert" ON public.order_handovers;
CREATE POLICY "order_handovers_insert" ON public.order_handovers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'manager', 'dispatch', 'dispatch_manager', 'sales_manager')
    )
  );

-- =============================================================
-- 2. Upgrade fn_dispatch_box
-- Stock is deducted exactly once here. Supports partial dispatch
-- and auto-updates orders.status to 'partially_dispatched' or 'dispatched'.
-- =============================================================
DROP FUNCTION IF EXISTS public.fn_dispatch_box(text, uuid, uuid);

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
  v_role               text;
  v_box                record;
  v_order              record;
  v_dispatch_id        uuid;
  v_product_ordered    numeric := 0;
  v_product_dispatched numeric := 0;
  v_total_ordered      numeric := 0;
  v_total_dispatched   numeric := 0;
  v_order_status       text;
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

  -- 3. Box exists & status validation
  SELECT * INTO v_box FROM public.boxes WHERE barcode = p_barcode;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barcode not found: this box does not exist.';
  END IF;

  IF v_box.status = 'dispatched' THEN
    RAISE EXCEPTION 'Duplicate dispatch: this box is already dispatched.';
  END IF;

  -- Box must be in warehouse or already allocated to this order
  IF v_box.status NOT IN ('allocated', 'in_warehouse') THEN
    RAISE EXCEPTION 'Cannot dispatch: box is currently ''%''. Box must be in warehouse or allocated.', v_box.status;
  END IF;

  -- 4. Box belongs to this warehouse
  IF v_box.current_warehouse_id IS NULL OR v_box.current_warehouse_id != p_warehouse_id THEN
    RAISE EXCEPTION 'Box does not belong to this warehouse.';
  END IF;

  -- 5. If already allocated, ensure it belongs to this order
  IF v_box.status = 'allocated' AND (v_box.current_order_id IS NULL OR v_box.current_order_id != p_order_id) THEN
    RAISE EXCEPTION 'Box is allocated to another order.';
  END IF;

  -- 6. Order exists and is valid for dispatch
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;
  IF v_order.status NOT IN ('approved', 'pending', 'partially_dispatched', 'handed_over') THEN
    RAISE EXCEPTION 'Order is not valid for dispatch. Current status: %.', v_order.status;
  END IF;

  -- 7. Validate product is on order and not over-dispatched
  SELECT COALESCE(SUM(quantity), 0) INTO v_product_ordered
  FROM public.order_items
  WHERE order_id = p_order_id AND product_id = v_box.product_id;

  IF v_product_ordered <= 0 THEN
    RAISE EXCEPTION 'This product is not part of this order.';
  END IF;

  SELECT count(*) INTO v_product_dispatched
  FROM public.dispatches
  WHERE order_id = p_order_id AND product_id = v_box.product_id;

  IF v_product_dispatched >= v_product_ordered THEN
    RAISE EXCEPTION 'All required cartons of this product have already been dispatched for this order.';
  END IF;

  -- 8. Auto-allocate if not yet allocated (enabling smooth single-scan workflow)
  IF v_box.status != 'allocated' THEN
    INSERT INTO public.order_allocations (order_id, barcode, product_id, warehouse_id, allocated_by, status)
    VALUES (p_order_id, p_barcode, v_box.product_id, p_warehouse_id, auth.uid(), 'allocated')
    ON CONFLICT (barcode) DO UPDATE SET order_id = p_order_id, status = 'allocated';
  END IF;

  -- 9. Insert Dispatch Record
  INSERT INTO public.dispatches (barcode, order_id, product_id, warehouse_id, dispatched_by)
  VALUES (p_barcode, p_order_id, v_box.product_id, p_warehouse_id, auth.uid())
  RETURNING id INTO v_dispatch_id;

  -- 10. CRITICAL INVENTORY RULE: Deduct warehouse stock exactly once at Dispatch
  UPDATE public.boxes
  SET status = 'dispatched', current_warehouse_id = NULL, current_order_id = p_order_id, updated_at = now()
  WHERE barcode = p_barcode;

  -- Stock movement: OUT
  INSERT INTO public.stock_movements (barcode, product_id, warehouse_id, movement_type, quantity, user_id, created_at)
  VALUES (p_barcode, v_box.product_id, p_warehouse_id, 'OUT', 1, auth.uid(), now());

  -- 11. Barcode history: DISPATCHED
  INSERT INTO public.barcode_history (barcode, action, product_id, warehouse_id, order_id, user_id, performed_at)
  VALUES (p_barcode, 'DISPATCHED', v_box.product_id, p_warehouse_id, p_order_id, auth.uid(), now());

  -- 12. Audit log
  INSERT INTO public.audit_logs (user_id, role, action, entity_type, entity_id, warehouse_id, barcode, details)
  VALUES (auth.uid(), v_role, 'box_dispatched', 'dispatches', v_dispatch_id, p_warehouse_id, p_barcode,
          jsonb_build_object('order_id', p_order_id, 'product_id', v_box.product_id));

  -- 13. Recompute Order Fulfillment & Progress
  SELECT COALESCE(SUM(quantity), 0) INTO v_total_ordered
  FROM public.order_items
  WHERE order_id = p_order_id;

  SELECT count(*) INTO v_total_dispatched
  FROM public.dispatches
  WHERE order_id = p_order_id;

  IF v_total_dispatched >= v_total_ordered THEN
    UPDATE public.orders SET status = 'dispatched', updated_at = now() WHERE id = p_order_id;
    v_order_status := 'dispatched';
  ELSE
    UPDATE public.orders SET status = 'partially_dispatched', updated_at = now() WHERE id = p_order_id;
    v_order_status := 'partially_dispatched';
  END IF;

  RETURN jsonb_build_object(
    'dispatch_id', v_dispatch_id,
    'barcode', p_barcode,
    'order_id', p_order_id,
    'product_id', v_box.product_id,
    'dispatched_count', v_total_dispatched,
    'ordered_count', v_total_ordered,
    'remaining_count', GREATEST(0, v_total_ordered - v_total_dispatched),
    'fulfillment_percent', ROUND((v_total_dispatched::numeric / v_total_ordered::numeric) * 100, 1),
    'order_status', v_order_status,
    'status', 'dispatched'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_dispatch_box(text, uuid, uuid) TO authenticated;

-- =============================================================
-- 3. Create fn_handover_order RPC
-- Records custody transfer to customer / driver / 3PL transporter
-- DOES NOT deduct stock (already deducted at dispatch).
-- =============================================================
CREATE OR REPLACE FUNCTION public.fn_handover_order(
  p_order_id          uuid,
  p_recipient_type    text,
  p_recipient_name    text,
  p_recipient_phone   text,
  p_driver_name       text,
  p_transport_company text,
  p_vehicle_plate     text,
  p_waybill_number    text,
  p_notes             text,
  p_signature_data    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role           text;
  v_order          record;
  v_dispatched_qty integer;
  v_handover_id    uuid;
  v_handover_num   text;
BEGIN
  -- 1. Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to record an order handover.';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'manager', 'dispatch', 'dispatch_manager', 'sales_manager') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot record order handovers.', v_role;
  END IF;

  -- 2. Validate Order
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  -- 3. Check that at least one carton has been dispatched
  SELECT count(*) INTO v_dispatched_qty FROM public.dispatches WHERE order_id = p_order_id;
  IF v_dispatched_qty = 0 THEN
    RAISE EXCEPTION 'Cannot handover order: no cartons have been dispatched yet.';
  END IF;

  -- 4. Validate Recipient Name
  IF p_recipient_name IS NULL OR trim(p_recipient_name) = '' THEN
    RAISE EXCEPTION 'Recipient name is required.';
  END IF;

  -- 5. Generate unique handover number
  v_handover_num := 'HO-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(md5(random()::text) from 1 for 4));

  -- 6. Insert Handover Record
  INSERT INTO public.order_handovers (
    order_id, customer_id, handover_number, recipient_type,
    recipient_name, recipient_phone, driver_name, transport_company,
    vehicle_plate, cartons_handed_over, waybill_number, notes,
    signature_data, handed_over_by
  ) VALUES (
    p_order_id, v_order.customer_id, v_handover_num, COALESCE(p_recipient_type, 'customer'),
    p_recipient_name, p_recipient_phone, p_driver_name, p_transport_company,
    p_vehicle_plate, v_dispatched_qty, p_waybill_number, p_notes,
    p_signature_data, auth.uid()
  ) RETURNING id INTO v_handover_id;

  -- 7. Update Order Status
  DECLARE
    v_total_ordered numeric;
  BEGIN
    SELECT COALESCE(SUM(quantity), 0) INTO v_total_ordered
    FROM public.order_items
    WHERE order_id = p_order_id;

    IF v_dispatched_qty >= v_total_ordered THEN
      UPDATE public.orders SET status = 'handed_over', updated_at = now() WHERE id = p_order_id;
    ELSE
      UPDATE public.orders SET status = 'partially_dispatched', updated_at = now() WHERE id = p_order_id;
    END IF;
  END;

  -- 8. Record Barcode History for all dispatched cartons in this order
  INSERT INTO public.barcode_history (barcode, action, product_id, warehouse_id, order_id, user_id, performed_at)
  SELECT d.barcode, 'HANDED_OVER', d.product_id, d.warehouse_id, p_order_id, auth.uid(), now()
  FROM public.dispatches d
  WHERE d.order_id = p_order_id;

  -- 9. Audit Log
  INSERT INTO public.audit_logs (user_id, role, action, entity_type, entity_id, details)
  VALUES (auth.uid(), v_role, 'order_handed_over', 'order_handovers', v_handover_id,
          jsonb_build_object(
            'order_id', p_order_id,
            'handover_number', v_handover_num,
            'cartons_handed_over', v_dispatched_qty,
            'recipient_name', p_recipient_name,
            'vehicle_plate', p_vehicle_plate
          ));

  RETURN jsonb_build_object(
    'handover_id', v_handover_id,
    'handover_number', v_handover_num,
    'order_id', p_order_id,
    'cartons_handed_over', v_dispatched_qty,
    'status', 'handed_over'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_handover_order(uuid, text, text, text, text, text, text, text, text, text) TO authenticated;

-- =============================================================
-- 4. Create fn_complete_order RPC
-- Secure server-side final order completion.
-- Requires 100% full quantity dispatched AND valid handover record.
-- =============================================================
CREATE OR REPLACE FUNCTION public.fn_complete_order(
  p_order_id uuid,
  p_notes    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role             text;
  v_order            record;
  v_total_ordered    numeric := 0;
  v_total_dispatched numeric := 0;
  v_has_handover     boolean := false;
BEGIN
  -- 1. Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to complete an order.';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'manager', 'dispatch_manager', 'accounts_manager') THEN
    RAISE EXCEPTION 'Unauthorized: only managers and administrators can complete orders.';
  END IF;

  -- 2. Validate Order
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  IF v_order.status = 'completed' THEN
    RAISE EXCEPTION 'Order is already completed.';
  END IF;

  -- 3. Fulfillment validation: Full required quantity must be dispatched
  SELECT COALESCE(SUM(quantity), 0) INTO v_total_ordered
  FROM public.order_items
  WHERE order_id = p_order_id;

  SELECT count(*) INTO v_total_dispatched
  FROM public.dispatches
  WHERE order_id = p_order_id;

  IF v_total_dispatched < v_total_ordered THEN
    RAISE EXCEPTION 'Cannot complete order: partially fulfilled (% of % cartons dispatched).', v_total_dispatched, v_total_ordered;
  END IF;

  -- 4. Handover validation: Must have a recorded handover
  SELECT EXISTS(SELECT 1 FROM public.order_handovers WHERE order_id = p_order_id) INTO v_has_handover;
  IF NOT v_has_handover THEN
    RAISE EXCEPTION 'Cannot complete order: Dispatch Handover has not been recorded for this order.';
  END IF;

  -- 5. Close Order
  UPDATE public.orders
  SET status = 'completed', updated_at = now()
  WHERE id = p_order_id;

  -- 6. Audit Log
  INSERT INTO public.audit_logs (user_id, role, action, entity_type, entity_id, details)
  VALUES (auth.uid(), v_role, 'order_completed', 'orders', p_order_id,
          jsonb_build_object(
            'order_id', p_order_id,
            'order_number', v_order.order_number,
            'total_dispatched', v_total_dispatched,
            'notes', p_notes
          ));

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'order_number', v_order.order_number,
    'status', 'completed',
    'total_dispatched', v_total_dispatched
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_complete_order(uuid, text) TO authenticated;
