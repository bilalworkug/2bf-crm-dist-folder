/*
# 2BF Seed Data
Seeds reference data: 8 roles, 3 warehouses, 13 real 2BF products, 1 company settings row.
Idempotent via ON CONFLICT.
*/
INSERT INTO public.roles (key, name, description) VALUES
  ('admin', 'Admin', 'Full system access: users, settings, all reports and logs'),
  ('production', 'Production User', 'Scans finished product boxes and registers produced stock'),
  ('warehouse', 'Warehouse User', 'Receives approved barcodes into assigned warehouse'),
  ('dispatch', 'Dispatch User', 'Dispatches stock out of warehouse linked to customer orders'),
  ('sales', 'Sales Person', 'Creates customers and orders, views customer history'),
  ('accounts', 'Accounts User', 'Tracks invoices, payments, balances'),
  ('manager', 'Supervisor / Manager', 'Approves actions, reviews performance and exceptions'),
  ('reports', 'Full Reports User', 'Read-only access to all reports and audit logs')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.warehouses (code, name, location, manager_name) VALUES
  ('WH1', 'Warehouse 1', 'Addis Ababa - Main', 'TBD'),
  ('WH2', 'Warehouse 2', 'Adama - Branch', 'TBD'),
  ('WH3', 'Warehouse 3', 'Dire Dawa - Branch', 'TBD')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, location = EXCLUDED.location;

INSERT INTO public.products (name, sku, category, unit) VALUES
  ('Brothers First Cappuccino', '2BF-CAP', 'Biscuits', 'carton'),
  ('Brothers First Mango', '2BF-MAN', 'Biscuits', 'carton'),
  ('Brothers First Vanilla', '2BF-VAN', 'Biscuits', 'carton'),
  ('Brothers Crown', '2BF-CRN', 'Biscuits', 'carton'),
  ('Brothers Glory', '2BF-GLY', 'Biscuits', 'carton'),
  ('Brothers Fegegta', '2BF-FEG', 'Biscuits', 'carton'),
  ('Brothers My Cracker', '2BF-CRK', 'Crackers', 'carton'),
  ('Brothers Nurten', '2BF-NUR', 'Biscuits', 'carton'),
  ('Brothers To Your Finger', '2BF-TYF', 'Biscuits', 'carton'),
  ('Brothers Top Glucose', '2BF-GLU', 'Glucose', 'carton'),
  ('Brothers Viva Cookies', '2BF-VIV', 'Cookies', 'carton'),
  ('Brothers Wafer Creams', '2BF-WAF', 'Wafers', 'carton'),
  ('2BF Chocolates', '2BF-CHO', 'Chocolates', 'carton')
ON CONFLICT (name) DO UPDATE SET sku = EXCLUDED.sku, category = EXCLUDED.category;

INSERT INTO public.company_settings (id, company_name, short_name, address, phone, email, website, currency)
VALUES (1, 'Two Brothers Food Complex P.L.C', '2BF',
  'Addis Ababa, Ethiopia',
  '+251 11 000 0000',
  'info@2bf.com.et',
  'https://www.2bf.com.et',
  'ETB')
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  short_name = EXCLUDED.short_name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  website = EXCLUDED.website,
  currency = EXCLUDED.currency,
  updated_at = now();
