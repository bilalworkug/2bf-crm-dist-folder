-- =============================================================
-- Phase 5: RLS Policies for Delivery
-- =============================================================

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deliveries_select" ON public.deliveries;
CREATE POLICY "deliveries_select" ON public.deliveries
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "delivery_items_select" ON public.delivery_items;
CREATE POLICY "delivery_items_select" ON public.delivery_items
  FOR SELECT TO authenticated USING (true);
