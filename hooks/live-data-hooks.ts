'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export function useLiveProductionStats(initialStats: any) {
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    // Note: To make this fully functional, RLS policies and realtime 
    // must be enabled on the production_scans table in Supabase.
    const channel = supabase
      .channel('production_scans_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'production_scans',
        },
        (payload) => {
          // Optimistically update the local stats when a new scan happens
          setStats((prev: any) => ({
            ...prev,
            producedToday: prev.producedToday + 1,
            shiftProgress: Math.min(100, ((prev.producedToday + 1) / prev.targetToday) * 100),
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return stats;
}

export function useLiveWarehouseStats(initialStats: any) {
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    const channel = supabase
      .channel('warehouse_movements')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_movements',
        },
        (payload) => {
          // Re-fetch or optimistically update stats based on payload
          // For now, we will just simulate a data refresh by triggering a re-render 
          // or you could refetch the actual count from the API.
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return stats;
}
