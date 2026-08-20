-- =========================================================================
-- Phase 20: Fix existing payments table
-- =========================================================================

-- 1. Add missing columns to payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id),
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'ETB',
  ADD COLUMN IF NOT EXISTS payment_date timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Backfill existing data to preserve history
UPDATE public.payments p
SET 
  customer_id = o.customer_id,
  payment_date = p.processed_at,
  status = 'approved',
  submitted_by = p.processed_by,
  approved_by = p.processed_by,
  approved_at = p.processed_at
FROM public.orders o
WHERE p.order_id = o.id AND p.customer_id IS NULL;

-- 3. Now enforce NOT NULL constraints where applicable
ALTER TABLE public.payments ALTER COLUMN customer_id SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN payment_date SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN submitted_by SET NOT NULL;

-- 4. Re-create the RPC functions with the correct column names (some existed from the previous migration but failed to run successfully due to schema mismatch)

CREATE OR REPLACE FUNCTION public.fn_submit_payment(
  p_order_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_payment_date timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_role text;
  v_customer_id uuid;
  v_payment_id uuid;
BEGIN
  -- Validate Role
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'accounts', 'accounts_manager') THEN
    RAISE EXCEPTION 'Unauthorized: only account users can submit payments.';
  END IF;

  IF p_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero.'; END IF;

  SELECT customer_id INTO v_customer_id FROM public.orders WHERE id = p_order_id;
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Order not found.'; END IF;

  INSERT INTO public.payments (order_id, customer_id, amount, payment_method, payment_date, reference_number, notes, submitted_by, status)
  VALUES (p_order_id, v_customer_id, p_amount, p_payment_method, p_payment_date, p_reference, p_notes, auth.uid(), 'pending')
  RETURNING id INTO v_payment_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'payment_submitted', 'payments', v_payment_id, jsonb_build_object('order_id', p_order_id, 'amount', p_amount));

  RETURN v_payment_id;
END;
$$;
