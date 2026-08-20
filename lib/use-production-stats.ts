'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface ProductionStats {
  today: number;
  week: number;
  byProduct: { name: string; value: number }[];
  byUser: { name: string; value: number }[];
  recentCorrections: any[];
  correctionCount: number;
  total: number;
  loading: boolean;
}

export function useProductionStats(): ProductionStats {
  const [stats, setStats] = useState<ProductionStats>({
    today: 0,
    week: 0,
    byProduct: [],
    byUser: [],
    recentCorrections: [],
    correctionCount: 0,
    total: 0,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      const now = new Date();
      const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStr = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();

      const [
        { count: prodTodayCount },
        { count: prodWeekCount },
        { data: weekScans },
        { count: correctionsCountNum },
        { data: recentCorrections },
        { count: totalCountNum }
      ] = await Promise.all([
        supabase.from('production_scans').select('id', { count: 'exact', head: true }).gte('scanned_at', todayStr),
        supabase.from('production_scans').select('id', { count: 'exact', head: true }).gte('scanned_at', weekStr),
        supabase.from('production_scans').select('quantity, product:products(name), scanner:profiles(full_name)').gte('scanned_at', weekStr),
        supabase.from('correction_records').select('id', { count: 'exact', head: true }).eq('correction_type', 'production'),
        supabase.from('correction_records').select('*').eq('correction_type', 'production').order('performed_at', { ascending: false }).limit(5),
        supabase.from('production_scans').select('id', { count: 'exact', head: true })
      ]);

      if (!active) return;

      const productMap = new Map();
      const userMap = new Map();

      (weekScans || []).forEach((scan: any) => {
        const pName = scan.product?.name || 'Unknown';
        const uName = scan.scanner?.full_name || 'Unknown';
        
        productMap.set(pName, (productMap.get(pName) || 0) + scan.quantity);
        userMap.set(uName, (userMap.get(uName) || 0) + scan.quantity);
      });

      setStats({
        today: prodTodayCount || 0,
        week: prodWeekCount || 0,
        byProduct: Array.from(productMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5),
        byUser: Array.from(userMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5),
        correctionCount: correctionsCountNum || 0,
        recentCorrections: recentCorrections || [],
        total: totalCountNum || 0,
        loading: false,
      });
    };
    fetchStats();
    return () => { active = false; };
  }, []);

  return stats;
}
