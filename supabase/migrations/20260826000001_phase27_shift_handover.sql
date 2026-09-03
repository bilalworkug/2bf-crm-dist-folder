-- =========================================================================
-- Phase 27: Dedicated Shift Handover Storage
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.shift_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  shift text NOT NULL,
  handover_date date NOT NULL DEFAULT CURRENT_DATE,
  machine_status text,
  boxes_completed integer DEFAULT 0,
  issues text,
  pending_tasks text,
  next_shift_instructions text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_handovers_dept_date ON public.shift_handovers(department, handover_date DESC);

ALTER TABLE public.shift_handovers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_read_shift_handovers" ON public.shift_handovers;
CREATE POLICY "allow_authenticated_read_shift_handovers" ON public.shift_handovers
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "allow_authenticated_insert_shift_handovers" ON public.shift_handovers;
CREATE POLICY "allow_authenticated_insert_shift_handovers" ON public.shift_handovers
FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
