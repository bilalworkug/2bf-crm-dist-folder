'use client';

import { useAuth } from '@/lib/auth';
import { UnifiedDashboard } from '@/components/dashboards/unified-dashboard';
import { AdminDashboard } from '@/components/dashboards/admin-dashboard';
import { ProductionDashboard } from '@/components/dashboards/production-dashboard';
import { WarehouseDashboard } from '@/components/dashboards/warehouse-dashboard';
import { SalesDashboard } from '@/components/dashboards/sales-dashboard';
import { DispatchDashboard } from '@/components/dashboards/dispatch-dashboard';
import { AccountsDashboard } from '@/components/dashboards/accounts-dashboard';
import { ManagerDashboard } from '@/components/dashboards/manager-dashboard';
import { ReportsDashboard } from '@/components/dashboards/reports-dashboard';

import { DeliveryDashboard } from '@/components/dashboards/delivery-dashboard';
import { ReturnsDashboard } from '@/components/dashboards/returns-dashboard';

import { ProductionManagerDashboard } from '@/components/dashboards/production-manager-dashboard';
import { WarehouseManagerDashboard } from '@/components/dashboards/warehouse-manager-dashboard';
import { SalesManagerDashboard } from '@/components/dashboards/sales-manager-dashboard';
import { DispatchManagerDashboard } from '@/components/dashboards/dispatch-manager-dashboard';
import { ReturnsManagerDashboard } from '@/components/dashboards/returns-manager-dashboard';

export default function DashboardPage() {
  const { profile } = useAuth();
  
  if (!profile) return null;

  switch (profile.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'production':
      return <ProductionDashboard />;
    case 'production_manager':
      return <ProductionManagerDashboard />;
    case 'warehouse':
      return <WarehouseDashboard />;
    case 'warehouse_manager':
      return <WarehouseManagerDashboard />;
    case 'sales':
      return <SalesDashboard />;
    case 'sales_manager':
      return <SalesManagerDashboard />;
    case 'dispatch':
      return <DispatchDashboard />;
    case 'dispatch_manager':
      return <DispatchManagerDashboard />;
    case 'delivery':
      return <DeliveryDashboard />;
    case 'accounts':
    case 'accounts_manager':
      return <AccountsDashboard />;
    case 'returns':
      return <ReturnsDashboard />;
    case 'returns_manager':
      return <ReturnsManagerDashboard />;
    case 'manager':
      return <ManagerDashboard />;
    case 'reports':
      return <ReportsDashboard />;
    default:
      return <UnifiedDashboard />;
  }
}
