'use client';

import { useDashboardStats } from '@/lib/use-dashboard-stats';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import { 
  FileText, Wallet, CheckCircle2, TrendingUp, DollarSign, AlertCircle
} from 'lucide-react';
import { 
  EnterpriseWelcomeHeader, 
  EnterpriseKPICard, 
  EnterpriseQuickActions,
  QuickAction,
  AlertsPanel
} from './enterprise-components';
import { EnterpriseBarChart } from './enterprise-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AccountsDashboard() {
  const stats = useDashboardStats();
  const { profile } = useAuth();

  const actions: QuickAction[] = [
    { label: 'Invoices', icon: FileText, href: '/accounts/invoices', count: 'View', subtitle: 'Manage billing' },
    { label: 'Payments', icon: Wallet, href: '/accounts/payments', count: 'Log', subtitle: 'Record income' },
    { label: 'Collections', icon: TrendingUp, href: '/accounts/collections', count: 'Chase', subtitle: 'Overdue accounts' },
    { label: 'Approvals', icon: CheckCircle2, href: '/accounts/approvals', count: stats.pendingApprovals.toString(), subtitle: 'Pending review' },
  ];

  const cashFlowData = [
    { month: 'Jan', in: 450000, out: 300000 },
    { month: 'Feb', in: 520000, out: 310000 },
    { month: 'Mar', in: 480000, out: 290000 },
    { month: 'Apr', in: 610000, out: 350000 },
  ];

  return (
    <div className="min-h-screen bg-background px-4 md:px-8 py-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <EnterpriseWelcomeHeader 
          title="Accounts & Finance"
          breadcrumbs={["Home", "Accounts"]}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <EnterpriseKPICard 
            label="Total Revenue" 
            value={formatMoney(stats.outstandingBalance + stats.paidAmount)} 
            trend={15.3} 
            trendLabel="YTD"
            icon={DollarSign}
            iconColorClass="text-emerald-500"
            iconBgClass="bg-emerald-50 border-emerald-100"
            valueColorClass="text-emerald-500"
            sparklineColor="#10b981"
            sparklineData={[15, 20, 25, 30, 28, 35, 40]}
          />
          <EnterpriseKPICard 
            label="Outstanding" 
            value={formatMoney(stats.outstandingBalance)} 
            trend={-5.2} 
            trendLabel="Unpaid invoices"
            icon={Wallet}
            iconColorClass="text-blue-500"
            iconBgClass="bg-blue-50 border-blue-100"
            valueColorClass="text-blue-500"
            sparklineColor="#3b82f6"
            sparklineData={[40, 35, 38, 30, 25, 28, 20]}
          />
          <EnterpriseKPICard 
            label="Overdue" 
            value={formatMoney(stats.outstandingBalance * 0.4)} 
            trend={12.5} 
            trendLabel="Past 30 days"
            icon={AlertCircle}
            iconColorClass="text-rose-500"
            iconBgClass="bg-rose-50 border-rose-100"
            valueColorClass="text-rose-500"
            sparklineColor="#ef4444"
            sparklineData={[5, 8, 12, 10, 15, 18, 25]}
          />
          <EnterpriseKPICard 
            label="Pending Approvals" 
            value={stats.pendingApprovals} 
            trend={0} 
            trendLabel="Discount requests"
            icon={CheckCircle2}
            iconColorClass="text-amber-500"
            iconBgClass="bg-amber-50 border-amber-100"
            valueColorClass="text-amber-500"
            sparklineColor="#f59e0b"
            sparklineData={[2, 3, 2, 4, 3, 5, 4]}
          />
        </div>

        <EnterpriseQuickActions actions={actions} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="bg-white border-0 shadow-premium rounded-3xl overflow-hidden p-2 h-full flex flex-col">
               <CardHeader className="pb-0">
                  <CardTitle className="text-xl font-bold text-gray-900">Cash Flow Overview</CardTitle>
               </CardHeader>
               <CardContent className="flex-1 pt-4 min-h-[300px]">
                 <EnterpriseBarChart 
                  title="" 
                  description=""
                  data={cashFlowData}
                  xAxisKey="month"
                  bars={[
                    { key: 'in', name: 'Money In', color: '#10b981', gradientColors: ['#34d399', '#10b981'] },
                    { key: 'out', name: 'Money Out', color: '#f43f5e', gradientColors: ['#fb7185', '#f43f5e'] }
                  ]} 
                />
               </CardContent>
            </Card>
          </div>
          <div className="flex flex-col gap-6">
            <AlertsPanel alerts={[]} />
          </div>
        </div>
      </div>
    </div>
  );
}
