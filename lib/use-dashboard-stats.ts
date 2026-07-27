'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface DashboardStats {
  totalUsers: number;
  totalWarehouses: number;
  totalProducts: number;
  totalCustomers: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalProductionScans: number;
  scansToday: number;
  totalReceipts: number;
  receiptsToday: number;
  totalDispatches: number;
  dispatchesToday: number;
  pendingApprovals: number;
  totalReturns: number;
  pendingReturns: number;
  damagedStock: number;
  expiredStock: number;
  outstandingBalance: number;
  paidAmount: number;
  loading: boolean;
}

const EMPTY: DashboardStats = {
  totalUsers: 0, totalWarehouses: 0, totalProducts: 0, totalCustomers: 0,
  totalOrders: 0, pendingOrders: 0, completedOrders: 0,
  totalProductionScans: 0, scansToday: 0, totalReceipts: 0, receiptsToday: 0,
  totalDispatches: 0, dispatchesToday: 0, pendingApprovals: 0,
  totalReturns: 0, pendingReturns: 0, damagedStock: 0, expiredStock: 0,
  outstandingBalance: 0, paidAmount: 0, loading: true,
};

export function useDashboardStats(): DashboardStats {
  const [stats, setStats] = useState<DashboardStats>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      const [
        users, warehouses, products, customers,
        orders, pendingOrders, completedOrders,
        scans, scansToday, receipts, receiptsToday,
        dispatches, dispatchesToday,
        approvals, returns, pendingReturns, damaged, expired,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('warehouses').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('production_scans').select('id', { count: 'exact', head: true }),
        supabase.from('production_scans').select('id', { count: 'exact', head: true }).gte('scanned_at', todayISO),
        supabase.from('warehouse_receipts').select('id', { count: 'exact', head: true }),
        supabase.from('warehouse_receipts').select('id', { count: 'exact', head: true }).gte('received_at', todayISO),
        supabase.from('dispatches').select('id', { count: 'exact', head: true }),
        supabase.from('dispatches').select('id', { count: 'exact', head: true }).gte('dispatched_at', todayISO),
        supabase.from('approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('returns').select('id', { count: 'exact', head: true }),
        supabase.from('returns').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('returns').select('id', { count: 'exact', head: true }).eq('return_type', 'damaged'),
        supabase.from('returns').select('id', { count: 'exact', head: true }).eq('return_type', 'expired'),
      ]);

      const { data: orderMoney } = await supabase
        .from('orders')
        .select('total_amount, paid_amount');

      const outstanding = (orderMoney ?? []).reduce((s, o) => s + (Number(o.total_amount) - Number(o.paid_amount)), 0);
      const paid = (orderMoney ?? []).reduce((s, o) => s + Number(o.paid_amount), 0);

      if (cancelled) return;
      setStats({
        totalUsers: users.count ?? 0,
        totalWarehouses: warehouses.count ?? 0,
        totalProducts: products.count ?? 0,
        totalCustomers: customers.count ?? 0,
        totalOrders: orders.count ?? 0,
        pendingOrders: pendingOrders.count ?? 0,
        completedOrders: completedOrders.count ?? 0,
        totalProductionScans: scans.count ?? 0,
        scansToday: scansToday.count ?? 0,
        totalReceipts: receipts.count ?? 0,
        receiptsToday: receiptsToday.count ?? 0,
        totalDispatches: dispatches.count ?? 0,
        dispatchesToday: dispatchesToday.count ?? 0,
        pendingApprovals: approvals.count ?? 0,
        totalReturns: returns.count ?? 0,
        pendingReturns: pendingReturns.count ?? 0,
        damagedStock: damaged.count ?? 0,
        expiredStock: expired.count ?? 0,
        outstandingBalance: outstanding,
        paidAmount: paid,
        loading: false,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  return stats;
}
