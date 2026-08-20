'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface DashboardData {
  loading: boolean;
  // Production
  producedToday: number;
  producedThisWeek: number;
  recentScans: { barcode: string; product_name: string; scanned_at: string }[];
  // Warehouse
  boxesInWarehouse: number;
  boxesReceived: number;
  recentReceipts: { barcode: string; product_name: string; warehouse_name: string; received_at: string }[];
  // Orders / Sales
  ordersTotal: number;
  ordersToday: number;
  ordersPending: number;
  totalRevenue: number;
  totalOutstanding: number;
  recentOrders: { order_number: string; customer_name: string; status: string; total_amount: number; created_at: string }[];
  // Dispatch
  dispatchedToday: number;
  dispatchReady: number; // orders ready to dispatch
  inTransit: number;
  recentDispatches: { barcode: string; order_number: string; customer_name: string; dispatched_at: string }[];
  // Delivery
  deliveriesToday: number;
  deliveriesPending: number;
  // Returns
  returnsPending: number;
  returnsApproved: number;
  recentReturns: { barcode: string; product_name: string; condition: string; approval_status: string; created_at: string }[];
  // Payments
  paymentsToday: number;
  paymentsTodayValue: number;
  overdueCount: number;
  recentPayments: { order_number: string; customer_name: string; amount: number; payment_date: string }[];
  // Activity Feed
  activity: { action: string; entity_type: string; barcode: string | null; details: any; created_at: string; user_name: string }[];
  // Customers
  customersTotal: number;
}

const today = new Date();
today.setHours(0, 0, 0, 0);
const todayISO = today.toISOString();

export function useDashboardData(role: string, warehouseId?: string): DashboardData {
  const [data, setData] = useState<DashboardData>({
    loading: true,
    producedToday: 0, producedThisWeek: 0, recentScans: [],
    boxesInWarehouse: 0, boxesReceived: 0, recentReceipts: [],
    ordersTotal: 0, ordersToday: 0, ordersPending: 0, totalRevenue: 0, totalOutstanding: 0, recentOrders: [],
    dispatchedToday: 0, dispatchReady: 0, inTransit: 0, recentDispatches: [],
    deliveriesToday: 0, deliveriesPending: 0,
    returnsPending: 0, returnsApproved: 0, recentReturns: [],
    paymentsToday: 0, paymentsTodayValue: 0, overdueCount: 0, recentPayments: [],
    activity: [],
    customersTotal: 0,
  });

  useEffect(() => {
    const fetchAll = async () => {
      const updates: Partial<DashboardData> = { loading: false };
      const needs = getNeeds(role);

      try {
        await Promise.all([
          // Production stats
          needs.production && (async () => {
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const [todayRes, weekRes, recentRes] = await Promise.all([
              supabase.from('production_scans').select('id', { count: 'exact', head: true }).gte('scanned_at', todayISO),
              supabase.from('production_scans').select('id', { count: 'exact', head: true }).gte('scanned_at', weekAgo),
              supabase.from('production_scans').select('barcode, scanned_at, product:products(name)').order('scanned_at', { ascending: false }).limit(10),
            ]);
            updates.producedToday = todayRes.count ?? 0;
            updates.producedThisWeek = weekRes.count ?? 0;
            updates.recentScans = (recentRes.data ?? []).map((s: any) => ({
              barcode: s.barcode, product_name: s.product?.name ?? '—', scanned_at: s.scanned_at
            }));
          })(),

          // Warehouse stats
          needs.warehouse && (async () => {
            let q = supabase.from('boxes').select('id', { count: 'exact', head: true }).eq('status', 'in_warehouse');
            if (warehouseId) q = q.eq('current_warehouse_id', warehouseId);
            const [whRes, rcvRes, recentRes] = await Promise.all([
              q,
              supabase.from('warehouse_receipts').select('id', { count: 'exact', head: true }).gte('received_at', todayISO),
              supabase.from('warehouse_receipts').select('barcode, received_at, product:products(name), warehouse:warehouses(code)').order('received_at', { ascending: false }).limit(10),
            ]);
            updates.boxesInWarehouse = whRes.count ?? 0;
            updates.boxesReceived = rcvRes.count ?? 0;
            updates.recentReceipts = (recentRes.data ?? []).map((r: any) => ({
              barcode: r.barcode, product_name: r.product?.name ?? '—',
              warehouse_name: r.warehouse?.code ?? '—', received_at: r.received_at
            }));
          })(),

          // Orders / Sales stats
          needs.orders && (async () => {
            const [totalRes, todayRes, pendingRes, recentRes] = await Promise.all([
              supabase.from('orders').select('id, total_amount, paid_amount', { count: 'exact' }),
              supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
              supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
              supabase.from('orders').select('order_number, status, total_amount, created_at, customer:customers(customer_name)').order('created_at', { ascending: false }).limit(10),
            ]);
            updates.ordersTotal = totalRes.count ?? 0;
            updates.ordersToday = todayRes.count ?? 0;
            updates.ordersPending = pendingRes.count ?? 0;
            const allOrders = totalRes.data ?? [];
            updates.totalRevenue = allOrders.reduce((s: number, o: any) => s + (o.total_amount ?? 0), 0);
            updates.totalOutstanding = allOrders.reduce((s: number, o: any) => s + Math.max(0, (o.total_amount ?? 0) - (o.paid_amount ?? 0)), 0);
            updates.recentOrders = (recentRes.data ?? []).map((o: any) => ({
              order_number: o.order_number, customer_name: o.customer?.customer_name ?? '—',
              status: o.status, total_amount: o.total_amount, created_at: o.created_at
            }));
          })(),

          // Dispatch stats
          needs.dispatch && (async () => {
            const [todayRes, readyRes, inTransitRes, recentRes] = await Promise.all([
              supabase.from('dispatches').select('id', { count: 'exact', head: true }).gte('dispatched_at', todayISO),
              supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'allocated'),
              supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
              supabase.from('dispatches').select('barcode, dispatched_at, order:orders(order_number, customer:customers(customer_name))').order('dispatched_at', { ascending: false }).limit(10),
            ]);
            updates.dispatchedToday = todayRes.count ?? 0;
            updates.dispatchReady = readyRes.count ?? 0;
            updates.inTransit = inTransitRes.count ?? 0;
            updates.recentDispatches = (recentRes.data ?? []).map((d: any) => ({
              barcode: d.barcode, order_number: d.order?.order_number ?? '—',
              customer_name: d.order?.customer?.customer_name ?? '—', dispatched_at: d.dispatched_at
            }));
          })(),

          // Delivery stats
          needs.delivery && (async () => {
            const [todayRes, pendingRes] = await Promise.all([
              supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('status', 'delivered').gte('delivered_at', todayISO),
              supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            ]);
            updates.deliveriesToday = todayRes.count ?? 0;
            updates.deliveriesPending = pendingRes.count ?? 0;
          })(),

          // Returns stats
          needs.returns && (async () => {
            const [pendingRes, approvedRes, recentRes] = await Promise.all([
              supabase.from('returns').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending'),
              supabase.from('returns').select('id', { count: 'exact', head: true }).eq('approval_status', 'approved'),
              supabase.from('returns').select('barcode, condition, approval_status, processed_at, product:products(name)').order('processed_at', { ascending: false }).limit(10),
            ]);
            updates.returnsPending = pendingRes.count ?? 0;
            updates.returnsApproved = approvedRes.count ?? 0;
            updates.recentReturns = (recentRes.data ?? []).map((r: any) => ({
              barcode: r.barcode, product_name: r.product?.name ?? '—',
              condition: r.condition, approval_status: r.approval_status, created_at: r.processed_at
            }));
          })(),

          // Payments stats
          needs.payments && (async () => {
            const [todayRes, allOrdersRes] = await Promise.all([
              supabase.from('payments').select('id, amount', { count: 'exact' }).gte('payment_date', todayISO),
              supabase.from('orders').select('id, total_amount, paid_amount, status'),
            ]);
            const todayPayments = todayRes.data ?? [];
            updates.paymentsToday = todayRes.count ?? 0;
            updates.paymentsTodayValue = todayPayments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
            const orders = allOrdersRes.data ?? [];
            updates.overdueCount = orders.filter((o: any) => (o.total_amount ?? 0) > (o.paid_amount ?? 0) && o.status === 'delivered').length;
          })(),

          // Customers count
          needs.customers && (async () => {
            const { count } = await supabase.from('customers').select('id', { count: 'exact', head: true });
            updates.customersTotal = count ?? 0;
          })(),

          // Activity feed from audit_logs
          needs.activity && (async () => {
            const { data: acts } = await supabase
              .from('audit_logs')
              .select('action, entity_type, barcode, details, created_at, user:profiles(full_name)')
              .order('created_at', { ascending: false })
              .limit(15);
            updates.activity = (acts ?? []).map((a: any) => ({
              action: a.action, entity_type: a.entity_type, barcode: a.barcode,
              details: a.details, created_at: a.created_at, user_name: a.user?.full_name ?? '—'
            }));
          })(),
        ]);
      } catch (e) {
        console.error('Dashboard data fetch error:', e);
      }

      setData(prev => ({ ...prev, ...updates }));
    };

    fetchAll();
  }, [role, warehouseId]);

  return data;
}

function getNeeds(role: string) {
  const all = { production: true, warehouse: true, orders: true, dispatch: true, delivery: true, returns: true, payments: true, customers: true, activity: true };
  switch (role) {
    case 'production': return { ...all, orders: false, dispatch: false, delivery: false, returns: false, payments: false, customers: false };
    case 'production_manager': return { ...all, orders: false, dispatch: false, delivery: false, returns: false, payments: false, customers: false };
    case 'warehouse': return { ...all, orders: false, dispatch: false, delivery: false, returns: false, payments: false, customers: false };
    case 'warehouse_manager': return { ...all, orders: false, dispatch: false, delivery: false, returns: false, payments: false, customers: false };
    case 'sales': return { ...all, production: false, warehouse: false, dispatch: false, delivery: false, returns: false, payments: false };
    case 'sales_manager': return { ...all, production: false, warehouse: false, dispatch: false, delivery: false, returns: false };
    case 'dispatch': return { ...all, production: false, warehouse: false, orders: true, payments: false, customers: false };
    case 'dispatch_manager': return { ...all, production: false, warehouse: false, payments: false, customers: false };
    case 'accounts': return { ...all, production: false, warehouse: false, dispatch: false, delivery: false, returns: false };
    case 'returns_manager': return { ...all, production: false, warehouse: false, orders: false, dispatch: false, delivery: false, payments: false, customers: false };
    default: return all; // admin, manager, reports get everything
  }
}
