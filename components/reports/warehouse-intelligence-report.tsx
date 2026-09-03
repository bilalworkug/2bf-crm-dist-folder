'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Boxes, Package, TrendingUp, AlertTriangle,
  RefreshCw, Building2, ShieldAlert, CheckCircle2
} from 'lucide-react';
import { ExportDropdown } from '@/components/export-dropdown';
import { cn } from '@/lib/utils';
import type { UniversalFilterState } from './report-filter-bar';

interface WarehouseIntelligenceReportProps {
  filters: UniversalFilterState;
}

export function WarehouseIntelligenceReport({ filters }: WarehouseIntelligenceReportProps) {
  const [loading, setLoading] = useState(true);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [productsRes, boxesRes, whRes] = await Promise.all([
        supabase.from('products').select('id, name, sku, active'),
        supabase.from('boxes').select('id, product_id, warehouse_id, status'),
        supabase.from('warehouses').select('id, name, code'),
      ]);

      const products = productsRes.data || [];
      const boxes = boxesRes.data || [];
      const whs = whRes.data || [];

      // Compute inventory counts per product
      const stockMap = new Map<string, {
        id: string;
        name: string;
        sku: string;
        total: number;
        inWarehouse: number;
        dispatched: number;
        delivered: number;
      }>();

      products.forEach((p) => {
        stockMap.set(p.id, {
          id: p.id,
          name: p.name,
          sku: p.sku || 'SKU',
          total: 0,
          inWarehouse: 0,
          dispatched: 0,
          delivered: 0,
        });
      });

      boxes.forEach((b: any) => {
        if (!b.product_id) return;
        const cur = stockMap.get(b.product_id);
        if (cur) {
          cur.total += 1;
          if (b.status === 'in_warehouse' || b.status === 'received') cur.inWarehouse += 1;
          if (b.status === 'dispatched') cur.dispatched += 1;
          if (b.status === 'delivered') cur.delivered += 1;
        }
      });

      const list = Array.from(stockMap.values()).sort((a, b) => b.inWarehouse - a.inWarehouse);
      setStockItems(list);
      setWarehouses(whs);
    } catch (e) {
      console.error('Failed to load warehouse intelligence:', e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalStockOnHand = stockItems.reduce((acc, i) => acc + i.inWarehouse, 0);
  const lowStockCount = stockItems.filter((i) => i.inWarehouse > 0 && i.inWarehouse < 50).length;
  const stockoutCount = stockItems.filter((i) => i.inWarehouse === 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-4 rounded-2xl border border-border/80">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            Warehouse Intelligence & Inventory Velocity
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Physical stock on-hand, fast vs slow moving SKUs, and stockout vulnerability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportDropdown
            filenameBase="warehouse_intelligence"
            title="2BF Warehouse Intelligence Report"
            headers={['Product Name', 'SKU', 'Available Stock (Cartons)', 'Dispatched', 'Delivered', 'Health Status']}
            rows={stockItems.map((s) => [
              s.name,
              s.sku,
              s.inWarehouse,
              s.dispatched,
              s.delivered,
              s.inWarehouse === 0 ? 'STOCKOUT' : s.inWarehouse < 50 ? 'LOW STOCK' : 'HEALTHY',
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

      {/* Capacity & Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="shadow-xs border-border/80 bg-primary/5">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold text-primary">Total Stock On-Hand</p>
            <h3 className="text-2xl font-bold font-mono text-primary">{totalStockOnHand.toLocaleString()}</h3>
            <p className="text-[11px] text-muted-foreground">Cartons In Warehouse</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Active Warehouses</p>
            <h3 className="text-2xl font-bold font-mono text-foreground">{warehouses.length}</h3>
            <p className="text-[11px] text-muted-foreground">Storage Locations</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Low Stock Warnings</p>
            <h3 className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">{lowStockCount}</h3>
            <p className="text-[11px] text-muted-foreground">SKUs &lt; 50 cartons</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">Critical Stockouts</p>
            <h3 className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">{stockoutCount}</h3>
            <p className="text-[11px] text-muted-foreground">SKUs with 0 cartons</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Health Matrix */}
      <Card className="shadow-xs border-border/80">
        <CardHeader className="p-4 pb-3 border-b border-border/60">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Inventory Stock & Velocity Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Product SKU</TableHead>
                <TableHead className="text-xs text-right">On-Hand Stock</TableHead>
                <TableHead className="text-xs text-right">In Transit (Dispatched)</TableHead>
                <TableHead className="text-xs text-right">Delivered to Customers</TableHead>
                <TableHead className="text-xs text-center">Health Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockItems.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-semibold text-xs py-2.5">
                    <div>
                      <span className="text-foreground">{item.name}</span>
                      <span className="text-muted-foreground font-mono text-[10px] block">{item.sku}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-xs py-2.5">
                    {Number(item.inWarehouse).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground py-2.5">
                    {Number(item.dispatched).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold py-2.5">
                    {Number(item.delivered).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center py-2.5">
                    {item.inWarehouse === 0 ? (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                        Stockout
                      </span>
                    ) : item.inWarehouse < 50 ? (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Low Stock
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Healthy
                      </span>
                    )}
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
