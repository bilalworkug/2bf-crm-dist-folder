'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Package, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ProductPerformanceRow } from '@/lib/dashboard/dashboard-types';

interface ProductLeaderboardProps {
  products: ProductPerformanceRow[];
}

export function ProductLeaderboard({ products = [] }: ProductLeaderboardProps) {
  const topProducts = [...products]
    .sort((a, b) => b.dispatched - a.dispatched)
    .slice(0, 5);

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/40">
        <div>
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Top SKU Inventory & Fulfillment
          </CardTitle>
          <CardDescription className="text-xs">
            Highest velocity finished goods and current safety levels
          </CardDescription>
        </div>
        <Link
          href="/inventory"
          className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
        >
          <span>Inventory Hub</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        {topProducts.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No product activity recorded for this period.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {topProducts.map((prod, idx) => {
              const totalFlow = prod.produced || prod.dispatched + prod.inStock || 1;
              const dispatchRate = Math.min(100, Math.round((prod.dispatched / totalFlow) * 100));
              const isLowStock = prod.inStock <= 20;

              return (
                <div
                  key={prod.productName || idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-muted-foreground">
                        0{idx + 1}
                      </span>
                      <h4 className="text-xs font-bold text-foreground truncate">
                        {prod.productName}
                      </h4>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1 pt-0.5">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Fulfillment Velocity</span>
                        <span className="font-mono font-bold text-foreground">{dispatchRate}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${dispatchRate}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stock Metrics */}
                  <div className="flex items-center gap-4 shrink-0 text-right sm:pl-4">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Dispatched</span>
                      <span className="font-mono text-xs font-bold text-primary">
                        {prod.dispatched.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">In Stock</span>
                      <span
                        className={cn(
                          'font-mono text-xs font-bold inline-flex items-center gap-1',
                          isLowStock ? 'text-amber-500' : 'text-emerald-500'
                        )}
                      >
                        {isLowStock ? (
                          <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        )}
                        {prod.inStock.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
