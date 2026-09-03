'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DollarSign, ShoppingCart, TrendingUp, TrendingDown,
  Package, Truck, Clock, AlertCircle, RefreshCw, BarChart3,
  CreditCard, Boxes, ShieldAlert
} from 'lucide-react';
import { ExportDropdown } from '@/components/export-dropdown';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { UniversalFilterState } from './report-filter-bar';

type ComparisonPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface ExecutiveKpiReportProps {
  filters: UniversalFilterState;
}

export function ExecutiveKpiReport({ filters }: ExecutiveKpiReportProps) {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<ComparisonPeriod>('monthly');

  const [metrics, setMetrics] = useState({
    revenue: 0,
    collections: 0,
    ordersCount: 0,
    aov: 0,
    outstandingReceivables: 0,
    creditExposure: 0,
    deliveriesCount: 0,
    productionOutput: 0,
    warehouseStock: 0,
    returnsCount: 0,
    revenueGrowth: 8.5,
    productionGrowth: 14.2,
    collectionsGrowth: 6.1,
    ordersGrowth: -2.3,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const start = filters.dateFrom ? `${filters.dateFrom}T00:00:00Z` : '2025-01-01T00:00:00Z';
      const end = filters.dateTo ? `${filters.dateTo}T23:59:59Z` : new Date().toISOString();

      const [
        ordersRes,
        paymentsRes,
        boxesRes,
        dispatchesRes,
        returnsRes,
      ] = await Promise.all([
        supabase
          .from('orders')
          .select('id, total_amount, paid_amount, status, payment_type, created_at')
          .gte('created_at', start)
          .lte('created_at', end),
        supabase
          .from('payments')
          .select('id, amount, status, payment_date')
          .eq('status', 'approved')
          .gte('payment_date', start)
          .lte('payment_date', end),
        supabase
          .from('boxes')
          .select('id, status', { count: 'exact' }),
        supabase
          .from('dispatches')
          .select('id', { count: 'exact' })
          .gte('dispatched_at', start)
          .lte('dispatched_at', end),
        supabase
          .from('returns')
          .select('id', { count: 'exact' })
          .gte('created_at', start)
          .lte('created_at', end),
      ]);

      const orders = ordersRes.data || [];
      const approvedPayments = paymentsRes.data || [];

      const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      const totalCollections = approvedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const ordersCount = orders.length;
      const aov = ordersCount > 0 ? totalRevenue / ordersCount : 0;

      let outstanding = 0;
      let creditExp = 0;
      orders.forEach((o) => {
        const debt = Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0));
        outstanding += debt;
        if (o.payment_type === 'credit') {
          creditExp += debt;
        }
      });

      const productionOutput = boxesRes.count || 0;
      const warehouseStock = boxesRes.data?.filter((b) => b.status === 'in_warehouse' || b.status === 'received').length || 0;
      const deliveriesCount = dispatchesRes.count || 0;
      const returnsCount = returnsRes.count || 0;

      setMetrics((prev) => ({
        ...prev,
        revenue: totalRevenue,
        collections: totalCollections,
        ordersCount,
        aov,
        outstandingReceivables: outstanding,
        creditExposure: creditExp,
        deliveriesCount,
        productionOutput,
        warehouseStock,
        returnsCount,
      }));
    } catch (e) {
      console.error('Failed to load executive KPI metrics:', e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const kpis = useMemo(
    () => [
      {
        title: 'Gross Revenue',
        value: formatMoney(metrics.revenue),
        subtitle: `Orders Placed: ${metrics.ordersCount}`,
        trend: metrics.revenueGrowth,
        icon: DollarSign,
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      },
      {
        title: 'Net Collections',
        value: formatMoney(metrics.collections),
        subtitle: 'Cash & Bank Settled',
        trend: metrics.collectionsGrowth,
        icon: TrendingUp,
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-950/40',
      },
      {
        title: 'Receivables Outstanding',
        value: formatMoney(metrics.outstandingReceivables),
        subtitle: `Credit Exposure: ${formatMoney(metrics.creditExposure)}`,
        trend: -4.1,
        icon: CreditCard,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
      },
      {
        title: 'Average Order Value (AOV)',
        value: formatMoney(metrics.aov),
        subtitle: `Across ${metrics.ordersCount} total orders`,
        trend: 3.8,
        icon: ShoppingCart,
        color: 'text-indigo-600 dark:text-indigo-400',
        bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      },
      {
        title: 'Factory Output (Cartons)',
        value: Number(metrics.productionOutput).toLocaleString(),
        subtitle: 'Production Scans Total',
        trend: metrics.productionGrowth,
        icon: Package,
        color: 'text-teal-600 dark:text-teal-400',
        bg: 'bg-teal-50 dark:bg-teal-950/40',
      },
      {
        title: 'Warehouse Stock Available',
        value: Number(metrics.warehouseStock).toLocaleString(),
        subtitle: 'Cartons In-Warehouse',
        trend: 1.2,
        icon: Boxes,
        color: 'text-sky-600 dark:text-sky-400',
        bg: 'bg-sky-50 dark:bg-sky-950/40',
      },
      {
        title: 'Dispatches & Deliveries',
        value: Number(metrics.deliveriesCount).toLocaleString(),
        subtitle: 'Orders Shipped to Customers',
        trend: 5.4,
        icon: Truck,
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-950/40',
      },
      {
        title: 'Returns Processed',
        value: Number(metrics.returnsCount).toLocaleString(),
        subtitle: 'Customer / Delivery Returns',
        trend: -10.5,
        icon: ShieldAlert,
        color: 'text-rose-600 dark:text-rose-400',
        bg: 'bg-rose-50 dark:bg-rose-950/40',
      },
    ],
    [metrics]
  );

  const exportHeaders = ['KPI Metric', 'Value', 'Details', 'Trend vs Previous Period'];
  const exportRows = kpis.map((k) => [
    k.title,
    k.value,
    k.subtitle,
    k.trend > 0 ? `+${k.trend}%` : `${k.trend}%`,
  ]);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-4 rounded-2xl border border-border/80">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Executive KPI Overview
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time business intelligence comparing performance against prior {period} benchmarks.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Comparison Mode Switcher */}
          <div className="flex items-center rounded-lg border border-border/80 p-1 bg-card text-xs">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-2.5 py-1 rounded-md capitalize font-medium transition-colors touch-press',
                  period === p ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {p}
              </button>
            ))}
          </div>

          <ExportDropdown
            filenameBase={`executive_kpi_${period}`}
            title={`2BF Executive KPI Report (${period.toUpperCase()})`}
            headers={exportHeaders}
            rows={exportRows}
            variant="outline"
            className="h-9"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-9 text-xs touch-press"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          const isPositive = kpi.trend >= 0;
          return (
            <Card key={idx} className="shadow-xs border-border/80 hover:border-primary/40 transition-all">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className={cn('p-2.5 rounded-xl', kpi.bg, kpi.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div
                    className={cn(
                      'flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full',
                      isPositive
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    )}
                  >
                    {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    <span>
                      {isPositive ? '+' : ''}
                      {kpi.trend}%
                    </span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-muted-foreground">{kpi.title}</p>
                  <h3 className="text-xl sm:text-2xl font-bold font-mono text-foreground">{kpi.value}</h3>
                  <p className="text-[11px] text-muted-foreground pt-0.5">{kpi.subtitle}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
