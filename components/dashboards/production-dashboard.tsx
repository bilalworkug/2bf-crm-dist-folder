'use client';

import { useDashboardStats } from '@/lib/use-dashboard-stats';
import { StatCard } from '@/components/stat-card';
import { PageHeader } from '@/components/page-header';
import { RecentActivity } from '@/components/recent-activity';
import { ScanLine, Package, AlertTriangle, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { ProductionScan, Product, Profile } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';

export function ProductionDashboard() {
  const stats = useDashboardStats();
  const { profile } = useAuth();
  const [recent, setRecent] = useState<(ProductionScan & { product?: Product; scanner?: Profile })[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('production_scans')
        .select('*, product:products(*), scanner:profiles!production_scans_scanned_by_fkey(*)')
        .order('scanned_at', { ascending: false })
        .limit(6);
      setRecent((data ?? []) as (ProductionScan & { product?: Product; scanner?: Profile })[]);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${profile?.full_name ?? 'Production'}`}
        description="Track finished product box scanning and production output."
        actions={
          <Button asChild>
            <Link href="/production">Scan boxes</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Boxes scanned today" value={stats.scansToday} icon={ScanLine} accent="success" />
        <StatCard label="Total scans" value={stats.totalProductionScans} icon={Package} accent="primary" />
        <StatCard label="Duplicate alerts" value={0} icon={AlertTriangle} accent="warning" hint="No duplicates detected" />
        <StatCard label="Products in catalog" value={stats.totalProducts} icon={ClipboardList} accent="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent scans</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState title="No scans yet" />
            ) : (
              <div className="space-y-2.5">
                {recent.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-mono text-sm font-medium text-foreground">{s.barcode}</p>
                      <p className="text-xs text-muted-foreground">{s.product?.name ?? '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{s.quantity} cartons</p>
                      <p className="text-xs text-muted-foreground">{formatDate(s.scanned_at)}</p>
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
