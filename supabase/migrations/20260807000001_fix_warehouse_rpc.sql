-- =============================================================
-- DEFINITIVE FIX: Warehouse Receiving RLS + RPC
-- File: 20260807000001_fix_warehouse_rpc.sql
--
-- SCOPE: ONLY modifies warehouse_receipts RLS and fn_receive_box.
-- Does NOT modify Production, Dispatch, Orders, Reports, or Dashboards.
-- =============================================================

-- =============================================================
-- PART 1: FIX RLS ON warehouse_receipts
-- =============================================================

-- Drop ALL conflicting old policies on warehouse_receipts
DROP POLICY IF EXISTS "read_warehouse_receipts" ON public.warehouse_receipts;
DROP POLICY IF EXISTS "write_warehouse_receipts" ON public.warehouse_receipts;
DROP POLICY IF EXISTS "Warehouse receipts visibility" ON public.warehouse_receipts;
DROP POLICY IF EXISTS "Allow all modifications if authenticated" ON public.warehouse_receipts;
DROP POLICY IF EXISTS "warehouse_receipts_select" ON public.warehouse_receipts;
DROP POLICY IF EXISTS "warehouse_receipts_insert" ON public.warehouse_receipts;
DROP POLICY IF EXISTS "warehouse_receipts_update" ON public.warehouse_receipts;
DROP POLICY IF EXISTS "warehouse_receipts_delete" ON public.warehouse_receipts;

-- SELECT: All authenticated users except accounts can read warehouse_receipts.
-- Warehouse users are filtered to only see their warehouse.
CREATE POLICY "warehouse_receipts_select" ON public.warehouse_receipts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('accounts', 'accounts_manager')
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'warehouse'
      )
      OR warehouse_id = (
        SELECT profiles.warehouse_id FROM public.profiles WHERE profiles.id = auth.uid()
      )
    )
  );

-- INSERT: Warehouse, warehouse_manager, admin, manager roles can insert.
-- SECURITY DEFINER on the RPC is the primary insert path, but this policy
-- acts as a safety net for direct inserts.
CREATE POLICY "warehouse_receipts_insert" ON public.warehouse_receipts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'warehouse', 'warehouse_manager', 'manager')
    )
  );

-- UPDATE: Admin and warehouse_manager only (e.g. corrections).
CREATE POLICY "warehouse_receipts_update" ON public.warehouse_receipts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'warehouse_manager', 'manager')
    )
  );

-- DELETE: Admin only. Warehouse cannot delete receipts.
CREATE POLICY "warehouse_receipts_delete" ON public.warehouse_receipts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- =============================================================
-- PART 2: CREATE fn_receive_box RPC
-- Uses SECURITY DEFINER to bypass RLS and write to all tables.
-- All authorization is enforced INSIDE the function.
-- =============================================================

-- Drop old overloads if any exist
DROP FUNCTION IF EXISTS public.fn_receive_box(text, uuid, uuid);
DROP FUNCTION IF EXISTS public.fn_receive_box(character varying, uuid, uuid);

CREATE OR REPLACE FUNCTION public.fn_receive_box(
  p_barcode     text,
  p_warehouse_id uuid,
  p_user_id     uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role         text;
  v_box          record;
  v_warehouse    record;
  v_scan         record;
  v_receipt_id   uuid;
BEGIN

  -- -------------------------------------------------------
  -- STEP 1: Validate inputs
  -- -------------------------------------------------------
  IF p_barcode IS NULL OR trim(p_barcode) = '' THEN
    RAISE EXCEPTION 'Invalid barcode: barcode cannot be empty.';
  END IF;

  IF p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Invalid warehouse: warehouse must be specified.';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to receive stock.';
  END IF;

  -- -------------------------------------------------------
  -- STEP 2: Authorize — only warehouse roles may receive
  -- -------------------------------------------------------
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('admin', 'warehouse', 'warehouse_manager', 'manager') THEN
    -- Audit the unauthorized attempt
    INSERT INTO public.audit_logs (user_id, action, entity_type, barcode, details)
    VALUES (
      auth.uid(),
      'unauthorized_receive_attempt',
      'warehouse_receipts',
      p_barcode,
      jsonb_build_object('role', COALESCE(v_role, 'unknown'), 'warehouse_id', p_warehouse_id)
    );
    RAISE EXCEPTION 'You do not have permission to receive stock.';
  END IF;

  -- -------------------------------------------------------
  -- STEP 3: Verify warehouse exists
  -- -------------------------------------------------------
  SELECT id INTO v_warehouse
  FROM public.warehouses
  WHERE id = p_warehouse_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse not found.';
  END IF;

  -- -------------------------------------------------------
  -- STEP 4: Verify barcode exists and was produced
  -- -------------------------------------------------------
  SELECT * INTO v_box
  FROM public.boxes
  WHERE barcode = p_barcode;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barcode not found: this box has not been produced yet.';
  END IF;

  -- -------------------------------------------------------
  -- STEP 5: Validate state transition — only produced → received
  -- -------------------------------------------------------
  IF v_box.status = 'received' OR v_box.status = 'in_warehouse' THEN
    RAISE EXCEPTION 'Duplicate receiving rejected: this box has already been received into a warehouse.';
  END IF;

  IF v_box.status NOT IN ('produced') THEN
    RAISE EXCEPTION 'Invalid state transition: box is currently ''%''. Only produced boxes can be received.', v_box.status;
  END IF;

  -- -------------------------------------------------------
  -- STEP 6: Fetch the production_scan record (for FK)
  -- -------------------------------------------------------
  SELECT id INTO v_scan
  FROM public.production_scans
  WHERE barcode = p_barcode
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production record not found for barcode %. Cannot receive without a production record.', p_barcode;
  END IF;

  -- -------------------------------------------------------
  -- STEP 7: Insert into warehouse_receipts
  -- -------------------------------------------------------
  INSERT INTO public.warehouse_receipts (
    barcode,
    warehouse_id,
    product_id,
    received_by,
    received_at,
    quantity
  )
  VALUES (
    p_barcode,
    p_warehouse_id,
    v_box.product_id,
    p_user_id,
    now(),
    1
  )
  RETURNING id INTO v_receipt_id;

  -- -------------------------------------------------------
  -- STEP 8: Update box status → received
  -- -------------------------------------------------------
  UPDATE public.boxes
  SET
    status             = 'received',
    current_warehouse_id = p_warehouse_id,
    updated_at         = now()
  WHERE barcode = p_barcode;

  -- -------------------------------------------------------
  -- STEP 9: Insert stock movement (inventory +1)
  -- -------------------------------------------------------
  INSERT INTO public.stock_movements (
    barcode,
    product_id,
    warehouse_id,
    movement_type,
    quantity,
    user_id,
    created_at
  )
  VALUES (
    p_barcode,
    v_box.product_id,
    p_warehouse_id,
    'RECEIVE',
    1,
    p_user_id,
    now()
  );

  -- -------------------------------------------------------
  -- STEP 10: Insert barcode history (RECEIVED event)
  -- -------------------------------------------------------
  INSERT INTO public.barcode_history (
    barcode,
    action,
    product_id,
    warehouse_id,
    user_id,
    performed_at
  )
  VALUES (
    p_barcode,
    'RECEIVED',
    v_box.product_id,
    p_warehouse_id,
    p_user_id,
    now()
  );

  -- -------------------------------------------------------
  -- STEP 11: Insert audit log (success)
  -- -------------------------------------------------------
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    warehouse_id,
    product_id,
    barcode,
    details
  )
  VALUES (
    auth.uid(),
    'box_received',
    'warehouse_receipts',
    v_receipt_id,
    p_warehouse_id,
    v_box.product_id,
    p_barcode,
    jsonb_build_object(
      'barcode',      p_barcode,
      'warehouse_id', p_warehouse_id,
      'product_id',   v_box.product_id,
      'received_by',  p_user_id,
      'previous_status', v_box.status
    )
  );

  -- All operations committed as one transaction.

EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise known application errors as-is (clean user messages)
    IF SQLERRM LIKE 'Duplicate receiving rejected%'
    OR SQLERRM LIKE 'Barcode not found%'
    OR SQLERRM LIKE 'Invalid state transition%'
    OR SQLERRM LIKE 'Warehouse not found%'
    OR SQLERRM LIKE 'Production record not found%'
    OR SQLERRM LIKE 'You do not have permission%'
    OR SQLERRM LIKE 'Invalid barcode%'
    OR SQLERRM LIKE 'You must be logged in%'
    OR SQLERRM LIKE 'Invalid warehouse%'
    THEN
      RAISE;
    END IF;

    -- Log unexpected system errors for debugging
    BEGIN
      INSERT INTO public.audit_logs (user_id, action, entity_type, barcode, details)
      VALUES (
        auth.uid(),
        'receive_system_error',
        'warehouse_receipts',
        p_barcode,
        jsonb_build_object('error', SQLERRM, 'barcode', p_barcode)
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;

    RAISE EXCEPTION 'Receiving failed due to a system error: %. Please retry or contact support.', SQLERRM;
END;
$$;

-- Grant execute to authenticated users (RPC call from frontend)
GRANT EXECUTE ON FUNCTION public.fn_receive_box(text, uuid, uuid) TO authenticated;
