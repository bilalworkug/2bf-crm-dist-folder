'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  ScanLine, Package, Clock, Calendar, RefreshCw,
  BarChart3, Award, Layers
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend
} from 'recharts';
import { ExportDropdown } from '@/components/export-dropdown';
import { cn } from '@/lib/utils';
import type { UniversalFilterState } from './report-filter-bar';

interface ProductionIntelligenceReportProps {
  filters: UniversalFilterState;
}

export function ProductionIntelligenceReport({ filters }: ProductionIntelligenceReportProps) {
  const [loading, setLoading] = useState(true);
  const [skuProduction, setSkuProduction] = useState<any[]>([]);
  const [hourlyProduction, setHourlyProduction] = useState<any[]>([]);
  const [shiftStats, setShiftStats] = useState({
    morning: 0,
    afternoon: 0,
    night: 0,
    total: 0,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const start = filters.dateFrom ? `${filters.dateFrom}T00:00:00Z` : '2025-01-01T00:00:00Z';
      const end = filters.dateTo ? `${filters.dateTo}T23:59:59Z` : new Date().toISOString();

      // Query boxes created in range with product details
      const { data: boxes } = await supabase
        .from('boxes')
        .select('id, barcode, status, created_at, product:products(name, sku)')
        .gte('created_at', start)
        .lte('created_at', end)
        .limit(1000);

      const allBoxes = boxes || [];

      // 1. Group by Product SKU
      const skuMap = new Map<string, { name: string; sku: string; count: number }>();
      // 2. Group by Hour of day (0-23)
      const hoursMap = new Array(24).fill(0);
      // 3. Group by shift
      let morning = 0; // 06:00 - 14:00
      let afternoon = 0; // 14:00 - 22:00
      let night = 0; // 22:00 - 06:00

      allBoxes.forEach((b: any) => {
        const pName = b.product?.name || 'Unassigned Product';
        const pSku = b.product?.sku || 'SKU';
        const cur = skuMap.get(pName) || { name: pName, sku: pSku, count: 0 };
        cur.count += 1;
        skuMap.set(pName, cur);

        const date = new Date(b.created_at);
        const hour = date.getHours();
        hoursMap[hour] += 1;

        if (hour >= 6 && hour < 14) {
          morning += 1;
        } else if (hour >= 14 && hour < 22) {
          afternoon += 1;
        } else {
          night += 1;
        }
      });

      const sortedSku = Array.from(skuMap.values()).sort((a, b) => b.count - a.count);
      setSkuProduction(sortedSku);

      const hourChartData = hoursMap.map((val, h) => ({
        hour: `${String(h).padStart(2, '0')}:00`,
        cartons: val,
      }));
      setHourlyProduction(hourChartData);

      setShiftStats({
        morning,
        afternoon,
        night,
        total: allBoxes.length,
      });
    } catch (e) {
      console.error('Failed to load production intelligence:', e);
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
            <ScanLine className="h-5 w-5 text-primary" />
            Production Intelligence & Factory Throughput
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Factual barcode scan throughput, SKU distribution, shift metrics, and hourly velocity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportDropdown
            filenameBase="production_intelligence"
            title="2BF Production Intelligence Report"
            headers={['Product Name', 'SKU', 'Cartons Scanned', '% of Total Output']}
            rows={skuProduction.map((s) => [
              s.name,
              s.sku,
              s.count,
              shiftStats.total > 0 ? `${((s.count / shiftStats.total) * 100).toFixed(1)}%` : '0%',
            ])}
            variant="outline"
            className="h-9"
          />

          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} className="h-9 text-xs touch-press">
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Shift Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Morning Shift (06-14h)</p>
            <h3 className="text-2xl font-bold font-mono text-foreground">{shiftStats.morning.toLocaleString()}</h3>
            <p className="text-[11px] text-muted-foreground">
              {shiftStats.total > 0 ? `${((shiftStats.morning / shiftStats.total) * 100).toFixed(0)}% of output` : '0%'}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Afternoon Shift (14-22h)</p>
            <h3 className="text-2xl font-bold font-mono text-foreground">{shiftStats.afternoon.toLocaleString()}</h3>
            <p className="text-[11px] text-muted-foreground">
              {shiftStats.total > 0 ? `${((shiftStats.afternoon / shiftStats.total) * 100).toFixed(0)}% of output` : '0%'}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Night Shift (22-06h)</p>
            <h3 className="text-2xl font-bold font-mono text-foreground">{shiftStats.night.toLocaleString()}</h3>
            <p className="text-[11px] text-muted-foreground">
              {shiftStats.total > 0 ? `${((shiftStats.night / shiftStats.total) * 100).toFixed(0)}% of output` : '0%'}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80 bg-primary/5">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold text-primary">Total Output (Period)</p>
            <h3 className="text-2xl font-bold font-mono text-primary">{shiftStats.total.toLocaleString()}</h3>
            <p className="text-[11px] text-muted-foreground">Verified Unique Cartons</p>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Velocity Chart */}
      <Card className="shadow-xs border-border/80">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Production Volume by Hour of Day
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="h-[250px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyProduction}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="cartons" name="Cartons Scanned" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Production by SKU Table */}
      <Card className="shadow-xs border-border/80">
        <CardHeader className="p-4 pb-3 border-b border-border/60">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Production Output by Product SKU
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Product Name</TableHead>
                <TableHead className="text-xs">SKU Code</TableHead>
                <TableHead className="text-xs text-right">Cartons Produced</TableHead>
                <TableHead className="text-xs text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skuProduction.map((s, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-semibold text-xs py-2.5">{s.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground py-2.5">{s.sku}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-xs text-primary py-2.5">
                    {Number(s.count).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground py-2.5">
                    {shiftStats.total > 0 ? `${((s.count / shiftStats.total) * 100).toFixed(1)}%` : '0%'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
