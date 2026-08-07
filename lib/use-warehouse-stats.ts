'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface WarehouseStats {
  warehouse: any | null;
  available: number;
  allocated: number;
  incomingTransfers: number;
  outgoingTransfers: number;
  pendingFulfillment: number;
  recentScans: any[];
  recentCorrections: any[];
  correctionCount: number;
  loading: boolean;
}

export function useWarehouseStats(profile: any): WarehouseStats {
  const [stats, setStats] = useState<WarehouseStats>({
    warehouse: null,
    available: 0,
    allocated: 0,
    incomingTransfers: 0,
    outgoingTransfers: 0,
    pendingFulfillment: 0,
    recentScans: [],
    recentCorrections: [],
    correctionCount: 0,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      // Find which warehouse this user belongs to based on email/profile
      // Since it's a demo, we match the warehouse code to the profile email prefix if possible
      // or we just fetch the first warehouse if they are an admin.
      let warehouseId = null;
      let wh = null;
      
      const { data: whs } = await supabase.from('warehouses').select('*');
      
      if (profile?.role === 'warehouse' || profile?.role === 'warehouse_manager') {
        const numMatch = profile.email.match(/wh(\d+)/);
        const code = numMatch ? `WH${numMatch[1]}` : 'WH1';
        wh = whs?.find(w => w.code === code) || whs?.[0];
        warehouseId = wh?.id;
      } else {
        wh = whs?.[0];
        warehouseId = wh?.id;
      }

      if (!warehouseId) {
        if (active) setStats(s => ({ ...s, loading: false }));
        return;
      }

      const [
        { data: invView },
        { count: incomingCount },
        { count: outgoingCount },
        { count: ordersCount },
        { data: receipts },
        { count: correctionsCountNum },
        { data: recentCorrections }
      ] = await Promise.all([
        supabase.from('view_inventory_summary').select('*').eq('current_warehouse_id', warehouseId),
        supabase.from('warehouse_transfers').select('id', { count: 'exact', head: true }).eq('destination_warehouse_id', warehouseId).in('status', ['sent', 'receiving']),
        supabase.from('warehouse_transfers').select('id', { count: 'exact', head: true }).eq('source_warehouse_id', warehouseId).in('status', ['draft', 'sent', 'receiving']),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'), // pending fulfillment (approximate globally or we could filter by items)
        supabase.from('warehouse_receipts').select('*, product:products(name), receiver:profiles(full_name)').eq('warehouse_id', warehouseId).order('received_at', { ascending: false }).limit(5),
        supabase.from('correction_records').select('id', { count: 'exact', head: true }).eq('department', 'warehouse'),
        supabase.from('correction_records').select('*').eq('department', 'warehouse').order('corrected_at', { ascending: false }).limit(5)
      ]);

      if (!active) return;

      let available = 0;
      let allocated = 0;

      (invView || []).forEach(v => {
        available += Number(v.available);
        allocated += Number(v.allocated);
      });

      setStats({
        warehouse: wh,
        available,
        allocated,
        incomingTransfers: incomingCount || 0,
        outgoingTransfers: outgoingCount || 0,
        pendingFulfillment: ordersCount || 0,
        recentScans: receipts || [],
        recentCorrections: recentCorrections || [],
        correctionCount: correctionsCountNum || 0,
        loading: false,
      });
    };
    if (profile) fetchStats();
    return () => { active = false; };
  }, [profile]);

  return stats;
}
