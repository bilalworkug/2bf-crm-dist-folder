export type RoleKey =
  | 'admin'
  | 'production'
  | 'production_manager'
  | 'warehouse'
  | 'warehouse_manager'
  | 'dispatch'
  | 'dispatch_manager'
  | 'sales'
  | 'sales_manager'
  | 'accounts'
  | 'accounts_manager'
  | 'returns'
  | 'returns_manager'
  | 'delivery'
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
  { key: 'production_manager', name: 'Production Manager', description: 'Manages production and corrections' },
  { key: 'warehouse', name: 'Warehouse User', description: 'Receives approved barcodes into assigned warehouse' },
  { key: 'warehouse_manager', name: 'Warehouse Manager', description: 'Manages warehouse and corrections' },
  { key: 'dispatch', name: 'Dispatch User', description: 'Dispatches stock out of warehouse linked to customer orders' },
  { key: 'dispatch_manager', name: 'Dispatch Manager', description: 'Manages dispatch and corrections' },
  { key: 'sales', name: 'Sales Person', description: 'Creates customers and orders, views customer history' },
  { key: 'sales_manager', name: 'Sales Manager', description: 'Manages sales, approves discounts' },
  { key: 'accounts', name: 'Accounts User', description: 'Tracks invoices, payments, balances' },
  { key: 'accounts_manager', name: 'Accounts Manager', description: 'Manages accounts, corrections, and customer credit authorization' },
  { key: 'returns_manager', name: 'Returns Manager', description: 'Manages returns and corrections' },
  { key: 'manager', name: 'Supervisor / Manager', description: 'Approves actions, reviews performance and exceptions (Legacy)' },
  { key: 'reports', name: 'Full Reports User', description: 'Read-only access to all reports and audit logs' },
];

export const ROLE_LABELS: Record<RoleKey, string> = {
  admin: 'Admin',
  production: 'Production',
  production_manager: 'Production Manager',
  warehouse: 'Warehouse',
  warehouse_manager: 'Warehouse Manager',
  dispatch: 'Dispatch',
  dispatch_manager: 'Dispatch Manager',
  sales: 'Sales',
  sales_manager: 'Sales Manager',
  accounts: 'Accounts',
  accounts_manager: 'Accounts Manager',
  returns: 'Returns',
  returns_manager: 'Returns Manager',
  delivery: 'Delivery',
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
  active?: boolean;
}

export interface CorrectionLog {
  id: string;
  original_record_id: string;
  record_type: string;
  action_type: string;
  corrected_by: string;
  reason: string;
  old_data: any;
  new_data: any;
  created_at: string;
  profile?: Profile;
}

export interface Payment {
  id: string;
  order_id: string;
  customer_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'reversed';
  reference_number?: string;
  notes?: string;
  submitted_by: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  order?: Order;
  customer?: Customer;
  submitter?: Profile;
  approver?: Profile;
}

export interface PaymentDocument {
  id: string;
  payment_id: string;
  document_type: string;
  file_name: string;
  storage_path: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface Notification {
  id: string;
  type: string;
  customer_id: string;
  reference_id: string;
  message: string;
  is_read: boolean;
  milestone: string;
  created_at: string;
}

export interface ProductPrice {
  id: string;
  product_id: string;
  price: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
  notes: string | null;
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

export interface CustomerCreditSettings {
  id: string;
  customer_id: string;
  credit_allowed: boolean;
  credit_limit: number;
  payment_terms_days: number;
  notes: string | null;
  active: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  status: string;
  notes?: string;
  sales_person_id?: string;
  total_amount: number;
  paid_amount: number;
  payment_type?: 'pay_now' | 'credit';
  due_date?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  items?: OrderItem[];
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

export interface OrderHandover {
  id: string;
  order_id: string;
  customer_id: string;
  handover_number: string;
  handover_date: string;
  recipient_type: 'customer' | 'representative' | 'transporter_3pl';
  recipient_name: string;
  recipient_phone: string | null;
  recipient_national_id: string | null;
  driver_name: string | null;
  transport_company: string | null;
  vehicle_plate: string | null;
  cartons_handed_over: number;
  waybill_number: string | null;
  notes: string | null;
  signature_data: string | null;
  handed_over_by: string;
  created_at: string;
  updated_at: string;
  order?: Order;
  customer?: Customer;
  profile?: Profile;
}

export const ORDER_STATUSES = [
  'pending',
  'approved',
  'partially_dispatched',
  'dispatched',
  'handed_over',
  'completed',
  'delivered',
  'partially_delivered',
  'cancelled',
] as const;

export const RETURN_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const RETURN_TYPES = ['returned', 'damaged', 'expired'] as const;
export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;
