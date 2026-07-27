'use client';

import { useDashboardStats } from '@/lib/use-dashboard-stats';
import { StatCard } from '@/components/stat-card';
import { PageHeader } from '@/components/page-header';
import { RecentActivity } from '@/components/recent-activity';
import { Truck, Package, ShoppingCart, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Dispatch, Order, Warehouse, Product, Profile } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';

export function DispatchDashboard() {
  const stats = useDashboardStats();
  const { profile } = useAuth();
  const [recent, setRecent] = useState<(Dispatch & { order?: Order; warehouse?: Warehouse; product?: Product; dispatcher?: Profile })[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('dispatches')
        .select('*, order:orders(*), warehouse:warehouses(*), product:products(*), dispatcher:profiles!dispatches_dispatched_by_fkey(*)')
        .order('dispatched_at', { ascending: false })
        .limit(6);
      setRecent((data ?? []) as (Dispatch & { order?: Order; warehouse?: Warehouse; product?: Product; dispatcher?: Profile })[]);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${profile?.full_name ?? 'Dispatch'}`}
        description="Dispatch stock out of warehouse to customer orders."
        actions={
          <Button asChild>
            <Link href="/dispatch">Dispatch stock</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Dispatched today" value={stats.dispatchesToday} icon={Truck} accent="success" />
        <StatCard label="Total dispatches" value={stats.totalDispatches} icon={Package} accent="primary" />
        <StatCard label="Orders ready" value={stats.pendingOrders + stats.completedOrders} icon={ShoppingCart} accent="warning" hint="Pending + approved" />
        <StatCard label="Failed scans" value={0} icon={AlertTriangle} accent="destructive" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent dispatches</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState title="No dispatches yet" />
            ) : (
              <div className="space-y-2.5">
                {recent.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-mono text-sm font-medium text-foreground">{d.barcode}</p>
                      <p className="text-xs text-muted-foreground">{d.product?.name ?? '—'} · {d.order?.order_number ?? '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{d.quantity} cartons</p>
                      <p className="text-xs text-muted-foreground">{formatDate(d.dispatched_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <RecentActivity limit={8} />
      </div>
    </div>
  );
}
