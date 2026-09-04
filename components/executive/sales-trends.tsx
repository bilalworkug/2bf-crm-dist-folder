'use client';

import { useState, useMemo } from 'react';
import { SalesTrendDataPoint } from '@/lib/executive-intelligence/executive-types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { TrendingUp, BarChart3, Users, DollarSign, Activity } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

interface SalesTrendsProps {
  salesTrends: SalesTrendDataPoint[];
}

type ChartMetric = 'revenue' | 'orders' | 'aov' | 'customers';

export function SalesTrends({ salesTrends }: SalesTrendsProps) {
  const [metric, setMetric] = useState<ChartMetric>('revenue');

  // Overall totals for this trend view
  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalOrders = 0;
    let totalNew = 0;
    let totalRepeat = 0;

    for (const point of salesTrends) {
      totalRevenue += point.revenue;
      totalOrders += point.ordersCount;
      totalNew += point.newCustomersCount;
      totalRepeat += point.repeatCustomersCount;
    }

    const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    return { totalRevenue, totalOrders, aov, totalNew, totalRepeat };
  }, [salesTrends]);

  return (
    <Card className="border-border/80 bg-card shadow-xs">
      <CardHeader className="p-4 border-b border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Executive Sales & Commercial Trends
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Interactive multi-dimensional performance tracking across periods.
          </CardDescription>
        </div>

        {/* Metric Switcher Controls */}
        <div className="flex flex-wrap items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border/60">
          <button
            onClick={() => setMetric('revenue')}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1',
              metric === 'revenue'
                ? 'bg-card text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <DollarSign className="w-3 h-3 text-emerald-600" />
            <span>Revenue</span>
          </button>

          <button
            onClick={() => setMetric('orders')}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1',
              metric === 'orders'
                ? 'bg-card text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <BarChart3 className="w-3 h-3 text-primary" />
            <span>Orders</span>
          </button>

          <button
            onClick={() => setMetric('aov')}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1',
              metric === 'aov'
                ? 'bg-card text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Activity className="w-3 h-3 text-indigo-600" />
            <span>AOV</span>
          </button>

          <button
            onClick={() => setMetric('customers')}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1',
              metric === 'customers'
                ? 'bg-card text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Users className="w-3 h-3 text-purple-600" />
            <span>New vs Repeat</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
          <div className="p-2.5 rounded-lg bg-muted/20 border border-border/60">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Period Revenue</p>
            <p className="text-sm font-extrabold text-foreground mt-0.5">
              ETB {summary.totalRevenue.toLocaleString()}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/20 border border-border/60">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Order Volume</p>
            <p className="text-sm font-extrabold text-foreground mt-0.5">
              {summary.totalOrders} orders
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/20 border border-border/60">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Average Ticket</p>
            <p className="text-sm font-extrabold text-foreground mt-0.5">
              ETB {summary.aov.toLocaleString()}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/20 border border-border/60">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Customer Split</p>
            <p className="text-sm font-extrabold text-foreground mt-0.5">
              {summary.totalNew} New / {summary.totalRepeat} Repeat
            </p>
          </div>
        </div>

        {/* Dynamic Chart Container */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {metric === 'revenue' ? (
              <AreaChart data={salesTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="execRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="periodLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `ETB ${(val / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as SalesTrendDataPoint;
                      return (
                        <div className="bg-popover border border-border p-2.5 rounded-lg shadow-md text-xs">
                          <p className="font-bold text-foreground mb-1">{d.periodLabel}</p>
                          <p className="text-emerald-600 font-semibold">Revenue: ETB {d.revenue.toLocaleString()}</p>
                          <p className="text-muted-foreground">Orders: {d.ordersCount}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#execRevenueGrad)"
                  name="Revenue"
                />
              </AreaChart>
            ) : metric === 'orders' ? (
              <BarChart data={salesTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="periodLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as SalesTrendDataPoint;
                      return (
                        <div className="bg-popover border border-border p-2.5 rounded-lg shadow-md text-xs">
                          <p className="font-bold text-foreground mb-1">{d.periodLabel}</p>
                          <p className="text-primary font-semibold">Orders: {d.ordersCount}</p>
                          <p className="text-muted-foreground">Revenue: ETB {d.revenue.toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="ordersCount" fill="#2563eb" radius={[4, 4, 0, 0]} name="Orders" />
              </BarChart>
            ) : metric === 'aov' ? (
              <LineChart data={salesTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="periodLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `ETB ${(val / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as SalesTrendDataPoint;
                      return (
                        <div className="bg-popover border border-border p-2.5 rounded-lg shadow-md text-xs">
                          <p className="font-bold text-foreground mb-1">{d.periodLabel}</p>
                          <p className="text-indigo-600 font-semibold">Avg Order: ETB {d.averageOrderValue.toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="averageOrderValue"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#6366f1' }}
                  name="Average Order Value"
                />
              </LineChart>
            ) : (
              <BarChart data={salesTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="periodLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as SalesTrendDataPoint;
                      return (
                        <div className="bg-popover border border-border p-2.5 rounded-lg shadow-md text-xs">
                          <p className="font-bold text-foreground mb-1">{d.periodLabel}</p>
                          <p className="text-emerald-600 font-semibold">New Customers: {d.newCustomersCount}</p>
                          <p className="text-purple-600 font-semibold">Repeat Customers: {d.repeatCustomersCount}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="newCustomersCount" stackId="cust" fill="#10b981" radius={[0, 0, 0, 0]} name="New Customers" />
                <Bar dataKey="repeatCustomersCount" stackId="cust" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Repeat Customers" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
