'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { DashboardFilters } from '@/lib/dashboard/dashboard-types';
import { fetchDashboardData, DashboardData } from '@/lib/dashboard/dashboard-queries';
import { exportDashboardToPDF, exportDashboardToExcel } from '@/lib/dashboard/dashboard-export';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { DashboardKPI } from '@/components/dashboard/dashboard-kpi';
import { ProductPerformanceWidget } from '@/components/dashboard/product-performance';
import { ProductionOverviewWidget } from '@/components/dashboard/production-overview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Factory, Target, ScanLine, Camera, RefreshCcw, Download,
  Calendar, AlertTriangle, Info
} from 'lucide-react';
import Link from 'next/link';

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse ${className || ''}`} />;
}

import { useRealtimeDashboard } from '@/hooks/use-realtime-dashboard';

export function ProductionDashboard() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<DashboardFilters>({ dateRange: 'today' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboardData(filters, 'production');
      setData(result);
    } catch (e: any) {
      console.error('Dashboard load error:', e);
      setError(e?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filters.dateRange]);

  // Phase 25B: Realtime update on box produced or correction created
  useRealtimeDashboard({
    tables: [
      { table: 'production_scans', event: 'INSERT' },
      { table: 'correction_records' },
    ],
    onUpdate: loadData,
  });

  // Top produced products
  const topProduced = useMemo(() => {
    if (!data?.productPerformance) return [];
    return [...data.productPerformance]
      .sort((a, b) => b.produced - a.produced)
      .filter(p => p.produced > 0)
      .slice(0, 5);
  }, [data?.productPerformance]);

  if (!profile) return null;

  return (
    <DashboardShell>
      {/* ════ HEADER & CONTROLS ════ */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Production Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back, {profile.full_name || 'Production User'}</p>
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

          <Button variant="outline" onClick={() => { if (data) exportDashboardToExcel(data, filters, profile?.full_name || 'User', 'Production'); }} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <Download className="w-4 h-4 mr-2 text-slate-500" />
            Export
          </Button>

          <div className="flex items-center gap-3 ml-2 pl-4 border-l border-slate-200 dark:border-slate-800">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm">
              {profile.full_name?.charAt(0).toUpperCase() || 'P'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{profile.full_name || 'Production User'}</p>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SkeletonBlock className="h-[350px]" />
            <SkeletonBlock className="h-[350px]" />
          </div>
        </div>
      ) : data && (
        <div className="space-y-6">

          {/* ════ 4 KPI CARDS ════ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <DashboardKPI
              kpi={{ value: `${data.totalProduced.toLocaleString()} units`, label: 'Produced Quantity', description: 'Successfully scanned' }}
              icon={<Factory className="w-5 h-5 text-emerald-600" />}
              iconBgClass="bg-emerald-100 border-transparent text-emerald-600"
            />
            <DashboardKPI
              kpi={{ value: `${data.products.length} types`, label: 'Product Types', description: 'Products in system' }}
              icon={<Target className="w-5 h-5 text-blue-600" />}
              iconBgClass="bg-blue-100 border-transparent text-blue-600"
            />
            <DashboardKPI
              kpi={{ value: `${data.totalInStock.toLocaleString()} units`, label: 'Available Product Quantity', description: 'Across all warehouses' }}
              icon={<ScanLine className="w-5 h-5 text-purple-600" />}
              iconBgClass="bg-purple-100 border-transparent text-purple-600"
            />
            <DashboardKPI
              kpi={{ value: `${data.totalDispatched.toLocaleString()} units`, label: 'Dispatched Quantity', description: 'Units shipped out' }}
              icon={<Camera className="w-5 h-5 text-amber-600" />}
              iconBgClass="bg-amber-100 border-transparent text-amber-600"
            />
          </div>

          {/* ════ MIDDLE ROW: PRODUCTION OVERVIEW & TOP PRODUCED ════ */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ProductionOverviewWidget productData={data.productPerformance} />

            {/* Top Produced Products */}
            <Card className="shadow-sm border-slate-200 flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800">Top Produced Products</CardTitle>
                <div className="text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">This Period</div>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col">
                <div className="flex-1">
                  <ul className="divide-y divide-slate-50">
                    {topProduced.length === 0 ? (
                      <li className="p-4 text-center text-slate-500 text-sm">No production data for this period.</li>
                    ) : topProduced.map((p, i) => (
                      <li key={i} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-5 h-5 shrink-0 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center">{i+1}</span>
                          <span className="text-sm text-slate-700 truncate">{p.productName}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-700 whitespace-nowrap ml-2">{p.produced} boxes</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-3 border-t border-slate-100 text-center">
                  <Link href="/production" className="text-xs font-medium text-blue-600 hover:underline">View all production</Link>
                </div>
              </CardContent>
            </Card>
          </div>

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
                <Link href="/production" className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <Camera className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700">Scan New Box</span>
                </Link>
                <Link href="/production/corrections" className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700">Corrections</span>
                </Link>
                <Link href="/inventory" className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <ScanLine className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700">View Inventory</span>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* ════ BOTTOM ALERT BAR ════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-2 min-w-0">
                <Info className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-sm font-semibold text-emerald-900 truncate">
                  {data.totalProduced > 0
                    ? `${data.totalProduced} boxes produced this period`
                    : 'No production scans recorded yet'}
                </span>
              </div>
              <Link href="/production" className="text-xs font-semibold px-3 py-1.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors whitespace-nowrap ml-2 shrink-0">Start Scanning</Link>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="text-sm font-semibold text-amber-900 truncate">
                  {data.products.filter((p: any) => !data.productPerformance.find(pp => pp.productName === p.name && pp.produced > 0)).length} product(s) with no production
                </span>
              </div>
              <Link href="/production" className="text-xs font-semibold px-3 py-1.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors whitespace-nowrap ml-2 shrink-0">View Details</Link>
            </div>
          </div>

        </div>
      )}
    </DashboardShell>
  );
}
