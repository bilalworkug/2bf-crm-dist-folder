'use client';

import { useDashboardStats } from '@/lib/use-dashboard-stats';
import { StatCard } from '@/components/stat-card';
import { PageHeader } from '@/components/page-header';
import { RecentActivity } from '@/components/recent-activity';
import { PackageCheck, Boxes, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { WarehouseReceipt, Warehouse, Product, Profile } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';

export function WarehouseDashboard() {
  const stats = useDashboardStats();
  const { profile } = useAuth();
  const [recent, setRecent] = useState<(WarehouseReceipt & { warehouse?: Warehouse; product?: Product; receiver?: Profile })[]>([]);

  useEffect(() => {
    (async () => {
      let q = supabase
        .from('warehouse_receipts')
        .select('*, warehouse:warehouses(*), product:products(*), receiver:profiles!warehouse_receipts_received_by_fkey(*)')
        .order('received_at', { ascending: false })
        .limit(6);
      if (profile?.warehouse_id) {
        q = q.eq('warehouse_id', profile.warehouse_id);
      }
      const { data } = await q;
      setRecent((data ?? []) as (WarehouseReceipt & { warehouse?: Warehouse; product?: Product; receiver?: Profile })[]);
    })();
  }, [profile?.warehouse_id]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${profile?.full_name ?? 'Warehouse'}`}
        description="Receive approved production stock into your warehouse."
        actions={
          <Button asChild>
            <Link href="/warehouse">Receive stock</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Received today" value={stats.receiptsToday} icon={PackageCheck} accent="success" />
        <StatCard label="Total receipts" value={stats.totalReceipts} icon={Boxes} accent="primary" />
        <StatCard label="Awaiting receipt" value={stats.totalProductionScans - stats.totalReceipts} icon={Clock} accent="warning" hint="Scanned but not received" />
        <StatCard label="Duplicate warnings" value={0} icon={AlertTriangle} accent="destructive" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent receiving activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState title="No receipts yet" />
            ) : (
              <div className="space-y-2.5">
                {recent.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-mono text-sm font-medium text-foreground">{r.barcode}</p>
                      <p className="text-xs text-muted-foreground">{r.product?.name ?? '—'} · {r.warehouse?.code ?? '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{r.quantity} cartons</p>
                      <p className="text-xs text-muted-foreground">{formatDate(r.received_at)}</p>
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
