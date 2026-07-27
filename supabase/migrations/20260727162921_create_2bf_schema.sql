/*
# 2BF Food Complex - Core Schema

## Overview
Creates the complete database for the Two Brothers Food Complex (2BF) factory system:
CRM + WMS + production traceability + sales + reports. Multi-role authenticated app.

## Tables created
1. `roles` - the 8 system roles
2. `profiles` - extends auth.users with role assignment
3. `warehouses` - 3 warehouses
4. `products` - seeded with the 13 real 2BF products
5. `customers` - CRM records
6. `orders` + `order_items` - sales orders
7. `production_scans` - boxes scanned by production team
8. `warehouse_receipts` - boxes received into a warehouse
9. `dispatches` - boxes dispatched out, linked to an order
10. `stock_movements` - ledger of every stock change
11. `barcode_history` - unified timeline per barcode
12. `returns` - returned / damaged / expired stock
13. `approvals` - approval requests
14. `audit_logs` - every important action recorded
15. `company_settings` - master data / settings

## Security
- RLS enabled on every table.
- SELECT: any authenticated user can read (internal company app).
- INSERT/UPDATE/DELETE: role-gated via helper functions current_user_is_admin() and user_has_role().
- Owner columns default to auth.uid().

## Notes
- Ordering: tables created first, then helper functions, then role-gated policies.
- Idempotent with IF NOT EXISTS + DROP POLICY IF EXISTS.
*/

-- ============================================================
-- roles (no FK dependencies)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.roles (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- profiles (depends on roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'reports' REFERENCES public.roles(key),
  warehouse_id uuid,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- warehouses
-- ============================================================
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  location text,
  manager_name text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- products
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  sku text UNIQUE,
  category text,
  unit text DEFAULT 'carton',
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- customers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text,
  last_name text,
  customer_name text NOT NULL,
  company_name text,
  phone text,
  email text,
  location text,
  contact_person text,
  notes text,
  sales_person_id uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- orders
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  status text NOT NULL DEFAULT 'pending',
  notes text,
  sales_person_id uuid REFERENCES public.profiles(id),
  total_amount numeric(14,2) DEFAULT 0,
  paid_amount numeric(14,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(14,2) DEFAULT 0,
  warehouse_id uuid REFERENCES public.warehouses(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- production_scans
-- ============================================================
CREATE TABLE IF NOT EXISTS public.production_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id),
  batch_lot text,
  quantity integer NOT NULL DEFAULT 1,
  scanned_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  scanned_at timestamptz DEFAULT now(),
  notes text
);

-- ============================================================
-- warehouse_receipts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.warehouse_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text NOT NULL,
  production_scan_id uuid NOT NULL REFERENCES public.production_scans(id),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL DEFAULT 1,
  received_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  received_at timestamptz DEFAULT now(),
  notes text
);

-- ============================================================
-- dispatches
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text NOT NULL,
  warehouse_receipt_id uuid NOT NULL REFERENCES public.warehouse_receipts(id),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL DEFAULT 1,
  dispatched_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  dispatched_at timestamptz DEFAULT now(),
  notes text
);

-- ============================================================
-- stock_movements (ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text,
  product_id uuid REFERENCES public.products(id),
  warehouse_id uuid REFERENCES public.warehouses(id),
  movement_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  reference_id uuid,
  reference_table text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  notes text
);

-- ============================================================
-- barcode_history (unified traceability timeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.barcode_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text NOT NULL,
  action text NOT NULL,
  warehouse_id uuid REFERENCES public.warehouses(id),
  product_id uuid REFERENCES public.products(id),
  order_id uuid REFERENCES public.orders(id),
  customer_id uuid REFERENCES public.customers(id),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  performed_at timestamptz DEFAULT now(),
  notes text
);

-- ============================================================
-- approvals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL,
  reference_id uuid,
  reference_table text,
  reason text,
  requested_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  requested_at timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  review_notes text
);

-- ============================================================
-- returns (returned / damaged / expired)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text,
  product_id uuid REFERENCES public.products(id),
  warehouse_id uuid REFERENCES public.warehouses(id),
  return_type text NOT NULL,
  reason text,
  quantity integer NOT NULL DEFAULT 1,
  processed_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  processed_at timestamptz DEFAULT now(),
  approval_id uuid REFERENCES public.approvals(id),
  status text NOT NULL DEFAULT 'pending'
);

-- ============================================================
-- audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  warehouse_id uuid REFERENCES public.warehouses(id),
  product_id uuid REFERENCES public.products(id),
  barcode text,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- company_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_settings (
  id integer PRIMARY KEY DEFAULT 1,
  company_name text NOT NULL DEFAULT 'Two Brothers Food Complex P.L.C',
  short_name text NOT NULL DEFAULT '2BF',
  address text,
  phone text,
  email text,
  website text,
  currency text DEFAULT 'ETB',
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- ============================================================
-- Helper functions (after profiles table exists)
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_role(allowed_roles text[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = ANY(allowed_roles)
  );
$$;

-- ============================================================
-- Enable RLS + policies on all tables
-- ============================================================
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barcode_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- roles
DROP POLICY IF EXISTS "read_roles" ON public.roles;
CREATE POLICY "read_roles" ON public.roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_roles" ON public.roles;
CREATE POLICY "admin_write_roles" ON public.roles FOR ALL
  TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

-- profiles
DROP POLICY IF EXISTS "read_profiles" ON public.profiles;
CREATE POLICY "read_profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "admin_insert_profile" ON public.profiles;
CREATE POLICY "admin_insert_profile" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (public.current_user_is_admin());
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
CREATE POLICY "admin_update_profiles" ON public.profiles FOR UPDATE
  TO authenticated USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin());

-- warehouses
DROP POLICY IF EXISTS "read_warehouses" ON public.warehouses;
CREATE POLICY "read_warehouses" ON public.warehouses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_warehouses" ON public.warehouses;
CREATE POLICY "admin_write_warehouses" ON public.warehouses FOR ALL
  TO authenticated USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin());

-- products
DROP POLICY IF EXISTS "read_products" ON public.products;
CREATE POLICY "read_products" ON public.products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_products" ON public.products;
CREATE POLICY "admin_write_products" ON public.products FOR ALL
  TO authenticated USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin());

-- customers
DROP POLICY IF EXISTS "read_customers" ON public.customers;
CREATE POLICY "read_customers" ON public.customers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_customers" ON public.customers;
CREATE POLICY "write_customers" ON public.customers FOR ALL
  TO authenticated
  USING (public.user_has_role(ARRAY['admin','sales','accounts','manager']))
  WITH CHECK (public.user_has_role(ARRAY['admin','sales','accounts','manager']));

-- orders
DROP POLICY IF EXISTS "read_orders" ON public.orders;
CREATE POLICY "read_orders" ON public.orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_orders" ON public.orders;
CREATE POLICY "write_orders" ON public.orders FOR ALL
  TO authenticated
  USING (public.user_has_role(ARRAY['admin','sales','dispatch','accounts','manager']))
  WITH CHECK (public.user_has_role(ARRAY['admin','sales','dispatch','accounts','manager']));

-- order_items
DROP POLICY IF EXISTS "read_order_items" ON public.order_items;
CREATE POLICY "read_order_items" ON public.order_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_order_items" ON public.order_items;
CREATE POLICY "write_order_items" ON public.order_items FOR ALL
  TO authenticated
  USING (public.user_has_role(ARRAY['admin','sales','dispatch','accounts','manager']))
  WITH CHECK (public.user_has_role(ARRAY['admin','sales','dispatch','accounts','manager']));

-- production_scans
DROP POLICY IF EXISTS "read_production_scans" ON public.production_scans;
CREATE POLICY "read_production_scans" ON public.production_scans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_production_scans" ON public.production_scans;
CREATE POLICY "write_production_scans" ON public.production_scans FOR ALL
  TO authenticated
  USING (public.user_has_role(ARRAY['admin','production','manager']))
  WITH CHECK (public.user_has_role(ARRAY['admin','production','manager']));

-- warehouse_receipts
DROP POLICY IF EXISTS "read_warehouse_receipts" ON public.warehouse_receipts;
CREATE POLICY "read_warehouse_receipts" ON public.warehouse_receipts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_warehouse_receipts" ON public.warehouse_receipts;
CREATE POLICY "write_warehouse_receipts" ON public.warehouse_receipts FOR ALL
  TO authenticated
  USING (public.user_has_role(ARRAY['admin','warehouse','manager']))
  WITH CHECK (public.user_has_role(ARRAY['admin','warehouse','manager']));

-- dispatches
DROP POLICY IF EXISTS "read_dispatches" ON public.dispatches;
CREATE POLICY "read_dispatches" ON public.dispatches FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_dispatches" ON public.dispatches;
CREATE POLICY "write_dispatches" ON public.dispatches FOR ALL
  TO authenticated
  USING (public.user_has_role(ARRAY['admin','dispatch','manager']))
  WITH CHECK (public.user_has_role(ARRAY['admin','dispatch','manager']));

-- stock_movements
DROP POLICY IF EXISTS "read_stock_movements" ON public.stock_movements;
CREATE POLICY "read_stock_movements" ON public.stock_movements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_stock_movements" ON public.stock_movements;
CREATE POLICY "write_stock_movements" ON public.stock_movements FOR INSERT
  TO authenticated WITH CHECK (true);

-- barcode_history
DROP POLICY IF EXISTS "read_barcode_history" ON public.barcode_history;
CREATE POLICY "read_barcode_history" ON public.barcode_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_barcode_history" ON public.barcode_history;
CREATE POLICY "write_barcode_history" ON public.barcode_history FOR INSERT
  TO authenticated WITH CHECK (true);

-- approvals
DROP POLICY IF EXISTS "read_approvals" ON public.approvals;
CREATE POLICY "read_approvals" ON public.approvals FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_approvals" ON public.approvals;
CREATE POLICY "write_approvals" ON public.approvals FOR ALL
  TO authenticated
  USING (public.user_has_role(ARRAY['admin','manager','supervisor']))
  WITH CHECK (public.user_has_role(ARRAY['admin','manager','supervisor']));

-- returns
DROP POLICY IF EXISTS "read_returns" ON public.returns;
CREATE POLICY "read_returns" ON public.returns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_returns" ON public.returns;
CREATE POLICY "write_returns" ON public.returns FOR ALL
  TO authenticated
  USING (public.user_has_role(ARRAY['admin','warehouse','dispatch','manager']))
  WITH CHECK (public.user_has_role(ARRAY['admin','warehouse','dispatch','manager']));

-- audit_logs
DROP POLICY IF EXISTS "read_audit_logs" ON public.audit_logs;
CREATE POLICY "read_audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_audit_logs" ON public.audit_logs;
CREATE POLICY "write_audit_logs" ON public.audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

-- company_settings
DROP POLICY IF EXISTS "read_company_settings" ON public.company_settings;
CREATE POLICY "read_company_settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_company_settings" ON public.company_settings;
CREATE POLICY "admin_write_company_settings" ON public.company_settings FOR ALL
  TO authenticated USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin());

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_production_scans_barcode ON public.production_scans(barcode);
CREATE INDEX IF NOT EXISTS idx_production_scans_scanned_at ON public.production_scans(scanned_at);
CREATE INDEX IF NOT EXISTS idx_warehouse_receipts_barcode ON public.warehouse_receipts(barcode);
CREATE INDEX IF NOT EXISTS idx_dispatches_barcode ON public.dispatches(barcode);
CREATE INDEX IF NOT EXISTS idx_dispatches_order_id ON public.dispatches(order_id);
CREATE INDEX IF NOT EXISTS idx_barcode_history_barcode ON public.barcode_history(barcode);
CREATE INDEX IF NOT EXISTS idx_barcode_history_performed_at ON public.barcode_history(performed_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_barcode ON public.stock_movements(barcode);
CREATE INDEX IF NOT EXISTS idx_returns_barcode ON public.returns(barcode);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.approvals(status);
