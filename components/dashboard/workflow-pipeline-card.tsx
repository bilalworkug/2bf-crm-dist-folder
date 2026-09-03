'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import Link from 'next/link';
import {
  Clock, CheckCircle2, Truck, FileCheck, ShieldCheck,
  ChevronRight, ArrowRight, Boxes
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowPipelineCardProps {
  ordersList: Array<{
    id: string;
    status: string;
    total_amount?: number;
  }>;
}

export function WorkflowPipelineCard({ ordersList }: WorkflowPipelineCardProps) {
  const counts = {
    pending: 0,
    approved: 0,
    partially_dispatched: 0,
    dispatched: 0,
    handed_over: 0,
    completed: 0,
  };

  for (const order of ordersList) {
    const s = order.status?.toLowerCase();
    if (s === 'pending') counts.pending++;
    else if (s === 'approved') counts.approved++;
    else if (s === 'partially_dispatched') counts.partially_dispatched++;
    else if (s === 'dispatched') counts.dispatched++;
    else if (s === 'handed_over') counts.handed_over++;
    else if (s === 'completed') counts.completed++;
  }

  const stages = [
    {
      step: 1,
      name: 'Pending Clearance',
      statusKey: 'pending',
      count: counts.pending,
      description: 'Awaiting payment/credit approval',
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10 border-amber-500/20',
      activeFilter: 'pending',
    },
    {
      step: 2,
      name: 'Approved / Ready',
      statusKey: 'approved',
      count: counts.approved,
      description: 'Ready for warehouse picking/loading',
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      activeFilter: 'approved',
    },
    {
      step: 3,
      name: 'Partially Dispatched',
      statusKey: 'partially_dispatched',
      count: counts.partially_dispatched,
      description: 'Truck loading in progress',
      icon: Truck,
      color: 'text-indigo-500 dark:text-indigo-400',
      bgColor: 'bg-indigo-500/10 border-indigo-500/20',
      activeFilter: 'partially_dispatched',
    },
    {
      step: 4,
      name: 'Fully Dispatched',
      statusKey: 'dispatched',
      count: counts.dispatched,
      description: 'Loaded, awaiting gate sign-off',
      icon: Truck,
      color: 'text-sky-500',
      bgColor: 'bg-sky-500/10 border-sky-500/20',
      activeFilter: 'dispatched',
    },
    {
      step: 5,
      name: 'Gate Handed Over',
      statusKey: 'handed_over',
      count: counts.handed_over,
      description: 'Waybill & custody issued',
      icon: FileCheck,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10 border-purple-500/20',
      activeFilter: 'handed_over',
    },
    {
      step: 6,
      name: 'Completed',
      statusKey: 'completed',
      count: counts.completed,
      description: 'Order cycle verified & closed',
      icon: ShieldCheck,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-600/10 border-emerald-600/20',
      activeFilter: 'completed',
    },
  ];

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
            <Boxes className="h-4 w-4 text-primary" />
            Core Order Fulfillment Pipeline
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time tracking of active orders through the factory lifecycle
          </p>
        </div>
        <Link
          href="/orders"
          className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
        >
          <span>All Orders</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {stages.map((stage) => {
            const Icon = stage.icon;
            return (
              <Link
                key={stage.step}
                href={`/orders?status=${stage.activeFilter}`}
                className={cn(
                  'group flex flex-col justify-between p-3 rounded-lg border transition-all hover:shadow-xs hover:border-primary/50',
                  stage.bgColor
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground">
                      0{stage.step}
                    </span>
                    <Icon className={cn('h-4 w-4', stage.color)} />
                  </div>
                  <p className="text-xs font-bold leading-snug text-foreground truncate">
                    {stage.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                    {stage.description}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between">
                  <span className="text-lg font-bold font-mono text-foreground">
                    {stage.count}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
