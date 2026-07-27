'use client';

import { useDashboardStats } from '@/lib/use-dashboard-stats';
import { StatCard } from '@/components/stat-card';
import { PageHeader } from '@/components/page-header';
import { RecentActivity } from '@/components/recent-activity';
import { ScanLine, PackageCheck, Truck, ClipboardCheck, Undo2, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function ManagerDashboard() {
  const stats = useDashboardStats();
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${profile?.full_name ?? 'Manager'}`}
        description="Operational overview across production, warehouse, dispatch, and sales."
        actions={
          <Button asChild>
            <Link href="/approvals">Review approvals</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Production scans" value={stats.totalProductionScans} icon={ScanLine} accent="primary" hint={`${stats.scansToday} today`} />
        <StatCard label="Warehouse receipts" value={stats.totalReceipts} icon={PackageCheck} accent="success" hint={`${stats.receiptsToday} today`} />
        <StatCard label="Dispatches" value={stats.totalDispatches} icon={Truck} accent="warning" hint={`${stats.dispatchesToday} today`} />
        <StatCard label="Total orders" value={stats.totalOrders} icon={ShoppingCart} accent="neutral" hint={`${stats.pendingOrders} pending`} />
        <StatCard label="Pending approvals" value={stats.pendingApprovals} icon={ClipboardCheck} accent="destructive" />
        <StatCard label="Returns" value={stats.totalReturns} icon={Undo2} accent="warning" hint={`${stats.pendingReturns} pending`} />
      </div>

      <RecentActivity limit={10} />
    </div>
  );
}
