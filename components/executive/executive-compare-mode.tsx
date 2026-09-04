'use client';

import { useState, useMemo } from 'react';
import { CompleteExecutiveData } from '@/lib/executive-intelligence/executive-types';
import { compareEntities } from '@/lib/executive-intelligence/executive-data-service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeftRight, Users, Package, Building2,
  TrendingUp, TrendingDown, Minus, Crown, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecutiveCompareModeProps {
  data: CompleteExecutiveData;
}

type CompareType = 'customer' | 'product' | 'warehouse';

export function ExecutiveCompareMode({ data }: ExecutiveCompareModeProps) {
  const [compareType, setCompareType] = useState<CompareType>('customer');
  const [entityAId, setEntityAId] = useState<string>('');
  const [entityBId, setEntityBId] = useState<string>('');

  // Auto-initialize IDs when type changes or data loads
  const currentEntityA = useMemo(() => {
    if (compareType === 'customer') {
      return entityAId || data.customers[0]?.id || '';
    }
    if (compareType === 'product') {
      return entityAId || data.products[0]?.id || '';
    }
    return entityAId || data.warehouses[0]?.id || '';
  }, [compareType, entityAId, data]);

  const currentEntityB = useMemo(() => {
    if (compareType === 'customer') {
      return entityBId || data.customers[1]?.id || data.customers[0]?.id || '';
    }
    if (compareType === 'product') {
      return entityBId || data.products[1]?.id || data.products[0]?.id || '';
    }
    return entityBId || data.warehouses[1]?.id || data.warehouses[0]?.id || '';
  }, [compareType, entityBId, data]);

  // Compute comparison result
  const comparison = useMemo(() => {
    return compareEntities(compareType, currentEntityA, currentEntityB, data);
  }, [compareType, currentEntityA, currentEntityB, data]);

  return (
    <Card className="border-border/80 bg-card shadow-xs">
      <CardHeader className="p-4 border-b border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-primary" />
            Executive Compare Mode (Head-to-Head Benchmarking)
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Compare customer commercial performance, SKU velocity, or warehouse throughput side-by-side.
          </CardDescription>
        </div>

        {/* Entity Type Toggle */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
          <button
            onClick={() => {
              setCompareType('customer');
              setEntityAId('');
              setEntityBId('');
            }}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1',
              compareType === 'customer'
                ? 'bg-card text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Customer vs. Customer</span>
          </button>

          <button
            onClick={() => {
              setCompareType('product');
              setEntityAId('');
              setEntityBId('');
            }}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1',
              compareType === 'product'
                ? 'bg-card text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Product vs. Product</span>
          </button>

          <button
            onClick={() => {
              setCompareType('warehouse');
              setEntityAId('');
              setEntityBId('');
            }}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1',
              compareType === 'warehouse'
                ? 'bg-card text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Warehouse vs. Warehouse</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-5">
        {/* Entity Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-xl bg-muted/20 border border-border/60">
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase mb-1.5 block">
              Entity A (Primary)
            </label>
            <Select
              value={currentEntityA}
              onValueChange={(val) => setEntityAId(val)}
            >
              <SelectTrigger className="h-9 text-xs bg-card border-border/80 font-bold">
                <SelectValue placeholder="Select primary entity" />
              </SelectTrigger>
              <SelectContent>
                {compareType === 'customer' &&
                  data.customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} (ETB {c.totalRevenue.toLocaleString()})
                    </SelectItem>
                  ))}
                {compareType === 'product' &&
                  data.products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                {compareType === 'warehouse' &&
                  data.warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.totalStockUnits.toLocaleString()} units)
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase mb-1.5 block">
              Entity B (Benchmark)
            </label>
            <Select
              value={currentEntityB}
              onValueChange={(val) => setEntityBId(val)}
            >
              <SelectTrigger className="h-9 text-xs bg-card border-border/80 font-bold">
                <SelectValue placeholder="Select benchmark entity" />
              </SelectTrigger>
              <SelectContent>
                {compareType === 'customer' &&
                  data.customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} (ETB {c.totalRevenue.toLocaleString()})
                    </SelectItem>
                  ))}
                {compareType === 'product' &&
                  data.products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                {compareType === 'warehouse' &&
                  data.warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.totalStockUnits.toLocaleString()} units)
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Head-to-Head Comparison Table */}
        <div className="border border-border/60 rounded-xl overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground text-[11px] font-bold border-b border-border/60">
              <tr>
                <th className="p-3 w-1/3">Benchmark Metric</th>
                <th className="p-3 text-center w-1/3">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="font-extrabold text-foreground text-xs">{comparison.titleA}</span>
                    <Badge variant="outline" className="text-[10px]">A</Badge>
                  </div>
                </th>
                <th className="p-3 text-center w-1/3">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="font-extrabold text-foreground text-xs">{comparison.titleB}</span>
                    <Badge variant="outline" className="text-[10px]">B</Badge>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {comparison.metrics.map((row) => {
                const isWinnerA = row.winner === 'A';
                const isWinnerB = row.winner === 'B';

                return (
                  <tr key={row.label} className="hover:bg-muted/20">
                    <td className="p-3 font-semibold text-foreground">
                      {row.label}
                    </td>

                    <td className={cn(
                      'p-3 text-center transition-colors',
                      isWinnerA ? 'bg-emerald-500/5 font-extrabold text-emerald-700 dark:text-emerald-400' : 'text-foreground'
                    )}>
                      <div className="flex items-center justify-center gap-1.5">
                        {isWinnerA && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        <span>{row.formattedA}</span>
                      </div>
                    </td>

                    <td className={cn(
                      'p-3 text-center transition-colors',
                      isWinnerB ? 'bg-emerald-500/5 font-extrabold text-emerald-700 dark:text-emerald-400' : 'text-foreground'
                    )}>
                      <div className="flex items-center justify-center gap-1.5">
                        {isWinnerB && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        <span>{row.formattedB}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
