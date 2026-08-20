-- =========================================================================
-- Phase 22: Account Manager & Customer Credit Authorization
-- =========================================================================

-- 1. Seed missing roles, importantly accounts_manager
INSERT INTO public.roles (key, name, description) VALUES
  ('accounts_manager', 'Accounts Manager', 'Manages customer credit authorization and accounts corrections'),
  ('production_manager', 'Production Manager', 'Manages production and corrections'),
  ('warehouse_manager', 'Warehouse Manager', 'Manages warehouse and corrections'),
  ('dispatch_manager', 'Dispatch Manager', 'Manages dispatch and corrections'),
  ('sales_manager', 'Sales Manager', 'Manages sales, approves discounts'),
  ('returns_manager', 'Returns Manager', 'Manages returns and corrections'),
  ('delivery', 'Delivery', 'Delivery')
ON CONFLICT (key) DO UPDATE SET 
  name = EXCLUDED.name, 
  description = EXCLUDED.description;

-- 2. Create customer_credit_settings table
CREATE TABLE IF NOT EXISTS public.customer_credit_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  credit_allowed boolean NOT NULL DEFAULT false,
  credit_limit numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  payment_terms_days integer NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
  notes text,
  active boolean NOT NULL DEFAULT true,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on customer_credit_settings
ALTER TABLE public.customer_credit_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read
DROP POLICY IF EXISTS "read_customer_credit_settings" ON public.customer_credit_settings;
CREATE POLICY "read_customer_credit_settings" ON public.customer_credit_settings
FOR SELECT TO authenticated USING (true);

-- Policy: Only admin and accounts_manager can write
DROP POLICY IF EXISTS "write_customer_credit_settings" ON public.customer_credit_settings;
CREATE POLICY "write_customer_credit_settings" ON public.customer_credit_settings
FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accounts_manager'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accounts_manager'))
);

-- 3. Add payment_type to orders
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_type') THEN
    ALTER TABLE public.orders ADD COLUMN payment_type text DEFAULT 'pay_now' CHECK (payment_type IN ('pay_now', 'credit'));
  END IF;
END $$;

-- 4. RPC: Get customer credit status
CREATE OR REPLACE FUNCTION public.fn_get_customer_credit_status(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_allowed boolean := false;
  v_credit_limit numeric := 0;
  v_payment_terms_days integer := 30;
  v_active boolean := false;
  v_outstanding numeric := 0;
BEGIN
  -- Validate user
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be logged in.'; END IF;

  -- Get credit settings
  SELECT credit_allowed, credit_limit, payment_terms_days, active
  INTO v_credit_allowed, v_credit_limit, v_payment_terms_days, v_active
  FROM public.customer_credit_settings
  WHERE customer_id = p_customer_id;

  -- If no settings exist, default to not allowed
  IF NOT FOUND THEN
    v_credit_allowed := false;
    v_credit_limit := 0;
    v_payment_terms_days := 30;
    v_active := false;
  END IF;

  -- Calculate outstanding debt from CREDIT orders
  -- (Outstanding = Total - Paid)
  SELECT COALESCE(SUM(total_amount - paid_amount), 0)
  INTO v_outstanding
  FROM public.orders
  WHERE customer_id = p_customer_id
    AND payment_type = 'credit'
    AND status NOT IN ('cancelled')
    AND (total_amount - paid_amount) > 0;

  RETURN jsonb_build_object(
    'credit_allowed', v_credit_allowed AND v_active,
    'credit_limit', v_credit_limit,
    'outstanding', v_outstanding,
    'available_credit', GREATEST(0, v_credit_limit - v_outstanding),
    'payment_terms_days', v_payment_terms_days
  );
END;
$$;

-- 5. RPC: Upsert customer credit settings
CREATE OR REPLACE FUNCTION public.fn_upsert_customer_credit(
  p_customer_id uuid,
  p_credit_allowed boolean,
  p_credit_limit numeric,
  p_payment_terms_days integer,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_existing record;
BEGIN
  -- 1. Validate permissions
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be logged in.'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'accounts_manager') THEN
    RAISE EXCEPTION 'Unauthorized: only Account Managers or Admins can manage credit.';
  END IF;

  -- 2. Validate input
  IF p_credit_limit < 0 THEN RAISE EXCEPTION 'Credit limit cannot be negative.'; END IF;
  IF p_payment_terms_days < 0 THEN RAISE EXCEPTION 'Payment terms cannot be negative.'; END IF;

  -- 3. Get existing to generate precise audit logs
  SELECT * INTO v_existing FROM public.customer_credit_settings WHERE customer_id = p_customer_id;

  -- 4. Upsert
  INSERT INTO public.customer_credit_settings (
    customer_id, credit_allowed, credit_limit, payment_terms_days, notes, active, approved_by, approved_at
  ) VALUES (
    p_customer_id, p_credit_allowed, p_credit_limit, p_payment_terms_days, p_notes, true, auth.uid(), now()
  )
  ON CONFLICT (customer_id) DO UPDATE SET
    credit_allowed = EXCLUDED.credit_allowed,
    credit_limit = EXCLUDED.credit_limit,
    payment_terms_days = EXCLUDED.payment_terms_days,
    notes = EXCLUDED.notes,
    active = EXCLUDED.active,
    approved_by = EXCLUDED.approved_by,
    approved_at = EXCLUDED.approved_at,
    updated_at = now();

  -- 5. Audit Logging
  IF v_existing IS NULL THEN
    -- New authorization record
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), CASE WHEN p_credit_allowed THEN 'customer_credit_authorized' ELSE 'customer_credit_disabled' END, 'customers', p_customer_id, jsonb_build_object('credit_limit', p_credit_limit, 'terms', p_payment_terms_days));
  ELSE
    -- Updates
    IF v_existing.credit_allowed != p_credit_allowed THEN
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (auth.uid(), CASE WHEN p_credit_allowed THEN 'customer_credit_authorized' ELSE 'customer_credit_disabled' END, 'customers', p_customer_id, jsonb_build_object('old', v_existing.credit_allowed, 'new', p_credit_allowed));
    END IF;

    IF v_existing.credit_limit != p_credit_limit THEN
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (auth.uid(), 'customer_credit_limit_changed', 'customers', p_customer_id, jsonb_build_object('old', v_existing.credit_limit, 'new', p_credit_limit));
    END IF;

    IF v_existing.payment_terms_days != p_payment_terms_days THEN
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (auth.uid(), 'customer_payment_terms_changed', 'customers', p_customer_id, jsonb_build_object('old', v_existing.payment_terms_days, 'new', p_payment_terms_days));
    END IF;
  END IF;
END;
$$;


-- 6. Update fn_create_sales_order to support payment_type and enforce credit limits
CREATE OR REPLACE FUNCTION public.fn_create_sales_order(
  p_customer_id uuid,
  p_notes text,
  p_items jsonb,
  p_payment_type text DEFAULT 'pay_now'
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
  
  -- Credit specific
  v_credit_status jsonb;
  v_credit_allowed boolean;
  v_available_credit numeric;
  v_payment_terms_days integer;
  v_due_date date := NULL;
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

  IF p_payment_type NOT IN ('pay_now', 'credit') THEN
    RAISE EXCEPTION 'Invalid payment type.';
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

  -- 4. Credit Verification (Phase 22)
  IF p_payment_type = 'credit' THEN
    v_credit_status := public.fn_get_customer_credit_status(p_customer_id);
    v_credit_allowed := (v_credit_status->>'credit_allowed')::boolean;
    v_available_credit := (v_credit_status->>'available_credit')::numeric;
    v_payment_terms_days := (v_credit_status->>'payment_terms_days')::integer;

    IF NOT v_credit_allowed THEN
      RAISE EXCEPTION 'Customer is not authorized for credit.';
    END IF;

    IF v_total_amount > v_available_credit THEN
      RAISE EXCEPTION 'CREDIT LIMIT EXCEEDED. Available credit: %', v_available_credit;
    END IF;

    -- Calculate due date automatically based on terms
    v_due_date := CURRENT_DATE + v_payment_terms_days;
  END IF;

  -- 5. Generate Order Number
  v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(md5(random()::text) from 1 for 4));

  -- 6. Insert Order
  INSERT INTO public.orders (order_number, customer_id, status, notes, sales_person_id, total_amount, paid_amount, payment_type, due_date)
  VALUES (v_order_number, p_customer_id, 'pending', p_notes, auth.uid(), v_total_amount, 0, p_payment_type, v_due_date)
  RETURNING id INTO v_order_id;

  -- 7. Insert Order Items using the securely fetched prices
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity integer, warehouse_id uuid)
  LOOP
    v_product_price := public.fn_get_current_product_price(v_item.product_id);
    
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, standard_price, warehouse_id)
    VALUES (v_order_id, v_item.product_id, v_item.quantity, v_product_price, v_product_price, v_item.warehouse_id)
    RETURNING id INTO v_inserted_item_id;
  END LOOP;

  -- 8. Audit Log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'order_created', 'orders', v_order_id, jsonb_build_object('order_number', v_order_number, 'total_amount', v_total_amount, 'payment_type', p_payment_type));

  RETURN v_order_id;
END;
$$;

-- 7. Create Indexes
CREATE INDEX IF NOT EXISTS idx_customer_credit_settings_customer_id ON public.customer_credit_settings(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_type ON public.orders(payment_type);

