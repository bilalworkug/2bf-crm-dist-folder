-- =========================================================================
-- Phase 27: Automated Operational Notifications
-- =========================================================================

-- 1. Create the app_notifications table (In-App Inbox)
CREATE TABLE IF NOT EXISTS public.app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action_url text,
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(recipient_id, type, entity_id) -- Prevent duplicate notification types for the same entity and recipient
);

-- 2. Create the notification_deliveries table (External Channel Queue)
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.app_notifications(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'failed', 'skipped')),
  attempt_count integer DEFAULT 0,
  provider text,
  provider_message_id text,
  last_error text,
  idempotency_key text UNIQUE NOT NULL,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_notifications_recipient ON public.app_notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notifications_unread ON public.app_notifications(recipient_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_pending ON public.notification_deliveries(status, next_attempt_at) WHERE status IN ('pending', 'failed');

-- RLS
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_own_notifications" ON public.app_notifications 
FOR SELECT TO authenticated USING (recipient_id = auth.uid());

CREATE POLICY "update_own_notifications" ON public.app_notifications 
FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

-- Normal users cannot access deliveries
CREATE POLICY "admin_read_deliveries" ON public.notification_deliveries 
FOR ALL TO authenticated USING (public.current_user_is_admin());

-- 3. Triggers for Business Events

-- A. Payment Pending Approval
CREATE OR REPLACE FUNCTION public.fn_trigger_payment_app_notification()
RETURNS trigger AS $$
DECLARE
  v_recipient record;
BEGIN
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') THEN
    -- Notify all accounts and admins
    FOR v_recipient IN SELECT id FROM public.profiles WHERE role IN ('accounts', 'accounts_manager', 'admin', 'manager') LOOP
      INSERT INTO public.app_notifications (recipient_id, type, title, message, entity_type, entity_id, action_url)
      VALUES (
        v_recipient.id, 
        'payment_pending_approval', 
        'Payment Awaiting Approval', 
        'Payment of ' || NEW.amount || ' ' || NEW.currency || ' requires review.', 
        'payments', 
        NEW.id::text, 
        '/account/payments'
      ) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_payment_app_notification ON public.payments;
CREATE TRIGGER trg_payment_app_notification
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_payment_app_notification();

-- B. Order Status Notifications (Ready for Dispatch & Dispatched)
CREATE OR REPLACE FUNCTION public.fn_trigger_order_app_notification()
RETURNS trigger AS $$
DECLARE
  v_recipient record;
  v_notif_id uuid;
BEGIN
  -- Ready for Dispatch (status = pending in our system)
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') THEN
    FOR v_recipient IN SELECT id FROM public.profiles WHERE role IN ('dispatch', 'dispatch_manager', 'manager', 'admin') LOOP
      INSERT INTO public.app_notifications (recipient_id, type, title, message, entity_type, entity_id, action_url)
      VALUES (
        v_recipient.id, 
        'order_ready_for_dispatch', 
        'Order Ready for Dispatch', 
        'Order ' || NEW.order_number || ' is pending dispatch.', 
        'orders', 
        NEW.id::text, 
        '/dispatch'
      ) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Dispatched
  IF NEW.status = 'dispatched' AND (TG_OP = 'INSERT' OR OLD.status != 'dispatched') THEN
    -- In-App notification for the customer (if they were a user, but we will target internal roles for now to monitor)
    -- Also queue external Email/SMS if customer has contact info
    FOR v_recipient IN SELECT id FROM public.profiles WHERE role IN ('admin', 'manager') LOOP
      INSERT INTO public.app_notifications (recipient_id, type, title, message, entity_type, entity_id, action_url)
      VALUES (
        v_recipient.id, 
        'order_dispatched', 
        'Order Dispatched', 
        'Order ' || NEW.order_number || ' has been dispatched.', 
        'orders', 
        NEW.id::text, 
        '/orders/detail?id=' || NEW.id
      ) ON CONFLICT DO NOTHING;
    END LOOP;

    -- We do not natively queue Email/SMS in the trigger to avoid hardcoding provider logic, 
    -- but we can insert a dummy delivery record that our background worker picks up and enriches.
    -- To keep it decoupled: We will insert a system-level notification (no recipient_id) that the worker maps to the customer.
    -- However, recipient_id is NOT NULL. 
    -- Instead, the Next.js background worker will scan `orders` that were updated to 'dispatched' and handle customer comms idempotently.
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_order_app_notification ON public.orders;
CREATE TRIGGER trg_order_app_notification
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_order_app_notification();
