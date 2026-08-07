'use client';

import { useDashboardStats } from '@/lib/use-dashboard-stats';
import { useAuth } from '@/lib/auth';
import { 
  Truck, PackageCheck, AlertTriangle, ScanLine, MapPin, CheckCircle2
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
import { EnterpriseDataTable } from './enterprise-tables';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const dispatchColumns = [
  { accessorKey: 'id', header: 'ORDER ID', cell: ({ row }: any) => <span className="font-semibold text-gray-900 text-sm">{row.getValue('id')}</span> },
  { accessorKey: 'truck', header: 'TRUCK', cell: ({ row }: any) => <span className="text-gray-600 text-sm">{row.getValue('truck')}</span> },
  { accessorKey: 'status', header: 'STATUS', cell: ({ row }: any) => {
    const status = row.getValue('status');
    const colorClass = status === 'Dispatched' ? 'bg-emerald-500' : 'bg-indigo-500';
    return (
      <Badge className={`${colorClass} text-white border-0 px-3 py-0.5 rounded-full font-medium text-[11px] shadow-sm`}>
        {status}
      </Badge>
    );
  }},
];

const mockDispatches = [
  { id: 'ORD-5832', truck: 'TRK-092', status: 'Loading' },
  { id: 'ORD-5831', truck: 'TRK-091', status: 'Dispatched' },
  { id: 'ORD-5830', truck: 'TRK-091', status: 'Dispatched' },
];

export function DispatchDashboard() {
  const stats = useDashboardStats();
  const { profile } = useAuth();

  const actions: QuickAction[] = [
    { label: 'Load Truck', icon: Truck, href: '/dispatch/load', count: 'Active', subtitle: 'Start loading' },
    { label: 'Scan Orders', icon: ScanLine, href: '/dispatch/scan', count: 'Scan', subtitle: 'Verify items' },
    { label: 'Orders Ready', icon: PackageCheck, href: '/dispatch/orders', count: stats.pendingOrders, subtitle: 'Waiting for dispatch' },
    { label: 'Exceptions', icon: AlertTriangle, href: '/dispatch/exceptions', count: '0', subtitle: 'Failed loads' },
  ];

  const dispatchData = [
    { time: '08:00', count: 5 },
    { time: '10:00', count: 12 },
    { time: '12:00', count: 8 },
    { time: '14:00', count: 15 },
  ];

  return (
    <div className="min-h-screen bg-background px-4 md:px-8 py-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <EnterpriseWelcomeHeader 
          title="Dispatch Center"
          breadcrumbs={["Home", "Dispatch"]}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <EnterpriseKPICard 
            label="Dispatched Today" 
            value={stats.dispatchesToday} 
            trend={12.0} 
            trendLabel="vs Yesterday"
            icon={Truck}
            iconColorClass="text-emerald-500"
            iconBgClass="bg-emerald-50 border-emerald-100"
            valueColorClass="text-emerald-500"
            sparklineColor="#10b981"
            sparklineData={[4, 6, 8, 12, 10, 15, 14]}
          />
          <EnterpriseKPICard 
            label="Orders Ready" 
            value={stats.pendingOrders} 
            trend={-2.5} 
            trendLabel="Awaiting trucks"
            icon={PackageCheck}
            iconColorClass="text-amber-500"
            iconBgClass="bg-amber-50 border-amber-100"
            valueColorClass="text-amber-500"
            sparklineColor="#f59e0b"
            sparklineData={[10, 8, 5, 4, 3, 2, 4]}
          />
          <EnterpriseKPICard 
            label="In Transit" 
            value={stats.totalDispatches} 
            trend={5.0} 
            trendLabel="On the road"
            icon={MapPin}
            iconColorClass="text-blue-500"
            iconBgClass="bg-blue-50 border-blue-100"
            valueColorClass="text-blue-500"
            sparklineColor="#3b82f6"
            sparklineData={[15, 18, 22, 20, 25, 24, 28]}
          />
          <EnterpriseKPICard 
            label="Delivered" 
            value={stats.completedOrders} 
            trend={8.2} 
            trendLabel="Confirmed delivery"
            icon={CheckCircle2}
            iconColorClass="text-purple-500"
            iconBgClass="bg-purple-50 border-purple-100"
            valueColorClass="text-purple-500"
            sparklineColor="#a855f7"
            sparklineData={[40, 45, 42, 50, 48, 55, 60]}
          />
        </div>

        <EnterpriseQuickActions actions={actions} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="bg-white border-0 shadow-premium rounded-3xl overflow-hidden p-2 h-full flex flex-col">
               <CardHeader className="pb-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-xl font-bold text-gray-900">Today's Deliveries</CardTitle>
                  <Button size="sm" variant="outline" className="text-gray-700 rounded-lg px-4 border-gray-200">
                    + New Load
                  </Button>
               </CardHeader>
               <CardContent className="flex-1">
                 <EnterpriseDataTable columns={dispatchColumns} data={mockDispatches} searchKey="id" />
               </CardContent>
            </Card>
          </div>
          <div className="flex flex-col gap-6">
            <Card className="bg-white border-0 shadow-premium rounded-3xl p-2 flex-1">
              <CardHeader className="pb-0">
                <CardTitle className="text-lg font-bold text-gray-900">Dispatch Rate</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 h-[250px]">
                 <EnterpriseBarChart 
                  title="" 
                  description=""
                  data={dispatchData}
                  xAxisKey="time"
                  bars={[{ key: 'count', name: 'Orders', color: '#4f46e5', gradientColors: ['#818cf8', '#4f46e5'] }]} 
                />
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
