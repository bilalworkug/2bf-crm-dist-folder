'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { DashboardFilters } from '@/lib/dashboard/dashboard-types';
import { fetchDashboardData, DashboardData } from '@/lib/dashboard/dashboard-queries';
import { exportDashboardToExcel } from '@/lib/dashboard/dashboard-export';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { DashboardKPI } from '@/components/dashboard/dashboard-kpi';
import { ProductPerformanceWidget } from '@/components/dashboard/product-performance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Truck, Package, PackageCheck, AlertTriangle,
  RefreshCcw, Download, Calendar, Info, FileCheck, ArrowRight,
  ScanLine, ClipboardList, Clock
} from 'lucide-react';
import Link from 'next/link';
import { useRealtimeDashboard } from '@/hooks/use-realtime-dashboard';

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-muted/60 rounded-lg border border-border/60 animate-pulse ${className || ''}`} />;
}

export function DispatchDashboard() {
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
      const result = await fetchDashboardData(filters, 'dispatch', warehouseId);
      setData(result);
    } catch (e: any) {
      console.error('Dashboard load error:', e);
      setError(e?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filters.dateRange]);

  // Realtime update on dispatch scan or order status change
  useRealtimeDashboard({
    tables: [
      { table: 'dispatches', event: 'INSERT' },
      { table: 'orders', event: 'UPDATE' },
      { table: 'order_handovers', event: 'INSERT' },
    ],
    onUpdate: loadData,
  });

  if (!profile) return null;

  return (
    <DashboardShell>
      {/* ════ HEADER & CONTROLS ════ */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Dispatch & Loading Operations
            </h1>
            <span className="px-2 py-0.5 rounded-md border border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-semibold">
              Loading Bay
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Logged in as <strong className="text-foreground">{profile.full_name || 'Dispatch Supervisor'}</strong> • {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild className="h-9 text-xs font-bold gap-1.5 shadow-2xs">
            <Link href="/dispatch">
              <ScanLine className="h-4 w-4" />
              <span>Open Loading Desk</span>
            </Link>
          </Button>

          <Select
            value={filters.dateRange}
            onValueChange={(v: any) => { setFilters({ ...filters, dateRange: v }); }}
          >
            <SelectTrigger className="w-auto h-9 bg-card border-border/80 text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={loadData} className="h-9 bg-card border-border/80 text-xs font-semibold gap-1.5">
            <RefreshCcw className="w-3.5 h-3.5 text-muted-foreground" />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { if (data) exportDashboardToExcel(data, filters, profile?.full_name || 'User', 'Dispatch'); }}
            className="h-9 bg-card border-border/80 text-xs font-semibold gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            Export
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-lg text-rose-700 dark:text-rose-300 shadow-2xs">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="font-semibold text-xs sm:text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <SkeletonBlock key={i} className="h-24" />)}
          </div>
          <SkeletonBlock className="h-48" />
        </div>
      ) : data && (
        <div className="space-y-6">

          {/* ════ 4 KPI CARDS ════ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <DashboardKPI
              kpi={{ value: `${data.pendingOrders.toLocaleString()} orders`, label: 'Orders in Dispatch Queue', description: 'Pending or loading', status: data.pendingOrders > 0 ? 'warning' : 'neutral' }}
              icon={<Package className="w-4 h-4 text-indigo-600" />}
              iconBgClass="bg-indigo-500/10 border-indigo-500/20 text-indigo-600"
            />
            <DashboardKPI
              kpi={{ value: `${data.totalInStock.toLocaleString()} units`, label: 'Warehouse Stock Available', description: 'Available for loading' }}
              icon={<PackageCheck className="w-4 h-4 text-emerald-600" />}
              iconBgClass="bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
            />
            <DashboardKPI
              kpi={{ value: `${data.totalDispatched.toLocaleString()} units`, label: 'Cartons Dispatched Today', description: 'Total units loaded on trucks' }}
              icon={<Truck className="w-4 h-4 text-sky-600" />}
              iconBgClass="bg-sky-500/10 border-sky-500/20 text-sky-600"
            />
            <DashboardKPI
              kpi={{ value: 'Single-Source', label: 'Stock Deduction Point', description: 'Deducted strictly at dispatch scan' }}
              icon={<FileCheck className="w-4 h-4 text-purple-600" />}
              iconBgClass="bg-purple-500/10 border-purple-500/20 text-purple-600"
            />
          </div>

          {/* ════ OPERATIONAL SHORTCUT CARDS ════ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link
              href="/dispatch"
              className="group flex flex-col justify-between p-4 rounded-lg border border-border/80 bg-card hover:border-primary/50 transition-all shadow-xs"
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-2 rounded-md bg-primary/10 text-primary border border-primary/20">
                    <ScanLine className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">1. Carton Loading Scan</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Scan cartons at loading dock with camera or hardware barcode reader. Stock is deducted immediately.
                </p>
              </div>
              <div className="mt-4 pt-2.5 border-t border-border/40 flex items-center justify-between text-xs font-semibold text-primary">
                <span>Start Scanning</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            <Link
              href="/dispatch"
              className="group flex flex-col justify-between p-4 rounded-lg border border-border/80 bg-card hover:border-purple-500/50 transition-all shadow-xs"
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-2 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20">
                    <FileCheck className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">2. Gate Handover & Waybill</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Record driver details, license plate, 3PL company, and print official A4 Gate Pass / Waybill.
                </p>
              </div>
              <div className="mt-4 pt-2.5 border-t border-border/40 flex items-center justify-between text-xs font-semibold text-purple-600 dark:text-purple-400">
                <span>Issue Gate Pass</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            <Link
              href="/delivery"
              className="group flex flex-col justify-between p-4 rounded-lg border border-border/80 bg-card hover:border-emerald-500/50 transition-all shadow-xs"
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <Truck className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">3. Delivery Tracking</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Monitor active driver dispatches, vehicle status, and confirm delivery fulfillment notes.
                </p>
              </div>
              <div className="mt-4 pt-2.5 border-t border-border/40 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span>View Deliveries</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>

          {/* ════ PRODUCT PERFORMANCE ════ */}
          <ProductPerformanceWidget data={data.productPerformance} />

        </div>
      )}
    </DashboardShell>
  );
}
