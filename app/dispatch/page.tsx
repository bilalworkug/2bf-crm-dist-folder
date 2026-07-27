'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Dispatch, Warehouse, Product, Profile, Order, WarehouseReceipt } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { Truck, Package, ShoppingCart, AlertTriangle, Search, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDate, isToday } from '@/lib/format';

export default function DispatchPage() {
  const { profile } = useAuth();
  const [dispatches, setDispatches] = useState<(Dispatch & { warehouse?: Warehouse; product?: Product; dispatcher?: Profile; order?: Order })[]>([]);
  const [orders, setOrders] = useState<(Order & { customer?: { customer_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [barcode, setBarcode] = useState('');
  const [orderId, setOrderId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canEdit = profile && ['admin', 'dispatch', 'manager'].includes(profile.role);

  useEffect(() => {
    load();
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, customer:customers(customer_name)')
        .in('status', ['approved', 'dispatched', 'completed'])
        .order('created_at', { ascending: false });
      setOrders((data ?? []) as (Order & { customer?: { customer_name: string } })[]);
    })();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('dispatches')
      .select('*, warehouse:warehouses(*), product:products(*), dispatcher:profiles!dispatches_dispatched_by_fkey(*), order:orders(*)')
      .order('dispatched_at', { ascending: false })
      .limit(50);
    setDispatches((data ?? []) as (Dispatch & { warehouse?: Warehouse; product?: Product; dispatcher?: Profile; order?: Order })[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return dispatches.filter((d) => !q || d.barcode.toLowerCase().includes(q) || d.product?.name.toLowerCase().includes(q) || d.order?.order_number.toLowerCase().includes(q));
  }, [dispatches, search]);

  const dispatchedToday = dispatches.filter((d) => isToday(d.dispatched_at)).length;

  async function handleDispatch(e: React.FormEvent) {
    e.preventDefault();
    if (!barcode.trim()) {
      toast.error('Enter a barcode');
      return;
    }
    if (!orderId) {
      toast.error('Select an order');
      return;
    }

    setSubmitting(true);
    setLastResult(null);

    // 1. Check if already dispatched
    const { data: alreadyDispatched } = await supabase
      .from('dispatches')
      .select('id')
      .eq('barcode', barcode.trim())
      .maybeSingle();

    if (alreadyDispatched) {
      const msg = `Already dispatched: barcode ${barcode} was already sent out`;
      toast.error(msg);
      setLastResult({ type: 'error', message: msg });
      setSubmitting(false);
      return;
    }

    // 2. Check if received into warehouse (must exist in stock)
    const { data: receipt } = await supabase
      .from('warehouse_receipts')
      .select('*')
      .eq('barcode', barcode.trim())
      .maybeSingle();

    if (!receipt) {
      const msg = `Rejected: barcode ${barcode} is not in warehouse stock. It must be received before dispatch.`;
      toast.error(msg);
      setLastResult({ type: 'error', message: msg });
      setSubmitting(false);
      return;
    }

    const wr = receipt as WarehouseReceipt;

    // 3. Insert dispatch
    const { data: dispatch, error } = await supabase
      .from('dispatches')
      .insert({
        barcode: barcode.trim(),
        warehouse_receipt_id: wr.id,
        order_id: orderId,
        warehouse_id: wr.warehouse_id,
        product_id: wr.product_id,
        quantity: wr.quantity,
        dispatched_by: profile?.id,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    // 4. Fetch customer for barcode history
    const { data: order } = await supabase
      .from('orders')
      .select('customer_id')
      .eq('id', orderId)
      .maybeSingle();

    // 5. Barcode history
    await supabase.from('barcode_history').insert({
      barcode: barcode.trim(),
      action: 'dispatch',
      warehouse_id: wr.warehouse_id,
      product_id: wr.product_id,
      order_id: orderId,
      customer_id: order?.customer_id ?? null,
      user_id: profile?.id,
    });

    // 6. Audit log
    await supabase.from('audit_logs').insert({
      user_id: profile?.id,
      action: 'dispatch',
      warehouse_id: wr.warehouse_id,
      product_id: wr.product_id,
      barcode: barcode.trim(),
      entity_type: 'dispatches',
      entity_id: dispatch.id,
      details: { order_id: orderId, quantity: wr.quantity },
    });

    const msg = `Dispatched ${barcode} to order ${orders.find((o) => o.id === orderId)?.order_number} — ${wr.quantity} cartons`;
    toast.success(msg);
    setLastResult({ type: 'success', message: msg });
    setBarcode('');
    setSubmitting(false);
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch"
        description="Dispatch stock out of warehouse to customer orders."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Dispatched today" value={dispatchedToday} icon={Truck} accent="success" />
        <StatCard label="Total dispatches" value={dispatches.length} icon={Package} accent="primary" />
        <StatCard label="Orders ready" value={orders.length} icon={ShoppingCart} accent="warning" />
      </div>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-4 w-4 text-primary" /> Dispatch a box
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDispatch} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Barcode *</Label>
                <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or enter barcode" autoFocus className="font-mono" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Order *</Label>
                <Select value={orderId} onValueChange={setOrderId}>
                  <SelectTrigger><SelectValue placeholder="Select order" /></SelectTrigger>
                  <SelectContent>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.order_number} — {o.customer?.customer_name ?? '—'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-4 flex justify-end">
                <Button type="submit" disabled={submitting}>
                  <Truck className="mr-2 h-4 w-4" />
                  {submitting ? 'Dispatching...' : 'Dispatch box'}
                </Button>
              </div>
            </form>

            {lastResult && (
              <div className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-sm ${lastResult.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                {lastResult.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                <p>{lastResult.message}</p>
              </div>
            )}

            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Only boxes received into warehouse stock can be dispatched. Already-dispatched barcodes are blocked.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by barcode, product, or order..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No dispatches found" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead>Dispatched by</TableHead>
                  <TableHead>Dispatched at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-sm font-medium">{d.barcode}</TableCell>
                    <TableCell>{d.product?.name ?? '—'}</TableCell>
                    <TableCell>{d.warehouse?.code ?? '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{d.order?.order_number ?? '—'}</TableCell>
                    <TableCell className="text-center">{d.quantity}</TableCell>
                    <TableCell className="text-sm">{d.dispatcher?.full_name ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(d.dispatched_at)}</TableCell>
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
