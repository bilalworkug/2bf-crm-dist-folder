'use client';

import { useDashboardStats } from '@/lib/use-dashboard-stats';
import { StatCard } from '@/components/stat-card';
import { PageHeader } from '@/components/page-header';
import { RecentActivity } from '@/components/recent-activity';
import { Users, Warehouse, Package, ShoppingCart, ScanLine, Truck, ClipboardCheck, Undo2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function AdminDashboard() {
  const stats = useDashboardStats();
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${profile?.full_name ?? 'Admin'}`}
        description="System-wide overview of Two Brothers Food Complex operations."
        actions={
          <Button asChild>
            <Link href="/users">Manage users</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={stats.totalUsers} icon={Users} accent="primary" />
        <StatCard label="Warehouses" value={stats.totalWarehouses} icon={Warehouse} accent="success" />
        <StatCard label="Products" value={stats.totalProducts} icon={Package} accent="primary" />
        <StatCard label="Customers" value={stats.totalCustomers} icon={Users} accent="neutral" />
        <StatCard label="Total orders" value={stats.totalOrders} icon={ShoppingCart} accent="primary" hint={`${stats.pendingOrders} pending`} />
        <StatCard label="Production scans" value={stats.totalProductionScans} icon={ScanLine} accent="success" hint={`${stats.scansToday} today`} />
        <StatCard label="Dispatches" value={stats.totalDispatches} icon={Truck} accent="warning" hint={`${stats.dispatchesToday} today`} />
        <StatCard label="Pending approvals" value={stats.pendingApprovals} icon={ClipboardCheck} accent="destructive" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivity limit={10} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Permission shortcuts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { href: '/users', label: 'Users & roles', desc: 'Manage accounts and permissions' },
              { href: '/settings', label: 'Settings', desc: 'Master data and company config' },
              { href: '/approvals', label: 'Approvals', desc: `${stats.pendingApprovals} pending` },
              { href: '/audit-logs', label: 'Audit logs', desc: 'Full system activity log' },
            ].map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="block rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <p className="text-sm font-medium text-foreground">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
