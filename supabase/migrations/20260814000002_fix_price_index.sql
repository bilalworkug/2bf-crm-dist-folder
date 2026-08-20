-- =========================================================================
-- Phase 19: Fix Product Prices Index & Order Creation
-- =========================================================================

-- 1. Clean up old unique index that prevents multiple active prices
DROP INDEX IF EXISTS public.product_prices_active_idx;

-- 2. Update fn_create_order_item to use the new current price function
CREATE OR REPLACE FUNCTION public.fn_create_order_item(
  p_order_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_warehouse_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role         text;
  v_order        record;
  v_price        numeric;
  v_inserted     record;
BEGIN
  -- 1. Validate permissions
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be logged in.'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('sales', 'sales_manager', 'manager', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: only sales and management can create order items.';
  END IF;

  -- 2. Validate input
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero.';
  END IF;

  -- 3. Validate order exists
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  -- 4. Prevent duplicates
  IF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id AND product_id = p_product_id) THEN
    RAISE EXCEPTION 'Duplicate product in order is not allowed. Please update the quantity of the existing item instead.';
  END IF;

  -- 5. Get active price using new pricing function (Phase 19)
  v_price := public.fn_get_current_product_price(p_product_id);

  IF v_price IS NULL OR v_price <= 0 THEN
    RAISE EXCEPTION 'No active price exists for this product.';
  END IF;

  -- 6. Insert item
  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, warehouse_id)
  VALUES (p_order_id, p_product_id, p_quantity, v_price, p_warehouse_id)
  RETURNING * INTO v_inserted;

  RETURN to_jsonb(v_inserted);
END;
$$;
