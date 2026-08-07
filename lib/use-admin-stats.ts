'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface AdminStats {
  production: {
    today: number;
    week: number;
    month: number;
  };
  inventory: {
    totalPhysical: number;
    available: number;
    allocated: number;
    dispatched: number;
    delivered: number;
    damaged: number;
    expired: number;
    returned: number;
    byWarehouse: { name: string; available: number; allocated: number; dispatched: number }[];
  };
  sales: {
    ordersToday: number;
    ordersMonth: number;
    pending: number;
    approved: number;
    dispatched: number;
    delivered: number;
  };
  finance: {
    totalValue: number;
    paid: number;
    outstanding: number;
    paymentCount: number;
    pendingDiscounts: number;
  };
  returns: {
    pending: number;
    approved: number;
    damaged: number;
    expired: number;
  };
  transfers: {
    pending: number;
    inTransit: number;
    completed: number;
  };
  loading: boolean;
}

export function useAdminStats(): AdminStats {
  const [stats, setStats] = useState<AdminStats>({
    production: { today: 0, week: 0, month: 0 },
    inventory: { totalPhysical: 0, available: 0, allocated: 0, dispatched: 0, delivered: 0, damaged: 0, expired: 0, returned: 0, byWarehouse: [] },
    sales: { ordersToday: 0, ordersMonth: 0, pending: 0, approved: 0, dispatched: 0, delivered: 0 },
    finance: { totalValue: 0, paid: 0, outstanding: 0, paymentCount: 0, pendingDiscounts: 0 },
    returns: { pending: 0, approved: 0, damaged: 0, expired: 0 },
    transfers: { pending: 0, inTransit: 0, completed: 0 },
    loading: true,
  });

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      const now = new Date();
      const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStr = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
      const monthStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Parallel efficient aggregations using PostgREST syntax and views
      const [
        { count: prodTodayCount }, { count: prodWeekCount }, { count: prodMonthCount },
        { data: boxes }, { data: invView }, { data: whList }, { data: prodList },
        { count: ordersTodayCount }, { count: ordersMonthCount }, { data: orderFinancials },
        { data: returns }, { data: transfers }, { count: discountsCount }
      ] = await Promise.all([
        supabase.from('production_scans').select('id', { count: 'exact', head: true }).gte('scanned_at', todayStr),
        supabase.from('production_scans').select('id', { count: 'exact', head: true }).gte('scanned_at', weekStr),
        supabase.from('production_scans').select('id', { count: 'exact', head: true }).gte('scanned_at', monthStr),
        
        // Boxes grouped by status
        supabase.from('boxes').select('status'),
        
        // Inventory by Warehouse
        supabase.from('view_inventory_summary').select('*'),
        supabase.from('warehouses').select('id, code'),
        supabase.from('products').select('id, name'),

        supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStr),
        supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', monthStr),
        supabase.from('view_order_financials').select('*'),
        
        supabase.from('returns').select('status, return_type'),
        supabase.from('warehouse_transfers').select('status'),
        supabase.from('approvals').select('id', { count: 'exact', head: true }).eq('request_type', 'discount').eq('status', 'pending')
      ]);

      if (!active) return;

      const whMap = new Map((whList || []).map(w => [w.id, w.code]));
      
      const invSummary = {
        totalPhysical: 0, available: 0, allocated: 0, dispatched: 0, delivered: 0, damaged: 0, expired: 0, returned: 0, byWarehouse: [] as any[]
      };

      (boxes || []).forEach(b => {
        invSummary.totalPhysical++;
        if (b.status === 'in_warehouse') invSummary.available++;
        if (b.status === 'allocated') invSummary.allocated++;
        if (b.status === 'dispatched') invSummary.dispatched++;
        if (b.status === 'delivered') invSummary.delivered++;
        if (b.status === 'damaged') invSummary.damaged++;
        if (b.status === 'expired') invSummary.expired++;
        if (b.status === 'returned') invSummary.returned++;
      });
      // also include returned good as available
      invSummary.available += invSummary.returned;

      const byWh = new Map();
      (invView || []).forEach(v => {
        const name = whMap.get(v.current_warehouse_id) || 'Unknown';
        if (!byWh.has(name)) byWh.set(name, { name, available: 0, allocated: 0, dispatched: 0 });
        const w = byWh.get(name);
        w.available += Number(v.available);
        w.allocated += Number(v.allocated);
      });
      invSummary.byWarehouse = Array.from(byWh.values());

      const salesSummary = { ordersToday: ordersTodayCount || 0, ordersMonth: ordersMonthCount || 0, pending: 0, approved: 0, dispatched: 0, delivered: 0 };
      const finSummary = { totalValue: 0, paid: 0, outstanding: 0, paymentCount: 0, pendingDiscounts: discountsCount || 0 };

      (orderFinancials || []).forEach(o => {
        if (o.status === 'pending') salesSummary.pending += Number(o.order_count);
        if (o.status === 'approved') salesSummary.approved += Number(o.order_count);
        if (o.status === 'dispatched') salesSummary.dispatched += Number(o.order_count);
        if (o.status === 'delivered' || o.status === 'partially_delivered') salesSummary.delivered += Number(o.order_count);
        
        finSummary.totalValue += Number(o.total_value);
        finSummary.paid += Number(o.total_paid);
        finSummary.outstanding += Number(o.total_outstanding);
      });

      const retSummary = { pending: 0, approved: 0, damaged: 0, expired: 0 };
      (returns || []).forEach(r => {
        if (r.status === 'pending') retSummary.pending++;
        if (r.status === 'approved') retSummary.approved++;
        if (r.return_type === 'damaged') retSummary.damaged++;
        if (r.return_type === 'expired') retSummary.expired++;
      });

      const transSummary = { pending: 0, inTransit: 0, completed: 0 };
      (transfers || []).forEach(t => {
        if (t.status === 'draft') transSummary.pending++;
        if (t.status === 'sent' || t.status === 'receiving') transSummary.inTransit++;
        if (t.status === 'completed') transSummary.completed++;
      });

      setStats({
        production: {
          today: prodTodayCount || 0,
          week: prodWeekCount || 0,
          month: prodMonthCount || 0,
        },
        inventory: invSummary,
        sales: salesSummary,
        finance: finSummary,
        returns: retSummary,
        transfers: transSummary,
        loading: false
      });
    };
    fetchStats();
    return () => { active = false; };
  }, []);

  return stats;
}
