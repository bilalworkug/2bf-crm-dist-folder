-- Fix fn_approve_discount to not trust client-supplied roles

DROP FUNCTION IF EXISTS public.fn_approve_discount(uuid, boolean, uuid, text);
DROP FUNCTION IF EXISTS public.fn_approve_discount(uuid, boolean, uuid, character varying);

CREATE OR REPLACE FUNCTION public.fn_approve_discount(
    p_order_item_id uuid,
    p_is_approved boolean
) RETURNS void AS $$
DECLARE
    v_manager_role text;
    v_manager_id uuid;
BEGIN
    v_manager_id := auth.uid();
    
    SELECT role INTO v_manager_role
    FROM public.profiles
    WHERE id = v_manager_id;

    IF v_manager_role NOT IN ('admin', 'sales_manager') THEN
        RAISE EXCEPTION 'Unauthorized: Only Admin or Sales Manager can approve discounts.';
    END IF;

    UPDATE public.order_items
    SET 
        discount_status = CASE WHEN p_is_approved THEN 'approved' ELSE 'rejected' END,
        unit_price = CASE WHEN p_is_approved THEN unit_price ELSE standard_price END
    WHERE id = p_order_item_id AND discount_status = 'pending';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.fn_approve_discount(uuid, boolean) TO authenticated;
