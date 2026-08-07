'use client';

import { useAdminStats } from '@/lib/use-admin-stats';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import { 
  Users, Warehouse, ScanLine, 
  ClipboardCheck, Settings, BarChart3, TrendingUp, AlertTriangle,
  DollarSign, ShoppingCart, Factory, CreditCard
} from 'lucide-react';
import { 
  EnterpriseWelcomeHeader, 
  EnterpriseKPICard, 
  EnterpriseQuickActions,
  AlertsPanel,
  QuickAction
} from './enterprise-components';
import { EnterpriseBarChart, EnterpriseAreaChart } from './enterprise-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AdminDashboard() {
  const stats = useAdminStats();
  const { profile } = useAuth();

  const actions: QuickAction[] = [
    { label: 'System Settings', icon: Settings, href: '/settings', count: 'Core', subtitle: 'Configure app' },
    { label: 'Users', icon: Users, href: '/users', count: 'Manage', subtitle: 'Access control' },
    { label: 'Full Reports', icon: BarChart3, href: '/reports', count: 'Analytics', subtitle: 'View BI' },
    { label: 'Approvals', icon: ClipboardCheck, href: '/approvals', count: (stats.sales.pending + stats.finance.pendingDiscounts).toString(), subtitle: 'Pending requests' },
    { label: 'Production', icon: ScanLine, href: '/production', count: 'Live', subtitle: 'Track items' },
    { label: 'Warehouse', icon: Warehouse, href: '/warehouse', count: 'Stock', subtitle: 'Inventory control' },
  ];

  const alerts = [
    { id: '1', title: 'Pending Discounts', type: 'warning' as const, message: `${stats.finance.pendingDiscounts} discounts waiting for executive approval.` },
    { id: '2', title: 'Failed API Calls', type: 'critical' as const, message: '3 failed attempts to sync with external accounting software.' },
    { id: '3', title: 'System Health', type: 'success' as const, message: 'All backend services running optimally.' },
  ];

  const revenueData = [
    { month: 'Jan', revenue: Math.max(0, stats.finance.totalValue * 0.6) },
    { month: 'Feb', revenue: Math.max(0, stats.finance.totalValue * 0.72) },
    { month: 'Mar', revenue: Math.max(0, stats.finance.totalValue * 0.85) },
    { month: 'Apr', revenue: stats.finance.totalValue },
  ];

  return (
    <div className="min-h-screen bg-background px-4 md:px-8 py-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <EnterpriseWelcomeHeader 
          title="Admin Command Center"
          breadcrumbs={["Home", "Admin", "Command Center"]}
        />

        {/* Top Level KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <EnterpriseKPICard 
            label="Total Revenue" 
            value={formatMoney(stats.finance.totalValue)} 
            trend={12.5} 
            trendLabel="vs Last Year"
            icon={DollarSign}
            iconColorClass="text-emerald-500"
            iconBgClass="bg-emerald-50 border-emerald-100"
            valueColorClass="text-emerald-500"
            sparklineColor="#10b981"
            sparklineData={[20, 35, 28, 45, 38, 55, 50]}
          />
          <EnterpriseKPICard 
            label="Orders Today" 
            value={stats.sales.ordersToday} 
            trend={5.2} 
            trendLabel="vs Yesterday"
            icon={ShoppingCart}
            iconColorClass="text-blue-500"
            iconBgClass="bg-blue-50 border-blue-100"
            valueColorClass="text-blue-500"
            sparklineColor="#3b82f6"
            sparklineData={[8, 12, 9, 15, 11, 18, 14]}
          />
          <EnterpriseKPICard 
            label="Produced Today" 
            value={stats.production.today} 
            trend={-2.1} 
            trendLabel="vs Target"
            icon={Factory}
            iconColorClass="text-purple-500"
            iconBgClass="bg-purple-50 border-purple-100"
            valueColorClass="text-purple-500"
            sparklineColor="#a855f7"
            sparklineData={[40, 35, 42, 38, 30, 28, 25]}
          />
          <EnterpriseKPICard 
            label="Outstanding Balance" 
            value={formatMoney(stats.finance.outstanding)} 
            trend={-8.4} 
            trendLabel="vs Last Month"
            icon={CreditCard}
            iconColorClass="text-amber-500"
            iconBgClass="bg-amber-50 border-amber-100"
            valueColorClass="text-amber-500"
            sparklineColor="#f59e0b"
            sparklineData={[50, 45, 48, 42, 38, 35, 30]}
          />
        </div>

        <EnterpriseQuickActions actions={actions} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <EnterpriseBarChart 
              title="Revenue Growth" 
              data={revenueData}
              xAxisKey="month"
              bars={[{ key: 'revenue', name: 'Revenue', color: '#3b82f6', gradientColors: ['#93c5fd', '#2563eb'] }]} 
            />
          </div>
          <div>
            <AlertsPanel alerts={alerts} />
          </div>
        </div>

      </div>
    </div>
  );
}
