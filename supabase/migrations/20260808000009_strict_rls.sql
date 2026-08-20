-- =============================================================
-- Phase 7: Strict RLS Security Hardening
-- =============================================================

-- Dynamically drop ALL existing policies on target tables to ensure clean slate
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('orders', 'customers', 'payments', 'dispatches', 'deliveries', 'returns', 'audit_logs', 'boxes', 'production_scans', 'barcode_history')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Helper functions for RLS to improve performance and avoid infinite recursion
CREATE OR REPLACE FUNCTION auth_user_role() RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION auth_user_warehouse() RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT warehouse_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 1. ORDERS, CUSTOMERS, PAYMENTS
-- Admin, Manager, Sales, Sales Manager, Accounts, Reports
CREATE POLICY "orders_strict_select" ON public.orders FOR SELECT TO authenticated
USING (auth_user_role() IN ('admin', 'manager', 'sales', 'sales_manager', 'accounts', 'reports'));

CREATE POLICY "customers_strict_select" ON public.customers FOR SELECT TO authenticated
USING (auth_user_role() IN ('admin', 'manager', 'sales', 'sales_manager', 'accounts', 'reports'));

CREATE POLICY "payments_strict_select" ON public.payments FOR SELECT TO authenticated
USING (auth_user_role() IN ('admin', 'manager', 'sales', 'sales_manager', 'accounts', 'reports'));

-- 2. DISPATCHES, DELIVERIES
-- Admin, Manager, Dispatch, Dispatch Manager, Sales, Reports
CREATE POLICY "dispatches_strict_select" ON public.dispatches FOR SELECT TO authenticated
USING (auth_user_role() IN ('admin', 'manager', 'dispatch', 'dispatch_manager', 'sales', 'reports'));

CREATE POLICY "deliveries_strict_select" ON public.deliveries FOR SELECT TO authenticated
USING (auth_user_role() IN ('admin', 'manager', 'dispatch', 'dispatch_manager', 'sales', 'reports'));

-- 3. RETURNS
-- Admin, Manager, Dispatch, Dispatch Manager, Sales, Returns Manager, Reports
CREATE POLICY "returns_strict_select" ON public.returns FOR SELECT TO authenticated
USING (auth_user_role() IN ('admin', 'manager', 'dispatch', 'dispatch_manager', 'sales', 'returns_manager', 'reports'));

-- 4. AUDIT LOGS
-- Admin, Manager, Reports
CREATE POLICY "audit_logs_strict_select" ON public.audit_logs FOR SELECT TO authenticated
USING (auth_user_role() IN ('admin', 'manager', 'reports'));

-- 5. PRODUCTION SCANS
-- Admin, Manager, Production User, Production Manager, Reports
CREATE POLICY "production_scans_strict_select" ON public.production_scans FOR SELECT TO authenticated
USING (
  auth_user_role() IN ('admin', 'manager', 'production_manager', 'reports')
  OR (auth_user_role() = 'production' AND scanned_by = auth.uid())
);

-- 6. BOXES
-- Admin: Full
-- Production User: Produced Boxes (via production_scans)
-- Production Manager: Full Production History (all boxes)
-- Warehouse User: Own Warehouse Boxes
-- Warehouse Manager: Full Warehouse History (all boxes)
-- Sales User: Customer Purchased Boxes (has customer_id)
-- Sales Manager: Full Sales History
-- Dispatch User: Dispatched Boxes
-- Dispatch Manager: Full Dispatch History
-- Accounts User: Customer Order Boxes
-- Returns Manager: Returned Boxes
-- Reports User: Read Only
CREATE POLICY "boxes_strict_select" ON public.boxes FOR SELECT TO authenticated
USING (
  auth_user_role() IN ('admin', 'manager', 'production_manager', 'warehouse_manager', 'sales_manager', 'dispatch_manager', 'reports')
  OR (auth_user_role() = 'production' AND EXISTS (SELECT 1 FROM public.production_scans ps WHERE ps.barcode = boxes.barcode AND ps.scanned_by = auth.uid()))
  OR (auth_user_role() = 'warehouse' AND current_warehouse_id = auth_user_warehouse())
  OR (auth_user_role() = 'sales' AND customer_id IS NOT NULL)
  OR (auth_user_role() = 'dispatch' AND status IN ('dispatched', 'delivered'))
  OR (auth_user_role() = 'accounts' AND customer_id IS NOT NULL)
  OR (auth_user_role() = 'returns_manager' AND status IN ('returned', 'damaged', 'expired'))
);

-- 7. BARCODE HISTORY
-- All authorized departments
CREATE POLICY "barcode_history_strict_select" ON public.barcode_history FOR SELECT TO authenticated
USING (auth_user_role() IN ('admin', 'manager', 'production_manager', 'warehouse_manager', 'sales_manager', 'dispatch_manager', 'returns_manager', 'reports', 'production', 'warehouse', 'sales', 'dispatch', 'accounts'));
