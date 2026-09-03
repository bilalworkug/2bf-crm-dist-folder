'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { DashboardFilters } from '@/lib/dashboard/dashboard-types';
import { fetchDashboardData, DashboardData } from '@/lib/dashboard/dashboard-queries';
import { exportDashboardToPDF, exportDashboardToExcel } from '@/lib/dashboard/dashboard-export';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { DashboardKPI } from '@/components/dashboard/dashboard-kpi';
import { ProductPerformanceWidget } from '@/components/dashboard/product-performance';
import { WarehouseOverviewWidget } from '@/components/dashboard/warehouse-overview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Package, ArrowDownToLine, ArrowUpFromLine, AlertTriangle,
  RefreshCcw, Download, Calendar, Info
} from 'lucide-react';
import Link from 'next/link';

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse ${className || ''}`} />;
}

import { useRealtimeDashboard } from '@/hooks/use-realtime-dashboard';

export function WarehouseDashboard() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<DashboardFilters>({ dateRange: 'today' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const warehouseId = profile?.warehouse_id || undefined;
      const result = await fetchDashboardData(filters, 'warehouse', warehouseId);
      setData(result);
    } catch (e: any) {
      console.error('Dashboard load error:', e);
      setError(e?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filters.dateRange]);

  // Phase 25B: Realtime update on stock received, transferred, or adjusted
  useRealtimeDashboard({
    tables: [
      { table: 'warehouse_receipts', event: 'INSERT' },
      { table: 'stock_movements', event: 'INSERT' },
      { table: 'boxes', event: 'UPDATE' },
    ],
    onUpdate: loadData,
  });

  if (!profile) return null;

  const totalReceived = data?.warehouseOverview.reduce((s, w) => s + w.receivedToday, 0) ?? 0;
  const totalDispatchedWH = data?.warehouseOverview.reduce((s, w) => s + w.dispatchedToday, 0) ?? 0;
  const totalAvailable = data?.warehouseOverview.reduce((s, w) => s + w.availableStock, 0) ?? 0;
  const criticalWarehouses = data?.warehouseOverview.filter(w => w.status === 'critical').length ?? 0;

  return (
    <DashboardShell>
      {/* ════ HEADER & CONTROLS ════ */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Warehouse Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back, {profile.full_name || 'Warehouse User'}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={filters.dateRange}
            onValueChange={(v: any) => { setFilters({ ...filters, dateRange: v }); }}
          >
            <SelectTrigger className="w-auto h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-medium">
              <Calendar className="w-4 h-4 mr-2 text-slate-500" />
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={loadData} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <RefreshCcw className="w-4 h-4 mr-2 text-slate-500" />
            Refresh
          </Button>

          <Button variant="outline" onClick={() => { if (data) exportDashboardToExcel(data, filters, profile?.full_name || 'User', 'Warehouse'); }} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <Download className="w-4 h-4 mr-2 text-slate-500" />
            Export
          </Button>

          <div className="flex items-center gap-3 ml-2 pl-4 border-l border-slate-200 dark:border-slate-800">
            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
              {profile.full_name?.charAt(0).toUpperCase() || 'W'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{profile.full_name || 'Warehouse User'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight capitalize">{profile.role?.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 shadow-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map(i => <SkeletonBlock key={i} className="h-28" />)}
          </div>
          <SkeletonBlock className="h-[300px]" />
          <SkeletonBlock className="h-[350px]" />
        </div>
      ) : data && (
        <div className="space-y-6">

          {/* ════ 4 KPI CARDS ════ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <DashboardKPI
              kpi={{ value: `${totalAvailable.toLocaleString()} units`, label: 'Available Quantity', description: 'Units ready for dispatch' }}
              icon={<Package className="w-5 h-5 text-indigo-600" />}
              iconBgClass="bg-indigo-100 border-transparent text-indigo-600"
            />
            <DashboardKPI
              kpi={{ value: `${totalReceived.toLocaleString()} units`, label: 'Received Quantity', description: 'Units received this period' }}
              icon={<ArrowDownToLine className="w-5 h-5 text-emerald-600" />}
              iconBgClass="bg-emerald-100 border-transparent text-emerald-600"
            />
            <DashboardKPI
              kpi={{ value: `${totalDispatchedWH.toLocaleString()} units`, label: 'Dispatched Quantity', description: 'Units sent out this period' }}
              icon={<ArrowUpFromLine className="w-5 h-5 text-purple-600" />}
              iconBgClass="bg-purple-100 border-transparent text-purple-600"
            />
            <DashboardKPI
              kpi={{ value: `${data.warehouseOverview.length} locations`, label: 'Warehouses', description: `${criticalWarehouses > 0 ? criticalWarehouses + ' need attention' : 'All operating normally'}`, status: criticalWarehouses > 0 ? 'warning' : 'neutral' }}
              icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
              iconBgClass="bg-amber-100 border-transparent text-amber-600"
            />
          </div>

          {/* ════ WAREHOUSE OVERVIEW ════ */}
          <WarehouseOverviewWidget warehouses={data.warehouseOverview} />

          {/* ════ PRODUCT PERFORMANCE & QUICK ACTIONS ════ */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="col-span-full xl:col-span-3">
              <ProductPerformanceWidget data={data.productPerformance} />
            </div>

            {/* Quick Actions */}
            <Card className="shadow-sm border-slate-200 flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-1 gap-3 flex-1 content-start">
                <Link href="/warehouse" className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <ArrowDownToLine className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700">Receive Stock</span>
                </Link>
                <Link href="/warehouse/transfers" className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <Package className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700">Stock Transfers</span>
                </Link>
                <Link href="/inventory" className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <Package className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700">View Inventory</span>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* ════ BOTTOM ALERT BARS ════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-2 min-w-0">
                <Info className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-sm font-semibold text-emerald-900 truncate">
                  {totalReceived > 0 ? `${totalReceived} boxes received this period` : 'No stock received yet'}
                </span>
              </div>
              <Link href="/warehouse" className="text-xs font-semibold px-3 py-1.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors whitespace-nowrap ml-2 shrink-0">Receive Stock</Link>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="text-sm font-semibold text-amber-900 truncate">
                  {criticalWarehouses > 0
                    ? `${criticalWarehouses} warehouse(s) with low or no stock`
                    : 'All warehouses operating normally'}
                </span>
              </div>
              <Link href="/inventory" className="text-xs font-semibold px-3 py-1.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors whitespace-nowrap ml-2 shrink-0">View Details</Link>
            </div>
          </div>

        </div>
      )}
    </DashboardShell>
  );
}
