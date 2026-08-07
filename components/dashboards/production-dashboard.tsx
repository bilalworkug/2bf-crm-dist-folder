'use client';

import { useProductionStats } from '@/lib/use-production-stats';
import { useAuth } from '@/lib/auth';
import { 
  ScanLine, Factory, Camera, History, FileWarning, AlertTriangle, Target, BarChart3
} from 'lucide-react';
import { 
  EnterpriseWelcomeHeader, 
  EnterpriseKPICard, 
  EnterpriseQuickActions,
  QuickAction
} from './enterprise-components';
import { EnterpriseBarChart } from './enterprise-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EnterpriseDataTable } from './enterprise-tables';
import { useLiveProductionStats } from '@/hooks/live-data-hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const scanColumns = [
  {
    accessorKey: 'barcode',
    header: 'Barcode',
    cell: ({ row }: any) => <span className="font-semibold text-gray-900 text-[13px] font-mono">{row.getValue('barcode')}</span>,
  },
  {
    accessorKey: 'product',
    header: 'Product',
    cell: ({ row }: any) => <span className="text-gray-600 text-[13px] font-medium">{row.getValue('product')}</span>,
  },
  {
    accessorKey: 'time',
    header: 'Time',
    cell: ({ row }: any) => <span className="text-gray-500 text-[13px]">{row.getValue('time')}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: any) => {
      const status = row.getValue('status');
      const colorClass = status === 'Success' ? 'bg-emerald-500' : 'bg-rose-500';
      return (
        <Badge className={`${colorClass} text-white border-0 px-3 py-0.5 rounded-full font-medium text-[11px] shadow-sm`}>
          {status}
        </Badge>
      );
    }
  },
];

const mockRecentScans = [
  { id: '1', barcode: 'BOX-2948', product: 'Standard Widget A', time: '10:42:15 AM', status: 'Success' },
  { id: '2', barcode: 'BOX-2947', product: 'Standard Widget A', time: '10:41:03 AM', status: 'Success' },
  { id: '3', barcode: 'BOX-2947', product: 'Standard Widget A', time: '10:40:55 AM', status: 'Duplicate' },
  { id: '4', barcode: 'BOX-2946', product: 'Premium Widget B', time: '10:35:12 AM', status: 'Success' },
];

export function ProductionDashboard() {
  const baseStats = useProductionStats();
  const stats = useLiveProductionStats(baseStats);
  const { profile } = useAuth();

  const actions: QuickAction[] = [
    { label: 'Camera Scanner', icon: Camera, href: '/production', count: 'Active', subtitle: 'Scanner ready' },
    { label: 'Manual Entry', icon: ScanLine, href: '/production', count: 'Type', subtitle: 'Keyboard input' },
    { label: 'Corrections', icon: FileWarning, href: '/corrections', count: stats.correctionCount.toString(), subtitle: 'Fix errors' },
    { label: 'Scan History', icon: History, href: '/production', count: 'View', subtitle: 'Past records' },
  ];

  const hourlyOutput = [
    { time: '08:00', output: Math.max(0, stats.today * 0.1) },
    { time: '10:00', output: Math.max(0, stats.today * 0.15) },
    { time: '12:00', output: Math.max(0, stats.today * 0.25) },
    { time: '14:00', output: Math.max(0, stats.today * 0.2) },
    { time: '16:00', output: Math.max(0, stats.today * 0.3) },
  ];

  return (
    <div className="min-h-screen bg-background px-4 md:px-8 py-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <EnterpriseWelcomeHeader 
          title="Production Floor"
          breadcrumbs={["Home", "Production"]}
        />

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <EnterpriseKPICard 
            label="Produced Today" 
            value={stats.today} 
            trend={4.2} 
            trendLabel="vs Yesterday"
            icon={Factory}
            iconColorClass="text-emerald-500"
            iconBgClass="bg-emerald-50 border-emerald-100"
            valueColorClass="text-emerald-500"
            sparklineColor="#10b981"
            sparklineData={[15, 22, 18, 30, 25, 40, 35]}
          />
          <EnterpriseKPICard 
            label="Daily Target" 
            value="1,000" 
            trend={-1.5} 
            trendLabel="% Achieved"
            icon={Target}
            iconColorClass="text-blue-500"
            iconBgClass="bg-blue-50 border-blue-100"
            valueColorClass="text-blue-500"
            sparklineColor="#3b82f6"
            sparklineData={[80, 85, 78, 90, 88, 92, 85]}
          />
          <EnterpriseKPICard 
            label="Duplicates" 
            value={stats.duplicateCount} 
            trend={0} 
            trendLabel="Today"
            icon={AlertTriangle}
            iconColorClass="text-amber-500"
            iconBgClass="bg-amber-50 border-amber-100"
            valueColorClass="text-amber-500"
            sparklineColor="#f59e0b"
            sparklineData={[2, 0, 1, 0, 3, 1, 0]}
          />
          <EnterpriseKPICard 
            label="Corrections" 
            value={stats.correctionCount} 
            trend={0} 
            trendLabel="This Week"
            icon={FileWarning}
            iconColorClass="text-rose-500"
            iconBgClass="bg-rose-50 border-rose-100"
            valueColorClass="text-rose-500"
            sparklineColor="#ef4444"
            sparklineData={[1, 0, 2, 1, 0, 0, 1]}
          />
        </div>

        <EnterpriseQuickActions actions={actions} />

        {/* Charts + Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <EnterpriseBarChart 
              title="Hourly Output" 
              data={hourlyOutput}
              xAxisKey="time"
              bars={[{ key: 'output', name: 'Boxes', color: '#3b82f6', gradientColors: ['#93c5fd', '#2563eb'] }]} 
            />
          </div>
          <div className="lg:col-span-2">
            <Card className="bg-white border border-gray-100 shadow-premium rounded-2xl overflow-hidden p-2 h-full flex flex-col">
               <CardHeader className="pb-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-xl font-bold text-gray-900">Recent Scans</CardTitle>
                  <Button size="sm" variant="outline" className="text-gray-700 rounded-lg px-4 border-gray-200">
                    + New Scan
                  </Button>
               </CardHeader>
               <CardContent className="flex-1">
                 <EnterpriseDataTable columns={scanColumns} data={mockRecentScans} searchKey="barcode" />
               </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
