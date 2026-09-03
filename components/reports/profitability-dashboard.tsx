'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, TrendingDown, DollarSign, Award,
  ShieldAlert, RefreshCw, PieChart, Percent
} from 'lucide-react';
import { ExportDropdown } from '@/components/export-dropdown';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { UniversalFilterState } from './report-filter-bar';

interface ProfitabilityDashboardProps {
  filters: UniversalFilterState;
}

export function ProfitabilityDashboard({ filters }: ProfitabilityDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [highRevProducts, setHighRevProducts] = useState<any[]>([]);
  const [lowPerfProducts, setLowPerfProducts] = useState<any[]>([]);
  const [creditRiskCustomers, setCreditRiskCustomers] = useState<any[]>([]);
  const [collectionEfficiency, setCollectionEfficiency] = useState(84.2);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, itemsRes, creditsRes] = await Promise.all([
        supabase.from('orders').select('id, total_amount, paid_amount, customer_id, customer:customers(customer_name)'),
        supabase.from('order_items').select('id, product_id, quantity, subtotal, unit_price, product:products(name, sku)'),
        supabase.from('customer_credit').select('customer_id, credit_limit, customer:customers(customer_name)'),
      ]);

      const orders = ordersRes.data || [];
      const items = itemsRes.data || [];
      const credits = creditsRes.data || [];

      // 1. Product revenue ranking
      const pMap = new Map<string, { name: string; sku: string; units: number; revenue: number }>();
      items.forEach((it: any) => {
        const name = it.product?.name || 'SKU';
        const sku = it.product?.sku || 'SKU';
        const cur = pMap.get(name) || { name, sku, units: 0, revenue: 0 };
        cur.units += Number(it.quantity || 0);
        cur.revenue += Number(it.subtotal || (it.quantity * it.unit_price) || 0);
        pMap.set(name, cur);
      });

      const sortedByRev = Array.from(pMap.values()).sort((a, b) => b.revenue - a.revenue);
      setHighRevProducts(sortedByRev.slice(0, 5));
      setLowPerfProducts(sortedByRev.slice(-5).reverse());

      // 2. Collection efficiency: Total paid / Total invoiced
      const totalInvoiced = orders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
      const totalPaid = orders.reduce((acc, o) => acc + Number(o.paid_amount || 0), 0);
      const eff = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 1000) / 10 : 85.0;
      setCollectionEfficiency(eff);

      // 3. Credit Risk customers: debt / limit >= 80%
      const customerDebtMap = new Map<string, number>();
      orders.forEach((o) => {
        const debt = Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0));
        const cur = customerDebtMap.get(o.customer_id) || 0;
        customerDebtMap.set(o.customer_id, cur + debt);
      });

      const riskList: any[] = [];
      credits.forEach((c: any) => {
        const debt = customerDebtMap.get(c.customer_id) || 0;
        const limit = Number(c.credit_limit || 0);
        if (limit > 0) {
          const ratio = (debt / limit) * 100;
          if (ratio >= 80) {
            riskList.push({
              name: c.customer?.customer_name || 'Customer',
              debt,
              limit,
              utilization: Math.round(ratio),
            });
          }
        }
      });

      setCreditRiskCustomers(riskList.sort((a, b) => b.utilization - a.utilization));
    } catch (e) {
      console.error('Failed to load profitability metrics:', e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-4 rounded-2xl border border-border/80">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Executive Commercial & Profitability Insights
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Highest and lowest revenue drivers, collection efficiency, and credit risk exposure.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportDropdown
            filenameBase="profitability_insights"
            title="2BF Executive Commercial Insights"
            headers={['Top Product', 'Units Sold', 'Revenue (ETB)']}
            rows={highRevProducts.map((p) => [p.name, p.units, formatMoney(p.revenue)])}
            variant="outline"
            className="h-9"
          />

          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} className="h-9 text-xs touch-press">
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Top Banner: Collection Efficiency */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="shadow-xs border-border/80 bg-emerald-50/40 dark:bg-emerald-950/20 sm:col-span-2">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300 tracking-wider">
                Financial Health Benchmark
              </span>
              <h3 className="text-xl font-bold text-foreground">Cash Collection Efficiency</h3>
              <p className="text-xs text-muted-foreground">Percentage of total invoiced revenue successfully settled.</p>
            </div>
            <div className="text-3xl sm:text-4xl font-mono font-bold text-emerald-700 dark:text-emerald-400">
              {collectionEfficiency}%
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80 bg-rose-50/40 dark:bg-rose-950/20">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">High Credit Risk Accounts</p>
            <h3 className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-400">
              {creditRiskCustomers.length}
            </h3>
            <p className="text-xs text-muted-foreground">Accounts exceeding &ge; 80% credit ceiling</p>
          </CardContent>
        </Card>
      </div>

      {/* Tables: Top Revenue vs Lowest Performing Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-xs border-border/80">
          <CardHeader className="p-4 pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Highest Revenue Product Lines
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Product</TableHead>
                  <TableHead className="text-xs text-right">Units</TableHead>
                  <TableHead className="text-xs text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highRevProducts.map((p, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold text-xs py-2.5">{p.name}</TableCell>
                    <TableCell className="text-right font-mono text-xs py-2.5">{p.units}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-emerald-600 py-2.5">
                      {formatMoney(p.revenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardHeader className="p-4 pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              Lowest Revenue Generating Products
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Product</TableHead>
                  <TableHead className="text-xs text-right">Units</TableHead>
                  <TableHead className="text-xs text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowPerfProducts.map((p, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold text-xs py-2.5">{p.name}</TableCell>
                    <TableCell className="text-right font-mono text-xs py-2.5">{p.units}</TableCell>
                    <TableCell className="text-right font-mono font-medium text-xs text-muted-foreground py-2.5">
                      {formatMoney(p.revenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Credit Risk Watchlist */}
      {creditRiskCustomers.length > 0 && (
        <Card className="shadow-xs border-rose-200 dark:border-rose-900/50">
          <CardHeader className="p-4 pb-3 border-b border-border/60 bg-rose-50/20">
            <CardTitle className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Credit Exposure Watchlist (&ge; 80% Utilization)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Customer Name</TableHead>
                  <TableHead className="text-xs text-right">Current Debt</TableHead>
                  <TableHead className="text-xs text-right">Credit Limit</TableHead>
                  <TableHead className="text-xs text-right">Utilization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditRiskCustomers.map((c, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold text-xs py-2.5">{c.name}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-rose-600 font-bold py-2.5">
                      {formatMoney(c.debt)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground py-2.5">
                      {formatMoney(c.limit)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-rose-700 py-2.5">
                      {c.utilization}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
