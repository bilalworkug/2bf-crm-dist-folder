-- =========================================================================
-- Phase 23 FIX v2: Use trigger to protect profile sensitive fields
-- =========================================================================
-- PROBLEM: RLS WITH CHECK that calls get_current_role() during UPDATE on the
-- same profiles table sees the tentatively updated row, allowing users to
-- change their own role. This is a PostgreSQL self-referential RLS bypass.
--
-- SOLUTION: A BEFORE UPDATE trigger has access to OLD/NEW directly and runs
-- before the row is committed. For self-updates, we check OLD.role (which is
-- guaranteed to be the pre-update value) without querying the table again.
-- =========================================================================

-- Step 1: Create the trigger function
CREATE OR REPLACE FUNCTION public.fn_protect_profile_fields()
RETURNS trigger AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- Determine the caller's current role
  IF auth.uid() = OLD.id THEN
    -- Self-update: use OLD.role directly (avoids self-referential query issue)
    v_caller_role := OLD.role;
  ELSE
    -- Admin updating another user's profile: look up caller's role
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  END IF;

  -- If caller is admin, allow any change
  IF v_caller_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Non-admin users: block changes to sensitive fields
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Only admin can change user roles.';
  END IF;

  IF NEW.active IS DISTINCT FROM OLD.active THEN
    RAISE EXCEPTION 'Only admin can change user active status.';
  END IF;

  IF NEW.warehouse_id IS DISTINCT FROM OLD.warehouse_id THEN
    RAISE EXCEPTION 'Only admin can change warehouse assignment.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Attach trigger
DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_protect_profile_fields();

-- Step 3: Simplify RLS policies (field-level protection is now in the trigger)
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;

-- Users can update their own row (trigger blocks sensitive field changes)
CREATE POLICY "profiles_self_update" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admin can do everything
CREATE POLICY "profiles_admin_all" ON public.profiles
FOR ALL TO authenticated
USING (public.get_current_role() = 'admin')
WITH CHECK (public.get_current_role() = 'admin');
