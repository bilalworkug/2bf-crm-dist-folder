'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';
import { formatMoney } from '@/lib/format';
import { TrendingUp, BarChart3, Activity } from 'lucide-react';

interface DashboardChartsProps {
  ordersList: any[];
  totalProduced?: number;
  totalDispatched?: number;
}

export function DashboardCharts({ ordersList = [], totalProduced = 0, totalDispatched = 0 }: DashboardChartsProps) {
  // Compute daily revenue & cash collections trend
  const financialTrendData = useMemo(() => {
    if (!ordersList || ordersList.length === 0) {
      // Fallback sample trend points if order list is empty
      const today = new Date();
      return Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (6 - i));
        return {
          date: d.toLocaleDateString('en-US', { weekday: 'short' }),
          revenue: 0,
          collections: 0,
        };
      });
    }

    const map: Record<string, { date: string; revenue: number; collections: number }> = {};

    // Sort chronologically
    const sorted = [...ordersList].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    for (const ord of sorted) {
      const d = new Date(ord.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!map[d]) {
        map[d] = { date: d, revenue: 0, collections: 0 };
      }
      map[d].revenue += Number(ord.total_amount || 0);
      map[d].collections += Number(ord.paid_amount || 0);
    }

    const entries = Object.values(map);
    return entries.length > 10 ? entries.slice(-10) : entries;
  }, [ordersList]);

  // Compute factory operational volume (Orders placed vs loaded dispatches)
  const throughputData = useMemo(() => {
    if (!ordersList || ordersList.length === 0) {
      const today = new Date();
      return Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (6 - i));
        return {
          date: d.toLocaleDateString('en-US', { weekday: 'short' }),
          ordersPlaced: 0,
          fulfilled: 0,
        };
      });
    }

    const map: Record<string, { date: string; ordersPlaced: number; fulfilled: number }> = {};

    for (const ord of ordersList) {
      const d = new Date(ord.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!map[d]) {
        map[d] = { date: d, ordersPlaced: 0, fulfilled: 0 };
      }
      map[d].ordersPlaced += 1;
      if (['dispatched', 'handed_over', 'completed'].includes(ord.status?.toLowerCase())) {
        map[d].fulfilled += 1;
      }
    }

    const entries = Object.values(map);
    return entries.length > 7 ? entries.slice(-7) : entries;
  }, [ordersList]);

  const customMoneyTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="rounded-lg border border-border bg-card p-2.5 shadow-md text-xs space-y-1">
        <p className="font-bold text-foreground pb-1 border-b border-border/60">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}:
            </span>
            <span className="font-mono font-bold text-foreground">
              {formatMoney(entry.value)} ETB
            </span>
          </div>
        ))}
      </div>
    );
  };

  const customCountTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="rounded-lg border border-border bg-card p-2.5 shadow-md text-xs space-y-1">
        <p className="font-bold text-foreground pb-1 border-b border-border/60">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}:
            </span>
            <span className="font-mono font-bold text-foreground">
              {entry.value} orders
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ─── CHART 1: REVENUE VELOCITY (AREA CHART) ─── */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-2 flex flex-row items-center justify-between border-b border-border/40">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Revenue & Collections Velocity
            </CardTitle>
            <CardDescription className="text-xs">
              Daily sales booked vs cash inflows
            </CardDescription>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20">
            Cash Inflows
          </span>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financialTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorCollections" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <RechartsTooltip content={customMoneyTooltip} />
                <Legend
                  verticalAlign="top"
                  height={32}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', top: -4 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Sales Revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
                <Area
                  type="monotone"
                  dataKey="collections"
                  name="Cash Collected"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCollections)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ─── CHART 2: FACTORY THROUGHPUT (GROUPED BAR CHART) ─── */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-2 flex flex-row items-center justify-between border-b border-border/40">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-500" />
              Order Intake vs Gate Fulfillment Throughput
            </CardTitle>
            <CardDescription className="text-xs">
              Daily customer demand vs dispatched & handed over orders
            </CardDescription>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 font-bold border border-indigo-500/20">
            Factory Throughput
          </span>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={throughputData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  allowDecimals={false}
                />
                <RechartsTooltip content={customCountTooltip} />
                <Legend
                  verticalAlign="top"
                  height={32}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', top: -4 }}
                />
                <Bar
                  dataKey="ordersPlaced"
                  name="Orders Placed"
                  fill="#818cf8"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="fulfilled"
                  name="Orders Fulfilled"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
