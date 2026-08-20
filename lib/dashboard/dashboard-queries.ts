import { supabase } from '@/lib/supabase/client';
import { DashboardFilters, ProductPerformanceRow, WarehouseOverviewItem } from './dashboard-types';
import { getDatesForRange } from './dashboard-utils';

export interface DashboardData {
  productPerformance: ProductPerformanceRow[];
  totalProduced: number;
  totalInStock: number;
  totalAllocated: number;
  totalDispatched: number;
  totalDelivered: number;
  totalReturned: number;
  totalOrders: number;
  pendingOrders: number;
  totalCustomers: number;
  products: any[];
  warehouses: any[];
  warehouseOverview: WarehouseOverviewItem[];
  // New Phase 24 financial metrics
  salesValue: number;
  paidAmount: number;
  outstandingAmount: number;
  creditExposure: number;
  availableCredit: number;
  overdueCredit: number;
  authorizedCustomers: number;
  pendingPayments: number;
  readyForDispatch: number;
  ordersList: any[];
}

export async function fetchDashboardData(
  filters: DashboardFilters,
  role: string,
  warehouseId?: string
): Promise<DashboardData> {
  const { start, end } = getDatesForRange(filters.dateRange, filters.customStartDate, filters.customEndDate);
  const startStr = start.toISOString();
  const endStr = end.toISOString();

  // ─── Always fetch products ───
  const productsPromise = supabase.from('products').select('*');

  // ─── Conditionally fetch warehouses ───
  const shouldFetchWarehouses = ['admin', 'manager', 'warehouse', 'warehouse_manager'].includes(role);
  let warehousesPromise: any = Promise.resolve({ data: null, error: null });
  if (shouldFetchWarehouses) {
    let q = supabase.from('warehouses').select('*');
    if (warehouseId) q = q.eq('id', warehouseId);
    warehousesPromise = q;
  }

  // ─── Production Scans ───
  const shouldFetchProduction = ['admin', 'manager', 'production', 'production_manager'].includes(role);
  let productionPromise: any = Promise.resolve({ data: null, error: null });
  if (shouldFetchProduction) {
    let q = supabase
      .from('production_scans')
      .select('id, product_id, status, barcode, quantity, created_at, created_by')
      .gte('created_at', startStr)
      .lte('created_at', endStr);
    if (filters.product) q = q.eq('product_id', filters.product);
    productionPromise = q;
  }

  // ─── Warehouse Receipts ───
  const shouldFetchReceipts = ['admin', 'manager', 'warehouse', 'warehouse_manager'].includes(role);
  let receiptsPromise: any = Promise.resolve({ data: null, error: null });
  if (shouldFetchReceipts) {
    let q = supabase
      .from('warehouse_receipts')
      .select('id, product_id, warehouse_id, quantity, received_at')
      .gte('received_at', startStr)
      .lte('received_at', endStr);
    if (warehouseId) q = q.eq('warehouse_id', warehouseId);
    receiptsPromise = q;
  }

  // ─── Dispatches ───
  const shouldFetchDispatches = ['admin', 'manager', 'dispatch', 'dispatch_manager', 'warehouse', 'warehouse_manager'].includes(role);
  let dispatchesPromise: any = Promise.resolve({ data: null, error: null });
  if (shouldFetchDispatches) {
    let q = supabase
      .from('dispatches')
      .select('id, product_id, warehouse_id, order_id, quantity, dispatched_at')
      .gte('dispatched_at', startStr)
      .lte('dispatched_at', endStr);
    if (warehouseId) q = q.eq('warehouse_id', warehouseId);
    dispatchesPromise = q;
  }

  // ─── Orders ───
  const shouldFetchOrders = ['admin', 'manager', 'sales', 'sales_manager', 'accounts', 'accounts_manager'].includes(role);
  let ordersPromise: any = Promise.resolve({ data: null, error: null });
  let currentAllOrdersPromise: any = Promise.resolve({ data: null, error: null });
  if (shouldFetchOrders) {
    ordersPromise = supabase
      .from('orders')
      .select('id, order_number, status, total_amount, paid_amount, created_at, payment_type, due_date, customers(name)')
      .gte('created_at', startStr)
      .lte('created_at', endStr)
      .order('created_at', { ascending: false });

    // For current-state metrics (not period-filtered)
    currentAllOrdersPromise = supabase
      .from('orders')
      .select('id, status, total_amount, paid_amount, payment_type, due_date')
      .not('status', 'eq', 'cancelled');
  }

  // ─── Payments ───
  let paymentsPromise: any = Promise.resolve({ data: null, error: null });
  if (['admin', 'manager', 'accounts', 'accounts_manager'].includes(role)) {
    paymentsPromise = supabase
      .from('payments')
      .select('id, status')
      .eq('status', 'pending');
  }

  // ─── Customer Credit Settings (Current State) ───
  let creditSettingsPromise: any = Promise.resolve({ data: null, error: null });
  if (['admin', 'manager', 'accounts', 'accounts_manager'].includes(role)) {
    creditSettingsPromise = supabase
      .from('customer_credit_settings')
      .select('credit_allowed, credit_limit, active');
  }

  // ─── Customers ───
  let customersPromise: any = Promise.resolve({ data: null, error: null });
  if (shouldFetchOrders) {
    customersPromise = supabase.from('customers').select('id', { count: 'exact', head: true });
  }

  // ─── Returns ───
  const shouldFetchReturns = ['admin', 'manager', 'returns', 'returns_manager', 'warehouse', 'warehouse_manager'].includes(role);
  let returnsPromise: any = Promise.resolve({ data: null, error: null });
  if (shouldFetchReturns) {
    returnsPromise = supabase
      .from('returns')
      .select('id, product_id, quantity, status, processed_at')
      .gte('processed_at', startStr)
      .lte('processed_at', endStr);
  }

  // ─── Execute all concurrently ───
  const [
    productsResult,
    warehousesResult,
    productionResult,
    receiptsResult,
    dispatchesResult,
    ordersResult,
    customersResult,
    returnsResult,
    currentAllOrdersResult,
    paymentsResult,
    creditSettingsResult
  ] = await Promise.all([
    productsPromise,
    warehousesPromise,
    productionPromise,
    receiptsPromise,
    dispatchesPromise,
    ordersPromise,
    customersPromise,
    returnsPromise,
    currentAllOrdersPromise,
    paymentsPromise,
    creditSettingsPromise
  ]);

  const products = productsResult.data || [];
  const warehouses = warehousesResult.data || [];
  const productionScans = productionResult.data || [];
  const receipts = receiptsResult.data || [];
  const dispatches = dispatchesResult.data || [];
  const orders = ordersResult.data || [];
  const customerCount = customersResult.count ?? 0;
  const returns = returnsResult.data || [];
  const currentAllOrders = currentAllOrdersResult.data || [];
  const pendingPayments = paymentsResult.data ? paymentsResult.data.length : 0;
  const creditSettings = creditSettingsResult.data || [];

  // ─── Aggregate Product Performance ───
  const productPerformance: ProductPerformanceRow[] = products.map((p: any) => {
    const produced = productionScans.filter((s: any) => s.product_id === p.id).reduce((sum: number, s: any) => sum + (s.quantity || 1), 0);
    const inStock = receipts.filter((r: any) => r.product_id === p.id).reduce((sum: number, r: any) => sum + (r.quantity || 0), 0)
      - dispatches.filter((d: any) => d.product_id === p.id).reduce((sum: number, d: any) => sum + (d.quantity || 0), 0);
    const allocated = 0; // Allocation is part of order processing, placeholder
    const dispatched = dispatches.filter((d: any) => d.product_id === p.id).reduce((sum: number, d: any) => sum + (d.quantity || 0), 0);
    const delivered = 0; // Delivery confirmation data, placeholder
    const returned = returns.filter((r: any) => r.product_id === p.id).reduce((sum: number, r: any) => sum + (r.quantity || 0), 0);

    return {
      productName: p.name,
      produced,
      inStock: Math.max(0, inStock),
      allocated,
      dispatched,
      delivered,
      returned
    };
  });

  // ─── Warehouse Overview ───
  const warehouseOverview: WarehouseOverviewItem[] = warehouses.map((w: any) => {
    const receivedToday = receipts.filter((r: any) => r.warehouse_id === w.id).reduce((sum: number, r: any) => sum + (r.quantity || 0), 0);
    const dispatchedToday = dispatches.filter((d: any) => d.warehouse_id === w.id).reduce((sum: number, d: any) => sum + (d.quantity || 0), 0);
    const availableStock = receivedToday - dispatchedToday;
    const status: 'good' | 'attention' | 'critical' = 
      availableStock < 0 ? 'critical' : availableStock === 0 ? 'attention' : 'good';
    
    return {
      warehouseId: w.id,
      warehouseName: w.name,
      availableStock: Math.max(0, availableStock),
      receivedToday,
      dispatchedToday,
      status
    };
  });

  // ─── Aggregated stats ───
  const totalProduced = productPerformance.reduce((sum, p) => sum + p.produced, 0);
  const totalInStock = productPerformance.reduce((sum, p) => sum + p.inStock, 0);
  const totalAllocated = productPerformance.reduce((sum, p) => sum + p.allocated, 0);
  const totalDispatched = productPerformance.reduce((sum, p) => sum + p.dispatched, 0);
  const totalDelivered = productPerformance.reduce((sum, p) => sum + p.delivered, 0);
  const totalReturned = productPerformance.reduce((sum, p) => sum + p.returned, 0);
  
  // Period stats
  const totalOrders = orders.length;
  const validPeriodOrders = orders.filter((o: any) => o.status !== 'cancelled');
  const salesValue = validPeriodOrders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
  const paidAmount = validPeriodOrders.reduce((sum: number, o: any) => sum + (o.paid_amount || 0), 0);

  // Current State Stats (independent of date range, as per requirements)
  const outstandingAmount = currentAllOrders.reduce((sum: number, o: any) => sum + Math.max(0, (o.total_amount || 0) - (o.paid_amount || 0)), 0);
  const creditOrders = currentAllOrders.filter((o: any) => o.payment_type === 'credit');
  const creditExposure = creditOrders.reduce((sum: number, o: any) => sum + Math.max(0, (o.total_amount || 0) - (o.paid_amount || 0)), 0);
  
  const today = new Date().toISOString().split('T')[0];
  const overdueCredit = creditOrders
    .filter((o: any) => o.due_date && o.due_date < today && ((o.total_amount || 0) - (o.paid_amount || 0)) > 0)
    .reduce((sum: number, o: any) => sum + Math.max(0, (o.total_amount || 0) - (o.paid_amount || 0)), 0);

  const readyForDispatch = currentAllOrders.filter((o: any) => o.status === 'ready').length;
  const pendingOrders = currentAllOrders.filter((o: any) => o.status === 'pending').length;

  // Credit Settings Summary
  const authorizedCreditSettings = creditSettings.filter((s: any) => s.credit_allowed && s.active);
  const authorizedCustomers = authorizedCreditSettings.length;
  const totalCreditLimit = authorizedCreditSettings.reduce((sum: number, s: any) => sum + (s.credit_limit || 0), 0);
  const availableCredit = Math.max(0, totalCreditLimit - creditExposure);

  return {
    productPerformance,
    totalProduced,
    totalInStock,
    totalAllocated,
    totalDispatched,
    totalDelivered,
    totalReturned,
    totalOrders,
    pendingOrders,
    totalCustomers: customerCount,
    products,
    warehouses,
    warehouseOverview,
    salesValue,
    paidAmount,
    outstandingAmount,
    creditExposure,
    availableCredit,
    overdueCredit,
    authorizedCustomers,
    pendingPayments,
    readyForDispatch,
    ordersList: orders
  };
}
