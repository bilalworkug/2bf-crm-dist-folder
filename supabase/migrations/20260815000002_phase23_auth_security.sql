-- =========================================================================
-- Phase 23: Authentication & User Management Security Fix
-- =========================================================================
-- AUDIT FINDINGS:
--   1. The "Allow all modifications if authenticated" policy on profiles
--      lets ANY logged-in user change ANY profile row, including their own role.
--      This is a critical security vulnerability.
--   2. Fix: Replace the blanket profiles write policy with strict policies:
--      - Users can update ONLY their own profile
--      - Users can ONLY change full_name, phone, updated_at (NOT role, active, warehouse_id)
--      - Only admin can insert, update role/active/warehouse_id, or delete profiles
-- =========================================================================

-- Step 1: Drop the overly permissive profiles write policy
DROP POLICY IF EXISTS "Allow all modifications if authenticated" ON public.profiles;

-- Step 2: Create strict profile self-update policy
-- Users can update their own row, but ONLY non-sensitive fields.
-- We use a CHECK to verify that role, active, and warehouse_id are NOT being changed
-- by non-admin users.
CREATE POLICY "profiles_self_update" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  -- Admin can change anything on any profile (handled by separate admin policy)
  -- Non-admin users: can only update their own row AND cannot change role/active/warehouse_id
  id = auth.uid()
  AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  AND active = (SELECT p.active FROM public.profiles p WHERE p.id = auth.uid())
  AND (
    warehouse_id IS NOT DISTINCT FROM (SELECT p.warehouse_id FROM public.profiles p WHERE p.id = auth.uid())
  )
);

-- Step 3: Admin can do anything with profiles
CREATE POLICY "profiles_admin_all" ON public.profiles
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Step 4: Allow inserts only by admin (for user creation)
-- The self_update policy above is FOR UPDATE only, so non-admins cannot INSERT or DELETE.
-- The admin_all policy covers admin inserts/deletes.
-- No additional policy needed.

-- Step 5: Create a secure RPC for changing own password
-- (Password change is handled by Supabase Auth client-side, no custom RPC needed)
-- But we create an RPC for admin user creation that is SECURITY DEFINER
-- to properly create auth users + profiles in one transaction.

CREATE OR REPLACE FUNCTION public.fn_admin_create_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_warehouse_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role text;
  v_new_user_id uuid;
BEGIN
  -- 1. Verify caller is admin
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in.';
  END IF;
  
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = auth.uid();
  IF v_admin_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: only Admin can create users.';
  END IF;

  -- 2. Validate role exists
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE key = p_role) THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- 3. Create auth user via Supabase internal function
  -- Note: We cannot call supabase.auth.admin.createUser from SQL.
  -- The auth user must be created from the frontend using the admin API.
  -- This RPC only creates the profile row after the auth user is created.
  -- So we repurpose this as fn_admin_create_profile.
  
  RAISE EXCEPTION 'Use client-side admin API to create auth users. This RPC is not needed.';
END;
$$;

-- Actually, let's drop that and create a simpler RPC for admin to update user roles
-- since that's the real security concern (preventing non-admin role changes via direct API)
DROP FUNCTION IF EXISTS public.fn_admin_create_user(text, text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.fn_admin_update_user_role(
  p_user_id uuid,
  p_role text,
  p_active boolean DEFAULT NULL,
  p_warehouse_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role text;
  v_old_role text;
  v_old_active boolean;
BEGIN
  -- 1. Verify caller is admin
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in.';
  END IF;
  
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = auth.uid();
  IF v_admin_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: only Admin can manage user roles.';
  END IF;

  -- 2. Validate role exists
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE key = p_role) THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- 3. Get old values for audit
  SELECT role, active INTO v_old_role, v_old_active
  FROM public.profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found.';
  END IF;

  -- 4. Update
  UPDATE public.profiles SET
    role = p_role,
    active = COALESCE(p_active, active),
    warehouse_id = p_warehouse_id,
    updated_at = now()
  WHERE id = p_user_id;

  -- 5. Audit log
  IF v_old_role != p_role THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'user_role_changed', 'profiles', p_user_id,
      jsonb_build_object('old_role', v_old_role, 'new_role', p_role));
  END IF;
  
  IF p_active IS NOT NULL AND v_old_active != p_active THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), CASE WHEN p_active THEN 'user_activated' ELSE 'user_deactivated' END, 'profiles', p_user_id,
      jsonb_build_object('user_id', p_user_id));
  END IF;
END;
$$;
