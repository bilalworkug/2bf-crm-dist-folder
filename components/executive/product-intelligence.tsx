'use client';

import { useState, useMemo } from 'react';
import { ProductIntelligenceItem } from '@/lib/executive-intelligence/executive-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Package, Search, TrendingUp, AlertTriangle, ArrowUpDown,
  CheckCircle2, Clock, BarChart2, ShieldAlert, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductIntelligenceProps {
  products: ProductIntelligenceItem[];
}

export function ProductIntelligence({ products }: ProductIntelligenceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [products, searchTerm, selectedCategory]);

  // Rankings
  const bestSellingByVolume = [...products].sort((a, b) => b.unitsSold - a.unitsSold)[0] || null;
  const highestRevenue = [...products].sort((a, b) => b.revenue - a.revenue)[0] || null;
  const fastestMoving = [...products].sort((a, b) => b.stockVelocity - a.stockVelocity)[0] || null;
  const slowMoving = [...products].filter(p => p.currentStock > 0).sort((a, b) => a.stockVelocity - b.stockVelocity)[0] || null;
  const lowStockItems = products.filter(p => p.stockStatus === 'Low Stock');
  const stockoutItems = products.filter(p => p.stockStatus === 'Out of Stock');

  return (
    <div className="space-y-6">
      {/* ─── RANKINGS ROW ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Best Selling by Volume */}
        <Card className="border-border/80 bg-card p-3 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Best Seller (Volume)</p>
            <h4 className="text-xs font-bold text-foreground truncate mt-1" title={bestSellingByVolume?.name || 'None'}>
              {bestSellingByVolume?.name || 'None'}
            </h4>
          </div>
          <p className="text-sm font-extrabold text-primary mt-2">
            {bestSellingByVolume ? `${bestSellingByVolume.unitsSold.toLocaleString()} units` : '0 units'}
          </p>
        </Card>

        {/* Highest Revenue */}
        <Card className="border-border/80 bg-card p-3 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Highest Revenue</p>
            <h4 className="text-xs font-bold text-foreground truncate mt-1" title={highestRevenue?.name || 'None'}>
              {highestRevenue?.name || 'None'}
            </h4>
          </div>
          <p className="text-sm font-extrabold text-emerald-600 mt-2">
            ETB {highestRevenue ? highestRevenue.revenue.toLocaleString() : '0'}
          </p>
        </Card>

        {/* Fastest Moving SKU */}
        <Card className="border-border/80 bg-card p-3 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fastest Moving</p>
            <h4 className="text-xs font-bold text-foreground truncate mt-1" title={fastestMoving?.name || 'None'}>
              {fastestMoving?.name || 'None'}
            </h4>
          </div>
          <p className="text-sm font-extrabold text-indigo-600 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            {fastestMoving?.stockVelocity || 0}/day
          </p>
        </Card>

        {/* Slow Moving SKU */}
        <Card className="border-border/80 bg-card p-3 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Slow Moving</p>
            <h4 className="text-xs font-bold text-foreground truncate mt-1" title={slowMoving?.name || 'None'}>
              {slowMoving?.name || 'None'}
            </h4>
          </div>
          <p className="text-sm font-extrabold text-muted-foreground mt-2">
            {slowMoving ? `${slowMoving.stockVelocity}/day` : '0/day'}
          </p>
        </Card>

        {/* Low Stock SKUs */}
        <Card className="border-border/80 bg-card p-3 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Low Stock Alert</p>
            <h4 className="text-xs font-bold text-foreground truncate mt-1">
              {lowStockItems.length} SKUs
            </h4>
          </div>
          <p className="text-sm font-extrabold text-amber-600 mt-2 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Below safety margin
          </p>
        </Card>

        {/* Stockout SKUs */}
        <Card className="border-border/80 bg-card p-3 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Out of Stock</p>
            <h4 className="text-xs font-bold text-foreground truncate mt-1">
              {stockoutItems.length} SKUs
            </h4>
          </div>
          <p className="text-sm font-extrabold text-rose-600 mt-2 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            Zero Inventory
          </p>
        </Card>
      </div>

      {/* ─── PRODUCT PERFORMANCE TABLE ─── */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardHeader className="p-4 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              SKU Commercial Velocity & Stock Health
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live calculation of revenue, production batches, velocity burn rates, and factory returns.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {categories.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    'px-2 py-1 text-xs rounded-md font-medium transition-all',
                    selectedCategory === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/40 text-muted-foreground hover:text-foreground'
                  )}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      'px-2 py-1 text-xs rounded-md font-medium transition-all whitespace-nowrap',
                      selectedCategory === cat
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/40 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search SKU or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs bg-muted/20"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold border-b border-border/60">
                <tr>
                  <th className="py-2.5 px-3">Product / SKU</th>
                  <th className="py-2.5 px-3 text-right">Revenue</th>
                  <th className="py-2.5 px-3 text-center">Units Produced</th>
                  <th className="py-2.5 px-3 text-center">Units Sold</th>
                  <th className="py-2.5 px-3 text-center">Current Stock</th>
                  <th className="py-2.5 px-3 text-center">Velocity</th>
                  <th className="py-2.5 px-3 text-center">Runway</th>
                  <th className="py-2.5 px-3 text-center">Return Rate</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground text-xs">
                      No products found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-foreground">{p.name}</div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {p.sku} {p.category ? `• ${p.category}` : ''}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-foreground">
                        ETB {p.revenue.toLocaleString()}
                        {p.revenueGrowthPct !== 0 && (
                          <span className={cn(
                            'block text-[10px] font-normal',
                            p.revenueGrowthPct > 0 ? 'text-emerald-600' : 'text-rose-600'
                          )}>
                            {p.revenueGrowthPct > 0 ? `+${p.revenueGrowthPct}%` : `${p.revenueGrowthPct}%`}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center font-medium">
                        {p.unitsProduced.toLocaleString()}
                      </td>

                      <td className="py-2.5 px-3 text-center font-bold text-primary">
                        {p.unitsSold.toLocaleString()}
                      </td>

                      <td className="py-2.5 px-3 text-center font-bold">
                        <span className={cn(
                          p.currentStock === 0 ? 'text-rose-600' : p.currentStock <= 25 ? 'text-amber-600' : 'text-foreground'
                        )}>
                          {p.currentStock.toLocaleString()}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center font-medium">
                        {p.stockVelocity}/day
                      </td>

                      <td className="py-2.5 px-3 text-center text-muted-foreground">
                        {p.daysOfInventoryLeft >= 999 ? '∞' : `${p.daysOfInventoryLeft}d`}
                      </td>

                      <td className="py-2.5 px-3 text-center font-medium">
                        <span className={p.returnRatePct > 5 ? 'text-rose-600 font-bold' : 'text-muted-foreground'}>
                          {p.returnRatePct}%
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <span className={cn(
                          'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border',
                          p.stockStatus === 'In Stock'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : p.stockStatus === 'Low Stock'
                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                        )}>
                          {p.stockStatus}
                        </span>
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
