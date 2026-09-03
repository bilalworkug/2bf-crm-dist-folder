'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Clock, ScanLine, Package, Truck, CheckCircle2,
  Undo2, DollarSign, RefreshCw, Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';

export interface TimelineItem {
  id: string;
  timeStr: string;
  timestamp: string;
  title: string;
  department: string;
  type: 'production' | 'warehouse' | 'dispatch' | 'delivery' | 'finance' | 'return';
  actor: string;
}

export function DailyOperationsTimeline() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTodayEvents = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const events: TimelineItem[] = [];

    try {
      // 1. Barcode history today
      const { data: bcLogs } = await supabase
        .from('barcode_history')
        .select('id, barcode, action, details, performed_at, actor:profiles(full_name)')
        .gte('performed_at', todayStart)
        .order('performed_at', { ascending: false })
        .limit(20);

      bcLogs?.forEach((b: any) => {
        const act = (b.action || '').toUpperCase();
        let type: TimelineItem['type'] = 'production';
        let dept = 'Production';

        if (act.includes('RECEIVE')) {
          type = 'warehouse';
          dept = 'Warehouse';
        } else if (act.includes('DISPATCH')) {
          type = 'dispatch';
          dept = 'Logistics';
        } else if (act.includes('DELIVER')) {
          type = 'delivery';
          dept = 'Delivery';
        } else if (act.includes('RETURN')) {
          type = 'return';
          dept = 'Warehouse';
        }

        const date = new Date(b.performed_at);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        events.push({
          id: `bc-${b.id}`,
          timeStr,
          timestamp: b.performed_at,
          title: `${b.action.replace(/_/g, ' ')}: ${b.barcode}`,
          department: dept,
          type,
          actor: b.actor?.full_name || 'Factory Operator',
        });
      });

      // 2. Payments approved today
      const { data: payments } = await supabase
        .from('payments')
        .select('id, amount, currency, approved_at, approver:profiles(full_name), customer:customers(customer_name)')
        .eq('status', 'approved')
        .gte('approved_at', todayStart)
        .order('approved_at', { ascending: false })
        .limit(10);

      payments?.forEach((p: any) => {
        const date = new Date(p.approved_at);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        events.push({
          id: `pay-${p.id}`,
          timeStr,
          timestamp: p.approved_at,
          title: `Payment Approved: ETB ${Number(p.amount).toLocaleString()} (${p.customer?.customer_name || 'Customer'})`,
          department: 'Accounts',
          type: 'finance',
          actor: p.approver?.full_name || 'Account Manager',
        });
      });

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setItems(events.slice(0, 25));
    } catch (e) {
      console.error('Failed to load daily timeline:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayEvents();

    const channel = supabase
      .channel('realtime_daily_timeline')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'barcode_history' }, () => fetchTodayEvents())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payments' }, () => fetchTodayEvents())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTodayEvents]);

  const getIcon = (type: TimelineItem['type']) => {
    switch (type) {
      case 'production':
        return <ScanLine className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
      case 'warehouse':
        return <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />;
      case 'dispatch':
        return <Truck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />;
      case 'delivery':
        return <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />;
      case 'finance':
        return <DollarSign className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />;
      case 'return':
        return <Undo2 className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />;
    }
  };

  return (
    <Card className="shadow-sm border-border/80">
      <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              Today&apos;s Factory Operations Timeline
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Live Pulse
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Chronological stream of production, receiving, dispatches, and financial settlements.
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={fetchTodayEvents}
          disabled={loading}
          className="h-8 text-xs text-muted-foreground hover:text-foreground touch-press"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="p-4">
        {loading && items.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No operations recorded yet today.
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 border-l-2 border-border/60 ml-2">
            {items.map((item) => (
              <div key={item.id} className="relative group">
                {/* Timeline Node Icon */}
                <div className="absolute -left-[31px] top-0.5 w-6 h-6 rounded-full bg-card border-2 border-border flex items-center justify-center shadow-xs">
                  {getIcon(item.type)}
                </div>

                <div className="p-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-primary">
                        {item.timeStr}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                        {item.department}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {item.actor}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-foreground mt-1">
                    {item.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
