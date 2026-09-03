'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { DashboardFilters } from '@/lib/dashboard/dashboard-types';
import { fetchDashboardData, DashboardData } from '@/lib/dashboard/dashboard-queries';
import { exportDashboardToPDF, exportDashboardToExcel } from '@/lib/dashboard/dashboard-export';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { ExecutiveKPICard } from '@/components/dashboard/executive-kpi-card';
import { WorkflowPipelineCard } from '@/components/dashboard/workflow-pipeline-card';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { ProductLeaderboard } from '@/components/dashboard/product-leaderboard';
import { DashboardActionCenter } from '@/components/dashboard/dashboard-action-center';
import { SmartAlertCenter } from '@/components/smart-alert-center';
import { ActivityFeed } from '@/components/activity-feed';
import { AssignmentQueue } from '@/components/assignment-queue';
import { DailyOperationsTimeline } from '@/components/daily-timeline';
import { formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart, RefreshCcw, Download,
  ClipboardList, CreditCard, LayoutDashboard,
  Calendar, AlertTriangle, Banknote,
  Truck, ScanLine, Clock, FileCheck, Plus
} from 'lucide-react';
import Link from 'next/link';
import { fetchExecutiveInsights, type ExecutiveSummaryMetrics } from '@/lib/executive-insights';
import { useRealtimeDashboard } from '@/hooks/use-realtime-dashboard';
import { cn } from '@/lib/utils';

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-muted/60 rounded-lg border border-border/60 animate-pulse ${className || ''}`} />;
}

function getCurrentShiftName(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'Morning Shift (06:00 - 14:00)';
  if (hour >= 14 && hour < 22) return 'Afternoon Shift (14:00 - 22:00)';
  return 'Night Shift (22:00 - 06:00)';
}

export function AdminDashboard() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<DashboardFilters>({ dateRange: 'today' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [execSummary, setExecSummary] = useState<ExecutiveSummaryMetrics | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, insights] = await Promise.all([
        fetchDashboardData(filters, 'admin'),
        fetchExecutiveInsights(),
      ]);
      setData(result);
      setExecSummary(insights.summary);
    } catch (e: any) {
      console.error('Dashboard load error:', e);
      setError(e?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.dateRange, filters.customStartDate, filters.customEndDate]);

  // Realtime updates on relevant tables
  useRealtimeDashboard({
    tables: [
      { table: 'payments' },
      { table: 'orders' },
      { table: 'dispatches', event: 'INSERT' },
      { table: 'order_handovers', event: 'INSERT' },
    ],
    onUpdate: loadData,
  });

  // Operational pipeline order counts
  const pipelineCounts = useMemo(() => {
    const list = data?.ordersList || [];
    let pending = 0;
    let approved = 0;
    let partially_dispatched = 0;
    let dispatched = 0;
    let handed_over = 0;
    let completed = 0;

    for (const o of list) {
      const s = o.status?.toLowerCase();
      if (s === 'pending') pending++;
      else if (s === 'approved') approved++;
      else if (s === 'partially_dispatched') partially_dispatched++;
      else if (s === 'dispatched') dispatched++;
      else if (s === 'handed_over') handed_over++;
      else if (s === 'completed') completed++;
    }

    return { pending, approved, partially_dispatched, dispatched, handed_over, completed };
  }, [data?.ordersList]);

  // Low stock items count
  const lowStockCount = useMemo(() => {
    if (!data?.productPerformance) return 0;
    return data.productPerformance.filter((p) => p.inStock <= 20).length;
  }, [data?.productPerformance]);

  if (!profile) return null;

  const dateFilterOptions = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: '7 Days', value: 'week' },
    { label: 'This Month', value: 'month' },
    { label: 'Quarter', value: 'quarter' },
  ];

  return (
    <DashboardShell>
      {/* ════ ZONE 1: COMMAND & OPERATIONAL CONTEXT BAR ════ */}
      <div className="flex flex-col gap-4 mb-6 pb-4 border-b border-border/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Factory Operations & Executive Overview
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Floor
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
              <span>Plant Manager: <strong className="text-foreground">{profile.full_name || 'Admin User'}</strong></span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                {getCurrentShiftName()}
              </span>
              <span>•</span>
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </p>
          </div>

          {/* Quick Factory Commands */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            <Button size="sm" asChild className="h-8 px-3 text-xs font-bold gap-1.5 shadow-xs">
              <Link href="/orders">
                <Plus className="w-3.5 h-3.5" />
                New Order
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="h-8 px-2.5 text-xs font-semibold gap-1.5 bg-card">
              <Link href="/production">
                <ScanLine className="w-3.5 h-3.5 text-primary" />
                Scan Box
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="h-8 px-2.5 text-xs font-semibold gap-1.5 bg-card">
              <Link href="/dispatch">
                <Truck className="w-3.5 h-3.5 text-indigo-500" />
                Loading Desk
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="h-8 px-2.5 text-xs font-semibold gap-1.5 bg-card">
              <Link href="/dispatch">
                <FileCheck className="w-3.5 h-3.5 text-purple-500" />
                Gate Pass
              </Link>
            </Button>
          </div>
        </div>

        {/* Filter Bar & Export Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {/* Segmented Period Selector */}
          <div className="flex items-center gap-1 p-1 rounded-lg border border-border/70 bg-muted/30 overflow-x-auto">
            {dateFilterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilters({ ...filters, dateRange: opt.value as any })}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap',
                  filters.dateRange === opt.value
                    ? 'bg-card text-foreground shadow-xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Refresh & Reports */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="h-8 bg-card border-border/80 text-xs font-semibold gap-1.5"
            >
              <RefreshCcw className="w-3 h-3 text-muted-foreground" />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => exportDashboardToExcel(data as any, filters, profile?.full_name || 'User', 'Admin')}
              className="h-8 bg-card border-border/80 text-xs font-semibold gap-1.5"
            >
              <Download className="w-3 h-3 text-muted-foreground" />
              Excel
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => exportDashboardToPDF(data as any, filters, profile?.full_name || 'User', 'Admin')}
              className="h-8 bg-card border-border/80 text-xs font-semibold gap-1.5"
            >
              <Download className="w-3 h-3 text-muted-foreground" />
              PDF
            </Button>
          </div>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <SkeletonBlock key={i} className="h-28" />
            ))}
          </div>
          <SkeletonBlock className="h-32" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SkeletonBlock className="h-72" />
            <SkeletonBlock className="h-72" />
          </div>
        </div>
      ) : data && (
        <div className="space-y-6">
          {/* Smart Alert Notification Banner */}
          <SmartAlertCenter />

          {/* ════ ZONE 2: 8-CARD EXECUTIVE & VELOCITY KPI GRID ════ */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <ExecutiveKPICard
              title="Sales Revenue"
              value={formatMoney(data.salesValue)}
              subtext="Total orders booked"
              icon={Banknote}
              accent="emerald"
              progress={{
                percent: data.salesValue > 0 ? (data.paidAmount / data.salesValue) * 100 : 0,
                label: 'Collection Ratio',
              }}
              href="/orders"
            />
            <ExecutiveKPICard
              title="Cash Collections"
              value={formatMoney(data.paidAmount)}
              subtext="Reconciled cash inflows"
              icon={CreditCard}
              accent="blue"
              href="/account/payments"
            />
            <ExecutiveKPICard
              title="Accounts Receivable"
              value={formatMoney(data.outstandingAmount)}
              subtext="Pending customer credit balance"
              icon={ClipboardList}
              accent="amber"
              href="/account/debt"
            />
            <ExecutiveKPICard
              title="Total Orders"
              value={`${data.totalOrders} orders`}
              subtext={`${pipelineCounts.completed} fulfilled & closed`}
              icon={ShoppingCart}
              accent="purple"
              href="/orders"
            />
            <ExecutiveKPICard
              title="Factory Output"
              value={`${data.totalProduced.toLocaleString()} units`}
              subtext="Finished goods registered"
              icon={ScanLine}
              accent="emerald"
              href="/production"
            />
            <ExecutiveKPICard
              title="Warehouse Stock"
              value={`${data.totalInStock.toLocaleString()} units`}
              subtext={`${lowStockCount} SKUs near safety limit`}
              icon={LayoutDashboard}
              accent="cyan"
              href="/inventory"
            />
            <ExecutiveKPICard
              title="Dispatched Cartons"
              value={`${data.totalDispatched.toLocaleString()} units`}
              subtext="Loaded at loading dock"
              icon={Truck}
              accent="indigo"
              href="/dispatch"
            />
            <ExecutiveKPICard
              title="Awaiting Gate Handover"
              value={`${pipelineCounts.dispatched} orders`}
              subtext="Loaded, awaiting custody sign-off"
              icon={FileCheck}
              accent="rose"
              href="/dispatch"
            />
          </div>

          {/* ════ ZONE 3: CORE OPERATIONAL WORKFLOW PIPELINE ════ */}
          <WorkflowPipelineCard ordersList={data.ordersList || []} />

          {/* ════ ZONE 4: DUAL EXECUTIVE ANALYTICS CHARTS (RECHARTS) ════ */}
          <DashboardCharts
            ordersList={data.ordersList || []}
            totalProduced={data.totalProduced}
            totalDispatched={data.totalDispatched}
          />

          {/* ════ ZONE 5: OPERATIONAL ACTION CENTER & PRODUCT LEADERBOARD ════ */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <DashboardActionCenter
              pendingApprovals={data.pendingPayments || 0}
              ordersReadyForLoading={pipelineCounts.approved}
              partiallyDispatchedOrders={pipelineCounts.partially_dispatched}
              ordersAwaitingHandover={pipelineCounts.dispatched}
              lowStockItemsCount={lowStockCount}
            />
            <ProductLeaderboard products={data.productPerformance || []} />
          </div>

          {/* ════ ZONE 6: ASSIGNMENT QUEUE, OPERATIONS TIMELINE & ACTIVITY FEED ════ */}
          <AssignmentQueue />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DailyOperationsTimeline />
            <ActivityFeed />
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
