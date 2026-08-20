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
import { ProductionOverviewWidget } from '@/components/dashboard/production-overview';
import { ActionRequiredWidget } from '@/components/dashboard/action-required';
import { FactoryHealthWidget } from '@/components/dashboard/factory-health';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Factory, Truck, ShoppingCart, PackageCheck, ArrowRight,
  AlertTriangle, RefreshCcw, Download, Calendar, Archive
} from 'lucide-react';
import Link from 'next/link';

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse ${className || ''}`} />;
}

export function ManagerDashboard() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<DashboardFilters>({ dateRange: 'today' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboardData(filters, 'manager');
      setData(result);
    } catch (e: any) {
      console.error('Dashboard load error:', e);
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filters.dateRange]);
  if (!profile) return null;

  return (
    <DashboardShell>
      {/* ════ HEADER & CONTROLS ════ */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">General Manager Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back, {profile.full_name || 'Manager'}</p>
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

          <Button variant="outline" onClick={() => { if (data) exportDashboardToExcel(data, filters, profile?.full_name || 'User', 'Manager'); }} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <Download className="w-4 h-4 mr-2 text-slate-500" />
            Export
          </Button>

          <div className="flex items-center gap-3 ml-2 pl-4 border-l border-slate-200 dark:border-slate-800">
            <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">
              {profile.full_name?.charAt(0).toUpperCase() || 'M'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{profile.full_name || 'Manager'}</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <SkeletonBlock key={i} className="h-28" />)}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
             <div className="xl:col-span-2"><SkeletonBlock className="h-[250px]" /></div>
             <SkeletonBlock className="h-[250px]" />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SkeletonBlock className="h-[350px]" />
            <SkeletonBlock className="h-[350px]" />
          </div>
        </div>
      ) : data && (
        <div className="space-y-6">

          {/* ════ 4 KPI CARDS ════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardKPI
              kpi={{ value: `${data.totalProduced.toLocaleString()} units`, label: 'Produced Quantity', description: 'Finished goods scanned' }}
              icon={<Factory className="w-5 h-5 text-purple-600" />}
              iconBgClass="bg-purple-100 border-transparent text-purple-600"
            />
            <DashboardKPI
              kpi={{ value: `${data.totalInStock.toLocaleString()} units`, label: 'Available Product Quantity', description: 'Total across all warehouses' }}
              icon={<Archive className="w-5 h-5 text-emerald-600" />}
              iconBgClass="bg-emerald-100 border-transparent text-emerald-600"
            />
            <DashboardKPI
              kpi={{ value: `${data.totalOrders.toLocaleString()} orders`, label: 'Total Orders', description: 'Total orders placed' }}
              icon={<ShoppingCart className="w-5 h-5 text-blue-600" />}
              iconBgClass="bg-blue-100 border-transparent text-blue-600"
            />
            <DashboardKPI
              kpi={{ value: `${data.totalDispatched.toLocaleString()} units`, label: 'Dispatched Quantity', description: 'Units shipped' }}
              icon={<Truck className="w-5 h-5 text-amber-600" />}
              iconBgClass="bg-amber-100 border-transparent text-amber-600"
            />
          </div>

          {/* ════ FACTORY HEALTH + ACTION REQUIRED ════ */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <FactoryHealthWidget health={{
                production: data.totalProduced > 0 ? 'good' : 'attention',
                warehouse: data.totalInStock > 0 ? 'good' : 'attention',
                sales: data.totalOrders > 0 ? 'good' : 'attention',
                dispatch: data.totalDispatched > 0 ? 'good' : 'attention',
                delivery: data.totalDelivered > 0 ? 'good' : 'attention',
                returns: data.totalReturned > 0 ? 'attention' : 'good',
              }} />
            </div>
            <ActionRequiredWidget items={
              data.pendingOrders > 0
                ? [{ id: '1', title: `${data.pendingOrders} order(s) awaiting action`, severity: 'warning' as const, actionLabel: 'Review', actionHref: '/orders' }]
                : [{ id: '2', title: 'Everything is up to date', severity: 'info' as const }]
            } />
          </div>

          {/* ════ PRODUCTION OVERVIEW + WAREHOUSE OVERVIEW ════ */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ProductionOverviewWidget productData={data.productPerformance} />
            <WarehouseOverviewWidget warehouses={data.warehouseOverview} />
          </div>

          {/* ════ PRODUCT PERFORMANCE ════ */}
          <div className="grid grid-cols-1 gap-6">
            <ProductPerformanceWidget data={data.productPerformance} />
          </div>

          {/* ════ OPERATIONAL FLOW ════ */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800">Operational Flow</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1 w-full flex flex-col items-center justify-center p-6 bg-purple-50 rounded-xl border border-purple-100">
                  <Factory className="w-10 h-10 text-purple-500 mb-3" />
                  <span className="text-lg font-bold text-slate-900">Production</span>
                  <span className="text-sm font-medium text-slate-600 mt-1">{data.totalProduced.toLocaleString()} units produced</span>
                </div>
                <ArrowRight className="w-8 h-8 text-slate-300 hidden md:block" />
                <div className="flex-1 w-full flex flex-col items-center justify-center p-6 bg-blue-50 rounded-xl border border-blue-100">
                  <ShoppingCart className="w-10 h-10 text-blue-500 mb-3" />
                  <span className="text-lg font-bold text-slate-900">Orders</span>
                  <span className="text-sm font-medium text-slate-600 mt-1">{data.totalOrders.toLocaleString()} orders</span>
                </div>
                <ArrowRight className="w-8 h-8 text-slate-300 hidden md:block" />
                <div className="flex-1 w-full flex flex-col items-center justify-center p-6 bg-amber-50 rounded-xl border border-amber-100">
                  <Truck className="w-10 h-10 text-amber-500 mb-3" />
                  <span className="text-lg font-bold text-slate-900">Dispatch</span>
                  <span className="text-sm font-medium text-slate-600 mt-1">{data.totalDispatched.toLocaleString()} units dispatched</span>
                </div>
                <ArrowRight className="w-8 h-8 text-slate-300 hidden md:block" />
                <div className="flex-1 w-full flex flex-col items-center justify-center p-6 bg-teal-50 rounded-xl border border-teal-100">
                  <PackageCheck className="w-10 h-10 text-teal-500 mb-3" />
                  <span className="text-lg font-bold text-slate-900">Delivery</span>
                  <span className="text-sm font-medium text-slate-600 mt-1">{data.totalDelivered.toLocaleString()} units delivered</span>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      )}
    </DashboardShell>
  );
}
