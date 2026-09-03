'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Dispatch, Warehouse, Product, Profile, Order } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/empty-state';
import { ExportDropdown } from '@/components/export-dropdown';
import { cn } from '@/lib/utils';
import {
  Truck, Package, ShoppingCart, AlertTriangle, Search,
  CheckCircle2, XCircle, Camera, RefreshCw, FileText,
  FileCheck, Shield, Download, UserCheck
} from 'lucide-react';
import { ScanField } from '@/components/scanner/ScanField';
import { CameraScanner } from '@/components/scanner/CameraScanner';
import { FactoryHealthMonitor } from '@/components/factory-health-monitor';
import { StatusBadge } from '@/components/status-badge';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDate, isToday } from '@/lib/format';
import { playScanAlreadyExists, playScanError } from '@/components/scanner/audio';
import { generateWaybillPDF } from '@/lib/waybill-export';

const PAGE_SIZE = 50;

interface OrderLineFulfillment {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  ordered: number;
  dispatched: number;
  remaining: number;
}

export default function DispatchPage() {
  const { profile } = useAuth();
  const [dispatches, setDispatches] = useState<(Dispatch & { warehouse?: Warehouse; product?: Product; dispatcher?: Profile; order?: Order })[]>([]);
  const [orders, setOrders] = useState<(Order & { customer?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [barcode, setBarcode] = useState('');
  const [orderId, setOrderId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  // Phase 29: Order Fulfillment & Handover State
  const [activeTab, setActiveTab] = useState<'dispatch' | 'handover'>('dispatch');
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);
  const [lineFulfillment, setLineFulfillment] = useState<OrderLineFulfillment[]>([]);
  const [orderHandovers, setOrderHandovers] = useState<any[]>([]);

  // Handover form state
  const [submittingHandover, setSubmittingHandover] = useState(false);
  const [recipientType, setRecipientType] = useState('customer');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [driverName, setDriverName] = useState('');
  const [transportCompany, setTransportCompany] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [waybillNumber, setWaybillNumber] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');

  const canEdit = profile && ['admin', 'dispatch', 'dispatch_manager', 'manager'].includes(profile.role);

  useEffect(() => {
    load();
    loadActiveOrders();
  }, []);

  async function loadActiveOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*, customer:customers(*)')
      .in('status', ['pending', 'approved', 'partially_dispatched', 'dispatched', 'handed_over'])
      .order('created_at', { ascending: false });
    setOrders((data ?? []) as any[]);
  }

  // Load detailed order fulfillment lines when an order is selected
  useEffect(() => {
    if (!orderId) {
      setSelectedOrderDetail(null);
      setLineFulfillment([]);
      setOrderHandovers([]);
      return;
    }

    loadOrderFulfillment(orderId);
  }, [orderId]);

  async function loadOrderFulfillment(currentOrderId: string) {
    try {
      const [orderRes, itemsRes, dispatchesRes, handoversRes] = await Promise.all([
        supabase.from('orders').select('*, customer:customers(*)').eq('id', currentOrderId).single(),
        supabase.from('order_items').select('*, product:products(*)').eq('order_id', currentOrderId),
        supabase.from('dispatches').select('*, product:products(*)').eq('order_id', currentOrderId),
        supabase.from('order_handovers').select('*').eq('order_id', currentOrderId).order('created_at', { ascending: false }),
      ]);

      const orderData = orderRes.data;
      setSelectedOrderDetail(orderData);
      setOrderHandovers(handoversRes.data || []);

      if (orderData?.customer) {
        setRecipientName(orderData.customer.customer_name || orderData.customer.company_name || '');
        setRecipientPhone(orderData.customer.phone || '');
      }

      const items = itemsRes.data || [];
      const ordDispatches = dispatchesRes.data || [];

      // Calculate per-line fulfillment
      const lines: OrderLineFulfillment[] = items.map((it: any) => {
        const prodDispatches = ordDispatches.filter((d: any) => d.product_id === it.product_id);
        const dispatchedCount = prodDispatches.length;
        const orderedCount = it.quantity || 0;
        return {
          id: it.id,
          productId: it.product_id,
          productName: it.product?.name || 'Product',
          sku: it.product?.sku || 'SKU',
          ordered: orderedCount,
          dispatched: dispatchedCount,
          remaining: Math.max(0, orderedCount - dispatchedCount),
        };
      });

      setLineFulfillment(lines);
    } catch (e) {
      console.error('Error loading order fulfillment:', e);
    }
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('dispatches')
      .select('*, warehouse:warehouses(*), product:products(*), dispatcher:profiles!dispatches_dispatched_by_fkey(*), order:orders(*)')
      .order('dispatched_at', { ascending: false })
      .range(0, PAGE_SIZE - 1);
    const items = (data ?? []) as (Dispatch & { warehouse?: Warehouse; product?: Product; dispatcher?: Profile; order?: Order })[];
    setDispatches(items);
    setHasMore(items.length === PAGE_SIZE);
    setLoading(false);
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const start = dispatches.length;
    const end = start + PAGE_SIZE - 1;

    const { data } = await supabase
      .from('dispatches')
      .select('*, warehouse:warehouses(*), product:products(*), dispatcher:profiles!dispatches_dispatched_by_fkey(*), order:orders(*)')
      .order('dispatched_at', { ascending: false })
      .range(start, end);

    const newItems = (data ?? []) as (Dispatch & { warehouse?: Warehouse; product?: Product; dispatcher?: Profile; order?: Order })[];
    if (newItems.length > 0) {
      setDispatches((prev) => [...prev, ...newItems]);
    }
    setHasMore(newItems.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return dispatches.filter((d) => !q || d.barcode.toLowerCase().includes(q) || d.product?.name.toLowerCase().includes(q) || d.order?.order_number.toLowerCase().includes(q));
  }, [dispatches, search]);

  const dispatchedToday = dispatches.filter((d) => isToday(d.dispatched_at)).length;

  // Order fulfillment totals
  const totalOrdered = useMemo(() => lineFulfillment.reduce((acc, l) => acc + l.ordered, 0), [lineFulfillment]);
  const totalDispatched = useMemo(() => lineFulfillment.reduce((acc, l) => acc + l.dispatched, 0), [lineFulfillment]);
  const totalRemaining = Math.max(0, totalOrdered - totalDispatched);
  const fulfillmentPercent = totalOrdered > 0 ? Math.min(100, Math.round((totalDispatched / totalOrdered) * 1000) / 10) : 0;
  const isFullyDispatched = totalOrdered > 0 && totalRemaining === 0;

  // Dispatch barcode execution
  async function dispatchBarcode(code: string) {
    if (!code.trim()) {
      toast.error('Enter a barcode');
      return;
    }
    if (!orderId) {
      toast.error('Please select an order first');
      return;
    }

    setSubmitting(true);
    setLastResult(null);

    // Look up warehouse of the box
    const { data: boxData } = await supabase
      .from('boxes')
      .select('id, current_warehouse_id, status, product_id')
      .eq('barcode', code.trim())
      .maybeSingle();

    if (!boxData) {
      playScanError();
      const msg = `Rejected: barcode ${code} not found in database.`;
      toast.error(msg);
      setLastResult({ type: 'error', message: msg });
      setSubmitting(false);
      return;
    }

    if (!boxData.current_warehouse_id) {
      playScanError();
      const msg = `Rejected: barcode ${code} is currently '${boxData.status}' (not in warehouse stock).`;
      toast.error(msg);
      setLastResult({ type: 'error', message: msg });
      setSubmitting(false);
      return;
    }

    // Call upgraded fn_dispatch_box (Phase 29)
    const { data: dispatchResult, error } = await supabase.rpc('fn_dispatch_box', {
      p_barcode: code.trim(),
      p_order_id: orderId,
      p_warehouse_id: boxData.current_warehouse_id,
    });

    if (error) {
      const msg = error.message;
      if (msg.includes('duplicate') || msg.includes('already')) {
        playScanAlreadyExists();
      } else {
        playScanError();
      }
      toast.error(msg);
      setLastResult({ type: 'error', message: msg });
      setSubmitting(false);
      return;
    }

    // Success sound & notification
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.frequency.value = 880;
      osc.connect(ctx.destination);
      osc.start();
      setTimeout(() => osc.stop(), 120);
    } catch {}

    const ordNum = selectedOrderDetail?.order_number || 'order';
    const dCount = dispatchResult?.dispatched_count || totalDispatched + 1;
    const oCount = dispatchResult?.ordered_count || totalOrdered;
    const fPct = dispatchResult?.fulfillment_percent || fulfillmentPercent;

    const msg = `✓ Dispatched ${code} (${dCount}/${oCount} cartons, ${fPct}%)`;
    toast.success(msg);
    setLastResult({ type: 'success', message: msg });
    setBarcode('');
    setSubmitting(false);

    // Refresh state
    loadOrderFulfillment(orderId);
    loadActiveOrders();
    load();
  }

  // Record Order Custody Handover
  async function handleRecordHandover(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId || !recipientName.trim()) {
      toast.error('Recipient Name is required for custody handover');
      return;
    }

    setSubmittingHandover(true);
    try {
      const { data: hoRes, error } = await supabase.rpc('fn_handover_order', {
        p_order_id: orderId,
        p_recipient_type: recipientType,
        p_recipient_name: recipientName.trim(),
        p_recipient_phone: recipientPhone.trim() || null,
        p_driver_name: driverName.trim() || null,
        p_transport_company: transportCompany.trim() || null,
        p_vehicle_plate: vehiclePlate.trim() || null,
        p_waybill_number: waybillNumber.trim() || null,
        p_notes: handoverNotes.trim() || null,
      });

      if (error) throw error;

      toast.success(`Custody Handover Confirmed! Waybill: ${hoRes.handover_number}`);
      loadOrderFulfillment(orderId);
      loadActiveOrders();
    } catch (err: any) {
      toast.error('Handover failed: ' + err.message);
    } finally {
      setSubmittingHandover(false);
    }
  }

  // Print / Download Official A4 Waybill & Gate Pass
  function handleDownloadWaybill() {
    if (!selectedOrderDetail) return;

    const activeHo = orderHandovers[0];
    generateWaybillPDF({
      waybillNumber: activeHo?.waybill_number || activeHo?.handover_number || `WB-${selectedOrderDetail.order_number}`,
      handoverNumber: activeHo?.handover_number || 'N/A',
      orderNumber: selectedOrderDetail.order_number,
      orderDate: formatDate(selectedOrderDetail.created_at),
      customerName: selectedOrderDetail.customer?.customer_name || 'Customer',
      customerCompany: selectedOrderDetail.customer?.company_name,
      customerPhone: selectedOrderDetail.customer?.phone,
      customerLocation: selectedOrderDetail.customer?.location,
      recipientType: activeHo?.recipient_type || recipientType,
      recipientName: activeHo?.recipient_name || recipientName || 'Receiver',
      recipientPhone: activeHo?.recipient_phone || recipientPhone,
      driverName: activeHo?.driver_name || driverName,
      transportCompany: activeHo?.transport_company || transportCompany,
      vehiclePlate: activeHo?.vehicle_plate || vehiclePlate,
      notes: activeHo?.notes || handoverNotes,
      items: lineFulfillment.map((l) => ({
        sku: l.sku,
        productName: l.productName,
        cartonsDispatched: l.dispatched,
      })),
      totalCartons: totalDispatched,
      dispatcherName: profile?.full_name || 'Dispatch Supervisor',
      dispatcherRole: profile?.role?.replace(/_/g, ' '),
    });

    toast.success('Waybill & Gate Pass PDF generated successfully');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch & Fulfillment Desk"
        description="Scan cartons onto transport vehicles, verify real-time fulfillment, and execute custody handovers."
      />

      <FactoryHealthMonitor />

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Dispatched today" value={dispatchedToday} icon={Truck} accent="success" />
        <StatCard label="Total dispatches" value={dispatches.length} icon={Package} accent="primary" />
        <StatCard label="Orders active" value={orders.length} icon={ShoppingCart} accent="warning" />
        <StatCard
          label="Selected Order Progress"
          value={orderId ? `${fulfillmentPercent}%` : '—'}
          hint={orderId ? `${totalDispatched}/${totalOrdered} cartons` : 'Select order'}
          icon={CheckCircle2}
          accent="primary"
        />
      </div>

      {canEdit && (
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Order Dispatch & Custody Management
                </CardTitle>
                <CardDescription className="text-xs">
                  Select an order to begin carton loading or finalize gate handover.
                </CardDescription>
              </div>

              {/* Order Selection Dropdown */}
              <div className="w-full sm:w-72">
                <Select value={orderId} onValueChange={setOrderId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select active order..." />
                  </SelectTrigger>
                  <SelectContent>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={o.id} className="text-xs">
                        {o.order_number} — {o.customer?.customer_name ?? '—'} ({o.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {orderId && selectedOrderDetail && (
              /* Live Real-Time Fulfillment Overview */
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{selectedOrderDetail.order_number}</span>
                      <StatusBadge status={selectedOrderDetail.status} className="text-[10px]" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Customer: <span className="font-semibold text-foreground">{selectedOrderDetail.customer?.customer_name}</span> • Terms: {selectedOrderDetail.payment_type?.toUpperCase()}
                    </p>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="text-center px-2.5 py-1 bg-background rounded-lg border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Ordered</span>
                      <span className="font-mono font-bold">{totalOrdered}</span>
                    </div>
                    <div className="text-center px-2.5 py-1 bg-background rounded-lg border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Dispatched</span>
                      <span className="font-mono font-bold text-primary">{totalDispatched}</span>
                    </div>
                    <div className="text-center px-2.5 py-1 bg-background rounded-lg border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Remaining</span>
                      <span className={cn('font-mono font-bold', totalRemaining === 0 ? 'text-emerald-600' : 'text-amber-600')}>
                        {totalRemaining}
                      </span>
                    </div>
                    <div className="text-center px-2.5 py-1 bg-background rounded-lg border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Progress</span>
                      <span className="font-mono font-bold text-emerald-600">{fulfillmentPercent}%</span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-border/60 h-2 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-300 rounded-full',
                      isFullyDispatched ? 'bg-emerald-500' : 'bg-primary'
                    )}
                    style={{ width: `${fulfillmentPercent}%` }}
                  />
                </div>

                {/* SKU Itemized Breakdown Table */}
                <div className="rounded-lg border border-border/60 overflow-hidden bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[11px] h-8 bg-muted/40">
                        <TableHead className="py-1">Product SKU</TableHead>
                        <TableHead className="py-1 text-center">Ordered</TableHead>
                        <TableHead className="py-1 text-center">Dispatched</TableHead>
                        <TableHead className="py-1 text-center">Remaining</TableHead>
                        <TableHead className="py-1 text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineFulfillment.map((item) => (
                        <TableRow key={item.id} className="text-xs">
                          <TableCell className="py-1.5 font-medium">
                            {item.productName} <span className="text-[10px] text-muted-foreground font-mono">({item.sku})</span>
                          </TableCell>
                          <TableCell className="py-1.5 text-center font-mono">{item.ordered}</TableCell>
                          <TableCell className="py-1.5 text-center font-mono font-bold text-primary">{item.dispatched}</TableCell>
                          <TableCell className="py-1.5 text-center font-mono">
                            {item.remaining === 0 ? <span className="text-emerald-600 font-bold">0</span> : item.remaining}
                          </TableCell>
                          <TableCell className="py-1.5 text-right">
                            {item.remaining === 0 ? (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                Complete
                              </span>
                            ) : item.dispatched > 0 ? (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-md border border-amber-200/60">
                                Partial ({item.remaining} left)
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border/40">
                                Pending
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Operational Tabs: 1. Loading Scan | 2. Handover & Gate Pass */}
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
              <TabsList className="grid grid-cols-2 w-full max-w-md h-9 text-xs">
                <TabsTrigger value="dispatch" className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> 1. Carton Loading Scan
                </TabsTrigger>
                <TabsTrigger value="handover" className="flex items-center gap-1.5">
                  <FileCheck className="h-3.5 w-3.5" /> 2. Gate Handover & Waybill
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: Carton Dispatch Scan */}
              <TabsContent value="dispatch" className="space-y-3 pt-2">
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Scan Carton Barcode *</Label>
                    <div className="flex gap-2">
                      <ScanField
                        onSubmit={dispatchBarcode}
                        placeholder={orderId ? 'Scan or enter carton barcode...' : 'Select an order first'}
                        autoFocus
                        showCamera={true}
                        disabled={submitting || !orderId}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                {lastResult && (
                  <div
                    className={cn(
                      'flex items-start gap-2 rounded-lg p-3 text-xs',
                      lastResult.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                    )}
                  >
                    {lastResult.type === 'success' ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <p>{lastResult.message}</p>
                  </div>
                )}

                <div className="flex items-start gap-2 rounded-lg bg-amber-50/60 p-2.5 text-[11px] text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    <strong>Inventory Rule:</strong> Warehouse stock is deducted immediately upon successful scan at Dispatch.
                    Supports partial dispatch; final completion requires full quantity loaded.
                  </p>
                </div>

                <CameraScanner
                  active={cameraOpen}
                  onClose={() => setCameraOpen(false)}
                  onDetected={(scannedBarcode) => dispatchBarcode(scannedBarcode)}
                />
              </TabsContent>

              {/* TAB 2: Gate Handover & Waybill */}
              <TabsContent value="handover" className="space-y-4 pt-2">
                {totalDispatched === 0 ? (
                  <div className="p-8 text-center border border-dashed rounded-lg space-y-2">
                    <Truck className="h-8 w-8 text-muted-foreground mx-auto" />
                    <h4 className="text-sm font-bold">No Cartons Dispatched Yet</h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      At least one carton must be physically scanned and dispatched before custody handover can be confirmed.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Active Handovers Notification */}
                    {orderHandovers.length > 0 && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4" />
                            Custody Handover Confirmed ({orderHandovers[0].handover_number})
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Receiver: {orderHandovers[0].recipient_name} • Vehicle: {orderHandovers[0].vehicle_plate || 'N/A'} • {orderHandovers[0].cartons_handed_over} cartons
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadWaybill}
                          className="h-8 text-xs font-semibold"
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download Waybill
                        </Button>
                      </div>
                    )}

                    {/* Handover Form */}
                    <form onSubmit={handleRecordHandover} className="space-y-3 border rounded-xl p-4 bg-muted/10">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Record Driver / Customer Gate Handover
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Recipient Type</Label>
                          <Select value={recipientType} onValueChange={setRecipientType}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="customer">Customer Directly</SelectItem>
                              <SelectItem value="representative">Authorized Representative</SelectItem>
                              <SelectItem value="transporter_3pl">3PL Transporter / Commercial Truck</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Receiver Name *</Label>
                          <Input
                            placeholder="Full name of person receiving"
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                            required
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Receiver Phone</Label>
                          <Input
                            placeholder="e.g. 0911-00-0000"
                            value={recipientPhone}
                            onChange={(e) => setRecipientPhone(e.target.value)}
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Driver Name</Label>
                          <Input
                            placeholder="Vehicle driver name"
                            value={driverName}
                            onChange={(e) => setDriverName(e.target.value)}
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Transport Company (3PL)</Label>
                          <Input
                            placeholder="e.g. Self-Pickup, DHL, EthioFreight"
                            value={transportCompany}
                            onChange={(e) => setTransportCompany(e.target.value)}
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Vehicle Plate Number</Label>
                          <Input
                            placeholder="e.g. ET-3-54912"
                            value={vehiclePlate}
                            onChange={(e) => setVehiclePlate(e.target.value)}
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Waybill / Gate Pass Ref</Label>
                          <Input
                            placeholder="Optional custom waybill number"
                            value={waybillNumber}
                            onChange={(e) => setWaybillNumber(e.target.value)}
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Handover Notes / Inspection Remarks</Label>
                        <Input
                          placeholder="Cartons verified clean, sealed, intact..."
                          value={handoverNotes}
                          onChange={(e) => setHandoverNotes(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/60">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadWaybill}
                          className="h-9 text-xs"
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Preview Waybill PDF
                        </Button>

                        <Button
                          type="submit"
                          size="sm"
                          disabled={submittingHandover}
                          className="h-9 text-xs font-semibold"
                        >
                          <UserCheck className="h-3.5 w-3.5 mr-1" />
                          Confirm Gate Handover ({totalDispatched} Cartons)
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Recent Dispatches Log Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Recent Dispatches</CardTitle>
            <CardDescription className="text-xs">Audit log of all cartons dispatched from warehouses</CardDescription>
          </div>
          <ExportDropdown
            filenameBase="dispatches"
            title="Dispatches Report"
            headers={['Barcode', 'Product', 'Warehouse', 'Order', 'Dispatched By', 'Dispatched At']}
            rows={filtered.map((d) => [
              d.barcode,
              d.product?.name ?? '—',
              d.warehouse?.code ?? '—',
              d.order?.order_number ?? '—',
              d.dispatcher?.full_name ?? '—',
              formatDate(d.dispatched_at),
            ])}
            variant="outline"
            className="h-8"
          />
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by barcode, product, or order..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Barcode</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Dispatched By</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                      No dispatches found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((d) => (
                    <TableRow key={d.id} className="text-xs">
                      <TableCell className="font-mono font-bold text-primary">{d.barcode}</TableCell>
                      <TableCell className="font-medium">{d.product?.name ?? '—'}</TableCell>
                      <TableCell>{d.warehouse?.code ?? '—'}</TableCell>
                      <TableCell className="font-mono">{d.order?.order_number ?? '—'}</TableCell>
                      <TableCell>{d.dispatcher?.full_name ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(d.dispatched_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore} className="h-8 text-xs">
                {loadingMore ? 'Loading...' : 'Load more dispatches'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
