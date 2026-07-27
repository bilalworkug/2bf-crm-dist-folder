'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Order, Customer, Profile, Warehouse, Product, OrderItem } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { ShoppingCart, Plus, Search, Clock, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDateShort, formatMoney } from '@/lib/format';
import { ORDER_STATUSES } from '@/lib/types';

export default function OrdersPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<(Order & { customer?: Customer; sales_person?: Profile | null })[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: '',
    notes: '',
    items: [{ product_id: '', quantity: 1, unit_price: 0, warehouse_id: '' }],
  });

  const canEdit = profile && ['admin', 'sales', 'dispatch', 'accounts', 'manager'].includes(profile.role);

  useEffect(() => {
    load();
    (async () => {
      const [{ data: c }, { data: p }, { data: w }] = await Promise.all([
        supabase.from('customers').select('*').order('customer_name'),
        supabase.from('products').select('*').order('name'),
        supabase.from('warehouses').select('*').order('code'),
      ]);
      setCustomers(c ?? []);
      setProducts(p ?? []);
      setWarehouses(w ?? []);
    })();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, customer:customers(*), sales_person:profiles!orders_sales_person_id_fkey(*)')
      .order('created_at', { ascending: false });
    setOrders((data ?? []) as (Order & { customer?: Customer; sales_person?: Profile | null })[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer?.customer_name.toLowerCase().includes(q) ||
        o.customer?.company_name?.toLowerCase().includes(q)
      );
    });
  }, [orders, search, statusFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id) {
      toast.error('Select a customer');
      return;
    }
    if (!form.items[0].product_id) {
      toast.error('Add at least one product');
      return;
    }

    const orderNum = `ORD-2025-${String(Date.now()).slice(-4)}`;
    const total = form.items.reduce((s, it) => s + it.quantity * it.unit_price, 0);

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        order_number: orderNum,
        customer_id: form.customer_id,
        status: 'pending',
        notes: form.notes,
        sales_person_id: profile?.id,
        total_amount: total,
        paid_amount: 0,
      })
      .select()
      .single();

    if (orderErr) {
      toast.error(orderErr.message);
      return;
    }

    const items = form.items
      .filter((it) => it.product_id)
      .map((it) => ({
        order_id: order.id,
        product_id: it.product_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
        warehouse_id: it.warehouse_id || null,
      }));

    const { error: itemsErr } = await supabase.from('order_items').insert(items);
    if (itemsErr) {
      toast.error(itemsErr.message);
      return;
    }

    await supabase.from('audit_logs').insert({
      user_id: profile?.id,
      action: 'order_created',
      entity_type: 'orders',
      entity_id: order.id,
      details: { order_number: orderNum, total },
    });

    toast.success('Order created');
    setOpen(false);
    setForm({ customer_id: '', notes: '', items: [{ product_id: '', quantity: 1, unit_price: 0, warehouse_id: '' }] });
    load();
  }

  function addItem() {
    setForm({ ...form, items: [...form.items, { product_id: '', quantity: 1, unit_price: 0, warehouse_id: '' }] });
  }

  function updateItem(idx: number, field: string, value: string | number) {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, items });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Create and track customer orders through the fulfillment flow."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> New order</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>New order</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Customer *</Label>
                      <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.customer_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Order items</Label>
                    {form.items.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2">
                        <div className="col-span-5">
                          <Select value={it.product_id} onValueChange={(v) => updateItem(idx, 'product_id', v)}>
                            <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input className="col-span-2" type="number" min={1} placeholder="Qty" value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} />
                        <Input className="col-span-3" type="number" min={0} step="0.01" placeholder="Unit price" value={it.unit_price} onChange={(e) => updateItem(idx, 'unit_price', Number(e.target.value))} />
                        <div className="col-span-2">
                          <Select value={it.warehouse_id} onValueChange={(v) => updateItem(idx, 'warehouse_id', v)}>
                            <SelectTrigger><SelectValue placeholder="WH" /></SelectTrigger>
                            <SelectContent>
                              {warehouses.map((w) => (
                                <SelectItem key={w.id} value={w.id}>{w.code}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add item
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit">Create order</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total orders" value={orders.length} icon={ShoppingCart} accent="primary" />
        <StatCard label="Pending" value={orders.filter((o) => o.status === 'pending').length} icon={Clock} accent="warning" />
        <StatCard label="Completed" value={orders.filter((o) => o.status === 'completed').length} icon={CheckCircle2} accent="success" />
        <StatCard label="Cancelled" value={orders.filter((o) => o.status === 'cancelled').length} icon={XCircle} accent="destructive" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search order number or customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No orders found" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Sales person</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/orders/${o.id}`)}>
                      <TableCell className="font-mono font-medium">{o.order_number}</TableCell>
                      <TableCell>{o.customer?.customer_name ?? '—'}</TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell className="font-medium">{formatMoney(o.total_amount)}</TableCell>
                      <TableCell>{formatMoney(o.paid_amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{o.sales_person?.full_name ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateShort(o.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
