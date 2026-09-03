'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Briefcase, CheckCircle2, Clock, ArrowRight,
  Package, Truck, DollarSign, ScanLine, AlertCircle, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SLATimer, type SLATaskType } from '@/components/sla-timer';

export interface TaskItem {
  id: string;
  title: string;
  subtitle: string;
  department: string;
  taskType: SLATaskType;
  startedAt: string;
  actionUrl: string;
  actionLabel: string;
  badge?: string;
}

export function AssignmentQueue() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const list: TaskItem[] = [];
    const role = profile.role;

    try {
      // 1. Warehouse: Boxes awaiting receiving & orders awaiting picking
      if (['warehouse', 'warehouse_manager', 'admin', 'manager'].includes(role)) {
        // Orders ready for staging / picking
        const { data: ordersToPick } = await supabase
          .from('orders')
          .select('id, order_number, created_at, customer:customers(customer_name)')
          .in('status', ['approved', 'processing'])
          .limit(4);

        ordersToPick?.forEach((o: any) => {
          list.push({
            id: `pick-${o.id}`,
            title: `Pick & Stage: ${o.order_number}`,
            subtitle: `${o.customer?.customer_name || 'Customer'} • Awaiting staging`,
            department: 'Warehouse',
            taskType: 'dispatch',
            startedAt: o.created_at,
            actionUrl: `/warehouse/fulfillment`,
            actionLabel: 'Stage Order',
            badge: 'Picking',
          });
        });
      }

      // 2. Dispatch: Orders ready for truck loading
      if (['dispatch', 'dispatch_manager', 'admin', 'manager'].includes(role)) {
        const { data: ordersToDispatch } = await supabase
          .from('orders')
          .select('id, order_number, created_at, customer:customers(customer_name)')
          .eq('status', 'processing')
          .limit(4);

        ordersToDispatch?.forEach((o: any) => {
          list.push({
            id: `dispatch-${o.id}`,
            title: `Load & Dispatch: ${o.order_number}`,
            subtitle: `${o.customer?.customer_name || 'Customer'} • Ready for truck loading`,
            department: 'Dispatch',
            taskType: 'dispatch',
            startedAt: o.created_at,
            actionUrl: '/dispatch',
            actionLabel: 'Scan Carton',
            badge: 'Outbound',
          });
        });
      }

      // 3. Accounts: Payments awaiting approval
      if (['accounts', 'accounts_manager', 'admin', 'manager'].includes(role)) {
        const { data: payments } = await supabase
          .from('payments')
          .select('id, amount, currency, created_at, customer:customers(customer_name)')
          .eq('status', 'pending')
          .limit(4);

        payments?.forEach((p: any) => {
          list.push({
            id: `pay-${p.id}`,
            title: `Approve Payment: ETB ${Number(p.amount).toLocaleString()}`,
            subtitle: `${p.customer?.customer_name || 'Customer'} • Reconcile ledger`,
            department: 'Accounts',
            taskType: 'payment',
            startedAt: p.created_at,
            actionUrl: '/account/payments',
            actionLabel: 'Review',
            badge: 'Payment',
          });
        });
      }

      // 4. Delivery: Dispatched orders awaiting delivery
      if (['delivery', 'admin', 'manager'].includes(role)) {
        const { data: deliveries } = await supabase
          .from('orders')
          .select('id, order_number, created_at, customer:customers(customer_name)')
          .eq('status', 'dispatched')
          .limit(4);

        deliveries?.forEach((d: any) => {
          list.push({
            id: `deliv-${d.id}`,
            title: `Deliver Order: ${d.order_number}`,
            subtitle: `${d.customer?.customer_name || 'Customer'} • Out on route`,
            department: 'Delivery',
            taskType: 'delivery',
            startedAt: d.created_at,
            actionUrl: '/delivery',
            actionLabel: 'Deliver',
            badge: 'In Transit',
          });
        });
      }

      // 5. Production: Recent scans target & corrections
      if (['production', 'production_manager', 'admin', 'manager'].includes(role)) {
        const { data: corrections } = await supabase
          .from('approvals')
          .select('id, reason, requested_at, requester:profiles(full_name)')
          .eq('status', 'pending')
          .ilike('request_type', '%correction%')
          .limit(3);

        corrections?.forEach((c: any) => {
          list.push({
            id: `corr-${c.id}`,
            title: `Carton Correction Needed`,
            subtitle: c.reason || 'Requested by production operator',
            department: 'Production',
            taskType: 'correction',
            startedAt: c.requested_at,
            actionUrl: '/production/corrections',
            actionLabel: 'Inspect',
            badge: 'Quality',
          });
        });
      }

      setTasks(list);
    } catch (e) {
      console.error('Failed to load assignment queue:', e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <Card className="shadow-sm border-border/80">
      <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Briefcase className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              My Work Today
              {tasks.length > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                  {tasks.length} active
                </span>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Direct departmental assignment queue sorted by urgency and SLA.
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={fetchTasks}
          disabled={loading}
          className="h-8 text-xs text-muted-foreground hover:text-foreground touch-press"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="p-4">
        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-1">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-1" />
            <p className="text-sm font-bold text-foreground">Queue Complete</p>
            <p className="text-xs">No pending assignments in your queue today. Good job!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-card hover:bg-muted/20 transition-all shadow-xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {task.badge && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.2 rounded-full bg-muted text-muted-foreground">
                        {task.badge}
                      </span>
                    )}
                    <h4 className="text-sm font-bold text-foreground truncate">
                      {task.title}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {task.subtitle}
                  </p>
                  <div className="pt-1">
                    <SLATimer taskType={task.taskType} startedAt={task.startedAt} />
                  </div>
                </div>

                <div className="shrink-0 flex items-center justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                  <Button
                    asChild
                    size="sm"
                    className="w-full sm:w-auto h-9 text-xs font-semibold touch-press shadow-xs"
                  >
                    <Link href={task.actionUrl}>
                      {task.actionLabel}
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
