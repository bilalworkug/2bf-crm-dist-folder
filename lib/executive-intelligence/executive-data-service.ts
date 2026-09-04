import { supabase } from '@/lib/supabase/client';
import {
  ExecutiveFilters,
  CompleteExecutiveData,
  CustomerIntelligenceItem,
  ProductIntelligenceItem,
  SalesTrendDataPoint,
  WarehouseIntelligenceItem,
  ProductionIntelligenceData,
  FinancialIntelligenceData,
  SnapshotCardData,
  SmartRecommendation,
  PaymentBehaviorBadge,
  ExecutiveCompareResult,
  ComparisonMetricRow,
} from './executive-types';

export function calculateDateRanges(filters: ExecutiveFilters): {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  days: number;
} {
  const now = new Date();
  let start: Date;
  let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (filters.datePreset) {
    case 'today': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate(), 0, 0, 0, 0);
      return { start, end, prevStart, prevEnd, days: 1 };
    }
    case 'yesterday': {
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 0, 0, 0, 0);
      return { start, end, prevStart, prevEnd, days: 1 };
    }
    case 'last_7_days': {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end, prevStart, prevEnd, days: 7 };
    }
    case 'last_30_days': {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start, end, prevStart, prevEnd, days: 30 };
    }
    case 'last_3_months': {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { start, end, prevStart, prevEnd, days: 90 };
    }
    case 'last_6_months': {
      start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - 180 * 24 * 60 * 60 * 1000);
      return { start, end, prevStart, prevEnd, days: 180 };
    }
    case 'last_12_months': {
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - 365 * 24 * 60 * 60 * 1000);
      return { start, end, prevStart, prevEnd, days: 365 };
    }
    case 'custom': {
      start = filters.customStartDate ? new Date(filters.customStartDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      end = filters.customEndDate ? new Date(filters.customEndDate) : now;
      const diffMs = Math.max(86400000, end.getTime() - start.getTime());
      const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - diffMs);
      return { start, end, prevStart, prevEnd, days };
    }
  }
}

export async function fetchExecutiveIntelligenceData(filters: ExecutiveFilters): Promise<CompleteExecutiveData> {
  const { start, end, prevStart, prevEnd, days } = calculateDateRanges(filters);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const prevStartIso = prevStart.toISOString();
  const prevEndIso = prevEnd.toISOString();

  // Parallel fetch of all raw source tables via Supabase
  const [
    customersRes,
    ordersRes,
    orderItemsRes,
    paymentsRes,
    creditRes,
    productsRes,
    pricesRes,
    scansRes,
    receiptsRes,
    dispatchesRes,
    returnsRes,
    warehousesRes,
    profilesRes,
  ] = await Promise.all([
    supabase.from('customers').select('id, customer_name, phone, location, created_at'),
    supabase.from('orders').select('id, order_number, customer_id, status, total_amount, paid_amount, payment_type, due_date, created_at, sales_person_id'),
    supabase.from('order_items').select('id, order_id, product_id, quantity, unit_price, warehouse_id, created_at'),
    supabase.from('payments').select('id, order_id, customer_id, amount, payment_method, status, payment_date, created_at'),
    supabase.from('customer_credit_settings').select('customer_id, credit_allowed, credit_limit, active'),
    supabase.from('products').select('id, name, sku, category, unit'),
    supabase.from('product_prices').select('id, product_id, price'),
    supabase.from('production_scans').select('id, product_id, quantity, scanned_by, scanned_at, created_at'),
    supabase.from('warehouse_receipts').select('id, product_id, warehouse_id, quantity, received_at'),
    supabase.from('dispatches').select('id, product_id, warehouse_id, order_id, quantity, dispatched_at'),
    supabase.from('returns').select('id, product_id, quantity, status, processed_at'),
    supabase.from('warehouses').select('id, code, name, location'),
    supabase.from('profiles').select('id, full_name, role'),
  ]);

  const rawCustomers = customersRes.data || [];
  const rawOrders = ordersRes.data || [];
  const rawOrderItems = orderItemsRes.data || [];
  const rawPayments = paymentsRes.data || [];
  const rawCredit = creditRes.data || [];
  const rawProducts = productsRes.data || [];
  const rawPrices = pricesRes.data || [];
  const rawScans = scansRes.data || [];
  const rawReceipts = receiptsRes.data || [];
  const rawDispatches = dispatchesRes.data || [];
  const rawReturns = returnsRes.data || [];
  const rawWarehouses = warehousesRes.data || [];
  const rawProfiles = profilesRes.data || [];

  // Map latest prices
  const priceMap: Record<string, number> = {};
  for (const p of rawPrices) {
    priceMap[p.product_id] = Number(p.price) || 0;
  }

  // Filter options for dropdowns
  const filterOptions = {
    warehouses: rawWarehouses.map((w: any) => ({ id: w.id, name: w.name })),
    products: rawProducts.map((p: any) => ({ id: p.id, name: p.name })),
    customers: rawCustomers.map((c: any) => ({ id: c.id, name: c.customer_name })),
    paymentTypes: ['Cash', 'Credit', 'Bank Transfer', 'Cheque'],
    orderStatuses: ['pending', 'approved', 'partially_dispatched', 'dispatched', 'completed', 'cancelled'],
  };

  // 1. Filter Orders by user criteria
  const isOrderInFilters = (o: any) => {
    if (filters.warehouseId) {
      const itemsInWh = rawOrderItems.filter((i: any) => i.order_id === o.id && i.warehouse_id === filters.warehouseId);
      if (itemsInWh.length === 0) return false;
    }
    if (filters.productId) {
      const itemsWithProd = rawOrderItems.filter((i: any) => i.order_id === o.id && i.product_id === filters.productId);
      if (itemsWithProd.length === 0) return false;
    }
    if (filters.customerId && o.customer_id !== filters.customerId) return false;
    if (filters.paymentType && o.payment_type?.toLowerCase() !== filters.paymentType.toLowerCase()) return false;
    if (filters.orderStatus && o.status?.toLowerCase() !== filters.orderStatus.toLowerCase()) return false;
    return true;
  };

  // Orders in current period vs previous period
  const periodOrders = rawOrders.filter(
    (o: any) => o.created_at >= startIso && o.created_at <= endIso && isOrderInFilters(o)
  );
  const prevPeriodOrders = rawOrders.filter(
    (o: any) => o.created_at >= prevStartIso && o.created_at <= prevEndIso && isOrderInFilters(o)
  );

  // Payments in current period
  const periodPayments = rawPayments.filter(
    (p: any) => p.payment_date >= startIso && p.payment_date <= endIso
  );

  // Dispatches in current period
  const periodDispatches = rawDispatches.filter(
    (d: any) => d.dispatched_at >= startIso && d.dispatched_at <= endIso
  );

  // Receipts in current period
  const periodReceipts = rawReceipts.filter(
    (r: any) => r.received_at >= startIso && r.received_at <= endIso
  );

  // Production Scans in current period
  const periodScans = rawScans.filter((s: any) => {
    const scanTime = s.scanned_at || s.created_at;
    return scanTime >= startIso && scanTime <= endIso;
  });

  // ─────────────────────────────────────────────────────────────
  // PART 2: CUSTOMER INTELLIGENCE
  // ─────────────────────────────────────────────────────────────
  const customerCreditMap = new Map<string, any>();
  for (const c of rawCredit) {
    customerCreditMap.set(c.customer_id, c);
  }

  const customersData: CustomerIntelligenceItem[] = rawCustomers.map((cust: any) => {
    const custOrdersAll = rawOrders.filter((o: any) => o.customer_id === cust.id && o.status !== 'cancelled');
    const custPeriodOrders = periodOrders.filter((o: any) => o.customer_id === cust.id && o.status !== 'cancelled');
    const custPrevOrders = prevPeriodOrders.filter((o: any) => o.customer_id === cust.id && o.status !== 'cancelled');

    const totalRevenue = custPeriodOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
    const prevRevenue = custPrevOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
    const totalOrders = custPeriodOrders.length;
    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // All time dates
    const sortedAllOrders = [...custOrdersAll].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const firstPurchaseDate = sortedAllOrders.length > 0 ? sortedAllOrders[0].created_at : null;
    const lastPurchaseDate = sortedAllOrders.length > 0 ? sortedAllOrders[sortedAllOrders.length - 1].created_at : null;

    const daysSinceLastPurchase = lastPurchaseDate
      ? Math.floor((new Date().getTime() - new Date(lastPurchaseDate).getTime()) / (24 * 60 * 60 * 1000))
      : 999;

    // Outstanding balance (current active orders)
    const outstandingBalance = custOrdersAll.reduce(
      (sum: number, o: any) => sum + Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0)),
      0
    );

    const creditConf = customerCreditMap.get(cust.id);
    const creditLimit = creditConf?.credit_allowed ? Number(creditConf.credit_limit || 0) : 0;
    const creditUtilizationPct = creditLimit > 0 ? Math.min(100, Math.round((outstandingBalance / creditLimit) * 100)) : 0;

    // Growth
    let growthPct = 0;
    if (prevRevenue > 0) {
      growthPct = Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100);
    } else if (totalRevenue > 0) {
      growthPct = 100;
    }

    // Payment behavior rating
    let paymentBehavior: PaymentBehaviorBadge = 'New Account';
    if (creditUtilizationPct >= 90) {
      paymentBehavior = 'High Credit Risk';
    } else if (outstandingBalance > 0 && daysSinceLastPurchase > 30) {
      paymentBehavior = 'Slow Payer';
    } else if (custOrdersAll.length >= 3 && outstandingBalance === 0) {
      paymentBehavior = 'Excellent';
    } else if (custOrdersAll.length >= 2 && creditUtilizationPct <= 40) {
      paymentBehavior = 'Good';
    } else if (custOrdersAll.length > 0) {
      paymentBehavior = 'Average';
    }

    // Favorite product
    const custOrderIds = new Set(custOrdersAll.map((o: any) => o.id));
    const custItems = rawOrderItems.filter((i: any) => custOrderIds.has(i.order_id));
    const productVolumeMap: Record<string, number> = {};
    for (const item of custItems) {
      productVolumeMap[item.product_id] = (productVolumeMap[item.product_id] || 0) + (Number(item.quantity) || 1);
    }
    let favProdId = '';
    let favVol = 0;
    for (const [pId, vol] of Object.entries(productVolumeMap)) {
      if (vol > favVol) {
        favVol = vol;
        favProdId = pId;
      }
    }
    const favProdObj = rawProducts.find((p: any) => p.id === favProdId);

    // Sample orders
    const orderHistorySample = custOrdersAll
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((o: any) => ({
        id: o.id,
        orderNumber: o.order_number,
        createdAt: o.created_at,
        totalAmount: Number(o.total_amount || 0),
        status: o.status,
      }));

    return {
      id: cust.id,
      name: cust.customer_name,
      phone: cust.phone || '',
      city: cust.location || '',
      totalRevenue,
      totalOrders,
      averageOrderValue,
      firstPurchaseDate,
      lastPurchaseDate,
      daysSinceLastPurchase,
      outstandingBalance,
      creditLimit,
      creditUtilizationPct,
      paymentBehavior,
      growthPct,
      favoriteProductName: favProdObj ? favProdObj.name : 'N/A',
      favoriteProductVolume: favVol,
      orderHistorySample,
    };
  });

  // Sort customers by period revenue descending
  customersData.sort((a, b) => b.totalRevenue - a.totalRevenue);

  // ─────────────────────────────────────────────────────────────
  // PART 3: PRODUCT INTELLIGENCE
  // ─────────────────────────────────────────────────────────────
  const productsData: ProductIntelligenceItem[] = rawProducts.map((p: any) => {
    // Period sales
    const pOrderItems = rawOrderItems.filter((i: any) => {
      const order = rawOrders.find((o: any) => o.id === i.order_id);
      return (
        i.product_id === p.id &&
        order &&
        order.created_at >= startIso &&
        order.created_at <= endIso &&
        order.status !== 'cancelled'
      );
    });

    const prevOrderItems = rawOrderItems.filter((i: any) => {
      const order = rawOrders.find((o: any) => o.id === i.order_id);
      return (
        i.product_id === p.id &&
        order &&
        order.created_at >= prevStartIso &&
        order.created_at <= prevEndIso &&
        order.status !== 'cancelled'
      );
    });

    const revenue = pOrderItems.reduce(
      (sum: number, i: any) => sum + (Number(i.quantity) || 0) * (Number(i.unit_price) || priceMap[p.id] || 0),
      0
    );
    const prevRevenue = prevOrderItems.reduce(
      (sum: number, i: any) => sum + (Number(i.quantity) || 0) * (Number(i.unit_price) || priceMap[p.id] || 0),
      0
    );

    const unitsSold = pOrderItems.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0);

    // Period produced
    const pScans = periodScans.filter((s: any) => s.product_id === p.id);
    const unitsProduced = pScans.reduce((sum: number, s: any) => sum + (Number(s.quantity) || 1), 0);

    // All-time inventory calculation
    const allReceipts = rawReceipts.filter((r: any) => r.product_id === p.id).reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0), 0);
    const allDispatches = rawDispatches.filter((d: any) => d.product_id === p.id).reduce((sum: number, d: any) => sum + (Number(d.quantity) || 0), 0);
    const currentStock = Math.max(0, allReceipts - allDispatches);

    // Stock velocity (units per day in period)
    const stockVelocity = Number((unitsSold / Math.max(1, days)).toFixed(1));
    const daysOfInventoryLeft = stockVelocity > 0 ? Math.round(currentStock / stockVelocity) : currentStock > 0 ? 999 : 0;

    // Return rate
    const pReturns = rawReturns.filter((r: any) => r.product_id === p.id).reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0), 0);
    const returnRatePct = allDispatches > 0 ? Number(((pReturns / allDispatches) * 100).toFixed(1)) : 0;

    // Growth %
    let revenueGrowthPct = 0;
    if (prevRevenue > 0) {
      revenueGrowthPct = Math.round(((revenue - prevRevenue) / prevRevenue) * 100);
    } else if (revenue > 0) {
      revenueGrowthPct = 100;
    }

    let stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock' = 'In Stock';
    if (currentStock <= 0) stockStatus = 'Out of Stock';
    else if (currentStock <= 25) stockStatus = 'Low Stock';

    return {
      id: p.id,
      name: p.name,
      sku: p.sku || 'SKU-' + p.id.slice(0, 4),
      category: p.category || 'General',
      unit: p.unit || 'carton',
      price: priceMap[p.id] || 0,
      revenue,
      unitsProduced,
      unitsSold,
      currentStock,
      stockVelocity,
      daysOfInventoryLeft,
      returnRatePct,
      revenueGrowthPct,
      stockStatus,
    };
  });

  productsData.sort((a, b) => b.revenue - a.revenue);

  // ─────────────────────────────────────────────────────────────
  // PART 4: SALES TRENDS
  // ─────────────────────────────────────────────────────────────
  const salesTrendsMap = new Map<string, {
    revenue: number;
    orders: number;
    newCustomers: Set<string>;
    repeatCustomers: Set<string>;
  }>();

  // Helper to determine date grouping key
  const formatGroupKey = (d: Date, numDays: number): { key: string; label: string } => {
    if (numDays <= 2) {
      // Hourly or today
      const hour = d.getHours().toString().padStart(2, '0');
      return { key: `${hour}:00`, label: `${hour}:00` };
    }
    if (numDays <= 31) {
      // Daily: MMM dd
      const month = d.toLocaleString('en-US', { month: 'short' });
      const day = d.getDate().toString().padStart(2, '0');
      return { key: `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${day}`, label: `${month} ${day}` };
    }
    if (numDays <= 90) {
      // Weekly: Wk X
      const weekNum = Math.ceil(d.getDate() / 7);
      const month = d.toLocaleString('en-US', { month: 'short' });
      return { key: `${d.getFullYear()}-${d.getMonth()}-W${weekNum}`, label: `${month} Wk ${weekNum}` };
    }
    // Monthly: MMM yyyy
    const month = d.toLocaleString('en-US', { month: 'short' });
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: `${month} '${d.getFullYear().toString().slice(2)}` };
  };

  // Find customer first order dates across entire database
  const customerFirstOrderTime = new Map<string, number>();
  for (const o of rawOrders) {
    if (o.status === 'cancelled') continue;
    const t = new Date(o.created_at).getTime();
    const currFirst = customerFirstOrderTime.get(o.customer_id);
    if (!currFirst || t < currFirst) {
      customerFirstOrderTime.set(o.customer_id, t);
    }
  }

  for (const o of periodOrders) {
    if (o.status === 'cancelled') continue;
    const od = new Date(o.created_at);
    const { key, label } = formatGroupKey(od, days);

    if (!salesTrendsMap.has(key)) {
      salesTrendsMap.set(key, { revenue: 0, orders: 0, newCustomers: new Set(), repeatCustomers: new Set() });
    }
    const entry = salesTrendsMap.get(key)!;
    entry.revenue += Number(o.total_amount || 0);
    entry.orders += 1;

    const firstTime = customerFirstOrderTime.get(o.customer_id);
    const isNew = firstTime && firstTime >= start.getTime() && firstTime <= end.getTime();
    if (isNew) {
      entry.newCustomers.add(o.customer_id);
    } else {
      entry.repeatCustomers.add(o.customer_id);
    }
  }

  const salesTrends: SalesTrendDataPoint[] = [];
  salesTrendsMap.forEach((val, key) => {
    salesTrends.push({
      periodLabel: key.includes(':') ? key : key.split('-').slice(1).join('-') || key,
      dateKey: key,
      revenue: val.revenue,
      ordersCount: val.orders,
      averageOrderValue: val.orders > 0 ? Math.round(val.revenue / val.orders) : 0,
      newCustomersCount: val.newCustomers.size,
      repeatCustomersCount: val.repeatCustomers.size,
    });
  });

  // Sort chronological
  salesTrends.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  // If empty (e.g. fresh database today), populate at least 1 mock/current point
  if (salesTrends.length === 0) {
    salesTrends.push({
      periodLabel: 'Current Period',
      dateKey: 'current',
      revenue: 0,
      ordersCount: 0,
      averageOrderValue: 0,
      newCustomersCount: 0,
      repeatCustomersCount: 0,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // PART 5: WAREHOUSE INTELLIGENCE
  // ─────────────────────────────────────────────────────────────
  const warehousesData: WarehouseIntelligenceItem[] = rawWarehouses.map((w: any) => {
    const wReceipts = rawReceipts.filter((r: any) => r.warehouse_id === w.id);
    const wDispatches = rawDispatches.filter((d: any) => d.warehouse_id === w.id);
    const totalReceived = wReceipts.reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0), 0);
    const totalDispatched = wDispatches.reduce((sum: number, d: any) => sum + (Number(d.quantity) || 0), 0);
    const totalStockUnits = Math.max(0, totalReceived - totalDispatched);

    const capacityUnits = 10000; // Baseline storage capacity per factory spec
    const utilizationPct = Math.min(100, Math.round((totalStockUnits / capacityUnits) * 100));

    // Period activity
    const pReceipts = periodReceipts.filter((r: any) => r.warehouse_id === w.id).length;
    const pDispatches = periodDispatches.filter((d: any) => d.warehouse_id === w.id).length;
    const activityCount = pReceipts + pDispatches;

    // Stock per product in this warehouse
    const stockDistribution = rawProducts.map((p: any) => {
      const prodIn = wReceipts.filter((r: any) => r.product_id === p.id).reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0), 0);
      const prodOut = wDispatches.filter((d: any) => d.product_id === p.id).reduce((sum: number, d: any) => sum + (Number(d.quantity) || 0), 0);
      const units = Math.max(0, prodIn - prodOut);
      const pctOfWarehouse = totalStockUnits > 0 ? Math.round((units / totalStockUnits) * 100) : 0;
      return {
        productId: p.id,
        productName: p.name,
        units,
        pctOfWarehouse,
      };
    }).filter(d => d.units > 0);

    // Fast moving SKU
    const dispatchesByProduct: Record<string, number> = {};
    for (const d of periodDispatches.filter((dp: any) => dp.warehouse_id === w.id)) {
      dispatchesByProduct[d.product_id] = (dispatchesByProduct[d.product_id] || 0) + (Number(d.quantity) || 0);
    }
    let topProdId = '';
    let topProdUnits = 0;
    for (const [pId, units] of Object.entries(dispatchesByProduct)) {
      if (units > topProdUnits) {
        topProdUnits = units;
        topProdId = pId;
      }
    }
    const topProd = rawProducts.find((p: any) => p.id === topProdId);

    const lowStockCount = stockDistribution.filter(d => d.units > 0 && d.units <= 20).length;
    const stockoutCount = rawProducts.length - stockDistribution.length;

    return {
      id: w.id,
      name: w.name,
      code: w.code,
      location: w.location || 'Addis Ababa',
      totalStockUnits,
      capacityUnits,
      utilizationPct,
      activityCount,
      receiptsCount: pReceipts,
      dispatchesCount: pDispatches,
      lowStockItemsCount: lowStockCount,
      stockoutItemsCount: Math.max(0, stockoutCount),
      fastMovingProduct: topProd ? { name: topProd.name, units: topProdUnits } : undefined,
      stockDistribution,
    };
  });

  // ─────────────────────────────────────────────────────────────
  // PART 6: PRODUCTION INTELLIGENCE
  // ─────────────────────────────────────────────────────────────
  const now = new Date();
  const todayStartIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStartIso = new Date(now.getTime() - 7 * 86400000).toISOString();
  const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sixMonthsStartIso = new Date(now.getTime() - 180 * 86400000).toISOString();

  const producedToday = rawScans
    .filter((s: any) => (s.scanned_at || s.created_at) >= todayStartIso)
    .reduce((sum: number, s: any) => sum + (Number(s.quantity) || 1), 0);

  const producedThisWeek = rawScans
    .filter((s: any) => (s.scanned_at || s.created_at) >= weekStartIso)
    .reduce((sum: number, s: any) => sum + (Number(s.quantity) || 1), 0);

  const producedThisMonth = rawScans
    .filter((s: any) => (s.scanned_at || s.created_at) >= monthStartIso)
    .reduce((sum: number, s: any) => sum + (Number(s.quantity) || 1), 0);

  const producedLast6Months = rawScans
    .filter((s: any) => (s.scanned_at || s.created_at) >= sixMonthsStartIso)
    .reduce((sum: number, s: any) => sum + (Number(s.quantity) || 1), 0);

  // Hourly breakdown of period scans (06:00 to 22:00)
  const hourlyMap: Record<number, { count: number; volume: number }> = {};
  for (let h = 6; h <= 21; h++) {
    hourlyMap[h] = { count: 0, volume: 0 };
  }

  // Time blocks
  let morningVol = 0; // 06:00 - 12:00
  let afternoonVol = 0; // 12:00 - 18:00
  let nightVol = 0; // 18:00 - 24:00

  for (const s of periodScans) {
    const scanDate = new Date(s.scanned_at || s.created_at);
    const hour = scanDate.getHours();
    const qty = Number(s.quantity) || 1;

    if (hourlyMap[hour]) {
      hourlyMap[hour].count += 1;
      hourlyMap[hour].volume += qty;
    }

    if (hour >= 6 && hour < 12) morningVol += qty;
    else if (hour >= 12 && hour < 18) afternoonVol += qty;
    else nightVol += qty;
  }

  let peakHour = '10:00';
  let peakHourVolume = 0;
  const hourlyProduction = Object.entries(hourlyMap).map(([hourStr, data]) => {
    const h = parseInt(hourStr, 10);
    const label = `${h.toString().padStart(2, '0')}:00`;
    if (data.volume > peakHourVolume) {
      peakHourVolume = data.volume;
      peakHour = label;
    }
    return {
      hourLabel: label,
      count: data.count,
      volume: data.volume,
    };
  });

  const totalBlockVol = Math.max(1, morningVol + afternoonVol + nightVol);
  const timeBlocks = [
    {
      blockName: 'Morning (06:00-12:00)' as const,
      units: morningVol,
      percentage: Math.round((morningVol / totalBlockVol) * 100),
    },
    {
      blockName: 'Afternoon (12:00-18:00)' as const,
      units: afternoonVol,
      percentage: Math.round((afternoonVol / totalBlockVol) * 100),
    },
    {
      blockName: 'Night (18:00-24:00)' as const,
      units: nightVol,
      percentage: Math.round((nightVol / totalBlockVol) * 100),
    },
  ];

  // Operator rankings
  const operatorScansMap: Record<string, { units: number; count: number; lastActive: string }> = {};
  for (const s of periodScans) {
    const opId = s.scanned_by || 'system';
    if (!operatorScansMap[opId]) {
      operatorScansMap[opId] = { units: 0, count: 0, lastActive: s.scanned_at || s.created_at };
    }
    const curr = operatorScansMap[opId];
    curr.units += Number(s.quantity) || 1;
    curr.count += 1;
    if (new Date(s.scanned_at || s.created_at).getTime() > new Date(curr.lastActive).getTime()) {
      curr.lastActive = s.scanned_at || s.created_at;
    }
  }

  const profileMap = new Map<string, string>();
  for (const prof of rawProfiles) {
    profileMap.set(prof.id, prof.full_name || 'Staff');
  }

  const operatorRankings = Object.entries(operatorScansMap).map(([opId, stats]) => ({
    operatorId: opId,
    operatorName: profileMap.get(opId) || 'Operator ' + opId.slice(0, 6),
    scannedUnits: stats.units,
    scannedCartonsCount: stats.count,
    lastActive: stats.lastActive,
  })).sort((a, b) => b.scannedUnits - a.scannedUnits);

  const productionData: ProductionIntelligenceData = {
    producedToday,
    producedThisWeek,
    producedThisMonth,
    producedLast6Months,
    hourlyProduction,
    peakHour,
    peakHourVolume,
    timeBlocks,
    operatorRankings,
  };

  // ─────────────────────────────────────────────────────────────
  // PART 7: FINANCIAL INTELLIGENCE & AR AGING
  // ─────────────────────────────────────────────────────────────
  const validPeriodOrders = periodOrders.filter((o: any) => o.status !== 'cancelled');
  const totalRevenue = validPeriodOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);

  const approvedPeriodPayments = periodPayments.filter((p: any) => p.status === 'approved');
  const totalCollections = approvedPeriodPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  // Cash vs Credit orders
  let cashSalesAmount = 0;
  let creditSalesAmount = 0;
  for (const o of validPeriodOrders) {
    const isCredit = o.payment_type?.toLowerCase() === 'credit';
    if (isCredit) {
      creditSalesAmount += Number(o.total_amount || 0);
    } else {
      cashSalesAmount += Number(o.total_amount || 0);
    }
  }

  const totalSalesSplit = Math.max(1, cashSalesAmount + creditSalesAmount);
  const cashVsCreditRatio = {
    cashPct: Math.round((cashSalesAmount / totalSalesSplit) * 100),
    creditPct: Math.round((creditSalesAmount / totalSalesSplit) * 100),
  };

  const collectionRatePct = totalRevenue > 0 ? Math.min(100, Math.round((totalCollections / totalRevenue) * 100)) : 0;

  // AR Aging across all currently open orders
  const activeUnpaidOrders = rawOrders.filter(
    (o: any) => o.status !== 'cancelled' && Number(o.total_amount || 0) > Number(o.paid_amount || 0)
  );

  let arCurrent = 0;
  let ar1To30 = 0;
  let ar31To60 = 0;
  let ar61To90 = 0;
  let ar90Plus = 0;
  let totalOutstanding = 0;
  let creditExposure = 0;

  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  for (const o of activeUnpaidOrders) {
    const unpaid = Number(o.total_amount || 0) - Number(o.paid_amount || 0);
    totalOutstanding += unpaid;
    if (o.payment_type?.toLowerCase() === 'credit') {
      creditExposure += unpaid;
    }

    const dueDate = o.due_date ? new Date(o.due_date).getTime() : new Date(o.created_at).getTime() + 30 * 86400000;
    const daysOverdue = Math.floor((todayMidnight - dueDate) / 86400000);

    if (daysOverdue <= 0) {
      arCurrent += unpaid;
    } else if (daysOverdue <= 30) {
      ar1To30 += unpaid;
    } else if (daysOverdue <= 60) {
      ar31To60 += unpaid;
    } else if (daysOverdue <= 90) {
      ar61To90 += unpaid;
    } else {
      ar90Plus += unpaid;
    }
  }

  const totalCreditLimit = rawCredit
    .filter((c: any) => c.credit_allowed && c.active)
    .reduce((sum: number, c: any) => sum + Number(c.credit_limit || 0), 0);

  const creditUtilizationPct = totalCreditLimit > 0 ? Math.min(100, Math.round((creditExposure / totalCreditLimit) * 100)) : 0;

  const recentPayments = rawPayments
    .slice(0, 6)
    .map((p: any) => {
      const cust = rawCustomers.find((c: any) => c.id === p.customer_id);
      return {
        id: p.id,
        customerName: cust ? cust.customer_name : 'Customer',
        amount: Number(p.amount || 0),
        paymentMethod: p.payment_method || 'Cash',
        paymentDate: p.payment_date || p.created_at,
        status: p.status,
      };
    });

  const financesData: FinancialIntelligenceData = {
    totalRevenue,
    totalCollections,
    outstandingBalance: totalOutstanding,
    creditExposure,
    totalCreditLimit,
    creditUtilizationPct,
    cashSalesAmount,
    creditSalesAmount,
    cashVsCreditRatio,
    collectionRatePct,
    arAging: {
      current: arCurrent,
      days1To30: ar1To30,
      days31To60: ar31To60,
      days61To90: ar61To90,
      days90Plus: ar90Plus,
      totalReceivables: totalOutstanding,
    },
    recentPayments,
  };

  // ─────────────────────────────────────────────────────────────
  // PART 8 & 10: SNAPSHOT CARDS & SMART RECOMMENDATIONS
  // ─────────────────────────────────────────────────────────────
  // Top customer of period
  const topCustomer = customersData.find(c => c.totalRevenue > 0) || customersData[0];
  // Top product of period
  const topProduct = productsData.find(p => p.revenue > 0) || productsData[0];

  // Highest revenue day in period
  const dailySalesMap: Record<string, { total: number; label: string }> = {};
  for (const o of validPeriodOrders) {
    const dStr = o.created_at.split('T')[0];
    if (!dailySalesMap[dStr]) dailySalesMap[dStr] = { total: 0, label: dStr };
    dailySalesMap[dStr].total += Number(o.total_amount || 0);
  }
  let highestRevDayDate = 'N/A';
  let highestRevDayVal = 0;
  for (const [dayStr, data] of Object.entries(dailySalesMap)) {
    if (data.total > highestRevDayVal) {
      highestRevDayVal = data.total;
      highestRevDayDate = dayStr;
    }
  }

  // Biggest single order
  let biggestOrderNum = 'N/A';
  let biggestOrderAmount = 0;
  for (const o of validPeriodOrders) {
    const amt = Number(o.total_amount || 0);
    if (amt > biggestOrderAmount) {
      biggestOrderAmount = amt;
      biggestOrderNum = o.order_number;
    }
  }

  // Fastest growing customer
  const fastestGrowingCustomer = [...customersData]
    .filter(c => c.totalRevenue > 0)
    .sort((a, b) => b.growthPct - a.growthPct)[0];

  // Most active warehouse
  const mostActiveWarehouse = [...warehousesData].sort((a, b) => b.activityCount - a.activityCount)[0];

  // Top salesperson
  const salesRepRevenueMap: Record<string, number> = {};
  for (const o of validPeriodOrders) {
    if (o.sales_person_id) {
      salesRepRevenueMap[o.sales_person_id] = (salesRepRevenueMap[o.sales_person_id] || 0) + Number(o.total_amount || 0);
    }
  }
  let topSalesRepId = '';
  let topSalesRepAmt = 0;
  for (const [repId, amt] of Object.entries(salesRepRevenueMap)) {
    if (amt > topSalesRepAmt) {
      topSalesRepAmt = amt;
      topSalesRepId = repId;
    }
  }
  const topSalesRepName = topSalesRepId ? profileMap.get(topSalesRepId) || 'Sales Rep' : 'Direct Orders';

  // Highest collection day
  const dailyCollMap: Record<string, number> = {};
  for (const p of approvedPeriodPayments) {
    const dStr = (p.payment_date || p.created_at).split('T')[0];
    dailyCollMap[dStr] = (dailyCollMap[dStr] || 0) + Number(p.amount || 0);
  }
  let highestCollDay = 'N/A';
  let highestCollAmt = 0;
  for (const [dStr, amt] of Object.entries(dailyCollMap)) {
    if (amt > highestCollAmt) {
      highestCollAmt = amt;
      highestCollDay = dStr;
    }
  }

  const snapshots: SnapshotCardData[] = [
    {
      id: 'top-customer',
      title: 'Customer of the Period',
      name: topCustomer ? topCustomer.name : 'None',
      metric: topCustomer ? `ETB ${topCustomer.totalRevenue.toLocaleString()}` : 'ETB 0',
      rawMetricValue: topCustomer ? topCustomer.totalRevenue : 0,
      subtext: topCustomer ? `${topCustomer.totalOrders} orders booked` : 'No orders',
      destinationUrl: '/customers',
      iconName: 'UserCheck',
      badge: 'VIP Account',
    },
    {
      id: 'top-product',
      title: 'Product of the Period',
      name: topProduct ? topProduct.name : 'None',
      metric: topProduct ? `ETB ${topProduct.revenue.toLocaleString()}` : 'ETB 0',
      rawMetricValue: topProduct ? topProduct.revenue : 0,
      subtext: topProduct ? `${topProduct.unitsSold.toLocaleString()} units sold` : '0 sold',
      destinationUrl: '/inventory',
      iconName: 'Package',
      badge: 'Top Seller',
    },
    {
      id: 'peak-revenue-day',
      title: 'Highest Revenue Day',
      name: highestRevDayDate !== 'N/A' ? new Date(highestRevDayDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }) : 'None',
      metric: `ETB ${highestRevDayVal.toLocaleString()}`,
      rawMetricValue: highestRevDayVal,
      subtext: 'Peak daily bookings',
      destinationUrl: '/orders',
      iconName: 'Calendar',
      badge: 'Peak Sales',
    },
    {
      id: 'biggest-order',
      title: 'Biggest Single Order',
      name: biggestOrderNum,
      metric: `ETB ${biggestOrderAmount.toLocaleString()}`,
      rawMetricValue: biggestOrderAmount,
      subtext: 'Largest invoice ticket',
      destinationUrl: '/orders',
      iconName: 'Receipt',
      badge: 'Max Ticket',
    },
    {
      id: 'fastest-grower',
      title: 'Fastest Growing Customer',
      name: fastestGrowingCustomer ? fastestGrowingCustomer.name : 'None',
      metric: fastestGrowingCustomer ? `+${fastestGrowingCustomer.growthPct}%` : '0%',
      rawMetricValue: fastestGrowingCustomer ? fastestGrowingCustomer.growthPct : 0,
      subtext: fastestGrowingCustomer ? `ETB ${fastestGrowingCustomer.totalRevenue.toLocaleString()} volume` : 'No history',
      destinationUrl: '/customers',
      iconName: 'TrendingUp',
      badge: 'Accelerating',
    },
    {
      id: 'active-warehouse',
      title: 'Most Active Warehouse',
      name: mostActiveWarehouse ? mostActiveWarehouse.name : 'Main Plant',
      metric: mostActiveWarehouse ? `${mostActiveWarehouse.activityCount} ops` : '0 ops',
      rawMetricValue: mostActiveWarehouse ? mostActiveWarehouse.activityCount : 0,
      subtext: mostActiveWarehouse ? `${mostActiveWarehouse.totalStockUnits.toLocaleString()} units on hand` : '0 in stock',
      destinationUrl: '/warehouse',
      iconName: 'Building2',
      badge: 'Hub',
    },
    {
      id: 'top-salesperson',
      title: 'Top Salesperson',
      name: topSalesRepName,
      metric: `ETB ${topSalesRepAmt.toLocaleString()}`,
      rawMetricValue: topSalesRepAmt,
      subtext: 'Closed revenue',
      destinationUrl: '/orders',
      iconName: 'Award',
      badge: 'Champion',
    },
    {
      id: 'highest-collection-day',
      title: 'Highest Collection Day',
      name: highestCollDay !== 'N/A' ? new Date(highestCollDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'None',
      metric: `ETB ${highestCollAmt.toLocaleString()}`,
      rawMetricValue: highestCollAmt,
      subtext: 'Cash inflows reconciled',
      destinationUrl: '/account/payments',
      iconName: 'Banknote',
      badge: 'Cash Inflow',
    },
  ];

  // ─────────────────────────────────────────────────────────────
  // PART 8: SMART RECOMMENDATIONS (Purely factual from calculations)
  // ─────────────────────────────────────────────────────────────
  const recommendations: SmartRecommendation[] = [];

  // 1. Customer Growth
  if (fastestGrowingCustomer && fastestGrowingCustomer.growthPct >= 20) {
    recommendations.push({
      id: `rec-growth-${fastestGrowingCustomer.id}`,
      category: 'customer',
      priority: 'high',
      title: 'Customer Surge Alert',
      message: `${fastestGrowingCustomer.name} increased order volume by ${fastestGrowingCustomer.growthPct}% (ETB ${fastestGrowingCustomer.totalRevenue.toLocaleString()}) compared to prior period.`,
      metric: `+${fastestGrowingCustomer.growthPct}%`,
      supportingValue: `ETB ${fastestGrowingCustomer.totalRevenue.toLocaleString()}`,
      actionLabel: 'View Account',
      actionUrl: '/customers',
    });
  }

  // 2. Inactive Customers
  const inactiveCustomers = customersData.filter(c => c.daysSinceLastPurchase >= 45 && c.daysSinceLastPurchase < 999);
  if (inactiveCustomers.length > 0) {
    const topInactive = inactiveCustomers[0];
    recommendations.push({
      id: `rec-inactive-${topInactive.id}`,
      category: 'customer',
      priority: 'medium',
      title: 'Account Inactivity Warning',
      message: `${topInactive.name} has not placed an order in ${topInactive.daysSinceLastPurchase} days (Historical spend: ETB ${topInactive.totalRevenue.toLocaleString()}).`,
      metric: `${topInactive.daysSinceLastPurchase} days inactive`,
      supportingValue: topInactive.phone || 'Contact Client',
      actionLabel: 'Call Customer',
      actionUrl: '/customers',
    });
  }

  // 3. High Credit Utilization
  const highCreditClients = customersData.filter(c => c.creditUtilizationPct >= 85);
  if (highCreditClients.length > 0) {
    const client = highCreditClients[0];
    recommendations.push({
      id: `rec-credit-${client.id}`,
      category: 'finance',
      priority: client.creditUtilizationPct >= 95 ? 'critical' : 'high',
      title: 'Credit Limit Threshold Reached',
      message: `${client.name} has utilized ${client.creditUtilizationPct}% of their authorized credit limit (Outstanding: ETB ${client.outstandingBalance.toLocaleString()}).`,
      metric: `${client.creditUtilizationPct}% utilization`,
      supportingValue: `ETB ${client.outstandingBalance.toLocaleString()}`,
      actionLabel: 'Review Credit',
      actionUrl: '/account/debt',
    });
  }

  // 4. Product Stockout Risk
  const lowStockProds = productsData.filter(p => p.stockStatus === 'Low Stock' || p.stockStatus === 'Out of Stock');
  if (lowStockProds.length > 0) {
    const prod = lowStockProds[0];
    recommendations.push({
      id: `rec-stock-${prod.id}`,
      category: 'product',
      priority: prod.currentStock === 0 ? 'critical' : 'high',
      title: prod.currentStock === 0 ? 'Stockout Immediate Action' : 'Replenishment Forecast',
      message: `${prod.name} has ${prod.currentStock} units remaining (Burn rate: ${prod.stockVelocity} units/day. Projected depletion: ${prod.daysOfInventoryLeft} days).`,
      metric: `${prod.currentStock} units left`,
      supportingValue: `Velocity: ${prod.stockVelocity}/day`,
      actionLabel: 'Schedule Production',
      actionUrl: '/production',
    });
  }

  // 5. Peak Sales Day
  if (highestRevDayVal > 0 && highestRevDayDate !== 'N/A') {
    const dayName = new Date(highestRevDayDate).toLocaleDateString('en-US', { weekday: 'long' });
    recommendations.push({
      id: 'rec-peak-sales-day',
      category: 'sales',
      priority: 'info',
      title: 'Sales Timing Optimization',
      message: `${dayName} emerged as the strongest revenue driver with ETB ${highestRevDayVal.toLocaleString()} in closed transactions.`,
      metric: `ETB ${highestRevDayVal.toLocaleString()}`,
      supportingValue: dayName,
      actionLabel: 'Review Pipeline',
      actionUrl: '/orders',
    });
  }

  // 6. Production Peak Hour
  if (peakHourVolume > 0) {
    recommendations.push({
      id: 'rec-peak-prod-hour',
      category: 'production',
      priority: 'info',
      title: 'Peak Factory Output Hour',
      message: `Factory floor recorded peak throughput at ${peakHour} with ${peakHourVolume.toLocaleString()} units registered by operators.`,
      metric: `${peakHourVolume} units`,
      supportingValue: peakHour,
      actionLabel: 'View Floor Scans',
      actionUrl: '/production',
    });
  }

  return {
    filters,
    dateRange: { start, end, prevStart, prevEnd },
    snapshots,
    customers: customersData,
    products: productsData,
    salesTrends,
    warehouses: warehousesData,
    production: productionData,
    finances: financesData,
    recommendations,
    filterOptions,
  };
}

// ─────────────────────────────────────────────────────────────
// PART 9: EXECUTIVE COMPARE MODE CALCULATOR
// ─────────────────────────────────────────────────────────────
export function compareEntities(
  type: 'customer' | 'product' | 'warehouse',
  entityAId: string,
  entityBId: string,
  data: CompleteExecutiveData
): ExecutiveCompareResult {
  if (type === 'customer') {
    const custA = data.customers.find(c => c.id === entityAId) || data.customers[0];
    const custB = data.customers.find(c => c.id === entityBId) || data.customers[1] || custA;

    const metrics: ComparisonMetricRow[] = [
      {
        label: 'Total Revenue',
        entityAValue: custA.totalRevenue,
        entityBValue: custB.totalRevenue,
        rawDiff: custA.totalRevenue - custB.totalRevenue,
        pctChange: custB.totalRevenue > 0 ? Math.round(((custA.totalRevenue - custB.totalRevenue) / custB.totalRevenue) * 100) : 0,
        winner: custA.totalRevenue > custB.totalRevenue ? 'A' : custB.totalRevenue > custA.totalRevenue ? 'B' : 'Tie',
        formattedA: `ETB ${custA.totalRevenue.toLocaleString()}`,
        formattedB: `ETB ${custB.totalRevenue.toLocaleString()}`,
      },
      {
        label: 'Total Orders',
        entityAValue: custA.totalOrders,
        entityBValue: custB.totalOrders,
        rawDiff: custA.totalOrders - custB.totalOrders,
        winner: custA.totalOrders > custB.totalOrders ? 'A' : custB.totalOrders > custA.totalOrders ? 'B' : 'Tie',
        formattedA: `${custA.totalOrders} orders`,
        formattedB: `${custB.totalOrders} orders`,
      },
      {
        label: 'Average Order Value (AOV)',
        entityAValue: custA.averageOrderValue,
        entityBValue: custB.averageOrderValue,
        winner: custA.averageOrderValue > custB.averageOrderValue ? 'A' : custB.averageOrderValue > custA.averageOrderValue ? 'B' : 'Tie',
        formattedA: `ETB ${custA.averageOrderValue.toLocaleString()}`,
        formattedB: `ETB ${custB.averageOrderValue.toLocaleString()}`,
      },
      {
        label: 'Credit Utilization',
        entityAValue: custA.creditUtilizationPct,
        entityBValue: custB.creditUtilizationPct,
        winner: custA.creditUtilizationPct < custB.creditUtilizationPct ? 'A' : 'B',
        formattedA: `${custA.creditUtilizationPct}%`,
        formattedB: `${custB.creditUtilizationPct}%`,
      },
      {
        label: 'Payment Rating',
        entityAValue: custA.paymentBehavior,
        entityBValue: custB.paymentBehavior,
        formattedA: custA.paymentBehavior,
        formattedB: custB.paymentBehavior,
      },
    ];

    return {
      titleA: custA.name,
      titleB: custB.name,
      metrics,
    };
  }

  if (type === 'product') {
    const prodA = data.products.find(p => p.id === entityAId) || data.products[0];
    const prodB = data.products.find(p => p.id === entityBId) || data.products[1] || prodA;

    const metrics: ComparisonMetricRow[] = [
      {
        label: 'Revenue Generated',
        entityAValue: prodA.revenue,
        entityBValue: prodB.revenue,
        rawDiff: prodA.revenue - prodB.revenue,
        pctChange: prodB.revenue > 0 ? Math.round(((prodA.revenue - prodB.revenue) / prodB.revenue) * 100) : 0,
        winner: prodA.revenue > prodB.revenue ? 'A' : prodB.revenue > prodA.revenue ? 'B' : 'Tie',
        formattedA: `ETB ${prodA.revenue.toLocaleString()}`,
        formattedB: `ETB ${prodB.revenue.toLocaleString()}`,
      },
      {
        label: 'Units Sold',
        entityAValue: prodA.unitsSold,
        entityBValue: prodB.unitsSold,
        winner: prodA.unitsSold > prodB.unitsSold ? 'A' : prodB.unitsSold > prodA.unitsSold ? 'B' : 'Tie',
        formattedA: `${prodA.unitsSold.toLocaleString()} units`,
        formattedB: `${prodB.unitsSold.toLocaleString()} units`,
      },
      {
        label: 'Units Produced',
        entityAValue: prodA.unitsProduced,
        entityBValue: prodB.unitsProduced,
        winner: prodA.unitsProduced > prodB.unitsProduced ? 'A' : prodB.unitsProduced > prodA.unitsProduced ? 'B' : 'Tie',
        formattedA: `${prodA.unitsProduced.toLocaleString()} units`,
        formattedB: `${prodB.unitsProduced.toLocaleString()} units`,
      },
      {
        label: 'Current Stock',
        entityAValue: prodA.currentStock,
        entityBValue: prodB.currentStock,
        winner: prodA.currentStock > prodB.currentStock ? 'A' : 'B',
        formattedA: `${prodA.currentStock.toLocaleString()} units`,
        formattedB: `${prodB.currentStock.toLocaleString()} units`,
      },
      {
        label: 'Stock Velocity',
        entityAValue: prodA.stockVelocity,
        entityBValue: prodB.stockVelocity,
        winner: prodA.stockVelocity > prodB.stockVelocity ? 'A' : 'B',
        formattedA: `${prodA.stockVelocity} units/day`,
        formattedB: `${prodB.stockVelocity} units/day`,
      },
    ];

    return {
      titleA: prodA.name,
      titleB: prodB.name,
      metrics,
    };
  }

  // Warehouse comparison
  const whA = data.warehouses.find(w => w.id === entityAId) || data.warehouses[0];
  const whB = data.warehouses.find(w => w.id === entityBId) || data.warehouses[1] || whA;

  const metrics: ComparisonMetricRow[] = [
    {
      label: 'Total Stock On Hand',
      entityAValue: whA.totalStockUnits,
      entityBValue: whB.totalStockUnits,
      rawDiff: whA.totalStockUnits - whB.totalStockUnits,
      winner: whA.totalStockUnits > whB.totalStockUnits ? 'A' : 'B',
      formattedA: `${whA.totalStockUnits.toLocaleString()} units`,
      formattedB: `${whB.totalStockUnits.toLocaleString()} units`,
    },
    {
      label: 'Capacity Utilization',
      entityAValue: whA.utilizationPct,
      entityBValue: whB.utilizationPct,
      formattedA: `${whA.utilizationPct}%`,
      formattedB: `${whB.utilizationPct}%`,
    },
    {
      label: 'Operational Activity',
      entityAValue: whA.activityCount,
      entityBValue: whB.activityCount,
      winner: whA.activityCount > whB.activityCount ? 'A' : 'B',
      formattedA: `${whA.activityCount} operations`,
      formattedB: `${whB.activityCount} operations`,
    },
  ];

  return {
    titleA: whA.name,
    titleB: whB.name,
    metrics,
  };
}
