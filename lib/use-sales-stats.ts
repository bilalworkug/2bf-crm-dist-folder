'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface SalesStats {
  ordersToday: number;
  ordersWeek: number;
  ordersByStatus: { status: string; count: number }[];
  customerCount: number;
  discounts: {
    pending: number;
    approved: number;
    rejected: number;
  };
  totals: {
    value: number;
    outstanding: number;
  };
  salesByPerson: { name: string; value: number }[];
  topProducts: { name: string; value: number }[];
  topCustomers: { name: string; value: number }[];
  loading: boolean;
}

export function useSalesStats(profile: any): SalesStats {
  const [stats, setStats] = useState<SalesStats>({
    ordersToday: 0,
    ordersWeek: 0,
    ordersByStatus: [],
    customerCount: 0,
    discounts: { pending: 0, approved: 0, rejected: 0 },
    totals: { value: 0, outstanding: 0 },
    salesByPerson: [],
    topProducts: [],
    topCustomers: [],
    loading: true,
  });

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      const now = new Date();
      const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStr = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();

      const [
        { count: ordersTodayCount },
        { count: ordersWeekCount },
        { data: orderFin },
        { count: customersCount },
        { data: approvals },
        { data: allOrders }
      ] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStr),
        supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', weekStr),
        supabase.from('view_order_financials').select('*'),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('approvals').select('status').eq('request_type', 'discount'),
        supabase.from('orders').select('total_amount, customer:customers(customer_name), salesperson:profiles!orders_salesperson_id_fkey(full_name)')
      ]);

      if (!active) return;

      const byStatusMap = new Map();
      const fin = { value: 0, outstanding: 0 };
      (orderFin || []).forEach(o => {
        byStatusMap.set(o.status, (byStatusMap.get(o.status) || 0) + Number(o.order_count));
        fin.value += Number(o.total_value);
        fin.outstanding += Number(o.total_outstanding);
      });

      const disc = { pending: 0, approved: 0, rejected: 0 };
      (approvals || []).forEach(a => {
        if (a.status === 'pending') disc.pending++;
        if (a.status === 'approved') disc.approved++;
        if (a.status === 'rejected') disc.rejected++;
      });

      const spMap = new Map();
      const cMap = new Map();
      (allOrders || []).forEach((o: any) => {
        const spName = o.salesperson?.full_name || 'Unknown';
        const cName = o.customer?.customer_name || 'Unknown';
        const val = Number(o.total_amount) || 0;
        
        spMap.set(spName, (spMap.get(spName) || 0) + val);
        cMap.set(cName, (cMap.get(cName) || 0) + val);
      });

      setStats({
        ordersToday: ordersTodayCount || 0,
        ordersWeek: ordersWeekCount || 0,
        ordersByStatus: Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count })),
        customerCount: customersCount || 0,
        discounts: disc,
        totals: fin,
        salesByPerson: Array.from(spMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5),
        topCustomers: Array.from(cMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5),
        topProducts: [], // Would need order_items for this, skipping for performance unless explicitly needed
        loading: false,
      });
    };
    fetchStats();
    return () => { active = false; };
  }, [profile]);

  return stats;
}
