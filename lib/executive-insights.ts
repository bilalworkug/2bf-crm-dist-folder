import { supabase } from '@/lib/supabase/client';

export type AlertPriority = 'critical' | 'warning' | 'info' | 'success';

export interface ExecutiveAlert {
  id: string;
  priority: AlertPriority;
  category: 'credit' | 'warehouse' | 'finance' | 'production' | 'delivery';
  title: string;
  description: string;
  metric?: string;
  actionLabel: string;
  actionUrl: string;
}

export interface ExecutiveSummaryMetrics {
  ordersToday: number;
  productionToday: number;
  dispatchToday: number;
  deliveriesToday: number;
  revenueToday: number;
  productionComparisonPct: number;
}

/**
 * Executive Intelligence Engine
 * Queries existing database tables and generates actionable managerial insights
 * entirely without external AI services or changing database schemas.
 */
export async function fetchExecutiveInsights(): Promise<{
  alerts: ExecutiveAlert[];
  summary: ExecutiveSummaryMetrics;
}> {
  const alerts: ExecutiveAlert[] = [];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Credit Insights: Customers >= 90% credit limit or overdue
    const { data: creditData } = await supabase
      .from('customer_credit')
      .select('*, customer:customers(id, customer_name)')
      .eq('credit_allowed', true);

    if (creditData && creditData.length > 0) {
      for (const c of creditData) {
        const limit = Number(c.credit_limit) || 0;
        const outstanding = Number(c.outstanding_balance) || 0;
        if (limit > 0) {
          const usagePct = (outstanding / limit) * 100;
          if (usagePct >= 90) {
            alerts.push({
              id: `credit-limit-${c.customer_id}`,
              priority: usagePct >= 100 ? 'critical' : 'warning',
              category: 'credit',
              title: `High Credit Usage: ${c.customer?.customer_name || 'Customer'}`,
              description: `Customer has utilized ${usagePct.toFixed(0)}% of their credit limit. Review before approving new orders.`,
              metric: `ETB ${outstanding.toLocaleString()} / ${limit.toLocaleString()}`,
              actionLabel: 'View Credit',
              actionUrl: `/account/customers`,
            });
          }
        }
      }
    }

    // 2. Finance Insights: Pending Payments
    const { data: pendingPayments } = await supabase
      .from('payments')
      .select('id, amount, currency, customer:customers(customer_name)')
      .eq('status', 'pending');

    if (pendingPayments && pendingPayments.length > 0) {
      const totalPending = pendingPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
      alerts.push({
        id: 'finance-pending-payments',
        priority: 'warning',
        category: 'finance',
        title: `${pendingPayments.length} Payment${pendingPayments.length > 1 ? 's' : ''} Awaiting Approval`,
        description: 'Account manager verification required to reconcile customer ledgers.',
        metric: `ETB ${totalPending.toLocaleString()}`,
        actionLabel: 'Review Payments',
        actionUrl: '/account/payments',
      });
    }

    // 3. Warehouse Insights: Dispatch Backlog (Orders pending/ready for dispatch)
    const { data: pendingOrders } = await supabase
      .from('orders')
      .select('id, order_number, total_amount')
      .in('status', ['pending', 'approved', 'processing']);

    if (pendingOrders && pendingOrders.length > 0) {
      alerts.push({
        id: 'warehouse-dispatch-backlog',
        priority: pendingOrders.length > 5 ? 'warning' : 'info',
        category: 'warehouse',
        title: `${pendingOrders.length} Orders Waiting for Dispatch`,
        description: 'Warehouse and fulfillment teams should prioritize staging and outbound loading.',
        metric: `${pendingOrders.length} orders queued`,
        actionLabel: 'Go to Dispatch',
        actionUrl: '/dispatch',
      });
    }

    // 4. Stock Depletion: Active products with low units in stock
    const { data: stockItems } = await supabase
      .from('boxes')
      .select('product_id, status')
      .in('status', ['in_warehouse', 'received']);

    const countsByProduct: Record<string, number> = {};
    stockItems?.forEach((b) => {
      countsByProduct[b.product_id] = (countsByProduct[b.product_id] || 0) + 1;
    });

    const { data: products } = await supabase
      .from('products')
      .select('id, name, active')
      .eq('active', true);

    if (products) {
      for (const prod of products) {
        const qty = countsByProduct[prod.id] || 0;
        if (qty === 0) {
          alerts.push({
            id: `stock-depleted-${prod.id}`,
            priority: 'critical',
            category: 'warehouse',
            title: `Zero Stock: ${prod.name}`,
            description: 'Warehouse inventory depleted. Production line schedule should prioritize this SKU.',
            metric: '0 boxes available',
            actionLabel: 'View Inventory',
            actionUrl: '/inventory',
          });
        } else if (qty < 10) {
          alerts.push({
            id: `stock-low-${prod.id}`,
            priority: 'warning',
            category: 'warehouse',
            title: `Low Stock: ${prod.name}`,
            description: `Only ${qty} boxes available in warehouse inventory.`,
            metric: `${qty} boxes remaining`,
            actionLabel: 'View Inventory',
            actionUrl: '/inventory',
          });
        }
      }
    }

    // 5. Today's Summary & Production Velocity
    // Production today
    const { count: prodTodayCount } = await supabase
      .from('production_scans')
      .select('id', { count: 'exact', head: true })
      .gte('scanned_at', todayStart);

    // Production past 7 days
    const { count: prodWeekCount } = await supabase
      .from('production_scans')
      .select('id', { count: 'exact', head: true })
      .gte('scanned_at', sevenDaysAgo);

    const todayProd = prodTodayCount || 0;
    const weekProd = prodWeekCount || 0;
    const avgDailyProd = weekProd > 0 ? weekProd / 7 : 0;
    let prodDiffPct = 0;
    if (avgDailyProd > 0) {
      prodDiffPct = Math.round(((todayProd - avgDailyProd) / avgDailyProd) * 100);
    }

    if (todayProd > 0 && prodDiffPct >= 10) {
      alerts.push({
        id: 'production-velocity-high',
        priority: 'success',
        category: 'production',
        title: "Today's Production Exceeded Target",
        description: `Factory throughput is running ${prodDiffPct}% above the 7-day daily average (${Math.round(avgDailyProd)}/day).`,
        metric: `${todayProd} boxes produced`,
        actionLabel: 'View Production',
        actionUrl: '/production',
      });
    }

    // Orders today
    const { count: ordersTodayCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart);

    // Dispatches today
    const { count: dispatchesTodayCount } = await supabase
      .from('dispatches')
      .select('id', { count: 'exact', head: true })
      .gte('dispatched_at', todayStart);

    // Deliveries today
    const { count: deliveriesTodayCount } = await supabase
      .from('barcode_history')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'DELIVERED')
      .gte('performed_at', todayStart);

    // Revenue today (approved payments)
    const { data: approvedTodayPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'approved')
      .gte('payment_date', todayStart);

    const revenueToday = approvedTodayPayments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

    return {
      alerts,
      summary: {
        ordersToday: ordersTodayCount || 0,
        productionToday: todayProd,
        dispatchToday: dispatchesTodayCount || 0,
        deliveriesToday: deliveriesTodayCount || 0,
        revenueToday,
        productionComparisonPct: prodDiffPct,
      },
    };
  } catch (err) {
    console.error('Failed to calculate executive insights:', err);
    return {
      alerts: [],
      summary: {
        ordersToday: 0,
        productionToday: 0,
        dispatchToday: 0,
        deliveriesToday: 0,
        revenueToday: 0,
        productionComparisonPct: 0,
      },
    };
  }
}
