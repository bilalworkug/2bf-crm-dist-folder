-- =============================================================
-- Phase 7: Strict RLS Security Hardening (Writes)
-- Restoring and securing INSERT/UPDATE/DELETE access 
-- =============================================================

-- ORDERS
DROP POLICY IF EXISTS "orders_strict_insert" ON public.orders;
CREATE POLICY "orders_strict_insert" ON public.orders FOR INSERT TO authenticated
WITH CHECK (auth_user_role() IN ('admin', 'manager', 'sales', 'sales_manager', 'accounts'));

DROP POLICY IF EXISTS "orders_strict_update" ON public.orders;
CREATE POLICY "orders_strict_update" ON public.orders FOR UPDATE TO authenticated
USING (auth_user_role() IN ('admin', 'manager', 'sales', 'sales_manager', 'accounts'));

DROP POLICY IF EXISTS "orders_strict_delete" ON public.orders;
CREATE POLICY "orders_strict_delete" ON public.orders FOR DELETE TO authenticated
USING (auth_user_role() IN ('admin', 'manager'));

-- CUSTOMERS
DROP POLICY IF EXISTS "customers_strict_insert" ON public.customers;
CREATE POLICY "customers_strict_insert" ON public.customers FOR INSERT TO authenticated
WITH CHECK (auth_user_role() IN ('admin', 'manager', 'sales', 'sales_manager', 'accounts'));

DROP POLICY IF EXISTS "customers_strict_update" ON public.customers;
CREATE POLICY "customers_strict_update" ON public.customers FOR UPDATE TO authenticated
USING (auth_user_role() IN ('admin', 'manager', 'sales', 'sales_manager', 'accounts'));

DROP POLICY IF EXISTS "customers_strict_delete" ON public.customers;
CREATE POLICY "customers_strict_delete" ON public.customers FOR DELETE TO authenticated
USING (auth_user_role() IN ('admin', 'manager'));

-- PAYMENTS
DROP POLICY IF EXISTS "payments_strict_insert" ON public.payments;
CREATE POLICY "payments_strict_insert" ON public.payments FOR INSERT TO authenticated
WITH CHECK (auth_user_role() IN ('admin', 'manager', 'sales', 'sales_manager', 'accounts'));

DROP POLICY IF EXISTS "payments_strict_update" ON public.payments;
CREATE POLICY "payments_strict_update" ON public.payments FOR UPDATE TO authenticated
USING (auth_user_role() IN ('admin', 'manager', 'sales', 'sales_manager', 'accounts'));

-- AUDIT LOGS
-- Frontend inserts audit logs for various actions (orders, etc), so we must allow all authenticated users to insert
DROP POLICY IF EXISTS "audit_logs_strict_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_strict_insert" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (true);

-- BOXES, DISPATCHES, DELIVERIES, RETURNS, PRODUCTION SCANS, BARCODE HISTORY
-- Most writes are handled via SECURITY DEFINER RPCs which bypass RLS.
-- However, for any direct frontend updates (like corrections), we grant access to admins/managers.
DROP POLICY IF EXISTS "boxes_strict_update" ON public.boxes;
CREATE POLICY "boxes_strict_update" ON public.boxes FOR UPDATE TO authenticated
USING (auth_user_role() IN ('admin', 'manager', 'production_manager', 'warehouse_manager', 'sales_manager', 'dispatch_manager', 'returns_manager'));

DROP POLICY IF EXISTS "dispatches_strict_update" ON public.dispatches;
CREATE POLICY "dispatches_strict_update" ON public.dispatches FOR UPDATE TO authenticated
USING (auth_user_role() IN ('admin', 'manager', 'dispatch_manager'));

DROP POLICY IF EXISTS "deliveries_strict_update" ON public.deliveries;
CREATE POLICY "deliveries_strict_update" ON public.deliveries FOR UPDATE TO authenticated
USING (auth_user_role() IN ('admin', 'manager', 'dispatch_manager'));

DROP POLICY IF EXISTS "returns_strict_update" ON public.returns;
CREATE POLICY "returns_strict_update" ON public.returns FOR UPDATE TO authenticated
USING (auth_user_role() IN ('admin', 'manager', 'returns_manager'));

DROP POLICY IF EXISTS "barcode_history_strict_insert" ON public.barcode_history;
CREATE POLICY "barcode_history_strict_insert" ON public.barcode_history FOR INSERT TO authenticated
WITH CHECK (true);
