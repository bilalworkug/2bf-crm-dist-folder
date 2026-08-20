-- =========================================================================
-- Phase 23 FIX: Complete profiles RLS security with helper functions
-- =========================================================================

-- Step 1: Create/recreate all helper functions (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_warehouse_id()
RETURNS uuid AS $$
DECLARE
  v_wh_id uuid;
BEGIN
  SELECT warehouse_id INTO v_wh_id FROM public.profiles WHERE id = auth.uid();
  RETURN v_wh_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_active()
RETURNS boolean AS $$
DECLARE
  v_active boolean;
BEGIN
  SELECT active INTO v_active FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_active, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Drop old problematic policies
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "Allow all modifications if authenticated" ON public.profiles;

-- Step 3: Users can update ONLY their own row, cannot change role/active/warehouse_id
CREATE POLICY "profiles_self_update" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = public.get_current_role()
  AND active = public.get_current_active()
  AND warehouse_id IS NOT DISTINCT FROM public.get_current_warehouse_id()
);

-- Step 4: Admin full access
CREATE POLICY "profiles_admin_all" ON public.profiles
FOR ALL TO authenticated
USING (
  public.get_current_role() = 'admin'
)
WITH CHECK (
  public.get_current_role() = 'admin'
);
