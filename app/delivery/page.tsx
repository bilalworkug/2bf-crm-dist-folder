'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { Truck, Search, PackageCheck, AlertCircle, CheckCircle2, FileText, ArrowRight, XCircle, Camera } from 'lucide-react';
import { ScanField } from '@/components/scanner/ScanField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'react-hot-toast';
import { StatCard } from '@/components/stat-card';
import { EmptyState } from '@/components/empty-state';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CameraScanner } from '@/components/scanner/CameraScanner';
import { ExportDropdown } from '@/components/export-dropdown';
import { playScanAlreadyExists, playScanError } from '@/components/scanner/audio';

export default function DeliveryPage() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [scannedBoxes, setScannedBoxes] = useState<string[]>([]);
  const [barcode, setBarcode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDispatchedOrders();
  }, []);

  async function fetchDispatchedOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*, customer:customers(customer_name)')
      .in('status', ['dispatched', 'partially_delivered', 'approved'])
      .order('created_at', { ascending: false });
    if (data) setOrders(data);
  }

  async function selectOrder(orderId: string) {
    setSelectedOrderId(orderId);
    setScannedBoxes([]);
    setShowConfirm(false);

    // Get order details with items
    const { data: order } = await supabase
      .from('orders')
      .select('*, customer:customers(customer_name), items:order_items(*, product:products(name))')
      .eq('id', orderId)
      .single();

    // Get dispatch count
    const { count: dispatchedCount } = await supabase
      .from('dispatches')
      .select('*', { count: 'exact', head: true })
      .eq('order_id', orderId);

    // Get already delivered count
    const { count: deliveredCount } = await supabase
      .from('delivery_items')
      .select('*', { count: 'exact', head: true })
      .eq('order_id', orderId);

    // Get dispatched barcodes for this order
    const { data: dispatched } = await supabase
      .from('dispatches')
      .select('barcode')
      .eq('order_id', orderId);

    // Get already delivered barcodes
    const { data: delivered } = await supabase
      .from('delivery_items')
      .select('barcode')
      .eq('order_id', orderId);

    const deliveredSet = new Set((delivered || []).map(d => d.barcode));

    setOrderDetail({
      ...order,
      dispatched_count: dispatchedCount || 0,
      delivered_count: deliveredCount || 0,
      remaining: (dispatchedCount || 0) - (deliveredCount || 0),
      dispatched_barcodes: (dispatched || []).map(d => d.barcode),
      delivered_barcodes: deliveredSet,
    });

    // Create a new delivery record securely via RPC
    const { data: delId, error: delErr } = await supabase
      .rpc('fn_create_delivery', { p_order_id: orderId });
      
    if (delId) {
      setDeliveryId(delId);
    } else if (delErr) {
      toast.error('Could not start delivery: ' + delErr.message);
      return;
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  }

  // Core deliver logic — called by form submit AND camera scanner
  async function deliverBarcode(rawCode: string) {
    if (!rawCode.trim() || !deliveryId || !profile) return;
    const bc = rawCode.trim().toUpperCase();
    setBarcode('');

    if (scannedBoxes.includes(bc)) {
      playScanAlreadyExists();
      toast.error(`${bc} already scanned in this session.`);
      return;
    }

    setScanning(true);
    const { error } = await supabase.rpc('fn_deliver_box', {
      p_barcode: bc,
      p_order_id: selectedOrderId,
      p_delivery_id: deliveryId
    });

    if (error) {
      const msg = error.message;
      if (msg.includes('duplicate key') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already')) {
        playScanAlreadyExists();
      } else {
        playScanError();
      }
      toast.error(msg);
    } else {
      toast.success(`✓ ${bc} delivered`);
      setScannedBoxes(prev => [bc, ...prev]);
      // Play success beep
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        osc.frequency.value = 800;
        osc.connect(ctx.destination);
        osc.start();
        setTimeout(() => osc.stop(), 150);
      } catch {}
      // Refresh counts
      setOrderDetail((prev: any) => prev ? ({
        ...prev,
        delivered_count: prev.delivered_count + 1,
        remaining: prev.remaining - 1,
      }) : prev);
    }
    setScanning(false);
    inputRef.current?.focus();
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    await deliverBarcode(barcode);
  }

  async function handleCompleteDelivery(e: React.FormEvent) {
    e.preventDefault();
    if (!deliveryId || !profile) return;
    setConfirming(true);

    const { error } = await supabase.rpc('fn_complete_delivery', {
      p_delivery_id: deliveryId,
      p_receiver_name: receiverName,
      p_receiver_phone: receiverPhone,
      p_notes: deliveryNotes
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Delivery completed!');
      setSelectedOrderId('');
      setOrderDetail(null);
      setDeliveryId(null);
      setScannedBoxes([]);
      setShowConfirm(false);
      setReceiverName('');
      setReceiverPhone('');
      setDeliveryNotes('');
      fetchDispatchedOrders();
    }
    setConfirming(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-green-500/10 p-2.5">
          <Truck className="h-6 w-6 text-green-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Delivery</h1>
          <p className="text-sm text-muted-foreground">Scan dispatched boxes to confirm delivery to customers.</p>
        </div>
      </div>

      {!selectedOrderId ? (
        <div className="rounded-xl border border-white/10 bg-card shadow-sm">
          <div className="border-b border-white/10 px-6 py-4 flex flex-row items-center justify-between">
            <h2 className="font-semibold text-card-foreground">Select Dispatched Order</h2>
            {orders.length > 0 && (
              <ExportDropdown
                filenameBase="delivery_orders"
                title="Delivery Ready Orders"
                headers={['Order #', 'Customer', 'Status', 'Created']}
                rows={orders.map((o) => [o.order_number, o.customer?.customer_name || '', o.status, new Date(o.created_at).toLocaleDateString()])}
                variant="outline"
                className="h-8"
              />
            )}
          </div>
          {orders.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No orders ready" description="There are no dispatched orders ready for delivery." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.order_number}</TableCell>
                    <TableCell>{o.customer?.customer_name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        o.status === 'dispatched' ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>{o.status}</span>
                    </TableCell>
                    <TableCell>{new Date(o.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button size="lg" className="w-full sm:w-auto" onClick={() => selectOrder(o.id)}>Start Delivery</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      ) : orderDetail && !showConfirm ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Dispatched" value={orderDetail.dispatched_count} icon={Truck} accent="primary" />
            <StatCard label="Delivered" value={orderDetail.delivered_count + scannedBoxes.length} icon={PackageCheck} accent="success" />
            <StatCard label="Remaining" value={Math.max(0, orderDetail.remaining - scannedBoxes.length)} icon={AlertCircle} accent="warning" />
            <StatCard label="This Session" value={scannedBoxes.length} icon={CheckCircle2} />
          </div>

          <div className="rounded-xl border border-white/10 bg-card p-6 shadow-sm">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">Order: <strong className="text-foreground">{orderDetail.order_number}</strong></p>
              <p className="text-sm text-muted-foreground">Customer: <strong className="text-foreground">{orderDetail.customer?.customer_name}</strong></p>
            </div>
            <div className="mt-4">
              <ScanField
                onSubmit={deliverBarcode}
                placeholder="Scan barcode..."
                autoFocus
                showCamera={true}
                disabled={scanning}
              />
            </div>
          </div>

          {scannedBoxes.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-card shadow-sm">
              <div className="border-b border-white/10 px-6 py-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <h2 className="font-semibold text-card-foreground">Scanned ({scannedBoxes.length})</h2>
                <Button size="lg" onClick={() => setShowConfirm(true)} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
                  <PackageCheck className="h-5 w-5 mr-2" /> Finish & Deliver
                </Button>
              </div>
              <div className="divide-y divide-white/5">
                {scannedBoxes.map(bc => (
                  <div key={bc} className="flex items-center gap-3 px-6 py-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="font-mono text-sm text-foreground">{bc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button variant="outline" size="lg" onClick={() => { setSelectedOrderId(''); setOrderDetail(null); }}>
            ← Back to Orders
          </Button>
        </div>
      ) : showConfirm ? (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="rounded-xl border border-white/10 bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-card-foreground mb-4">Delivery Confirmation</h2>
            <div className="mb-4 space-y-1 text-sm">
              <p><span className="text-muted-foreground">Customer:</span> <strong>{orderDetail?.customer?.customer_name}</strong></p>
              <p><span className="text-muted-foreground">Order:</span> <strong>{orderDetail?.order_number}</strong></p>
              <p><span className="text-muted-foreground">Delivered:</span> <strong>{scannedBoxes.length} boxes this session</strong></p>
            </div>
            <form onSubmit={handleCompleteDelivery} className="space-y-4">
              <div className="space-y-2">
                <Label>Receiver Name *</Label>
                <Input value={receiverName} onChange={e => setReceiverName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Receiver Phone</Label>
                <Input value={receiverPhone} onChange={e => setReceiverPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Delivery Notes</Label>
                <Textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button type="button" variant="outline" size="lg" onClick={() => setShowConfirm(false)} className="flex-1">
                  Back to Scanning
                </Button>
                <Button type="submit" size="lg" disabled={confirming} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  {confirming ? 'Completing Delivery...' : 'Confirm Delivery'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
