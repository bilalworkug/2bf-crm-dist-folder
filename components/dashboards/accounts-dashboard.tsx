'use client';

import { useDashboardStats } from '@/lib/use-dashboard-stats';
import { StatCard } from '@/components/stat-card';
import { PageHeader } from '@/components/page-header';
import { RecentActivity } from '@/components/recent-activity';
import { FileText, Wallet, AlertCircle, TrendingUp } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/format';

export function AccountsDashboard() {
  const stats = useDashboardStats();
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${profile?.full_name ?? 'Accounts'}`}
        description="Track invoices, payments, and customer balances."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total orders" value={stats.totalOrders} icon={FileText} accent="primary" />
        <StatCard label="Payments received" value={formatMoney(stats.paidAmount)} icon={Wallet} accent="success" />
        <StatCard label="Outstanding" value={formatMoney(stats.outstandingBalance)} icon={AlertCircle} accent="warning" />
        <StatCard label="Completed orders" value={stats.completedOrders} icon={TrendingUp} accent="neutral" />
      </div>

      <RecentActivity limit={10} />
    </div>
  );
}
