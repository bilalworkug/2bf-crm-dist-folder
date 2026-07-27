export type RoleKey =
  | 'admin'
  | 'production'
  | 'warehouse'
  | 'dispatch'
  | 'sales'
  | 'accounts'
  | 'manager'
  | 'reports';

export interface RoleInfo {
  key: RoleKey;
  name: string;
  description: string;
}

export const ROLES: RoleInfo[] = [
  { key: 'admin', name: 'Admin', description: 'Full system access: users, settings, all reports and logs' },
  { key: 'production', name: 'Production User', description: 'Scans finished product boxes and registers produced stock' },
  { key: 'warehouse', name: 'Warehouse User', description: 'Receives approved barcodes into assigned warehouse' },
  { key: 'dispatch', name: 'Dispatch User', description: 'Dispatches stock out of warehouse linked to customer orders' },
  { key: 'sales', name: 'Sales Person', description: 'Creates customers and orders, views customer history' },
  { key: 'accounts', name: 'Accounts User', description: 'Tracks invoices, payments, balances' },
  { key: 'manager', name: 'Supervisor / Manager', description: 'Approves actions, reviews performance and exceptions' },
  { key: 'reports', name: 'Full Reports User', description: 'Read-only access to all reports and audit logs' },
];

export const ROLE_LABELS: Record<RoleKey, string> = {
  admin: 'Admin',
  production: 'Production',
  warehouse: 'Warehouse',
  dispatch: 'Dispatch',
  sales: 'Sales',
  accounts: 'Accounts',
  manager: 'Manager',
  reports: 'Reports',
};

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: RoleKey;
  warehouse_id: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string | null;
  manager_name: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  created_at: string;
}

export interface Customer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  customer_name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  contact_person: string | null;
  notes: string | null;
  sales_person_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  status: string;
  notes: string | null;
  sales_person_id: string | null;
  total_amount: number;
  paid_amount: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  warehouse_id: string | null;
  created_at: string;
}

export interface ProductionScan {
  id: string;
  barcode: string;
  product_id: string;
  batch_lot: string | null;
  quantity: number;
  scanned_by: string;
  scanned_at: string;
  notes: string | null;
}

export interface WarehouseReceipt {
  id: string;
  barcode: string;
  production_scan_id: string;
  warehouse_id: string;
  product_id: string;
  quantity: number;
  received_by: string;
  received_at: string;
  notes: string | null;
}

export interface Dispatch {
  id: string;
  barcode: string;
  warehouse_receipt_id: string;
  order_id: string;
  warehouse_id: string;
  product_id: string;
  quantity: number;
  dispatched_by: string;
  dispatched_at: string;
  notes: string | null;
}

export interface StockMovement {
  id: string;
  barcode: string | null;
  product_id: string | null;
  warehouse_id: string | null;
  movement_type: string;
  quantity: number;
  reference_id: string | null;
  reference_table: string | null;
  user_id: string;
  created_at: string;
  notes: string | null;
}

export interface BarcodeHistoryEntry {
  id: string;
  barcode: string;
  action: string;
  warehouse_id: string | null;
  product_id: string | null;
  order_id: string | null;
  customer_id: string | null;
  user_id: string;
  performed_at: string;
  notes: string | null;
}

export interface ReturnRecord {
  id: string;
  barcode: string | null;
  product_id: string | null;
  warehouse_id: string | null;
  return_type: string;
  reason: string | null;
  quantity: number;
  processed_by: string;
  processed_at: string;
  approval_id: string | null;
  status: string;
}

export interface Approval {
  id: string;
  request_type: string;
  reference_id: string | null;
  reference_table: string | null;
  reason: string | null;
  requested_by: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  status: string;
  review_notes: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  warehouse_id: string | null;
  product_id: string | null;
  barcode: string | null;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface CompanySettings {
  id: number;
  company_name: string;
  short_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  currency: string;
  updated_at: string;
}

export const ORDER_STATUSES = [
  'pending',
  'approved',
  'dispatched',
  'completed',
  'cancelled',
] as const;

export const RETURN_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const RETURN_TYPES = ['returned', 'damaged', 'expired'] as const;
export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;
