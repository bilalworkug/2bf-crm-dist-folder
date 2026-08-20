CREATE OR REPLACE FUNCTION public.fn_get_all_policies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'tablename', tablename,
      'policyname', policyname,
      'roles', roles,
      'cmd', cmd,
      'qual', qual
    )
  )
  INTO v_result
  FROM pg_policies
  WHERE schemaname = 'public';
  
  RETURN v_result;
END;
$$;
