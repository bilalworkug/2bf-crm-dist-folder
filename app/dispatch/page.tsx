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
import { ExportDropdown } from '@/components/export-dropdown';
import { Truck, Package, ShoppingCart, AlertTriangle, Search, CheckCircle2, XCircle, Camera } from 'lucide-react';
import { ScanField } from '@/components/scanner/ScanField';
import { CameraScanner } from '@/components/scanner/CameraScanner';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDate, isToday } from '@/lib/format';
import { playScanAlreadyExists, playScanError } from '@/components/scanner/audio';

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
  const [cameraOpen, setCameraOpen] = useState(false);

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

  // Core dispatch logic — called by form submit AND camera scanner
  async function dispatchBarcode(code: string) {
    if (!code.trim()) {
      toast.error('Enter a barcode');
      return;
    }
    if (!orderId) {
      toast.error('Select an order');
      return;
    }

    setSubmitting(true);
    setLastResult(null);

    // Look up which warehouse this barcode is currently in
    const { data: boxData } = await supabase
      .from('boxes')
      .select('current_warehouse_id')
      .eq('barcode', code.trim())
      .maybeSingle();

    if (!boxData || !boxData.current_warehouse_id) {
      playScanError();
      const msg = `Rejected: barcode ${code} is not in a warehouse.`;
      toast.error(msg);
      setLastResult({ type: 'error', message: msg });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.rpc('fn_dispatch_box', {
      p_barcode: code.trim(),
      p_order_id: orderId,
      p_warehouse_id: boxData.current_warehouse_id
    });

    if (error) {
      const msg = error.message;
      if (msg.includes('duplicate key') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already')) {
        playScanAlreadyExists();
      } else {
        playScanError();
      }
      toast.error(msg);
      setLastResult({ type: 'error', message: msg });
      setSubmitting(false);
      return;
    }

    const msg = `Dispatched ${code} to order ${orders.find((o) => o.id === orderId)?.order_number}`;
    toast.success(msg);
    setLastResult({ type: 'success', message: msg });
    setBarcode('');
    setSubmitting(false);
    load();
  }

  async function handleDispatch(e: React.FormEvent) {
    e.preventDefault();
    await dispatchBarcode(barcode);
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Barcode *</Label>
                <div className="flex gap-2">
                  <ScanField
                    onSubmit={dispatchBarcode}
                    placeholder="Scan or enter barcode"
                    autoFocus
                    showCamera={true}
                    disabled={submitting || !orderId}
                    className="flex-1"
                  />
                </div>
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
                {/* Submit button handled by ScanField */}
              </div>
            </div>

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

            {/* Phase 10: ZXing camera scanner — onDetected passes barcode to dispatchBarcode(); no business logic in scanner */}
            <CameraScanner
              active={cameraOpen}
              onClose={() => setCameraOpen(false)}
              onDetected={(scannedBarcode) => dispatchBarcode(scannedBarcode)}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Recent Dispatches</CardTitle>
          <ExportDropdown
            filenameBase="dispatches"
            title="Dispatches Report"
            headers={['Barcode', 'Product', 'Warehouse', 'Order', 'Dispatched By', 'Dispatched At']}
            rows={filtered.map((d) => [d.barcode, d.product?.name ?? '—', d.warehouse?.code ?? '—', d.order?.order_number ?? '—', d.dispatcher?.full_name ?? '—', formatDate(d.dispatched_at)])}
            variant="outline"
            className="h-8"
          />
        </CardHeader>
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
