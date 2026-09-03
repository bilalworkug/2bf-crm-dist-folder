'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Activity, Package, Truck, DollarSign, Shield,
  RefreshCw, ScanLine, Clock, User, CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';

export type ActivityCategory = 'all' | 'operations' | 'warehouse' | 'logistics' | 'finance' | 'security';

export interface FeedEvent {
  id: string;
  category: 'operations' | 'warehouse' | 'logistics' | 'finance' | 'security';
  title: string;
  description: string;
  actor: string;
  timestamp: string;
  badge?: string;
}

export function ActivityFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<ActivityCategory>('all');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const feed: FeedEvent[] = [];

    try {
      // 1. Fetch from barcode_history (Operations, Warehouse, Logistics)
      const { data: barcodeHistory } = await supabase
        .from('barcode_history')
        .select('id, barcode, action, details, performed_at, actor:profiles(full_name)')
        .order('performed_at', { ascending: false })
        .limit(25);

      barcodeHistory?.forEach((item: any) => {
        let cat: 'operations' | 'warehouse' | 'logistics' = 'operations';
        const act = (item.action || '').toUpperCase();

        if (act.includes('RECEIVE') || act.includes('TRANSFER')) {
          cat = 'warehouse';
        } else if (act.includes('DISPATCH') || act.includes('DELIVER')) {
          cat = 'logistics';
        }

        feed.push({
          id: `bc-${item.id}`,
          category: cat,
          title: `${item.action.replace(/_/g, ' ')}: ${item.barcode}`,
          description: item.details || `Barcode action ${item.action}`,
          actor: item.actor?.full_name || 'System Operator',
          timestamp: item.performed_at,
          badge: item.action,
        });
      });

      // 2. Fetch from audit_logs (Finance, Security, Settings)
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('id, action, details, performed_at, actor:profiles(full_name)')
        .order('performed_at', { ascending: false })
        .limit(25);

      auditLogs?.forEach((log: any) => {
        const act = (log.action || '').toLowerCase();
        let cat: 'finance' | 'security' | 'operations' = 'security';

        if (act.includes('payment') || act.includes('credit') || act.includes('discount')) {
          cat = 'finance';
        } else if (act.includes('role') || act.includes('password') || act.includes('user')) {
          cat = 'security';
        }

        feed.push({
          id: `audit-${log.id}`,
          category: cat,
          title: log.action.replace(/_/g, ' '),
          description: typeof log.details === 'string' ? log.details : JSON.stringify(log.details || ''),
          actor: log.actor?.full_name || 'System User',
          timestamp: log.performed_at,
          badge: log.action,
        });
      });

      // Sort combined events by timestamp descending
      feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEvents(feed.slice(0, 30));
    } catch (err) {
      console.error('Failed to load activity feed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();

    // Supabase Realtime subscriptions
    const channel = supabase
      .channel('realtime_activity_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'barcode_history' },
        () => fetchEvents()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        () => fetchEvents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents]);

  const filteredEvents = useMemo(() => {
    if (category === 'all') return events;
    return events.filter((e) => e.category === category);
  }, [events, category]);

  return (
    <Card className="shadow-sm border-border/80 flex flex-col">
      <CardHeader className="p-4 pb-3 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              Company Activity Feed
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Live
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Real-time audit log and carton movements across factory and warehouse.
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={fetchEvents}
          disabled={loading}
          className="h-8 text-xs text-muted-foreground hover:text-foreground touch-press self-end sm:self-auto"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </CardHeader>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/60 overflow-x-auto bg-muted/10 text-xs">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'operations', label: 'Operations' },
            { id: 'warehouse', label: 'Warehouse' },
            { id: 'logistics', label: 'Logistics' },
            { id: 'finance', label: 'Finance' },
            { id: 'security', label: 'Security' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategory(tab.id)}
            className={cn(
              'px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap touch-press',
              category === tab.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <CardContent className="p-4 flex-1">
        {loading && events.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No events found in this category.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvents.map((evt) => {
              let Icon = Activity;
              let iconBg = 'bg-primary/10 text-primary';

              if (evt.category === 'operations') {
                Icon = ScanLine;
                iconBg = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400';
              } else if (evt.category === 'warehouse') {
                Icon = Package;
                iconBg = 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400';
              } else if (evt.category === 'logistics') {
                Icon = Truck;
                iconBg = 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400';
              } else if (evt.category === 'finance') {
                Icon = DollarSign;
                iconBg = 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400';
              } else if (evt.category === 'security') {
                Icon = Shield;
                iconBg = 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400';
              }

              return (
                <div
                  key={evt.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={cn('p-2 rounded-lg shrink-0 mt-0.5', iconBg)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground capitalize truncate">
                          {evt.title}
                        </p>
                        {evt.badge && (
                          <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-muted text-muted-foreground uppercase">
                            {evt.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {evt.description}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {evt.actor}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(evt.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
