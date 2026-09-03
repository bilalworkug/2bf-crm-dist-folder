'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  AlertCircle, Clock, Truck, FileCheck, AlertTriangle,
  ArrowRight, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionCenterProps {
  pendingApprovals: number;
  ordersReadyForLoading: number;
  partiallyDispatchedOrders: number;
  ordersAwaitingHandover: number;
  lowStockItemsCount: number;
}

export function DashboardActionCenter({
  pendingApprovals,
  ordersReadyForLoading,
  partiallyDispatchedOrders,
  ordersAwaitingHandover,
  lowStockItemsCount,
}: ActionCenterProps) {
  const actions = [
    {
      title: 'Commercial Approvals Pending',
      count: pendingApprovals,
      description: 'Customer payments or credit requests requiring manager sign-off',
      href: '/approvals',
      btnText: 'Review Approvals',
      icon: Clock,
      priority: pendingApprovals > 0 ? 'warning' : 'idle',
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200',
    },
    {
      title: 'Orders Ready for Staging / Dispatch',
      count: ordersReadyForLoading,
      description: 'Cleared orders ready for warehouse picking and vehicle loading',
      href: '/dispatch',
      btnText: 'Open Loading Desk',
      icon: CheckCircle2,
      priority: ordersReadyForLoading > 0 ? 'info' : 'idle',
      badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-200',
    },
    {
      title: 'Partially Dispatched (In Progress)',
      count: partiallyDispatchedOrders,
      description: 'Vehicle loading partially completed; remaining cartons required',
      href: '/dispatch',
      btnText: 'Resume Loading',
      icon: Truck,
      priority: partiallyDispatchedOrders > 0 ? 'warning' : 'idle',
      badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-200',
    },
    {
      title: 'Loaded Orders Awaiting Gate Handover',
      count: ordersAwaitingHandover,
      description: '100% loaded; requires driver/transporter sign-off & waybill print',
      href: '/dispatch',
      btnText: 'Issue Gate Pass',
      icon: FileCheck,
      priority: ordersAwaitingHandover > 0 ? 'success' : 'idle',
      badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200',
    },
    {
      title: 'Warehouse Low-Stock Warnings',
      count: lowStockItemsCount,
      description: 'SKUs nearing re-order safety levels across storage locations',
      href: '/inventory',
      btnText: 'Inspect Inventory',
      icon: AlertTriangle,
      priority: lowStockItemsCount > 0 ? 'critical' : 'idle',
      badgeClass: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200',
    },
  ];

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            Operational Action Center
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time operational exceptions and pending queues requiring attention
          </p>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {actions.map((item) => {
            const Icon = item.icon;
            const hasItems = item.count > 0;
            return (
              <div
                key={item.title}
                className={cn(
                  'flex flex-col justify-between p-3.5 rounded-lg border transition-all',
                  hasItems
                    ? 'bg-card border-border/80 shadow-2xs hover:border-primary/40'
                    : 'bg-muted/20 border-border/40 opacity-75'
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                        hasItems ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground border-border/40'
                      )}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <h4 className="text-xs font-bold text-foreground leading-snug truncate">
                        {item.title}
                      </h4>
                    </div>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-bold font-mono border',
                      item.badgeClass
                    )}>
                      {item.count}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed pl-9">
                    {item.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-border/40 flex justify-end">
                  <Button
                    asChild
                    variant={hasItems ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs font-semibold px-2.5 gap-1"
                  >
                    <Link href={item.href}>
                      <span>{item.btnText}</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
