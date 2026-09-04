'use client';

import { WarehouseIntelligenceItem } from '@/lib/executive-intelligence/executive-types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import {
  Building2, Package, AlertTriangle, ArrowRight,
  TrendingUp, Activity, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WarehouseIntelligenceProps {
  warehouses: WarehouseIntelligenceItem[];
}

export function WarehouseIntelligence({ warehouses }: WarehouseIntelligenceProps) {
  const chartData = warehouses.map((w) => ({
    name: w.name,
    stock: w.totalStockUnits,
    activity: w.activityCount,
    receipts: w.receiptsCount,
    dispatches: w.dispatchesCount,
    utilization: w.utilizationPct,
  }));

  const totalStockAll = warehouses.reduce((sum, w) => sum + w.totalStockUnits, 0);
  const totalOpsAll = warehouses.reduce((sum, w) => sum + w.activityCount, 0);
  const totalLowStock = warehouses.reduce((sum, w) => sum + w.lowStockItemsCount, 0);

  return (
    <div className="space-y-6">
      {/* ─── SUMMARY KPI STRIP ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Network Finished Goods</p>
          <p className="text-base font-extrabold text-foreground mt-1">
            {totalStockAll.toLocaleString()} units
          </p>
          <span className="text-[11px] text-muted-foreground mt-1 block">Across {warehouses.length} storage facilities</span>
        </Card>

        <Card className="border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Dock Operations (Period)</p>
          <p className="text-base font-extrabold text-primary mt-1">
            {totalOpsAll.toLocaleString()} movements
          </p>
          <span className="text-[11px] text-muted-foreground mt-1 block">Inbound receipts & dispatches</span>
        </Card>

        <Card className="border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Low Stock Alerts</p>
          <p className={cn(
            'text-base font-extrabold mt-1',
            totalLowStock > 0 ? 'text-amber-600' : 'text-emerald-600'
          )}>
            {totalLowStock} items near threshold
          </p>
          <span className="text-[11px] text-muted-foreground mt-1 block">Requires factory replenishment</span>
        </Card>

        <Card className="border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Network Capacity Utilized</p>
          <p className="text-base font-extrabold text-indigo-600 mt-1">
            {Math.round(warehouses.reduce((sum, w) => sum + w.utilizationPct, 0) / Math.max(1, warehouses.length))}%
          </p>
          <span className="text-[11px] text-muted-foreground mt-1 block">Nominal warehouse capacity</span>
        </Card>
      </div>

      {/* ─── WAREHOUSE COMPARISON CHART ─── */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardHeader className="p-4 border-b border-border/80">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Warehouse Facility Comparison: Inventory vs Operational Activity
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Compare stored units on hand against loading dock activity (receipts & dispatches).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-popover border border-border p-2.5 rounded-lg shadow-md text-xs">
                          <p className="font-bold text-foreground mb-1">{d.name}</p>
                          <p className="text-primary font-semibold">Stock on Hand: {d.stock} units</p>
                          <p className="text-indigo-600 font-semibold">Dock Operations: {d.activity} ops</p>
                          <p className="text-muted-foreground">Receipts: {d.receipts} | Dispatches: {d.dispatches}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="stock" fill="#2563eb" radius={[4, 4, 0, 0]} name="Stock Units" />
                <Bar dataKey="activity" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Dock Operations" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ─── FACILITY CARDS & STOCK DISTRIBUTION ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map((wh) => (
          <Card key={wh.id} className="border-border/80 bg-card shadow-xs flex flex-col justify-between">
            <CardHeader className="p-4 pb-2 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-primary" />
                    {wh.name}
                  </CardTitle>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Code: {wh.code} • {wh.location}
                  </span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {wh.utilizationPct}% Full
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3.5">
              {/* Core metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-md bg-muted/20 border border-border/40">
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">Stock On Hand</span>
                  <p className="font-extrabold text-foreground text-sm mt-0.5">{wh.totalStockUnits.toLocaleString()} units</p>
                </div>
                <div className="p-2 rounded-md bg-muted/20 border border-border/40">
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">Dock Throughput</span>
                  <p className="font-extrabold text-foreground text-sm mt-0.5">{wh.activityCount} dispatches/rcpts</p>
                </div>
              </div>

              {/* Fast & Slow movers */}
              <div className="space-y-1 text-xs">
                {wh.fastMovingProduct && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1 text-[11px]">
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                      Top Outbound SKU:
                    </span>
                    <strong className="text-foreground text-[11px] truncate max-w-[140px]" title={wh.fastMovingProduct.name}>
                      {wh.fastMovingProduct.name} ({wh.fastMovingProduct.units})
                    </strong>
                  </div>
                )}
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[11px]">Low Stock SKUs:</span>
                  <strong className={cn('text-[11px]', wh.lowStockItemsCount > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                    {wh.lowStockItemsCount} SKUs
                  </strong>
                </div>
              </div>

              {/* Stock distribution breakdown */}
              {wh.stockDistribution.length > 0 && (
                <div className="pt-2 border-t border-border/40">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">SKU Storage Distribution</p>
                  <div className="space-y-1.5">
                    {wh.stockDistribution.slice(0, 4).map((dist) => (
                      <div key={dist.productId} className="text-xs">
                        <div className="flex justify-between items-center text-[11px] mb-0.5">
                          <span className="truncate text-foreground font-medium max-w-[160px]">{dist.productName}</span>
                          <span className="text-muted-foreground">{dist.units} units ({dist.pctOfWarehouse}%)</span>
                        </div>
                        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${dist.pctOfWarehouse}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
