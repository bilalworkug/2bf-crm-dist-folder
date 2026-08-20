'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { DashboardFilters } from '@/lib/dashboard/dashboard-types';
import { fetchDashboardData, DashboardData } from '@/lib/dashboard/dashboard-queries';
import { exportDashboardToPDF, exportDashboardToExcel } from '@/lib/dashboard/dashboard-export';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { DashboardKPI } from '@/components/dashboard/dashboard-kpi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Truck, MapPin, CheckCircle, AlertTriangle,
  RefreshCcw, Download, Calendar, Info
} from 'lucide-react';
import Link from 'next/link';

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse ${className || ''}`} />;
}

export function DeliveryDashboard() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<DashboardFilters>({ dateRange: 'today' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboardData(filters, 'delivery');
      setData(result);
    } catch (e: any) {
      console.error('Dashboard load error:', e);
      setError(e?.message || 'Failed to load dashboard data');
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Delivery Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back, {profile.full_name || 'Delivery User'}</p>
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

          <Button variant="outline" onClick={() => { if (data) exportDashboardToExcel(data, filters, profile?.full_name || 'User', 'Delivery'); }} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <Download className="w-4 h-4 mr-2 text-slate-500" />
            Export
          </Button>

          <div className="flex items-center gap-3 ml-2 pl-4 border-l border-slate-200 dark:border-slate-800">
            <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-sm">
              {profile.full_name?.charAt(0).toUpperCase() || 'D'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{profile.full_name || 'Delivery User'}</p>
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
        </div>
      ) : data && (
        <div className="space-y-6">

          {/* ════ 4 KPI CARDS ════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardKPI
              kpi={{ value: data.totalDispatched.toLocaleString(), label: 'Pending Deliveries', description: 'Dispatched, not yet delivered', status: data.totalDispatched > 0 ? 'warning' : 'neutral' }}
              icon={<MapPin className="w-5 h-5 text-amber-600" />}
              iconBgClass="bg-amber-100 border-transparent text-amber-600"
            />
            <DashboardKPI
              kpi={{ value: '0', label: 'In Transit', description: 'Currently out for delivery' }}
              icon={<Truck className="w-5 h-5 text-blue-600" />}
              iconBgClass="bg-blue-100 border-transparent text-blue-600"
            />
            <DashboardKPI
              kpi={{ value: data.totalDelivered.toLocaleString(), label: 'Delivered Today', description: 'Successfully confirmed' }}
              icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
              iconBgClass="bg-emerald-100 border-transparent text-emerald-600"
            />
            <DashboardKPI
              kpi={{ value: '0', label: 'Failed Deliveries', description: 'Exceptions or returns' }}
              icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
              iconBgClass="bg-rose-100 border-transparent text-rose-600"
            />
          </div>

          {/* ════ QUICK ACTIONS & ALERTS ════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Quick Actions */}
            <Card className="shadow-sm border-slate-200 flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-1 gap-3 flex-1 content-start">
                <Link href="/delivery" className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700">Confirm Delivery</span>
                </Link>
                <Link href="/delivery" className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <Truck className="w-4 h-4 text-teal-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700">Manage Deliveries</span>
                </Link>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span className="text-sm font-semibold text-amber-900 truncate">
                    {data.totalDispatched > 0
                      ? `${data.totalDispatched} shipment(s) pending delivery confirmation`
                      : 'No pending deliveries'}
                  </span>
                </div>
                <Link href="/delivery" className="text-xs font-semibold px-3 py-1.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors whitespace-nowrap ml-2 shrink-0">View Deliveries</Link>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                <div className="flex items-center gap-2 min-w-0">
                  <Info className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="text-sm font-semibold text-emerald-900 truncate">
                    {data.totalDelivered > 0
                      ? `${data.totalDelivered} deliveries confirmed this period`
                      : 'No deliveries confirmed yet'}
                  </span>
                </div>
                <Link href="/delivery" className="text-xs font-semibold px-3 py-1.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors whitespace-nowrap ml-2 shrink-0">View History</Link>
              </div>
            </div>
          </div>

        </div>
      )}
    </DashboardShell>
  );
}
