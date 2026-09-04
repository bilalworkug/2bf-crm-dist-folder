'use client';

import { ProductionIntelligenceData } from '@/lib/executive-intelligence/executive-types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  ScanLine, Clock, Award, TrendingUp, Sun, Sunset, Moon, Activity
} from 'lucide-react';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface ProductionIntelligenceProps {
  production: ProductionIntelligenceData;
}

export function ProductionIntelligence({ production }: ProductionIntelligenceProps) {
  return (
    <div className="space-y-6">
      {/* ─── OUTPUT VOLUME CARDS ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Production Today</p>
          <p className="text-lg font-extrabold text-foreground mt-1">
            {production.producedToday.toLocaleString()} units
          </p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Floor scans since midnight</span>
        </Card>

        <Card className="border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Production This Week</p>
          <p className="text-lg font-extrabold text-primary mt-1">
            {production.producedThisWeek.toLocaleString()} units
          </p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Last 7 operational days</span>
        </Card>

        <Card className="border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Production This Month</p>
          <p className="text-lg font-extrabold text-indigo-600 mt-1">
            {production.producedThisMonth.toLocaleString()} units
          </p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Month-to-date output</span>
        </Card>

        <Card className="border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Last 6 Months</p>
          <p className="text-lg font-extrabold text-emerald-600 mt-1">
            {production.producedLast6Months.toLocaleString()} units
          </p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Rolling manufacturing volume</span>
        </Card>
      </div>

      {/* ─── HOURLY SCAN DISTRIBUTION & TIME BLOCKS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hourly Chart */}
        <Card className="border-border/80 bg-card shadow-xs lg:col-span-2">
          <CardHeader className="p-4 border-b border-border/80 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Hourly Factory Throughput & Peak Velocity
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Carton barcode scans logged by floor operators throughout the workday.
              </CardDescription>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Peak Hour</span>
              <span className="text-xs font-extrabold text-primary">
                {production.peakHour} ({production.peakHourVolume} units)
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={production.hourlyProduction} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="hourLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border p-2.5 rounded-lg shadow-md text-xs">
                            <p className="font-bold text-foreground mb-1">{d.hourLabel}</p>
                            <p className="text-primary font-semibold">Units Produced: {d.volume}</p>
                            <p className="text-muted-foreground">Scan Events: {d.count}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="volume" fill="#10b981" radius={[4, 4, 0, 0]} name="Units" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Operational Time Blocks */}
        <Card className="border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <CardHeader className="p-4 border-b border-border/80">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              Operational Time Blocks
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Factory throughput share by working window.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {production.timeBlocks.map((tb, idx) => {
              const Icon = idx === 0 ? Sun : idx === 1 ? Sunset : Moon;
              const colorClass = idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-orange-500' : 'text-indigo-400';
              return (
                <div key={tb.blockName} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold flex items-center gap-1.5 text-foreground">
                      <Icon className={cn('w-4 h-4', colorClass)} />
                      {tb.blockName}
                    </span>
                    <span className="font-bold text-foreground">
                      {tb.units.toLocaleString()} units ({tb.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-orange-500' : 'bg-indigo-500')}
                      style={{ width: `${tb.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ─── OPERATOR THROUGHPUT RANKINGS ─── */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardHeader className="p-4 border-b border-border/80">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            Floor Operator Throughput Rankings
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Individual throughput derived directly from verified production barcode scan history.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold border-b border-border/60">
                <tr>
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Operator Name</th>
                  <th className="py-2.5 px-3 text-center">Total Output (Units)</th>
                  <th className="py-2.5 px-3 text-center">Scan Events</th>
                  <th className="py-2.5 px-3">Last Floor Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {production.operatorRankings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      No operator scans recorded in this period.
                    </td>
                  </tr>
                ) : (
                  production.operatorRankings.map((op, idx) => (
                    <tr key={op.operatorId} className="hover:bg-muted/20">
                      <td className="py-2.5 px-3 font-bold text-muted-foreground">
                        #{idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        {op.operatorName}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-primary">
                        {op.scannedUnits.toLocaleString()} units
                      </td>
                      <td className="py-2.5 px-3 text-center text-muted-foreground">
                        {op.scannedCartonsCount} scans
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {formatDate(op.lastActive)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
