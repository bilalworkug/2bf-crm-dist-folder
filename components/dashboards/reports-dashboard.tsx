'use client';

import { useDashboardStats } from '@/lib/use-dashboard-stats';
import { StatCard } from '@/components/stat-card';
import { PageHeader } from '@/components/page-header';
import { RecentActivity } from '@/components/recent-activity';
import { BarChart3, ScanLine, PackageCheck, Truck, ShoppingCart, Undo2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function ReportsDashboard() {
  const stats = useDashboardStats();
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${profile?.full_name ?? 'Reports'}`}
        description="Read-only access to all operational reports and audit logs."
        actions={
          <Button asChild>
            <Link href="/reports">View all reports</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Production scans" value={stats.totalProductionScans} icon={ScanLine} accent="primary" />
        <StatCard label="Warehouse receipts" value={stats.totalReceipts} icon={PackageCheck} accent="success" />
        <StatCard label="Dispatches" value={stats.totalDispatches} icon={Truck} accent="warning" />
        <StatCard label="Orders" value={stats.totalOrders} icon={ShoppingCart} accent="neutral" />
        <StatCard label="Returns" value={stats.totalReturns} icon={Undo2} accent="destructive" />
        <StatCard label="Customers" value={stats.totalCustomers} icon={BarChart3} accent="primary" />
      </div>

      <RecentActivity limit={10} />
    </div>
  );
}
