-- =========================================================================
-- Phase 21: Simplify & Harden Sales Order Workflow (Fix)
-- =========================================================================

-- Add notes column if it doesn't exist (since it was requested in UI)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes text;

-- Create a secure RPC to handle full order creation transaction
CREATE OR REPLACE FUNCTION public.fn_create_sales_order(
  p_customer_id uuid,
  p_notes text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_order_number text;
  v_order_id uuid;
  v_total_amount numeric := 0;
  v_item record;
  v_product_price numeric;
  v_item_total numeric;
  v_inserted_item_id uuid;
BEGIN
  -- 1. Validate permissions
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be logged in.'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('sales', 'sales_manager', 'manager', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: only sales and management can create orders.';
  END IF;

  -- 2. Validate input
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer ID is required.';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item.';
  END IF;

  -- 3. Calculate total amount and validate prices
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity integer, warehouse_id uuid)
  LOOP
    IF v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero.';
    END IF;

    -- Get current active price (Phase 19 integration)
    v_product_price := public.fn_get_current_product_price(v_item.product_id);

    IF v_product_price IS NULL OR v_product_price <= 0 THEN
      RAISE EXCEPTION 'Product has no active price. Contact Admin to set a price.';
    END IF;

    v_item_total := v_product_price * v_item.quantity;
    v_total_amount := v_total_amount + v_item_total;
  END LOOP;

  -- 4. Generate Order Number
  v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(md5(random()::text) from 1 for 4));

  -- 5. Insert Order
  INSERT INTO public.orders (order_number, customer_id, status, notes, sales_person_id, total_amount, paid_amount)
  VALUES (v_order_number, p_customer_id, 'pending', p_notes, auth.uid(), v_total_amount, 0)
  RETURNING id INTO v_order_id;

  -- 6. Insert Order Items using the securely fetched prices
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity integer, warehouse_id uuid)
  LOOP
    v_product_price := public.fn_get_current_product_price(v_item.product_id);
    
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, standard_price, warehouse_id)
    VALUES (v_order_id, v_item.product_id, v_item.quantity, v_product_price, v_product_price, v_item.warehouse_id)
    RETURNING id INTO v_inserted_item_id;
  END LOOP;

  -- 7. Audit Log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'order_created', 'orders', v_order_id, jsonb_build_object('order_number', v_order_number, 'total_amount', v_total_amount));

  RETURN v_order_id;
END;
$$;
