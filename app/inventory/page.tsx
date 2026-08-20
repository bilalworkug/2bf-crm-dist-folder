'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Product, Warehouse } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { ExportDropdown } from '@/components/export-dropdown';
import { Boxes, PackageCheck, Truck, Undo2, Search, Download } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface InventoryRow {
  product: Product;
  warehouse: Warehouse | null;
  total_physical: number;
  available: number;
  allocated: number;
  dispatched: number;
  damaged: number;
  expired: number;
  returned: number;
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const { profile } = useAuth();

  const isWarehouseUser = profile?.role === 'warehouse';
  const isSalesUser = profile?.role === 'sales';

  useEffect(() => {
    if (!profile) return;
    
    (async () => {
      // 1. Fetch data
      const [{ data: prods }, { data: whs }, { data: boxes }] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('warehouses').select('*').order('code'),
        supabase.from('boxes').select('product_id, current_warehouse_id, status')
      ]);

      setProducts(prods ?? []);
      
      // Filter warehouses for Warehouse User
      let availableWarehouses = whs ?? [];
      if (isWarehouseUser && profile.warehouse_id) {
        availableWarehouses = availableWarehouses.filter(w => w.id === profile.warehouse_id);
      }
      setWarehouses(availableWarehouses);

      const map = new Map<string, InventoryRow>();
      const key = (pId: string, wId: string | null) => `${pId}|${wId ?? 'null'}`;

      const prodMap = new Map((prods ?? []).map(p => [p.id, p]));
      const whMap = new Map(availableWarehouses.map(w => [w.id, w]));

      for (const b of (boxes ?? [])) {
        if (!b.current_warehouse_id) continue;
        
        // Skip boxes not in allowed warehouses
        if (isWarehouseUser && b.current_warehouse_id !== profile.warehouse_id) continue;
        
        const k = key(b.product_id, b.current_warehouse_id);
        if (!map.has(k)) {
          map.set(k, {
            product: prodMap.get(b.product_id) as Product,
            warehouse: whMap.get(b.current_warehouse_id) as Warehouse,
            total_physical: 0, available: 0, allocated: 0, dispatched: 0, damaged: 0, expired: 0, returned: 0
          });
        }
        const row = map.get(k)!;
        
        if (!row.warehouse) continue; // Skip if warehouse wasn't in allowed list (should be caught above)

        row.total_physical++;
        
        switch (b.status) {
          case 'in_warehouse':
          case 'returned':
            row.available++;
            break;
          case 'allocated':
            row.allocated++;
            break;
          case 'damaged':
            row.damaged++;
            break;
          case 'expired':
            row.expired++;
            break;
        }
      }

      // Sales users shouldn't see dispatched info as it's not "Available Stock"
      if (!isSalesUser) {
        const { data: dispatches } = await supabase.from('dispatches').select('product_id, warehouse_id, quantity');
        for (const d of (dispatches ?? [])) {
          if (isWarehouseUser && d.warehouse_id !== profile.warehouse_id) continue;
          
          const k = key(d.product_id, d.warehouse_id);
          if (!map.has(k)) {
            map.set(k, {
              product: prodMap.get(d.product_id) as Product,
              warehouse: whMap.get(d.warehouse_id) as Warehouse,
              total_physical: 0, available: 0, allocated: 0, dispatched: 0, damaged: 0, expired: 0, returned: 0
            });
          }
          const row = map.get(k)!;
          if (row.warehouse) {
            row.dispatched += d.quantity;
          }
        }
      }

      setRows(Array.from(map.values()).sort((a, b) => a.product.name.localeCompare(b.product.name)));
      setLoading(false);
    })();
  }, [profile, isWarehouseUser, isSalesUser]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (warehouseFilter !== 'all' && r.warehouse?.id !== warehouseFilter) return false;
      if (productFilter !== 'all' && r.product.id !== productFilter) return false;
      if (!q) return true;
      return r.product.name.toLowerCase().includes(q) || r.product.sku?.toLowerCase().includes(q) || r.warehouse?.code.toLowerCase().includes(q);
    });
  }, [rows, search, warehouseFilter, productFilter]);

  const totals = filtered.reduce(
    (acc, r) => ({
      total_physical: acc.total_physical + r.total_physical,
      available: acc.available + r.available,
      allocated: acc.allocated + r.allocated,
      dispatched: acc.dispatched + r.dispatched,
      damaged: acc.damaged + r.damaged,
      expired: acc.expired + r.expired,
      returned: acc.returned + r.returned,
    }),
    { total_physical: 0, available: 0, allocated: 0, dispatched: 0, damaged: 0, expired: 0, returned: 0 }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description={isSalesUser ? "Available stock across all warehouses." : "Strict physical stock tracking."}
        actions={
          <ExportDropdown
            filenameBase="inventory"
            title="Inventory Report"
            headers={isSalesUser ? ['Product', 'Warehouse', 'Available'] : ['Product', 'Warehouse', 'Total Physical', 'Available', 'Allocated', 'Dispatched', 'Damaged', 'Expired']}
            rows={filtered.map((r) => isSalesUser ? [r.product.name, r.warehouse?.code ?? '', r.available] : [r.product.name, r.warehouse?.code ?? '', r.total_physical, r.available, r.allocated, r.dispatched, r.damaged, r.expired])}
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available for Sale" value={totals.available} icon={PackageCheck} accent="success" hint={!isSalesUser ? "in_warehouse + good returns" : undefined} />
        {!isSalesUser && (
          <>
            <StatCard label="Allocated (Pending Dispatch)" value={totals.allocated} icon={Boxes} accent="primary" />
            <StatCard label="Dispatched" value={totals.dispatched} icon={Truck} accent="warning" />
            <StatCard label="Damaged / Expired" value={totals.damaged + totals.expired} icon={Undo2} accent="destructive" />
          </>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by product, SKU, or warehouse..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="All products" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter} disabled={isWarehouseUser}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All warehouses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All warehouses</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No inventory found" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  {!isSalesUser && <TableHead className="text-center text-primary">Physical Total</TableHead>}
                  <TableHead className="text-center text-green-600">Available</TableHead>
                  {!isSalesUser && (
                    <>
                      <TableHead className="text-center text-blue-600">Allocated</TableHead>
                      <TableHead className="text-center text-orange-500">Dispatched</TableHead>
                      <TableHead className="text-center text-red-600">Damaged</TableHead>
                      <TableHead className="text-center text-red-600">Expired</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.product.name}</TableCell>
                    <TableCell>{r.warehouse?.code ?? '—'}</TableCell>
                    {!isSalesUser && <TableCell className="text-center font-bold text-primary">{r.total_physical}</TableCell>}
                    <TableCell className="text-center font-bold text-green-600">{r.available}</TableCell>
                    {!isSalesUser && (
                      <>
                        <TableCell className="text-center font-bold text-blue-600">{r.allocated}</TableCell>
                        <TableCell className="text-center text-orange-500">{r.dispatched}</TableCell>
                        <TableCell className="text-center text-red-600">{r.damaged}</TableCell>
                        <TableCell className="text-center text-red-600">{r.expired}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-bold">
                  <TableCell>Totals</TableCell>
                  <TableCell />
                  {!isSalesUser && <TableCell className="text-center text-primary">{totals.total_physical}</TableCell>}
                  <TableCell className="text-center text-green-600">{totals.available}</TableCell>
                  {!isSalesUser && (
                    <>
                      <TableCell className="text-center text-blue-600">{totals.allocated}</TableCell>
                      <TableCell className="text-center text-orange-500">{totals.dispatched}</TableCell>
                      <TableCell className="text-center text-red-600">{totals.damaged}</TableCell>
                      <TableCell className="text-center text-red-600">{totals.expired}</TableCell>
                    </>
                  )}
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
