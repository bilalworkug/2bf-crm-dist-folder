'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import {
  ExecutiveFilters,
  CompleteExecutiveData,
} from '@/lib/executive-intelligence/executive-types';
import { fetchExecutiveIntelligenceData } from '@/lib/executive-intelligence/executive-data-service';
import { ExecutiveFilterBar } from './executive-filter-bar';
import { CustomerIntelligence } from './customer-intelligence';
import { ProductIntelligence } from './product-intelligence';
import { SalesTrends } from './sales-trends';
import { WarehouseIntelligence } from './warehouse-intelligence';
import { ProductionIntelligence } from './production-intelligence';
import { FinancialIntelligence } from './financial-intelligence';
import { SmartRecommendations } from './smart-recommendations';
import { ExecutiveCompareMode } from './executive-compare-mode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard, Users, Package, TrendingUp,
  DollarSign, Building2, ScanLine, ArrowLeftRight,
  ArrowUpRight, Clock, AlertTriangle, CheckCircle2,
  Calendar, Award, Banknote, Receipt, ChevronRight,
  ArrowRight, ShieldAlert, Sparkles, Download, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRealtimeDashboard } from '@/hooks/use-realtime-dashboard';
import Link from 'next/link';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip
} from 'recharts';
import { exportExecutiveToPDF, exportExecutiveToExcel } from '@/lib/executive-intelligence/executive-export';
import { toast } from 'sonner';

export type ExecutivePillar =
  | 'overview'
  | 'customers'
  | 'products'
  | 'trends'
  | 'finances'
  | 'operations'
  | 'compare';

const PILLARS: { id: ExecutivePillar; label: string; icon: any }[] = [
  { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'products', label: 'Products & SKUs', icon: Package },
  { id: 'trends', label: 'Sales Trends', icon: TrendingUp },
  { id: 'finances', label: 'Finance & AR', icon: DollarSign },
  { id: 'operations', label: 'Factory & Warehouses', icon: Building2 },
  { id: 'compare', label: 'Compare Mode', icon: ArrowLeftRight },
];

export function ExecutiveDashboardPro() {
  const { profile } = useAuth();
  const [activePillar, setActivePillar] = useState<ExecutivePillar>('overview');
  const [filters, setFilters] = useState<ExecutiveFilters>({
    datePreset: 'last_30_days',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CompleteExecutiveData | null>(null);

  // Strict role protection check
  if (profile?.role !== 'admin') {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-border">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <h3 className="text-base font-bold text-foreground">Access Restricted</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Executive Intelligence Pro is strictly reserved for Admin accounts.
        </p>
      </div>
    );
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchExecutiveIntelligenceData(filters);
      setData(result);
    } catch (err: any) {
      console.error('Failed to load executive data:', err);
      setError(err?.message || 'Error compiling executive metrics');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime updates
  useRealtimeDashboard({
    tables: [
      { table: 'orders' },
      { table: 'payments' },
      { table: 'production_scans', event: 'INSERT' },
      { table: 'dispatches', event: 'INSERT' },
    ],
    onUpdate: loadData,
  });

  // Top 5 summaries for the overview
  const topCustomersSample = useMemo(() => {
    return (data?.customers || []).slice(0, 5);
  }, [data?.customers]);

  const topProductsSample = useMemo(() => {
    return (data?.products || []).slice(0, 5);
  }, [data?.products]);

  return (
    <div className="space-y-6">
      {/* ─── EXECUTIVE PILLAR NAVIGATION TABS & EXPORT ACTIONS ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/30 border border-border/80 overflow-x-auto scrollbar-none">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            const isActive = activePillar === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActivePillar(p.id)}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[36px]',
                  isActive
                    ? 'bg-card text-foreground shadow-xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Pro Export Actions */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            disabled={!data || loading}
            onClick={() => {
              if (!data) return;
              toast.promise(
                exportExecutiveToPDF(data, profile?.full_name || 'Admin', 'Admin'),
                {
                  loading: 'Compiling executive PDF briefing...',
                  success: 'Executive PDF downloaded successfully!',
                  error: 'Failed to generate PDF',
                }
              );
            }}
            className="h-8 text-xs font-bold gap-1.5 bg-card border-border/80 hover:border-rose-500/50 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-rose-500" />
            <span>Executive PDF</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!data || loading}
            onClick={() => {
              if (!data) return;
              toast.promise(
                exportExecutiveToExcel(data, profile?.full_name || 'Admin', 'Admin'),
                {
                  loading: 'Compiling Excel workbook...',
                  success: 'Executive Excel workbook downloaded successfully!',
                  error: 'Failed to generate Excel',
                }
              );
            }}
            className="h-8 text-xs font-bold gap-1.5 bg-card border-border/80 hover:border-emerald-500/50 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel Workbook</span>
          </Button>
        </div>
      </div>

      {/* ─── UNIVERSAL COMPACT FILTER BAR ─── */}
      <ExecutiveFilterBar
        filters={filters}
        onChange={(newFilters) => setFilters(newFilters)}
        filterOptions={
          data?.filterOptions || {
            warehouses: [],
            products: [],
            customers: [],
            paymentTypes: [],
            orderStatuses: [],
          }
        }
        isLoading={loading}
      />

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-muted/40 animate-pulse border border-border/60" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 h-72 rounded-xl bg-muted/40 animate-pulse border border-border/60" />
            <div className="h-72 rounded-xl bg-muted/40 animate-pulse border border-border/60" />
          </div>
        </div>
      ) : data ? (
        <div>
          {/* ═══════════════════════════════════════════════════════════════
              PILLAR 1: CLEAN EXECUTIVE OVERVIEW (Apple / Stripe Design)
          ═══════════════════════════════════════════════════════════════ */}
          {activePillar === 'overview' && (
            <div className="space-y-6">
              {/* 1. Top 4 Core Metrics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Revenue */}
                <Card className="border-border/80 bg-card p-4 flex flex-col justify-between hover:border-emerald-500/40 transition-all shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Booked Revenue</span>
                      <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600">
                        <Banknote className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight mt-1.5">
                      ETB {data.finances.totalRevenue.toLocaleString()}
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{data.customers.reduce((s, c) => s + c.totalOrders, 0)} orders booked</span>
                    <span className="font-semibold text-emerald-600">Period Total</span>
                  </div>
                </Card>

                {/* Collections */}
                <Card className="border-border/80 bg-card p-4 flex flex-col justify-between hover:border-primary/40 transition-all shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cash Collections</span>
                      <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                        <DollarSign className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-xl sm:text-2xl font-extrabold text-primary tracking-tight mt-1.5">
                      ETB {data.finances.totalCollections.toLocaleString()}
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Reconciled Cash</span>
                    <span className="font-semibold text-primary">{data.finances.collectionRatePct}% Inflow</span>
                  </div>
                </Card>

                {/* Accounts Receivable */}
                <Card className="border-border/80 bg-card p-4 flex flex-col justify-between hover:border-rose-500/40 transition-all shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Receivables (AR)</span>
                      <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-600">
                        <Clock className="w-4 h-4" />
                      </div>
                    </div>
                    <p className={cn(
                      'text-xl sm:text-2xl font-extrabold tracking-tight mt-1.5',
                      data.finances.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
                    )}>
                      ETB {data.finances.outstandingBalance.toLocaleString()}
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Credit: ETB {data.finances.creditExposure.toLocaleString()}</span>
                    <span className={cn('font-semibold', data.finances.creditUtilizationPct >= 85 ? 'text-rose-600' : 'text-muted-foreground')}>
                      {data.finances.creditUtilizationPct}% Limit
                    </span>
                  </div>
                </Card>

                {/* Factory Production */}
                <Card className="border-border/80 bg-card p-4 flex flex-col justify-between hover:border-indigo-500/40 transition-all shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Factory Output</span>
                      <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-600">
                        <ScanLine className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-xl sm:text-2xl font-extrabold text-indigo-600 tracking-tight mt-1.5">
                      {data.production.producedThisMonth.toLocaleString()} units
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Today: {data.production.producedToday}</span>
                    <span className="font-semibold text-indigo-600">Peak: {data.production.peakHour}</span>
                  </div>
                </Card>
              </div>

              {/* 2. Top 4 Executive Snapshot Highlights */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.snapshots.slice(0, 4).map((snap) => (
                  <div
                    key={snap.id}
                    className="p-3 rounded-xl border border-border/70 bg-card/70 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-bold uppercase">
                        <span>{snap.title}</span>
                        {snap.badge && (
                          <span className="px-1.5 py-0.2 rounded bg-muted text-foreground text-[9px] font-semibold border border-border/60">
                            {snap.badge}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-foreground truncate mt-1" title={snap.name}>
                        {snap.name}
                      </h4>
                    </div>
                    <p className="text-sm font-extrabold text-foreground mt-2">
                      {snap.metric}
                    </p>
                  </div>
                ))}
              </div>

              {/* 3. Main Split Grid: Left 2/3 (Trends & Leaderboards), Right 1/3 (Insights & AR Health) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left 2/3: Commercial Trends Chart & Compact Leaderboards */}
                <div className="lg:col-span-2 space-y-5">
                  {/* Revenue Trend Area Chart */}
                  <Card className="border-border/80 bg-card shadow-xs">
                    <CardHeader className="p-4 border-b border-border/80 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                          Commercial Inflows & Volume Trajectory
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Daily/weekly transaction volume plotted across the active timeframe.
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setActivePillar('trends')} className="h-7 text-xs font-semibold gap-1">
                        <span>Full Trends</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={data.salesTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="cleanExecGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                            <XAxis dataKey="periodLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                            <YAxis
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={11}
                              tickLine={false}
                              tickFormatter={(v) => `ETB ${(v / 1000).toFixed(0)}k`}
                            />
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const d = payload[0].payload;
                                  return (
                                    <div className="bg-popover border border-border p-2 rounded-lg shadow-md text-xs">
                                      <p className="font-bold text-foreground mb-0.5">{d.periodLabel}</p>
                                      <p className="text-emerald-600 font-semibold">ETB {d.revenue.toLocaleString()}</p>
                                      <p className="text-muted-foreground">{d.ordersCount} orders</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#cleanExecGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Dual Compact Leaderboards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Top 5 Customers */}
                    <Card className="border-border/80 bg-card shadow-xs flex flex-col justify-between">
                      <CardHeader className="p-3.5 pb-2 border-b border-border/40 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-primary" />
                          Top Accounts
                        </CardTitle>
                        <button
                          onClick={() => setActivePillar('customers')}
                          className="text-[11px] font-semibold text-primary hover:underline"
                        >
                          View All ({data.customers.length})
                        </button>
                      </CardHeader>
                      <CardContent className="p-0 divide-y divide-border/40">
                        {topCustomersSample.map((c, i) => (
                          <div key={c.id} className="p-2.5 px-3.5 flex items-center justify-between text-xs hover:bg-muted/20 transition-colors">
                            <div className="truncate pr-2">
                              <span className="font-bold text-foreground truncate block">{i + 1}. {c.name}</span>
                              <span className="text-[10px] text-muted-foreground">{c.totalOrders} orders • {c.city || 'Addis Ababa'}</span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-extrabold text-foreground text-xs block">
                                ETB {c.totalRevenue.toLocaleString()}
                              </span>
                              <span className={cn('text-[9px] font-bold px-1.5 py-0.2 rounded border inline-block mt-0.5',
                                c.outstandingBalance > 0 ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              )}>
                                {c.outstandingBalance > 0 ? 'Debt Pending' : 'Paid Up'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Top 5 Products */}
                    <Card className="border-border/80 bg-card shadow-xs flex flex-col justify-between">
                      <CardHeader className="p-3.5 pb-2 border-b border-border/40 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-primary" />
                          Top Products by Revenue
                        </CardTitle>
                        <button
                          onClick={() => setActivePillar('products')}
                          className="text-[11px] font-semibold text-primary hover:underline"
                        >
                          View All ({data.products.length})
                        </button>
                      </CardHeader>
                      <CardContent className="p-0 divide-y divide-border/40">
                        {topProductsSample.map((p, i) => (
                          <div key={p.id} className="p-2.5 px-3.5 flex items-center justify-between text-xs hover:bg-muted/20 transition-colors">
                            <div className="truncate pr-2">
                              <span className="font-bold text-foreground truncate block">{i + 1}. {p.name}</span>
                              <span className="text-[10px] text-muted-foreground">{p.unitsSold.toLocaleString()} units sold • {p.sku}</span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-extrabold text-foreground text-xs block">
                                ETB {p.revenue.toLocaleString()}
                              </span>
                              <span className={cn('text-[9px] font-semibold inline-block mt-0.5',
                                p.currentStock === 0 ? 'text-rose-600 font-bold' : p.currentStock <= 25 ? 'text-amber-600' : 'text-muted-foreground'
                              )}>
                                {p.currentStock} in stock
                              </span>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Right 1/3: Smart Recommendations & Financial Health Summary */}
                <div className="space-y-4">
                  {/* Executive Action Recommendations */}
                  <Card className="border-border/80 bg-card shadow-xs">
                    <CardHeader className="p-3.5 pb-2 border-b border-border/40 flex items-center justify-between">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Executive Intelligence Alerts
                      </CardTitle>
                      <span className="text-[10px] text-muted-foreground font-semibold">Live System Checks</span>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2.5">
                      {data.recommendations.slice(0, 3).map((rec) => (
                        <div key={rec.id} className="p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-foreground truncate">{rec.title}</span>
                            <span className={cn(
                              'text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase',
                              rec.priority === 'critical' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'
                            )}>
                              {rec.priority}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {rec.message}
                          </p>
                          <div className="pt-1 flex items-center justify-between text-[10px]">
                            <strong className="text-foreground">{rec.metric}</strong>
                            <Link href={rec.actionUrl} className="text-primary font-semibold hover:underline flex items-center gap-0.5">
                              <span>Action</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* AR Aging Mini Breakdown */}
                  <Card className="border-border/80 bg-card shadow-xs">
                    <CardHeader className="p-3.5 pb-2 border-b border-border/40 flex items-center justify-between">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-primary" />
                        AR Aging & Cash Split
                      </CardTitle>
                      <button onClick={() => setActivePillar('finances')} className="text-[11px] font-semibold text-primary hover:underline">
                        Details
                      </button>
                    </CardHeader>
                    <CardContent className="p-3 space-y-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Cash vs Credit:</span>
                          <span className="font-semibold text-foreground">{data.finances.cashVsCreditRatio.cashPct}% Cash / {data.finances.cashVsCreditRatio.creditPct}% Credit</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex">
                          <div className="bg-emerald-500 h-full" style={{ width: `${data.finances.cashVsCreditRatio.cashPct}%` }} />
                          <div className="bg-amber-500 h-full" style={{ width: `${data.finances.cashVsCreditRatio.creditPct}%` }} />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                        <div className="p-1.5 rounded bg-muted/20 border border-border/40">
                          <span className="text-muted-foreground block">Current</span>
                          <strong className="text-emerald-600 block mt-0.5">ETB {data.finances.arAging.current.toLocaleString()}</strong>
                        </div>
                        <div className="p-1.5 rounded bg-muted/20 border border-border/40">
                          <span className="text-muted-foreground block">1-30d</span>
                          <strong className="text-blue-600 block mt-0.5">ETB {data.finances.arAging.days1To30.toLocaleString()}</strong>
                        </div>
                        <div className="p-1.5 rounded bg-muted/20 border border-border/40">
                          <span className="text-muted-foreground block">31d+</span>
                          <strong className="text-rose-600 block mt-0.5">
                            ETB {(data.finances.arAging.days31To60 + data.finances.arAging.days61To90 + data.finances.arAging.days90Plus).toLocaleString()}
                          </strong>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Facilities Quick Pulse */}
                  <Card className="border-border/80 bg-card shadow-xs">
                    <CardHeader className="p-3.5 pb-2 border-b border-border/40 flex items-center justify-between">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                        Storage & Floor Pulse
                      </CardTitle>
                      <button onClick={() => setActivePillar('operations')} className="text-[11px] font-semibold text-primary hover:underline">
                        Operations
                      </button>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2 text-xs">
                      {data.warehouses.map((w) => (
                        <div key={w.id} className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground">{w.name}</span>
                          <div className="text-right">
                            <span className="font-bold text-foreground">{w.totalStockUnits.toLocaleString()} units</span>
                            <span className="text-[10px] text-muted-foreground block">{w.utilizationPct}% cap</span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              PILLAR 2: CUSTOMERS (Full Dedicated View)
          ═══════════════════════════════════════════════════════════════ */}
          {activePillar === 'customers' && (
            <CustomerIntelligence customers={data.customers} />
          )}

          {/* ═══════════════════════════════════════════════════════════════
              PILLAR 3: PRODUCTS & SKUS (Full Dedicated View)
          ═══════════════════════════════════════════════════════════════ */}
          {activePillar === 'products' && (
            <ProductIntelligence products={data.products} />
          )}

          {/* ═══════════════════════════════════════════════════════════════
              PILLAR 4: SALES TRENDS (Full Recharts Interactive Suite)
          ═══════════════════════════════════════════════════════════════ */}
          {activePillar === 'trends' && (
            <SalesTrends salesTrends={data.salesTrends} />
          )}

          {/* ═══════════════════════════════════════════════════════════════
              PILLAR 5: FINANCE & AR AGING
          ═══════════════════════════════════════════════════════════════ */}
          {activePillar === 'finances' && (
            <FinancialIntelligence finances={data.finances} />
          )}

          {/* ═══════════════════════════════════════════════════════════════
              PILLAR 6: FACTORY & WAREHOUSES
          ═══════════════════════════════════════════════════════════════ */}
          {activePillar === 'operations' && (
            <div className="space-y-8">
              <ProductionIntelligence production={data.production} />
              <WarehouseIntelligence warehouses={data.warehouses} />
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              PILLAR 7: COMPARE MODE
          ═══════════════════════════════════════════════════════════════ */}
          {activePillar === 'compare' && (
            <ExecutiveCompareMode data={data} />
          )}
        </div>
      ) : null}
    </div>
  );
}
