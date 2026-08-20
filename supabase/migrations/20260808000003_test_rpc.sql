-- Run this to get records bypassing RLS
CREATE OR REPLACE FUNCTION public.fn_test_get_dispatch(p_barcode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec jsonb;
BEGIN
  SELECT jsonb_build_object(
    'dispatch', (SELECT to_jsonb(d.*) FROM public.dispatches d WHERE barcode = p_barcode),
    'sm', (SELECT to_jsonb(s.*) FROM public.stock_movements s WHERE barcode = p_barcode AND movement_type = 'OUT'),
    'bh', (SELECT to_jsonb(b.*) FROM public.barcode_history b WHERE barcode = p_barcode AND action = 'DISPATCHED'),
    'al', (SELECT to_jsonb(a.*) FROM public.audit_logs a WHERE barcode = p_barcode AND action = 'box_dispatched')
  ) INTO v_rec;
  RETURN v_rec;
END;
$$;
