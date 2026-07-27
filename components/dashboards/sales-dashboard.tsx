'use client';

import { useDashboardStats } from '@/lib/use-dashboard-stats';
import { StatCard } from '@/components/stat-card';
import { PageHeader } from '@/components/page-header';
import { RecentActivity } from '@/components/recent-activity';
import { Users, ShoppingCart, Clock, Wallet } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';

export function SalesDashboard() {
  const stats = useDashboardStats();
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${profile?.full_name ?? 'Sales'}`}
        description="Manage customers, create orders, and track purchase history."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/customers">Customers</Link>
            </Button>
            <Button asChild>
              <Link href="/orders">New order</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Customers" value={stats.totalCustomers} icon={Users} accent="primary" />
        <StatCard label="Total orders" value={stats.totalOrders} icon={ShoppingCart} accent="success" />
        <StatCard label="Pending orders" value={stats.pendingOrders} icon={Clock} accent="warning" />
        <StatCard label="Outstanding balance" value={formatMoney(stats.outstandingBalance)} icon={Wallet} accent="destructive" />
      </div>

      <RecentActivity limit={10} />
    </div>
  );
}
