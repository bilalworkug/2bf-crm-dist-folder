-- =============================================================
-- FIX: Missing RLS policies for dispatches
-- Run this in the Supabase SQL Editor.
-- =============================================================

ALTER TABLE public.dispatches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dispatches_select" ON public.dispatches;
CREATE POLICY "dispatches_select" ON public.dispatches
  FOR SELECT TO authenticated USING (true);
