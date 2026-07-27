'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { ProductionScan, WarehouseReceipt, Dispatch, Order, ReturnRecord, Product, Warehouse } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { BarChart3, ScanLine, PackageCheck, Truck, ShoppingCart, Undo2, Download, X } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { toast } from 'sonner';
import { formatDateShort } from '@/lib/format';

const CHART_COLORS = ['hsl(32 80% 50%)', 'hsl(173 58% 39%)', 'hsl(197 50% 44%)', 'hsl(142 60% 45%)', 'hsl(25 85% 55%)', 'hsl(280 50% 50%)'];

const PRESETS = [
  { label: 'Today Production', action: 'production' },
  { label: 'Warehouse 2 Stock', action: 'warehouse2' },
  { label: 'This Week Orders', action: 'week-orders' },
];

export default function ReportsPage() {
  const [scans, setScans] = useState<ProductionScan[]>([]);
  const [receipts, setReceipts] = useState<WarehouseReceipt[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const [s, r, d, o, ret, p, w] = await Promise.all([
        supabase.from('production_scans').select('*'),
        supabase.from('warehouse_receipts').select('*'),
        supabase.from('dispatches').select('*'),
        supabase.from('orders').select('*'),
        supabase.from('returns').select('*'),
        supabase.from('products').select('*'),
        supabase.from('warehouses').select('*'),
      ]);
      setScans((s.data ?? []) as ProductionScan[]);
      setReceipts((r.data ?? []) as WarehouseReceipt[]);
      setDispatches((d.data ?? []) as Dispatch[]);
      setOrders((o.data ?? []) as Order[]);
      setReturns((ret.data ?? []) as ReturnRecord[]);
      setProducts((p.data ?? []) as Product[]);
      setWarehouses((w.data ?? []) as Warehouse[]);
      setLoading(false);
    })();
  }, []);

  const inDateRange = (iso: string) => {
    const d = new Date(iso);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  };

  const filteredScans = scans.filter((s) => inDateRange(s.scanned_at));
  const filteredReceipts = receipts.filter((r) => inDateRange(r.received_at) && (warehouseFilter === 'all' || r.warehouse_id === warehouseFilter));
  const filteredDispatches = dispatches.filter((d) => inDateRange(d.dispatched_at) && (warehouseFilter === 'all' || d.warehouse_id === warehouseFilter));
  const filteredOrders = orders.filter((o) => inDateRange(o.created_at));
  const filteredReturns = returns.filter((r) => inDateRange(r.processed_at) && (warehouseFilter === 'all' || r.warehouse_id === warehouseFilter));

  // Production by product
  const productionByProduct = useMemo(() => {
    const map = new Map<string, number>();
    filteredScans.forEach((s) => {
      const name = products.find((p) => p.id === s.product_id)?.name ?? 'Unknown';
      map.set(name, (map.get(name) ?? 0) + s.quantity);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredScans, products]);

  // Stock by warehouse
  const stockByWarehouse = useMemo(() => {
    const map = new Map<string, number>();
    filteredReceipts.forEach((r) => {
      const code = warehouses.find((w) => w.id === r.warehouse_id)?.code ?? '—';
      map.set(code, (map.get(code) ?? 0) + r.quantity);
    });
    filteredDispatches.forEach((d) => {
      const code = warehouses.find((w) => w.id === d.warehouse_id)?.code ?? '—';
      map.set(code, (map.get(code) ?? 0) - d.quantity);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredReceipts, filteredDispatches, warehouses]);

  // Orders by status
  const ordersByStatus = useMemo(() => {
    const map = new Map<string, number>();
    filteredOrders.forEach((o) => {
      map.set(o.status, (map.get(o.status) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  // Daily activity (last 7 days)
  const dailyActivity = useMemo(() => {
    const days: { date: string; scans: number; receipts: number; dispatches: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayLabel = formatDateShort(d.toISOString());
      days.push({
        date: dayLabel,
        scans: scans.filter((s) => new Date(s.scanned_at) >= d && new Date(s.scanned_at) < next).length,
        receipts: receipts.filter((r) => new Date(r.received_at) >= d && new Date(r.received_at) < next).length,
        dispatches: dispatches.filter((dp) => new Date(dp.dispatched_at) >= d && new Date(dp.dispatched_at) < next).length,
      });
    }
    return days;
  }, [scans, receipts, dispatches]);

  function applyPreset(preset: string) {
    const today = new Date().toISOString().slice(0, 10);
    if (preset === 'production') {
      setDateFrom(today);
      setDateTo(today);
      setWarehouseFilter('all');
      toast.info('Applied: Today Production');
    } else if (preset === 'warehouse2') {
      const wh2 = warehouses.find((w) => w.code === 'WH2');
      setWarehouseFilter(wh2?.id ?? 'all');
      setDateFrom('');
      setDateTo('');
      toast.info('Applied: Warehouse 2 Stock');
    } else if (preset === 'week-orders') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      setDateFrom(weekAgo.toISOString().slice(0, 10));
      setDateTo(today);
      toast.info('Applied: This Week Orders');
    }
  }

  function clearFilters() {
    setDateFrom('');
    setDateTo('');
    setWarehouseFilter('all');
    setProductFilter('all');
  }

  function exportCsv() {
    const rows = [
      ['Metric', 'Value'],
      ['Production scans', String(filteredScans.length)],
      ['Warehouse receipts', String(filteredReceipts.length)],
      ['Dispatches', String(filteredDispatches.length)],
      ['Orders', String(filteredOrders.length)],
      ['Returns', String(filteredReturns.length)],
    ];
    productionByProduct.forEach((p) => rows.push([`Production: ${p.name}`, String(p.value)]));
    stockByWarehouse.forEach((w) => rows.push([`Stock: ${w.name}`, String(w.value)]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `2bf-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  }

  const hasFilters = dateFrom || dateTo || warehouseFilter !== 'all' || productFilter !== 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Operational reports with filters and export."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        }
      />

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">From date</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full lg:w-44" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">To date</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full lg:w-44" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Warehouse</label>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All warehouses</SelectItem>
                  {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Product</label>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="w-full lg:w-48"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All products</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {hasFilters && (
              <Button variant="ghost" onClick={clearFilters} className="shrink-0">
                <X className="mr-1.5 h-4 w-4" /> Clear
              </Button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs font-medium text-muted-foreground">Presets:</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.action)}
                className="rounded-full border bg-card px-3 py-1 text-xs font-medium transition-colors hover:bg-accent"
              >
                {p.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Production scans" value={filteredScans.length} icon={ScanLine} accent="primary" />
        <StatCard label="Warehouse receipts" value={filteredReceipts.length} icon={PackageCheck} accent="success" />
        <StatCard label="Dispatches" value={filteredDispatches.length} icon={Truck} accent="warning" />
        <StatCard label="Orders" value={filteredOrders.length} icon={ShoppingCart} accent="neutral" />
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" /> Daily activity (7 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={dailyActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="scans" stroke="hsl(32 80% 50%)" name="Scans" strokeWidth={2} />
                  <Line type="monotone" dataKey="receipts" stroke="hsl(142 60% 45%)" name="Receipts" strokeWidth={2} />
                  <Line type="monotone" dataKey="dispatches" stroke="hsl(197 50% 44%)" name="Dispatches" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" /> Production by product
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={productionByProduct} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="hsl(32 80% 50%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" /> Stock by warehouse
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stockByWarehouse}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="hsl(142 60% 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" /> Orders by status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={ordersByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={{ fontSize: 11 }}>
                    {ordersByStatus.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Undo2 className="h-4 w-4 text-primary" /> Returns summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{filteredReturns.filter((r) => r.return_type === 'returned').length}</p>
              <p className="text-xs text-muted-foreground">Returned</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{filteredReturns.filter((r) => r.return_type === 'damaged').length}</p>
              <p className="text-xs text-muted-foreground">Damaged</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-red-700 dark:text-red-500">{filteredReturns.filter((r) => r.return_type === 'expired').length}</p>
              <p className="text-xs text-muted-foreground">Expired</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
