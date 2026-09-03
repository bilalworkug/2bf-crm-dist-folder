'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Users, Package, TrendingUp, DollarSign,
  ShoppingCart, RefreshCw, BarChart2, Award
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend
} from 'recharts';
import { ExportDropdown } from '@/components/export-dropdown';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { UniversalFilterState } from './report-filter-bar';

interface SalesIntelligenceReportProps {
  filters: UniversalFilterState;
}

export function SalesIntelligenceReport({ filters }: SalesIntelligenceReportProps) {
  const [loading, setLoading] = useState(true);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [productPerformance, setProductPerformance] = useState<any[]>([]);
  const [salesTrend, setSalesTrend] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const start = filters.dateFrom ? `${filters.dateFrom}T00:00:00Z` : '2025-01-01T00:00:00Z';
      const end = filters.dateTo ? `${filters.dateTo}T23:59:59Z` : new Date().toISOString();

      const [ordersRes, itemsRes, returnsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, customer_id, total_amount, paid_amount, created_at, customer:customers(customer_name, company_name)')
          .gte('created_at', start)
          .lte('created_at', end),
        supabase
          .from('order_items')
          .select('id, order_id, product_id, quantity, unit_price, subtotal, product:products(name)')
          .limit(500),
        supabase
          .from('returns')
          .select('id, product_id, quantity')
          .limit(200),
      ]);

      const orders = ordersRes.data || [];
      const items = itemsRes.data || [];
      const returns = returnsRes.data || [];

      // 1. Group by Customer
      const customerMap = new Map<string, { name: string; revenue: number; orders: number; debt: number }>();
      orders.forEach((o: any) => {
        const cName = o.customer?.company_name || o.customer?.customer_name || 'Individual Customer';
        const current = customerMap.get(cName) || { name: cName, revenue: 0, orders: 0, debt: 0 };
        current.revenue += Number(o.total_amount || 0);
        current.orders += 1;
        current.debt += Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0));
        customerMap.set(cName, current);
      });

      const sortedCustomers = Array.from(customerMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8);
      setTopCustomers(sortedCustomers);

      // 2. Group by Product
      const productMap = new Map<string, { name: string; units: number; revenue: number; returns: number }>();
      items.forEach((it: any) => {
        const pName = it.product?.name || 'Unassigned SKU';
        const current = productMap.get(pName) || { name: pName, units: 0, revenue: 0, returns: 0 };
        current.units += Number(it.quantity || 0);
        current.revenue += Number(it.subtotal || (it.quantity * it.unit_price) || 0);
        productMap.set(pName, current);
      });

      // Attach returns
      returns.forEach((r: any) => {
        // If returns have product attached
        const current = productMap.get(r.product_id) || Array.from(productMap.values())[0];
        if (current) {
          current.returns += Number(r.quantity || 1);
        }
      });

      const sortedProducts = Array.from(productMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8);
      setProductPerformance(sortedProducts);

      // 3. Sales Trend by date
      const dateMap = new Map<string, { date: string; revenue: number; orders: number }>();
      orders.forEach((o: any) => {
        const d = o.created_at.slice(0, 10);
        const cur = dateMap.get(d) || { date: d, revenue: 0, orders: 0 };
        cur.revenue += Number(o.total_amount || 0);
        cur.orders += 1;
        dateMap.set(d, cur);
      });

      const trendData = Array.from(dateMap.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14);
      setSalesTrend(trendData);
    } catch (e) {
      console.error('Failed to load sales intelligence:', e);
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
            <BarChart2 className="h-5 w-5 text-primary" />
            Sales Intelligence & Performance
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Customer leaderboard, SKU profitability ranking, and revenue trajectory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportDropdown
            filenameBase="sales_intelligence"
            title="2BF Sales Intelligence Report"
            headers={['Customer Name', 'Total Orders', 'Revenue (ETB)', 'Outstanding Debt (ETB)']}
            rows={topCustomers.map((c) => [c.name, c.orders, formatMoney(c.revenue), formatMoney(c.debt)])}
            variant="outline"
            className="h-9"
          />

          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} className="h-9 text-xs touch-press">
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      <Card className="shadow-xs border-border/80">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            Revenue & Order Trajectory
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="h-[260px] w-full mt-2">
            {salesTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No sales data recorded in this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="revenue" name="Revenue (ETB)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Two Tables Grid: Top Customers & Product Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Customers */}
        <Card className="shadow-xs border-border/80">
          <CardHeader className="p-4 pb-3 border-b border-border/60 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              Top Customers by Revenue
            </CardTitle>
            <span className="text-xs text-muted-foreground font-mono">Ranked</span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Customer</TableHead>
                  <TableHead className="text-xs text-center">Orders</TableHead>
                  <TableHead className="text-xs text-right">Revenue</TableHead>
                  <TableHead className="text-xs text-right">Debt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers.map((c, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold text-xs py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                          {idx + 1}
                        </span>
                        <span className="truncate max-w-[150px]">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs py-2.5">{c.orders}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-primary py-2.5">
                      {formatMoney(c.revenue)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-rose-600 font-semibold py-2.5">
                      {formatMoney(c.debt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Product Performance */}
        <Card className="shadow-xs border-border/80">
          <CardHeader className="p-4 pb-3 border-b border-border/60 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Product Performance Matrix
            </CardTitle>
            <span className="text-xs text-muted-foreground font-mono">Top SKUs</span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Product SKU</TableHead>
                  <TableHead className="text-xs text-center">Units Sold</TableHead>
                  <TableHead className="text-xs text-right">Revenue</TableHead>
                  <TableHead className="text-xs text-right">Returns</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productPerformance.map((p, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold text-xs py-2.5">
                      <span className="truncate max-w-[160px] block">{p.name}</span>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs py-2.5 font-bold">
                      {Number(p.units).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-primary py-2.5">
                      {formatMoney(p.revenue)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-amber-600 font-semibold py-2.5">
                      {p.returns}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
