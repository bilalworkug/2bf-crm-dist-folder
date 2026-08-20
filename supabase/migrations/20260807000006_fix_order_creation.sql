-- =============================================================
-- Phase 2: Order Creation & Pricing Integrity
-- Run this in the Supabase SQL Editor.
-- =============================================================

-- 1. Seed Product Prices
-- Let's give each product a realistic price if it doesn't have one.
INSERT INTO public.product_prices (product_id, price, is_active)
SELECT id, (random() * 500 + 50)::numeric(14,2), true
FROM public.products
WHERE id NOT IN (SELECT product_id FROM public.product_prices WHERE is_active = true);

-- 2. Trigger to recalculate Order Totals
CREATE OR REPLACE FUNCTION public.fn_recalculate_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.orders
    SET total_amount = COALESCE((SELECT SUM(quantity * unit_price) FROM public.order_items WHERE order_id = OLD.order_id), 0)
    WHERE id = OLD.order_id;
    RETURN OLD;
  ELSE
    UPDATE public.orders
    SET total_amount = COALESCE((SELECT SUM(quantity * unit_price) FROM public.order_items WHERE order_id = NEW.order_id), 0)
    WHERE id = NEW.order_id;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_total ON public.order_items;
CREATE TRIGGER trg_order_items_total
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_recalculate_order_total();

-- 3. RPC: fn_create_order_item
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

  -- 5. Get active price
  SELECT price INTO v_price 
  FROM public.product_prices 
  WHERE product_id = p_product_id AND is_active = true 
  ORDER BY created_at DESC LIMIT 1;

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'No active price exists for this product.';
  END IF;

  -- 6. Insert order item
  INSERT INTO public.order_items (
    order_id, 
    product_id, 
    quantity, 
    standard_price, 
    unit_price, 
    warehouse_id
  )
  VALUES (
    p_order_id,
    p_product_id,
    p_quantity,
    v_price,
    v_price,
    p_warehouse_id
  )
  RETURNING * INTO v_inserted;

  -- 6. Insert audit log
  INSERT INTO public.audit_logs (user_id, role, action, entity_type, entity_id, details)
  VALUES (auth.uid(), v_role, 'order_item_created', 'order_items', v_inserted.id,
          jsonb_build_object('order_id', p_order_id, 'product_id', p_product_id, 'quantity', p_quantity, 'standard_price', v_price));

  -- Return the inserted row as jsonb
  RETURN to_jsonb(v_inserted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_create_order_item(uuid, uuid, integer, uuid) TO authenticated;
