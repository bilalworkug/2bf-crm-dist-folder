-- =========================================================================
-- Phase 20: Payment, Customer Debt & Due-Date Management
-- =========================================================================

-- 1. Create Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'ETB',
  payment_method text NOT NULL,
  payment_date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'reversed')),
  reference_number text,
  notes text,
  submitted_by uuid NOT NULL REFERENCES public.profiles(id),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create Payment Documents Table
CREATE TABLE IF NOT EXISTS public.payment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  uploaded_at timestamptz DEFAULT now()
);

-- 3. Update Orders to track Due Date
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'due_date') THEN
    ALTER TABLE public.orders ADD COLUMN due_date date;
  END IF;
END $$;

-- 4. Create Notifications Table for Automatic Reminders
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, -- e.g., 'due_soon', 'overdue'
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  reference_id uuid NOT NULL, -- The order_id
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  milestone text NOT NULL, -- e.g., '7_days', '3_days', '1_day', 'today', 'overdue_1'
  created_at timestamptz DEFAULT now(),
  UNIQUE(reference_id, milestone) -- Prevents duplicate notifications for the same milestone on the same order
);

-- 5. Storage Bucket for Payment Proofs (Private)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment_proofs', 'payment_proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Accounts and Admins can manage payment proofs" ON storage.objects;
CREATE POLICY "Accounts and Admins can manage payment proofs"
ON storage.objects FOR ALL
USING (
  bucket_id = 'payment_proofs' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'accounts', 'accounts_manager')
  )
);

-- 6. Row Level Security (RLS)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Payments RLS
DROP POLICY IF EXISTS "Account and Admin manage payments" ON public.payments;
CREATE POLICY "Account and Admin manage payments" ON public.payments
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'accounts', 'accounts_manager'))
);

DROP POLICY IF EXISTS "Sales can view their customer payments" ON public.payments;
CREATE POLICY "Sales can view their customer payments" ON public.payments
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('sales', 'sales_manager'))
);

-- Payment Documents RLS
DROP POLICY IF EXISTS "Account and Admin manage payment documents" ON public.payment_documents;
CREATE POLICY "Account and Admin manage payment documents" ON public.payment_documents
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'accounts', 'accounts_manager'))
);

-- Notifications RLS
DROP POLICY IF EXISTS "Account and Admin manage notifications" ON public.notifications;
CREATE POLICY "Account and Admin manage notifications" ON public.notifications
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'accounts', 'accounts_manager'))
);

-- 7. RPC: Submit Payment
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

-- 8. RPC: Approve Payment
CREATE OR REPLACE FUNCTION public.fn_approve_payment(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_role text;
  v_payment record;
  v_order record;
BEGIN
  -- Validate Role
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'accounts', 'accounts_manager') THEN
    RAISE EXCEPTION 'Unauthorized: only account and admin users can approve payments.';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
  IF v_payment.status != 'pending' THEN RAISE EXCEPTION 'Payment is not pending.'; END IF;

  -- Update Payment
  UPDATE public.payments 
  SET status = 'approved', approved_by = auth.uid(), approved_at = now()
  WHERE id = p_payment_id;

  -- Update Order Paid Amount
  UPDATE public.orders 
  SET paid_amount = paid_amount + v_payment.amount, updated_at = now()
  WHERE id = v_payment.order_id
  RETURNING * INTO v_order;

  -- Audit Log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'payment_approved', 'payments', p_payment_id, 
    jsonb_build_object(
      'order_id', v_payment.order_id, 
      'amount', v_payment.amount,
      'new_paid_amount', v_order.paid_amount,
      'outstanding_balance', v_order.total_amount - v_order.paid_amount
    )
  );
END;
$$;

-- 9. RPC: Reject Payment
CREATE OR REPLACE FUNCTION public.fn_reject_payment(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_role text;
  v_payment record;
BEGIN
  -- Validate Role
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'accounts', 'accounts_manager') THEN
    RAISE EXCEPTION 'Unauthorized: only account and admin users can reject payments.';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
  IF v_payment.status != 'pending' THEN RAISE EXCEPTION 'Only pending payments can be rejected.'; END IF;

  -- Update Payment
  UPDATE public.payments 
  SET status = 'rejected', updated_at = now()
  WHERE id = p_payment_id;

  -- Audit Log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'payment_rejected', 'payments', p_payment_id, jsonb_build_object('order_id', v_payment.order_id, 'amount', v_payment.amount));
END;
$$;

-- 10. RPC: Set Due Date
CREATE OR REPLACE FUNCTION public.fn_set_order_due_date(p_order_id uuid, p_due_date date)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_role text;
BEGIN
  -- Validate Role
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'accounts', 'accounts_manager') THEN
    RAISE EXCEPTION 'Unauthorized: only account users can set due dates.';
  END IF;

  UPDATE public.orders SET due_date = p_due_date, updated_at = now() WHERE id = p_order_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'payment_due_date_changed', 'orders', p_order_id, jsonb_build_object('new_due_date', p_due_date));
END;
$$;

-- 11. RPC: Notification Cron Processor
CREATE OR REPLACE FUNCTION public.fn_check_due_payments()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_days_diff integer;
  v_milestone text;
  v_message text;
  v_outstanding numeric;
BEGIN
  -- We don't restrict by role here because this could be run via cron (pg_cron)
  -- Find orders with a due date that have an outstanding balance > 0
  FOR v_order IN 
    SELECT o.*, (o.total_amount - o.paid_amount) as outstanding, c.customer_name 
    FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    WHERE o.due_date IS NOT NULL AND (o.total_amount - o.paid_amount) > 0
  LOOP
    v_outstanding := v_order.outstanding;
    v_days_diff := v_order.due_date - CURRENT_DATE;

    v_milestone := NULL;
    IF v_days_diff = 7 THEN
      v_milestone := '7_days';
      v_message := 'Payment due in 7 days for ' || v_order.customer_name || '. Outstanding: ' || v_outstanding || ' ETB.';
    ELSIF v_days_diff = 3 THEN
      v_milestone := '3_days';
      v_message := 'Payment due in 3 days for ' || v_order.customer_name || '. Outstanding: ' || v_outstanding || ' ETB.';
    ELSIF v_days_diff = 1 THEN
      v_milestone := '1_day';
      v_message := 'Payment due tomorrow for ' || v_order.customer_name || '. Outstanding: ' || v_outstanding || ' ETB.';
    ELSIF v_days_diff = 0 THEN
      v_milestone := 'today';
      v_message := 'Payment due today for ' || v_order.customer_name || '. Outstanding: ' || v_outstanding || ' ETB.';
    ELSIF v_days_diff < 0 THEN
      -- Create an overdue notification every 7 days overdue
      v_milestone := 'overdue_' || ABS(v_days_diff);
      IF MOD(ABS(v_days_diff), 7) = 0 OR v_days_diff = -1 THEN
        v_message := 'Payment OVERDUE by ' || ABS(v_days_diff) || ' days for ' || v_order.customer_name || '. Outstanding: ' || v_outstanding || ' ETB.';
      ELSE
        v_milestone := NULL;
      END IF;
    END IF;

    IF v_milestone IS NOT NULL THEN
      -- Insert using ON CONFLICT to avoid duplicates
      INSERT INTO public.notifications (type, customer_id, reference_id, message, milestone)
      VALUES (
        CASE WHEN v_days_diff < 0 THEN 'overdue' ELSE 'due_soon' END,
        v_order.customer_id, 
        v_order.id, 
        v_message, 
        v_milestone
      )
      ON CONFLICT (reference_id, milestone) DO NOTHING;
    END IF;

  END LOOP;
END;
$$;
