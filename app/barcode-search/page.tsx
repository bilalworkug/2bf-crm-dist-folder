'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { Search, ScanLine, History, Package, MapPin, Truck, CheckCircle, Undo2, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/lib/auth';

const ACTION_ICONS: Record<string, any> = {
  PRODUCED: Package,
  RECEIVED: MapPin,
  CORRECTION: Undo2,
  TRANSFERRED: ArrowRightLeft,
  TRANSFER_RECEIVED: MapPin,
  ALLOCATED: CheckCircle,
  DISPATCHED: Truck,
  DELIVERED: CheckCircle,
  RETURN_REQUESTED: Undo2,
  RETURN_APPROVED: CheckCircle,
  DISPATCH_REVERSED: Undo2,
};

const ACTION_COLORS: Record<string, string> = {
  PRODUCED: 'text-blue-400 bg-blue-500/10',
  RECEIVED: 'text-green-400 bg-green-500/10',
  CORRECTION: 'text-amber-400 bg-amber-500/10',
  TRANSFERRED: 'text-purple-400 bg-purple-500/10',
  TRANSFER_RECEIVED: 'text-green-400 bg-green-500/10',
  ALLOCATED: 'text-cyan-400 bg-cyan-500/10',
  DISPATCHED: 'text-indigo-400 bg-indigo-500/10',
  DELIVERED: 'text-emerald-400 bg-emerald-500/10',
  RETURN_REQUESTED: 'text-red-400 bg-red-500/10',
  RETURN_APPROVED: 'text-orange-400 bg-orange-500/10',
  DISPATCH_REVERSED: 'text-amber-400 bg-amber-500/10',
};

function BarcodeSearchContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQ);
  const [history, setHistory] = useState<any[]>([]);
  const [boxInfo, setBoxInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const { profile } = useAuth();

  useEffect(() => {
    if (initialQ) doSearch(initialQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ]);

  async function doSearch(term: string) {
    if (!term.trim()) return;
    setLoading(true);
    setSearched(true);
    setBoxInfo(null);

    // Get box info
    const { data: box } = await supabase
      .from('boxes')
      .select('*, product:products(name, sku), warehouse:warehouses(code, name), order:orders(order_number, customer:customers(customer_name))')
      .eq('barcode', term.trim())
      .single();

    if (box) {
      let allowBox = true;
      if (profile?.role === 'warehouse' && profile.warehouse_id && box.current_warehouse_id !== profile.warehouse_id) {
        allowBox = false;
      } else if (profile?.role === 'sales' && !['in_warehouse', 'returned'].includes(box.status)) {
        allowBox = false;
      }
      if (allowBox) setBoxInfo(box);
    }

    // Get full history
    const { data } = await supabase
      .from('barcode_history')
      .select('*, warehouse:warehouses(code, name), product:products(name), user:profiles!barcode_history_user_id_fkey(full_name), order:orders(order_number, customer:customers(customer_name))')
      .eq('barcode', term.trim())
      .order('performed_at', { ascending: true });

    let filteredHistory = data || [];
    if (profile?.role === 'warehouse' && profile.warehouse_id) {
      filteredHistory = filteredHistory.filter(h => h.warehouse_id === profile.warehouse_id);
    } else if (profile?.role === 'sales') {
      filteredHistory = filteredHistory.filter(h => ['ALLOCATED', 'DISPATCHED', 'DELIVERED', 'RETURN_REQUESTED'].includes(h.action));
    }

    setHistory(filteredHistory);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Barcode Search"
        description="Search any barcode to see its full traceability across the system."
      />

      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); doSearch(query.trim()); }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Enter or scan barcode..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 font-mono"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={loading}>
              <ScanLine className="mr-2 h-4 w-4" />
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : !searched ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState title="Search for a barcode" description="Enter a barcode to view its complete lifecycle." icon={Search} />
          </CardContent>
        </Card>
      ) : history.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState title="Barcode not found" description="No history found for this barcode." icon={AlertTriangle} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Box Summary Card */}
          {boxInfo && (
            <div className="rounded-xl border border-white/10 bg-card p-6 shadow-sm">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Barcode</p>
                  <p className="mt-1 font-mono text-lg font-bold text-foreground">{boxInfo.barcode}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Product</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{boxInfo.product?.name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
                  <span className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                    boxInfo.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500' :
                    boxInfo.status === 'dispatched' ? 'bg-indigo-500/10 text-indigo-500' :
                    boxInfo.status === 'in_warehouse' ? 'bg-green-500/10 text-green-500' :
                    boxInfo.status === 'allocated' ? 'bg-cyan-500/10 text-cyan-500' :
                    boxInfo.status === 'damaged' ? 'bg-red-500/10 text-red-500' :
                    'bg-gray-500/10 text-gray-400'
                  }`}>{boxInfo.status}</span>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Location</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {boxInfo.status === 'delivered' ? 'Customer' :
                     boxInfo.warehouse ? `${boxInfo.warehouse.code}` :
                     boxInfo.status === 'dispatched' ? 'In Transit' : '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-xl border border-white/10 bg-card shadow-sm">
            <div className="border-b border-white/10 px-6 py-4">
              <h2 className="font-semibold text-card-foreground">Complete History</h2>
            </div>
            <div className="p-6">
              <div className="relative space-y-0">
                {history.map((h, i) => {
                  const Icon = ACTION_ICONS[h.action] || History;
                  const color = ACTION_COLORS[h.action] || 'text-gray-400 bg-gray-500/10';
                  const isLast = i === history.length - 1;

                  return (
                    <div key={h.id} className="relative flex gap-4 pb-8">
                      {/* Vertical line */}
                      {!isLast && (
                        <div className="absolute left-5 top-10 h-full w-px bg-white/10" />
                      )}
                      {/* Icon */}
                      <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      {/* Content */}
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="text-sm font-semibold text-foreground">{h.action.replace(/_/g, ' ')}</p>
                        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {h.product && <p>Product: <span className="text-foreground">{h.product.name}</span></p>}
                          {h.warehouse && <p>Warehouse: <span className="text-foreground">{h.warehouse.code} — {h.warehouse.name}</span></p>}
                          {h.order && <p>Order: <span className="text-foreground">{h.order.order_number}</span></p>}
                          {h.order?.customer && <p>Customer: <span className="text-foreground">{h.order.customer.customer_name}</span></p>}
                          {h.notes && <p>Notes: <span className="text-foreground">{h.notes}</span></p>}
                          <p>By: <span className="text-foreground">{h.user?.full_name || '—'}</span> · {formatDate(h.performed_at)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BarcodeSearchPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-muted-foreground">Loading...</div>}>
      <BarcodeSearchContent />
    </Suspense>
  );
}
