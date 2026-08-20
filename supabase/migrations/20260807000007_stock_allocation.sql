-- =============================================================
-- Phase 3: Stock Allocation
-- Run this in the Supabase SQL Editor.
--
-- Creates:
--   1. order_allocations table (links barcodes to orders)
--   2. fn_allocate_box RPC (validates & allocates a single box)
--
-- Does NOT modify: Production, Warehouse Receiving, Orders, Dispatch
-- =============================================================

-- =============================================================
-- PART 1: Create order_allocations table
-- =============================================================
CREATE TABLE IF NOT EXISTS public.order_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  order_item_id uuid REFERENCES public.order_items(id),
  barcode text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  allocated_by uuid NOT NULL REFERENCES public.profiles(id),
  allocated_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'allocated',
  CONSTRAINT order_allocations_barcode_unique UNIQUE (barcode)
);

ALTER TABLE public.order_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_allocations_select" ON public.order_allocations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "order_allocations_insert" ON public.order_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'warehouse', 'warehouse_manager', 'dispatch', 'dispatch_manager', 'manager')
    )
  );

CREATE POLICY "order_allocations_update" ON public.order_allocations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'manager')
    )
  );

-- =============================================================
-- PART 2: fn_allocate_box RPC
-- =============================================================
DROP FUNCTION IF EXISTS public.fn_allocate_box(text, uuid, uuid);

CREATE OR REPLACE FUNCTION public.fn_allocate_box(
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
  v_order_item    record;
  v_alloc_id      uuid;
BEGIN
  -- 1. Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to allocate stock.';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'warehouse', 'warehouse_manager', 'dispatch', 'dispatch_manager', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized: you do not have permission to allocate stock.';
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

  -- 3. Order exists and is approved
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;
  IF v_order.status NOT IN ('approved', 'pending') THEN
    RAISE EXCEPTION 'Order is not approved for allocation. Current status: %.', v_order.status;
  END IF;

  -- 4. Box exists
  SELECT * INTO v_box FROM public.boxes WHERE barcode = p_barcode;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barcode not found: this box does not exist.';
  END IF;

  -- 5. Box belongs to this warehouse
  IF v_box.current_warehouse_id IS NULL OR v_box.current_warehouse_id != p_warehouse_id THEN
    RAISE EXCEPTION 'Box does not belong to this warehouse.';
  END IF;

  -- 6. Box must be in_warehouse (not allocated, dispatched, returned, damaged, etc.)
  IF v_box.status = 'allocated' THEN
    RAISE EXCEPTION 'Duplicate allocation rejected: this box is already allocated.';
  END IF;
  IF v_box.status = 'dispatched' THEN
    RAISE EXCEPTION 'Cannot allocate: this box has already been dispatched.';
  END IF;
  IF v_box.status = 'returned' THEN
    RAISE EXCEPTION 'Cannot allocate: this box has been returned.';
  END IF;
  IF v_box.status = 'damaged' THEN
    RAISE EXCEPTION 'Cannot allocate: this box is marked as damaged.';
  END IF;
  IF v_box.status != 'in_warehouse' THEN
    RAISE EXCEPTION 'Cannot allocate: box is currently ''%''. Only boxes with status ''in_warehouse'' can be allocated.', v_box.status;
  END IF;

  -- 7. Find matching order_item for product
  SELECT * INTO v_order_item
  FROM public.order_items
  WHERE order_id = p_order_id AND product_id = v_box.product_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product mismatch: no order item for this product in the specified order.';
  END IF;

  -- 8. Insert allocation record
  INSERT INTO public.order_allocations (order_id, order_item_id, barcode, product_id, warehouse_id, allocated_by)
  VALUES (p_order_id, v_order_item.id, p_barcode, v_box.product_id, p_warehouse_id, auth.uid())
  RETURNING id INTO v_alloc_id;

  -- 9. Update box status → allocated, link to order
  UPDATE public.boxes
  SET status = 'allocated', current_order_id = p_order_id, updated_at = now()
  WHERE barcode = p_barcode;

  -- 10. Stock movement: ALLOCATE
  INSERT INTO public.stock_movements (barcode, product_id, warehouse_id, movement_type, quantity, user_id, created_at)
  VALUES (p_barcode, v_box.product_id, p_warehouse_id, 'ALLOCATE', 1, auth.uid(), now());

  -- 11. Barcode history
  INSERT INTO public.barcode_history (barcode, action, product_id, warehouse_id, order_id, user_id, performed_at)
  VALUES (p_barcode, 'ALLOCATED', v_box.product_id, p_warehouse_id, p_order_id, auth.uid(), now());

  -- 12. Audit log
  INSERT INTO public.audit_logs (user_id, role, action, entity_type, entity_id, warehouse_id, barcode, details)
  VALUES (auth.uid(), v_role, 'box_allocated', 'order_allocations', v_alloc_id, p_warehouse_id, p_barcode,
          jsonb_build_object('order_id', p_order_id, 'product_id', v_box.product_id,
                             'order_item_id', v_order_item.id, 'previous_status', v_box.status));

  -- Return
  RETURN jsonb_build_object(
    'allocation_id', v_alloc_id,
    'barcode', p_barcode,
    'order_id', p_order_id,
    'product_id', v_box.product_id,
    'warehouse_id', p_warehouse_id,
    'status', 'allocated'
  );

EXCEPTION WHEN OTHERS THEN
  -- Re-raise known business errors
  IF SQLERRM LIKE 'Duplicate allocation%' OR SQLERRM LIKE 'Barcode not found%'
  OR SQLERRM LIKE 'Cannot allocate%' OR SQLERRM LIKE 'Order not found%'
  OR SQLERRM LIKE 'Order is not approved%' OR SQLERRM LIKE 'Product mismatch%'
  OR SQLERRM LIKE 'Box does not belong%' OR SQLERRM LIKE 'Unauthorized%'
  OR SQLERRM LIKE 'Invalid barcode%' OR SQLERRM LIKE 'Invalid order%'
  OR SQLERRM LIKE 'Invalid warehouse%' OR SQLERRM LIKE 'You must be logged in%'
  THEN RAISE; END IF;

  -- Log system errors
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, entity_type, barcode, details)
    VALUES (auth.uid(), 'allocate_system_error', 'order_allocations', p_barcode,
            jsonb_build_object('error', SQLERRM, 'barcode', p_barcode));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RAISE EXCEPTION 'Allocation failed due to a system error: %. Please retry.', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_allocate_box(text, uuid, uuid) TO authenticated;
