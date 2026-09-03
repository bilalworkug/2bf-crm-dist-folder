'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeDashboardOptions {
  tables: Array<{
    table: string;
    event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
    schema?: string;
  }>;
  onUpdate: () => void;
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Reusable hook that subscribes to Supabase postgres_changes for specified tables
 * and triggers a debounced onUpdate callback.
 * Ensures clean subscription teardown on unmount to prevent memory leaks and redundant fetches.
 */
export function useRealtimeDashboard({
  tables,
  onUpdate,
  debounceMs = 800,
  enabled = true,
}: UseRealtimeDashboardOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onUpdateRef = useRef(onUpdate);

  // Keep callback reference current
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    const channelName = `dashboard-realtime-${Math.random().toString(36).substring(2, 9)}`;
    let channel: RealtimeChannel = supabase.channel(channelName);

    const triggerDebouncedUpdate = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        onUpdateRef.current();
      }, debounceMs);
    };

    // Attach listeners for all requested tables
    for (const config of tables) {
      channel = channel.on(
        'postgres_changes' as any,
        {
          event: config.event || '*',
          schema: config.schema || 'public',
          table: config.table,
        },
        () => {
          triggerDebouncedUpdate();
        }
      );
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Channel connected
      }
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [enabled, debounceMs, tables]);
}
