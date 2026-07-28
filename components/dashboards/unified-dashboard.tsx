'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { useDashboardStats } from '@/lib/use-dashboard-stats';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { RecentActivity } from '@/components/recent-activity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmptyState } from '@/components/empty-state';
import {
  ShoppingCart, ScanLine, Truck, PackageCheck, ClipboardCheck,
  Undo2, AlertTriangle, ArrowRight, Package, Users, Wallet,
  CheckCircle2, Clock, FileText,
} from 'lucide-react';
import { formatMoney, timeAgo } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/types';
import Link from 'next/link';
import type { Order, Approval, ReturnRecord, Profile } from '@/lib/types';

interface ActionItem {
  id: string;
  type: 'order' | 'approval' | 'return';
  label: string;
  detail: string;
  href: string;
  created_at: string;
}

export function UnifiedDashboard() {
  const stats = useDashboardStats();
  const { profile } = useAuth();
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loadingActions, setLoadingActions] = useState(true);

  useEffect(() => {
    (async () => {
      const [pendingOrders, pendingApprovals, pendingReturns] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, customer:customers(customer_name), created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('approvals')
          .select('id, request_type, requester:profiles(full_name), created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('returns')
          .select('id, return_type, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const items: ActionItem[] = [];

      (pendingOrders.data ?? []).forEach((o: any) => {
        items.push({
          id: `order-${o.id}`,
          type: 'order',
          label: `Order ${o.order_number} pending`,
          detail: o.customer?.customer_name ?? 'Unknown customer',
          href: '/orders',
          created_at: o.created_at,
        });
      });

      (pendingApprovals.data ?? []).forEach((a: any) => {
        items.push({
          id: `approval-${a.id}`,
          type: 'approval',
          label: `Approval needed: ${a.request_type}`,
          detail: a.requester?.full_name ?? 'Unknown',
          href: '/approvals',
          created_at: a.created_at,
        });
      });

      (pendingReturns.data ?? []).forEach((r: any) => {
        items.push({
          id: `return-${r.id}`,
          type: 'return',
          label: `Return pending: ${r.return_type}`,
          detail: 'Awaiting processing',
          href: '/returns',
          created_at: r.created_at,
        });
      });

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActionItems(items.slice(0, 8));
      setLoadingActions(false);
    })();
  }, []);

  const roleActions: Record<string, { href: string; label: string; icon: any }[]> = {
    admin: [
      { href: '/users', label: 'Manage users', icon: Users },
      { href: '/settings', label: 'Settings', icon: Package },
      { href: '/approvals', label: 'Approvals', icon: ClipboardCheck },
      { href: '/audit-logs', label: 'Audit logs', icon: AlertTriangle },
    ],
    production: [
      { href: '/production', label: 'Scan boxes', icon: ScanLine },
      { href: '/barcode-search', label: 'Search barcode', icon: Package },
    ],
    warehouse: [
      { href: '/warehouse', label: 'Receive stock', icon: PackageCheck },
      { href: '/inventory', label: 'View inventory', icon: Package },
    ],
    dispatch: [
      { href: '/dispatch', label: 'Dispatch stock', icon: Truck },
      { href: '/orders', label: 'View orders', icon: ShoppingCart },
    ],
    sales: [
      { href: '/customers', label: 'Customers', icon: Users },
      { href: '/orders', label: 'New order', icon: ShoppingCart },
      { href: '/quote', label: 'Create quote', icon: FileText },
    ],
    accounts: [
      { href: '/orders', label: 'View orders', icon: ShoppingCart },
      { href: '/returns', label: 'Returns', icon: Undo2 },
    ],
    manager: [
      { href: '/approvals', label: 'Review approvals', icon: ClipboardCheck },
      { href: '/reports', label: 'Reports', icon: Package },
      { href: '/orders', label: 'Orders', icon: ShoppingCart },
    ],
    reports: [
      { href: '/reports', label: 'View reports', icon: Package },
      { href: '/audit-logs', label: 'Audit logs', icon: AlertTriangle },
    ],
  };

  const shortcuts = roleActions[profile?.role ?? 'reports'] ?? roleActions.reports;

  const actionIcon = (type: ActionItem['type']) => {
    switch (type) {
      case 'order': return <ShoppingCart className="h-4 w-4 text-amber-500" />;
      case 'approval': return <ClipboardCheck className="h-4 w-4 text-blue-500" />;
      case 'return': return <Undo2 className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${profile?.full_name ?? 'User'}`}
        description={`${ROLE_LABELS[profile?.role ?? 'reports']} · Here's what's happening across your operation.`}
      />

      {/* Key stats — always 4 most important */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending orders"
          value={stats.pendingOrders}
          icon={ShoppingCart}
          accent="primary"
          hint={`${stats.totalOrders} total`}
        />
        <StatCard
          label="Production today"
          value={stats.scansToday}
          icon={ScanLine}
          accent="success"
          hint={`${stats.totalProductionScans} all-time`}
        />
        <StatCard
          label="Dispatches today"
          value={stats.dispatchesToday}
          icon={Truck}
          accent="warning"
          hint={`${stats.totalDispatches} all-time`}
        />
        <StatCard
          label="Needs attention"
          value={stats.pendingApprovals + stats.pendingReturns}
          icon={AlertTriangle}
          accent="destructive"
          hint={`${stats.pendingApprovals} approvals · ${stats.pendingReturns} returns`}
        />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {shortcuts.map((s) => {
          const Icon = s.icon;
          return (
            <Button key={s.href} asChild variant="outline">
              <Link href={s.href}>
                <Icon className="mr-2 h-4 w-4" />
                {s.label}
              </Link>
            </Button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Items needing attention */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Needs your attention
              </span>
              {actionItems.length > 0 && (
                <Badge variant="destructive" className="text-xs">{actionItems.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingActions ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : actionItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="text-sm text-muted-foreground">Nothing pending — you're all caught up.</p>
              </div>
            ) : (
              <ScrollArea className="h-[340px] pr-3">
                <div className="space-y-2">
                  {actionItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                    >
                      <div className="mt-0.5 shrink-0">{actionIcon(item.type)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/70">{timeAgo(item.created_at)}</p>
                      </div>
                      <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <div className="lg:col-span-2">
          <RecentActivity limit={10} />
        </div>
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Customers" value={stats.totalCustomers} icon={Users} accent="neutral" />
        <StatCard label="Products" value={stats.totalProducts} icon={Package} accent="primary" />
        <StatCard label="Warehouses" value={stats.totalWarehouses} icon={PackageCheck} accent="success" />
        <StatCard label="Returns" value={stats.totalReturns} icon={Undo2} accent="warning" />
        <StatCard label="Outstanding" value={formatMoney(stats.outstandingBalance)} icon={Wallet} accent="destructive" />
        <StatCard label="Paid" value={formatMoney(stats.paidAmount)} icon={Wallet} accent="success" />
      </div>
    </div>
  );
}
