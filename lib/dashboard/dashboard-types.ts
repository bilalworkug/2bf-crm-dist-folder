export type DateRange = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface DashboardFilters {
  dateRange: DateRange;
  customStartDate?: string;
  customEndDate?: string;
  product?: string;
  warehouseId?: string;
  status?: string;
  shift?: string;
}

export interface KPIValue {
  value: string | number;
  label: string;
  description: string;
  trend?: number;
  trendLabel?: string;
  status?: 'neutral' | 'success' | 'warning' | 'critical';
  sparkline?: number[];
}

export interface ProductPerformanceRow {
  productName: string;
  produced: number;
  inStock: number;
  allocated: number;
  dispatched: number;
  delivered: number;
  returned: number;
}

export interface WarehouseOverviewItem {
  warehouseId: string;
  warehouseName: string;
  availableStock: number;
  receivedToday: number;
  dispatchedToday: number;
  status: 'good' | 'attention' | 'critical';
}

export interface ActivityEvent {
  id: string;
  type: 'production' | 'warehouse' | 'order' | 'dispatch' | 'delivery' | 'return' | 'approval';
  description: string;
  barcode?: string;
  productName?: string;
  user: string;
  time: string; // ISO string
  warehouseName?: string;
}

export interface ActionRequiredItem {
  id: string;
  title: string;
  severity: 'info' | 'warning' | 'critical';
  actionLabel?: string;
  actionHref?: string;
}

export interface FactoryHealthStatus {
  production: 'good' | 'attention' | 'issue' | 'unknown';
  warehouse: 'good' | 'attention' | 'issue' | 'unknown';
  sales: 'good' | 'attention' | 'issue' | 'unknown';
  dispatch: 'good' | 'attention' | 'issue' | 'unknown';
  delivery: 'good' | 'attention' | 'issue' | 'unknown';
  returns: 'good' | 'attention' | 'issue' | 'unknown';
}
