-- Run this to get schema of a table
CREATE OR REPLACE FUNCTION public.fn_get_schema(p_table text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec jsonb;
BEGIN
  SELECT jsonb_agg(column_name) INTO v_rec
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = p_table;
  RETURN v_rec;
END;
$$;
