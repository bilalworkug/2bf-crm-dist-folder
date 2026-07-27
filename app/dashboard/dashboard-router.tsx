'use client';

import { useAuth } from '@/lib/auth';
import { AdminDashboard } from '@/components/dashboards/admin-dashboard';
import { ProductionDashboard } from '@/components/dashboards/production-dashboard';
import { WarehouseDashboard } from '@/components/dashboards/warehouse-dashboard';
import { DispatchDashboard } from '@/components/dashboards/dispatch-dashboard';
import { SalesDashboard } from '@/components/dashboards/sales-dashboard';
import { AccountsDashboard } from '@/components/dashboards/accounts-dashboard';
import { ManagerDashboard } from '@/components/dashboards/manager-dashboard';
import { ReportsDashboard } from '@/components/dashboards/reports-dashboard';
import { Loader2 } from 'lucide-react';

export function DashboardRouter({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const dashboards: Record<string, React.ReactNode> = {
    admin: <AdminDashboard />,
    production: <ProductionDashboard />,
    warehouse: <WarehouseDashboard />,
    dispatch: <DispatchDashboard />,
    sales: <SalesDashboard />,
    accounts: <AccountsDashboard />,
    manager: <ManagerDashboard />,
    reports: <ReportsDashboard />,
  };

  return <>{dashboards[profile.role] ?? <ReportsDashboard />}</>;
}
