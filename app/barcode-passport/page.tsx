'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { BarcodeHistoryEntry, Warehouse, Product, Profile, Order, Customer } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { ScanField } from '@/components/scanner/ScanField';
import {
  Search, ShieldCheck, ScanLine, PackageCheck, Truck, CheckCircle2,
  AlertTriangle, Clock, ArrowRightLeft, Undo2, Building2, User,
  Calendar, ShoppingCart, MapPin, Printer, QrCode, RefreshCw, FileText
} from 'lucide-react';
import { formatDate } from '@/lib/format';

interface TimelineStep {
  stepNumber: number;
  title: string;
  actionKey: string;
  status: 'completed' | 'current' | 'upcoming' | 'exception';
  timestamp?: string;
  operator?: string;
  location?: string;
  details?: string;
  icon: React.ComponentType<{ className?: string }>;
}

function BarcodePassportContent() {
  const searchParams = useSearchParams();
  const initialBarcode = searchParams.get('barcode') ?? '';
  const [query, setQuery] = useState(initialBarcode);
  const [barcode, setBarcode] = useState(initialBarcode);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Passport Data States
  const [boxData, setBoxData] = useState<any>(null);
  const [prodScan, setProdScan] = useState<any>(null);
  const [whReceipt, setWhReceipt] = useState<any>(null);
  const [dispatchData, setDispatchData] = useState<any>(null);
  const [historyEntries, setHistoryEntries] = useState<any[]>([]);
  const [returnRecord, setReturnRecord] = useState<any>(null);

  async function loadPassport(barcodeInput: string) {
    const trimmed = barcodeInput.trim();
    if (!trimmed) return;
    setLoading(true);
    setSearched(true);
    setBarcode(trimmed);

    try {
      // 1. Box current status and info
      const { data: box } = await supabase
        .from('boxes')
        .select('*, product:products(*), warehouse:warehouses(*)')
        .eq('barcode', trimmed)
        .maybeSingle();
      setBoxData(box);

      // 2. Production scan
      const { data: prod } = await supabase
        .from('production_scans')
        .select('*, scanner:profiles!production_scans_scanned_by_fkey(*), product:products(*)')
        .eq('barcode', trimmed)
        .maybeSingle();
      setProdScan(prod);

      // 3. Warehouse receipt
      const { data: wh } = await supabase
        .from('warehouse_receipts')
        .select('*, receiver:profiles!warehouse_receipts_received_by_fkey(*), warehouse:warehouses(*), product:products(*)')
        .eq('barcode', trimmed)
        .maybeSingle();
      setWhReceipt(wh);

      // 4. Dispatch record
      const { data: disp } = await supabase
        .from('dispatches')
        .select('*, dispatcher:profiles!dispatches_dispatched_by_fkey(*), warehouse:warehouses(*), product:products(*), order:orders(*, customer:customers(*))')
        .eq('barcode', trimmed)
        .maybeSingle();
      setDispatchData(disp);

      // 5. Full audit history
      const { data: history } = await supabase
        .from('barcode_history')
        .select('*, warehouse:warehouses(*), product:products(*), user:profiles!barcode_history_user_id_fkey(*), order:orders(*), customer:customers(*)')
        .eq('barcode', trimmed)
        .order('performed_at', { ascending: true });
      setHistoryEntries(history ?? []);

      // 6. Return record (if any)
      const { data: ret } = await supabase
        .from('returns')
        .select('*')
        .eq('barcode', trimmed)
        .maybeSingle();
      setReturnRecord(ret);
    } catch (e) {
      console.error('Failed to load barcode passport:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialBarcode) loadPassport(initialBarcode);
  }, [initialBarcode]);

  // Derived information
  const product = boxData?.product || prodScan?.product || whReceipt?.product || dispatchData?.product;
  const currentStatus = boxData?.status || (dispatchData ? 'dispatched' : whReceipt ? 'in_warehouse' : prodScan ? 'produced' : 'unknown');
  const order = dispatchData?.order;
  const customer = order?.customer;

  // Build the 6-stage lifecycle timeline
  const timeline: TimelineStep[] = [
    {
      stepNumber: 1,
      title: 'Production Line',
      actionKey: 'PRODUCED',
      status: prodScan ? 'completed' : 'upcoming',
      timestamp: prodScan?.scanned_at,
      operator: prodScan?.scanner?.full_name || prodScan?.scanner?.email,
      details: prodScan?.batch_lot ? `Batch: ${prodScan.batch_lot}` : 'Registered at factory floor',
      icon: ScanLine,
    },
    {
      stepNumber: 2,
      title: 'Warehouse Receiving',
      actionKey: 'RECEIVED',
      status: whReceipt ? 'completed' : prodScan ? 'upcoming' : 'upcoming',
      timestamp: whReceipt?.received_at,
      operator: whReceipt?.receiver?.full_name,
      location: whReceipt?.warehouse ? `${whReceipt.warehouse.code} — ${whReceipt.warehouse.name}` : undefined,
      details: whReceipt ? 'Approved and stored in inventory' : 'Pending warehouse reception',
      icon: PackageCheck,
    },
    {
      stepNumber: 3,
      title: 'Order Allocation & Dispatch',
      actionKey: 'DISPATCHED',
      status: dispatchData ? 'completed' : whReceipt ? 'upcoming' : 'upcoming',
      timestamp: dispatchData?.dispatched_at,
      operator: dispatchData?.dispatcher?.full_name,
      details: order ? `Order #${order.order_number} to ${customer?.customer_name || 'Customer'}` : 'Not yet dispatched',
      icon: Truck,
    },
    {
      stepNumber: 4,
      title: 'Customer Delivery',
      actionKey: 'DELIVERED',
      status: currentStatus === 'delivered' ? 'completed' : dispatchData ? 'current' : 'upcoming',
      timestamp: historyEntries.find((h) => h.action === 'DELIVERED')?.performed_at,
      details: currentStatus === 'delivered' ? 'Confirmed delivered to recipient' : 'In transit with delivery team',
      icon: CheckCircle2,
    },
  ];

  // Add Exceptions (Corrections / Returns) if they exist
  if (returnRecord) {
    timeline.push({
      stepNumber: 5,
      title: 'Reverse Logistics / Return',
      actionKey: 'RETURN',
      status: 'exception',
      timestamp: returnRecord.processed_at,
      details: `Type: ${returnRecord.return_type} • Reason: ${returnRecord.reason || 'N/A'} • Status: ${returnRecord.status}`,
      icon: Undo2,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Barcode Passport"
          description="Authoritative digital identity and complete traceability timeline for any carton barcode."
        />
        {searched && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="print:hidden text-xs font-medium"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print Passport
          </Button>
        )}
      </div>

      {/* Barcode Search Bar */}
      <Card className="print:hidden">
        <CardContent className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadPassport(query);
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Enter or scan carton barcode (e.g. 2BF-PROD-000041)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 font-mono"
              />
            </div>
            <Button type="submit" disabled={loading || !query.trim()} className="min-w-[120px]">
              {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              {loading ? 'Searching...' : 'View Passport'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Passport Content */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-44 animate-pulse rounded-xl bg-muted" />
          <div className="h-72 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : searched && !prodScan && !whReceipt && !dispatchData && !boxData ? (
        <EmptyState
          title="Barcode Not Found"
          description={`No production, warehouse, or dispatch records found for barcode "${barcode}".`}
        />
      ) : searched ? (
        <div className="space-y-6">
          {/* DIGITAL IDENTITY PASSPORT CARD */}
          <Card className="border-sky-500/30 dark:border-sky-500/20 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 p-6 text-white">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      Official 2BF Passport
                    </span>
                    <span className="text-xs text-slate-400">Single Source of Truth</span>
                  </div>
                  <h2 className="text-2xl font-mono font-black tracking-tight text-white flex items-center gap-2">
                    {barcode}
                  </h2>
                  <p className="text-sm text-sky-200">
                    {product ? `${product.name} (${product.category || 'Product'} • ${product.unit})` : 'Product Registration'}
                  </p>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400">Current Status</p>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mt-0.5 ${
                      currentStatus === 'delivered'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : currentStatus === 'dispatched'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : currentStatus === 'in_warehouse'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : currentStatus === 'produced'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
                      {currentStatus.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Passport Identity Grid */}
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-slate-50/50 dark:bg-slate-900/50">
              {/* Product Info */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5 text-sky-500" /> SKU / Product
                </span>
                <p className="text-sm font-semibold">{product?.name ?? '—'}</p>
                <p className="text-xs text-muted-foreground font-mono">{product?.sku ?? 'No SKU'}</p>
              </div>

              {/* Production Time & Operator */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-amber-500" /> Produced At
                </span>
                <p className="text-sm font-semibold">{prodScan ? formatDate(prodScan.scanned_at) : '—'}</p>
                <p className="text-xs text-muted-foreground">
                  By: {prodScan?.scanner?.full_name || prodScan?.scanner?.email || 'Factory Operator'}
                </p>
              </div>

              {/* Warehouse Location */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-purple-500" /> Current / Last Warehouse
                </span>
                <p className="text-sm font-semibold">
                  {boxData?.warehouse?.name || whReceipt?.warehouse?.name || dispatchData?.warehouse?.name || 'In Transit'}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  Code: {boxData?.warehouse?.code || whReceipt?.warehouse?.code || dispatchData?.warehouse?.code || '—'}
                </p>
              </div>

              {/* Sales Order & Customer */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5 text-blue-500" /> Sales Order & Customer
                </span>
                <p className="text-sm font-semibold">
                  {order ? `#${order.order_number}` : 'Unallocated / Stock'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {customer ? customer.customer_name : 'No customer assigned'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* CHRONOLOGICAL LIFECYCLE TIMELINE */}
          <Card>
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-sky-500" /> Carton Lifecycle Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-200 dark:border-slate-800 space-y-8 my-2">
                {timeline.map((step) => {
                  const Icon = step.icon;
                  const isCompleted = step.status === 'completed';
                  const isCurrent = step.status === 'current';
                  const isException = step.status === 'exception';

                  return (
                    <div key={step.stepNumber} className="relative group">
                      {/* Timeline Node Bullet */}
                      <div
                        className={`absolute -left-[35px] sm:-left-[43px] top-0.5 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 transition-transform group-hover:scale-110 ${
                          isCompleted
                            ? 'bg-emerald-500 border-white dark:border-slate-900 text-white shadow-sm'
                            : isCurrent
                            ? 'bg-sky-500 border-white dark:border-slate-900 text-white animate-pulse'
                            : isException
                            ? 'bg-red-500 border-white dark:border-slate-900 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </div>

                      {/* Content */}
                      <div className="space-y-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            {step.title}
                            {isCompleted && (
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                                Completed
                              </span>
                            )}
                            {isCurrent && (
                              <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-full">
                                Active
                              </span>
                            )}
                          </h4>
                          {step.timestamp && (
                            <span className="text-xs text-muted-foreground">
                              {formatDate(step.timestamp)}
                            </span>
                          )}
                        </div>

                        {step.operator && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                            Operator: <span className="font-semibold">{step.operator}</span>
                          </p>
                        )}

                        {step.location && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {step.location}
                          </p>
                        )}

                        {step.details && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {step.details}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* RAW AUDIT TIMELINE TABLE */}
          {historyEntries.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Immutable Audit Entries ({historyEntries.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-muted-foreground">
                      <th className="pb-2 font-medium">Timestamp</th>
                      <th className="pb-2 font-medium">Action</th>
                      <th className="pb-2 font-medium">Operator</th>
                      <th className="pb-2 font-medium">Warehouse</th>
                      <th className="pb-2 font-medium">Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {historyEntries.map((h) => (
                      <tr key={h.id}>
                        <td className="py-2 text-muted-foreground whitespace-nowrap">{formatDate(h.performed_at)}</td>
                        <td className="py-2 font-semibold uppercase">{h.action}</td>
                        <td className="py-2">{h.user?.full_name || 'System'}</td>
                        <td className="py-2">{h.warehouse?.code || '—'}</td>
                        <td className="py-2 font-mono">{h.order?.order_number || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card className="text-center p-12 text-muted-foreground">
          <QrCode className="h-12 w-12 mx-auto text-sky-500/40 mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            No Barcode Scanned Yet
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Scan or enter any carton barcode above to inspect its complete official digital passport and chronological history.
          </p>
        </Card>
      )}
    </div>
  );
}

export default function BarcodePassportPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading Barcode Passport...</div>}>
      <BarcodePassportContent />
    </Suspense>
  );
}
