'use client';

import { useWarehouseStats } from '@/lib/use-warehouse-stats';
import { useAuth } from '@/lib/auth';
import { 
  Package, ArrowRightLeft, Camera, AlertTriangle, Box, Truck
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

const receiptColumns = [
  { accessorKey: 'id', header: 'RECEIPT ID', cell: ({ row }: any) => <span className="font-semibold text-gray-900 text-sm">{row.getValue('id')}</span> },
  { accessorKey: 'supplier', header: 'SUPPLIER', cell: ({ row }: any) => <span className="text-gray-600 text-sm">{row.getValue('supplier')}</span> },
  { accessorKey: 'items', header: 'ITEMS', cell: ({ row }: any) => <span className="text-gray-600 text-sm">{row.getValue('items')}</span> },
  { accessorKey: 'status', header: 'STATUS', cell: ({ row }: any) => {
    const status = row.getValue('status');
    const colorClass = status === 'Completed' ? 'bg-emerald-500' : 'bg-amber-500';
    return (
      <Badge className={`${colorClass} text-white border-0 px-3 py-0.5 rounded-full font-medium text-[11px] shadow-sm`}>
        {status}
      </Badge>
    );
  }},
];

const mockReceipts = [
  { id: 'RC-1092', supplier: 'Global Suppliers Inc', items: '24 Pallets', status: 'Pending' },
  { id: 'RC-1091', supplier: 'Fast Parts Co', items: '5 Boxes', status: 'Completed' },
  { id: 'RC-1090', supplier: 'Tech Solutions', items: '12 Pallets', status: 'Completed' },
];

export function WarehouseDashboard() {
  const { profile } = useAuth();
  const stats = useWarehouseStats(profile);

  const actions: QuickAction[] = [
    { label: 'Receive Stock', icon: Package, href: '/warehouse/receive', count: 'Scan', subtitle: 'New inventory' },
    { label: 'Transfer', icon: ArrowRightLeft, href: '/warehouse/transfer', count: 'Move', subtitle: 'Between locations' },
    { label: 'Scan Camera', icon: Camera, href: '/warehouse/scan', count: 'Live', subtitle: 'Barcode scanner' },
    { label: 'Damaged', icon: AlertTriangle, href: '/warehouse/damaged', count: 'Report', subtitle: 'Log issues' },
  ];

  const occupancyData = [
    { zone: 'A', capacity: 85 },
    { zone: 'B', capacity: 42 },
    { zone: 'C', capacity: 90 },
    { zone: 'D', capacity: 15 },
  ];

  const alerts = [
    { id: '1', title: 'Zone C Near Capacity', type: 'warning' as const, message: 'Zone C is currently at 90% capacity.' },
    { id: '2', title: 'Pending Receipts', type: 'info' as const, message: '3 shipments waiting to be received.' },
  ];

  return (
    <div className="min-h-screen bg-background px-4 md:px-8 py-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <EnterpriseWelcomeHeader 
          title="Warehouse Operations"
          breadcrumbs={["Home", "Warehouse"]}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <EnterpriseKPICard 
            label="Warehouse Capacity" 
            value={`${Math.round((stats.allocated / (stats.available + stats.allocated)) * 100)}%`} 
            trend={1.2} 
            trendLabel="Overall occupancy"
            icon={Box}
            iconColorClass="text-blue-500"
            iconBgClass="bg-blue-50 border-blue-100"
            valueColorClass="text-blue-500"
            sparklineColor="#3b82f6"
            sparklineData={[70, 72, 75, 78, 80, 82, 85]}
          />
          <EnterpriseKPICard 
            label="Pending Receipts" 
            value={stats.incomingTransfers} 
            trend={-0.5} 
            trendLabel="Trucks waiting"
            icon={Truck}
            iconColorClass="text-amber-500"
            iconBgClass="bg-amber-50 border-amber-100"
            valueColorClass="text-amber-500"
            sparklineColor="#f59e0b"
            sparklineData={[5, 4, 3, 2, 4, 3, 1]}
          />
          <EnterpriseKPICard 
            label="Total Available" 
            value={stats.available} 
            trend={2.1} 
            trendLabel="Ready to ship"
            icon={Package}
            iconColorClass="text-emerald-500"
            iconBgClass="bg-emerald-50 border-emerald-100"
            valueColorClass="text-emerald-500"
            sparklineColor="#10b981"
            sparklineData={[1200, 1250, 1230, 1300, 1280, 1350, 1400]}
          />
          <EnterpriseKPICard 
            label="Damaged Stock" 
            value={stats.correctionCount} 
            trend={5.0} 
            trendLabel="Requires review"
            icon={AlertTriangle}
            iconColorClass="text-rose-500"
            iconBgClass="bg-rose-50 border-rose-100"
            valueColorClass="text-rose-500"
            sparklineColor="#ef4444"
            sparklineData={[2, 3, 2, 4, 3, 5, 4]}
          />
        </div>

        <EnterpriseQuickActions actions={actions} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="bg-white border-0 shadow-premium rounded-3xl overflow-hidden p-2 h-full flex flex-col">
               <CardHeader className="pb-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-xl font-bold text-gray-900">Today's Receipts</CardTitle>
                  <Button size="sm" variant="outline" className="text-gray-700 rounded-lg px-4 border-gray-200">
                    + New Receipt
                  </Button>
               </CardHeader>
               <CardContent className="flex-1">
                 <EnterpriseDataTable columns={receiptColumns} data={mockReceipts} searchKey="id" />
               </CardContent>
            </Card>
          </div>
          <div className="flex flex-col gap-6">
            <Card className="bg-white border-0 shadow-premium rounded-3xl p-2 flex-1">
              <CardHeader className="pb-0">
                <CardTitle className="text-lg font-bold text-gray-900">Zone Occupancy</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 h-[250px]">
                 <EnterpriseBarChart 
                  title="" 
                  description=""
                  data={occupancyData}
                  xAxisKey="zone"
                  bars={[{ key: 'capacity', name: '% Full', color: '#4f46e5', gradientColors: ['#818cf8', '#4f46e5'] }]} 
                />
              </CardContent>
            </Card>
            <AlertsPanel alerts={alerts} />
          </div>
        </div>

      </div>
    </div>
  );
}
