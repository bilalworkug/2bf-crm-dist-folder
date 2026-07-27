'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Product, Warehouse, WarehouseReceipt, Dispatch, ReturnRecord } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { Boxes, PackageCheck, Truck, Undo2, Search } from 'lucide-react';

interface InventoryRow {
  product: Product;
  warehouse: Warehouse | null;
  received: number;
  dispatched: number;
  available: number;
  returned: number;
  damaged: number;
  expired: number;
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const [{ data: prods }, { data: whs }, { data: receipts }, { data: dispatches }, { data: returns }] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('warehouses').select('*').order('code'),
        supabase.from('warehouse_receipts').select('*, product:products(*), warehouse:warehouses(*)'),
        supabase.from('dispatches').select('*, product:products(*), warehouse:warehouses(*)'),
        supabase.from('returns').select('*, product:products(*), warehouse:warehouses(*)'),
      ]);

      setProducts(prods ?? []);
      setWarehouses(whs ?? []);

      const receiptList = (receipts ?? []) as (WarehouseReceipt & { product?: Product; warehouse?: Warehouse })[];
      const dispatchList = (dispatches ?? []) as (Dispatch & { product?: Product; warehouse?: Warehouse })[];
      const returnList = (returns ?? []) as (ReturnRecord & { product?: Product; warehouse?: Warehouse })[];

      const map = new Map<string, InventoryRow>();
      const key = (pId: string, wId: string) => `${pId}|${wId ?? 'null'}`;

      for (const r of receiptList) {
        const k = key(r.product_id, r.warehouse_id);
        const row = map.get(k) ?? { product: r.product!, warehouse: r.warehouse ?? null, received: 0, dispatched: 0, available: 0, returned: 0, damaged: 0, expired: 0 };
        row.received += r.quantity;
        row.available += r.quantity;
        map.set(k, row);
      }
      for (const d of dispatchList) {
        const k = key(d.product_id, d.warehouse_id);
        const row = map.get(k);
        if (row) {
          row.dispatched += d.quantity;
          row.available -= d.quantity;
        }
      }
      for (const ret of returnList) {
        if (!ret.product_id) continue;
        const k = key(ret.product_id, ret.warehouse_id ?? 'null');
        const row = map.get(k) ?? { product: ret.product!, warehouse: ret.warehouse ?? null, received: 0, dispatched: 0, available: 0, returned: 0, damaged: 0, expired: 0 };
        if (ret.return_type === 'returned') row.returned += ret.quantity;
        if (ret.return_type === 'damaged') row.damaged += ret.quantity;
        if (ret.return_type === 'expired') row.expired += ret.quantity;
        row.available -= ret.quantity;
        map.set(k, row);
      }

      setRows(Array.from(map.values()).sort((a, b) => a.product.name.localeCompare(b.product.name)));
      setLoading(false);
    })();
  }, []);

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
      received: acc.received + r.received,
      dispatched: acc.dispatched + r.dispatched,
      available: acc.available + r.available,
      returned: acc.returned + r.returned,
      damaged: acc.damaged + r.damaged,
      expired: acc.expired + r.expired,
    }),
    { received: 0, dispatched: 0, available: 0, returned: 0, damaged: 0, expired: 0 }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Stock levels by product and warehouse, with status breakdown."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available stock" value={totals.available} icon={Boxes} accent="success" />
        <StatCard label="Received stock" value={totals.received} icon={PackageCheck} accent="primary" />
        <StatCard label="Dispatched" value={totals.dispatched} icon={Truck} accent="warning" />
        <StatCard label="Returned / damaged / expired" value={totals.returned + totals.damaged + totals.expired} icon={Undo2} accent="destructive" />
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
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
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
                  <TableHead className="text-center">Received</TableHead>
                  <TableHead className="text-center">Dispatched</TableHead>
                  <TableHead className="text-center">Available</TableHead>
                  <TableHead className="text-center">Returned</TableHead>
                  <TableHead className="text-center">Damaged</TableHead>
                  <TableHead className="text-center">Expired</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.product.name}</TableCell>
                    <TableCell>{r.warehouse?.code ?? '—'}</TableCell>
                    <TableCell className="text-center">{r.received}</TableCell>
                    <TableCell className="text-center">{r.dispatched}</TableCell>
                    <TableCell className="text-center font-bold">{r.available}</TableCell>
                    <TableCell className="text-center text-amber-600 dark:text-amber-400">{r.returned}</TableCell>
                    <TableCell className="text-center text-red-600 dark:text-red-400">{r.damaged}</TableCell>
                    <TableCell className="text-center text-red-600 dark:text-red-400">{r.expired}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-bold">
                  <TableCell>Totals</TableCell>
                  <TableCell />
                  <TableCell className="text-center">{totals.received}</TableCell>
                  <TableCell className="text-center">{totals.dispatched}</TableCell>
                  <TableCell className="text-center">{totals.available}</TableCell>
                  <TableCell className="text-center">{totals.returned}</TableCell>
                  <TableCell className="text-center">{totals.damaged}</TableCell>
                  <TableCell className="text-center">{totals.expired}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
