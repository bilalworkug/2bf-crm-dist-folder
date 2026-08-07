'use client';

import { useSalesStats } from '@/lib/use-sales-stats';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import { 
  FileText, Users, CheckCircle2, ShoppingCart, ArrowDownRight
} from 'lucide-react';
import { 
  EnterpriseWelcomeHeader, 
  EnterpriseKPICard, 
  EnterpriseQuickActions,
  QuickAction,
  AlertsPanel
} from './enterprise-components';
import { EnterpriseBarChart, EnterpriseAreaChart, EnterpriseRadarChart } from './enterprise-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EnterpriseDataTable } from './enterprise-tables';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const salesColumns = [
  { accessorKey: 'executive', header: 'Executive Name', cell: ({ row }: any) => (
    <div className="flex items-center gap-3 py-1">
      <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${row.getValue('executive')}&backgroundColor=e2e8f0`} alt="Avatar" className="w-8 h-8 rounded-full border border-gray-200" />
      <span className="font-semibold text-gray-900 text-[13px]">{row.getValue('executive')}</span>
    </div>
  )},
  { accessorKey: 'deals', header: 'Deal Closed', cell: ({ row }: any) => <span className="text-emerald-500 font-semibold text-[13px]">{row.getValue('deals')}</span> },
  { accessorKey: 'revenue', header: 'Revenue Generated', cell: ({ row }: any) => <span className="text-gray-600 font-medium text-[13px]">{row.getValue('revenue')}</span> },
  { accessorKey: 'conversion', header: 'Conversion %', cell: ({ row }: any) => <span className="text-blue-500 font-semibold text-[12px] bg-blue-50 px-2.5 py-1 rounded-md">{row.getValue('conversion')}</span> },
  { accessorKey: 'status', header: 'Status', cell: ({ row }: any) => {
    const status = row.getValue('status');
    const colorClass = status === 'Excellent' ? 'bg-emerald-500' : (status === 'Good' ? 'bg-blue-500' : 'bg-amber-500');
    return (
      <Badge className={`${colorClass} text-white border-0 px-3 py-0.5 rounded-full font-medium text-[11px] shadow-sm`}>
        {status}
      </Badge>
    );
  }},
];

const mockExecutives = [
  { executive: 'Robert Johnson', deals: 98, revenue: '$7,500', conversion: '100%', status: 'Excellent' },
  { executive: 'Isabella Cooper', deals: 87, revenue: '$2,000', conversion: '100%', status: 'Excellent' },
  { executive: 'John Smith', deals: 56, revenue: '$1,600', conversion: '85%', status: 'Good' },
  { executive: 'Sophia Parker', deals: 10, revenue: '$600', conversion: '30%', status: 'Average' },
];

export function SalesDashboard() {
  const { profile } = useAuth();
  const stats = useSalesStats(profile);

  const actions: QuickAction[] = [
    { label: 'New Quote', icon: FileText, href: '/sales/quotes/new', count: '+', subtitle: 'Create quotation' },
    { label: 'New Order', icon: ShoppingCart, href: '/sales/orders/new', count: '+', subtitle: 'Create order' },
    { label: 'Customers', icon: Users, href: '/sales/customers', count: 'View', subtitle: 'Manage accounts' },
    { label: 'Approvals', icon: CheckCircle2, href: '/sales/approvals', count: stats.discounts.pending.toString(), subtitle: 'Pending review' },
  ];

  const revenueData = [
    { name: 'Arlene', value: 800 },
    { name: 'Robert', value: 3400 },
    { name: 'Henry', value: 1900 },
    { name: 'Fox', value: 2600 },
    { name: 'Devon', value: 4100 },
  ];
  
  const dealsData = [
    { name: 'Brooklyn', value: 80 },
    { name: 'Kathryn', value: 100 },
    { name: 'Richards', value: 65 },
    { name: 'Robert', value: 50 },
    { name: 'Bessie', value: 30 },
  ];
  
  const pipelineData = [
    { stage: 'Prospecting', count: 15 },
    { stage: 'Qualification', count: 10 },
    { stage: 'Proposal', count: 8 },
    { stage: 'Negotiation', count: 5 },
    { stage: 'Closing', count: 2 },
  ];
  
  const forecastData = [
    { month: 'Jan', forecast: 270, target: 180 },
    { month: 'Feb', forecast: 160, target: 90 },
    { month: 'Mar', forecast: 230, target: 100 },
    { month: 'Apr', forecast: 110, target: 80 },
    { month: 'May', forecast: 90, target: 120 },
    { month: 'Jun', forecast: 290, target: 200 },
  ];
  
  const radarData = [
    { subject: 'Calls', A: 120, B: 80, fullMark: 150 },
    { subject: 'Emails', A: 98, B: 130, fullMark: 150 },
    { subject: 'Meetings', A: 86, B: 130, fullMark: 150 },
    { subject: 'Demos', A: 99, B: 100, fullMark: 150 },
    { subject: 'Close', A: 85, B: 90, fullMark: 150 },
  ];

  const alerts = [
    { id: '1', title: 'Pending Approvals', type: 'warning' as const, message: `${stats.discounts.pending} orders waiting for manager approval.` },
  ];

  return (
    <div className="min-h-screen bg-background px-4 md:px-8 py-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <EnterpriseWelcomeHeader 
          title="Sales Dashboard"
          breadcrumbs={["Home", "Sales"]}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <EnterpriseKPICard 
            label="Sales Revenue" 
            value={formatMoney(stats.totals.value)} 
            trend={12.5} 
            trendLabel="vs Last Year"
            icon={FileText}
            iconColorClass="text-emerald-500"
            iconBgClass="bg-emerald-50 border-emerald-100"
            valueColorClass="text-emerald-500"
            sparklineColor="#10b981"
            sparklineData={[10, 20, 15, 35, 25, 45, 40]}
          />
          <EnterpriseKPICard 
            label="New Customers" 
            value={450} 
            trend={8.2} 
            trendLabel="vs Last Year"
            icon={Users}
            iconColorClass="text-purple-500"
            iconBgClass="bg-purple-50 border-purple-100"
            valueColorClass="text-purple-500"
            sparklineColor="#a855f7"
            sparklineData={[5, 12, 10, 25, 18, 30, 28]}
          />
          <EnterpriseKPICard 
            label="Target Achievement" 
            value="68%" 
            trend={-1.2} 
            trendLabel="vs Last Year"
            icon={CheckCircle2}
            iconColorClass="text-orange-500"
            iconBgClass="bg-orange-50 border-orange-100"
            valueColorClass="text-orange-500"
            sparklineColor="#f97316"
            sparklineData={[30, 25, 28, 22, 20, 15, 12]}
          />
          <EnterpriseKPICard 
            label="Profit" 
            value="40%" 
            trend={1.2} 
            trendLabel="vs Last Year"
            icon={ShoppingCart}
            iconColorClass="text-blue-500"
            iconBgClass="bg-blue-50 border-blue-100"
            valueColorClass="text-blue-500"
            sparklineColor="#3b82f6"
            sparklineData={[15, 18, 16, 20, 25, 22, 28]}
          />
        </div>

        {/* Row 1.5: Activity & Conversion */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
             {/* We'll use this space in row 2 */}
          </div>
        </div>

        {/* Row 2: Bar Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EnterpriseBarChart 
            title="Top Revenue per Salesperson" 
            data={revenueData}
            xAxisKey="name"
            layout="vertical"
            bars={[{ key: 'value', name: 'Revenue', color: '#f97316', gradientColors: ['#fdba74', '#ea580c'] }]} 
          />
          <EnterpriseBarChart 
            title="Top Deals Closed per User" 
            data={dealsData}
            xAxisKey="name"
            layout="vertical"
            bars={[{ key: 'value', name: 'Deals', color: '#3b82f6', gradientColors: ['#93c5fd', '#2563eb'] }]} 
          />
        </div>

        {/* Row 3: Pipeline & Forecast */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 flex flex-col gap-6">
            <EnterpriseBarChart 
              title="Pipeline" 
              data={pipelineData}
              xAxisKey="stage"
              layout="vertical"
              rounded={true}
              bars={[{ key: 'count', name: 'Deals', color: '#a855f7', gradientColors: ['#d8b4fe', '#9333ea'] }]} 
            />
            <EnterpriseRadarChart
               title="Conversion Split"
               data={radarData}
               radarKey1="A"
               radarName1="Converted"
               radarColor1="#10b981"
               radarKey2="B"
               radarName2="On Progress"
               radarColor2="#8b5cf6"
            />
          </div>
          <div className="lg:col-span-2">
            <EnterpriseAreaChart 
              title="Forecast Overview" 
              data={forecastData}
              xAxisKey="month"
              areas={[
                { key: 'target', name: 'Target', color: '#10b981' },
                { key: 'forecast', name: 'Forecast', color: '#a855f7' }
              ]} 
            />
          </div>
        </div>

        {/* Row 4: Performance Table */}
        <Card className="bg-white border border-gray-100 shadow-premium rounded-2xl overflow-hidden p-2">
           <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-bold text-gray-900">Executive Performance Overview</CardTitle>
              <Button size="sm" variant="outline" className="text-gray-700 rounded-lg px-4 border-gray-200">
                Weekly <ArrowDownRight className="ml-2 h-3 w-3" />
              </Button>
           </CardHeader>
           <CardContent>
             <EnterpriseDataTable columns={salesColumns} data={mockExecutives} searchKey="executive" />
           </CardContent>
        </Card>


      </div>
    </div>
  );
}
