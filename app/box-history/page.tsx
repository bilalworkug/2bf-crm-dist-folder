'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { BarcodeHistoryEntry, Warehouse, Product, Profile, Order, Customer } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { Search, History, ScanLine, PackageCheck, Truck, Undo2, ShoppingCart, User, Building2, Package, Warehouse as WarehouseIcon, Clock } from 'lucide-react';
import { formatDate } from '@/lib/format';

interface TimelineEntry extends BarcodeHistoryEntry {
  warehouse?: Warehouse;
  product?: Product;
  user?: Profile;
  order?: Order;
  customer?: Customer;
}

const ACTION_META: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  production_scan: { icon: ScanLine, color: 'bg-amber-500 text-white', label: 'Production Scan' },
  warehouse_receipt: { icon: PackageCheck, color: 'bg-emerald-500 text-white', label: 'Warehouse Receipt' },
  dispatch: { icon: Truck, color: 'bg-blue-500 text-white', label: 'Dispatch' },
  return_returned: { icon: Undo2, color: 'bg-orange-500 text-white', label: 'Returned' },
  return_damaged: { icon: Undo2, color: 'bg-red-500 text-white', label: 'Damaged' },
  return_expired: { icon: Clock, color: 'bg-red-600 text-white', label: 'Expired' },
};

function BoxHistoryContent() {
  const searchParams = useSearchParams();
  const initialBarcode = searchParams.get('barcode') ?? '';
  const [query, setQuery] = useState(initialBarcode);
  const [activeBarcode, setActiveBarcode] = useState(initialBarcode);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function loadHistory(barcode: string) {
    if (!barcode.trim()) return;
    setLoading(true);
    setSearched(true);
    setActiveBarcode(barcode.trim());
    const { data } = await supabase
      .from('barcode_history')
      .select('*, warehouse:warehouses(*), product:products(*), user:profiles!barcode_history_user_id_fkey(*), order:orders(*), customer:customers(*)')
      .eq('barcode', barcode.trim())
      .order('performed_at', { ascending: true });
    setEntries((data ?? []) as TimelineEntry[]);
    setLoading(false);
  }

  useEffect(() => {
    if (initialBarcode) loadHistory(initialBarcode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBarcode]);

  const product = entries.find((e) => e.product)?.product;
  const customer = entries.find((e) => e.customer)?.customer;
  const order = entries.find((e) => e.order)?.order;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Box History & Traceability"
        description="Trace the full life of a box from production to customer."
      />

      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadHistory(query.trim());
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Enter a barcode to trace (e.g. 2BF-PROD-000001)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 font-mono"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={loading}>
              <History className="mr-2 h-4 w-4" />
              {loading ? 'Tracing...' : 'Trace box'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : !searched ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              title="Enter a barcode to begin"
              description="The full timeline of that box will appear here."
              icon={History}
            />
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              title={`No history found for ${activeBarcode}`}
              description="This barcode has not been scanned in the system yet."
              icon={Search}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4 text-primary" />
                Box summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <SummaryItem icon={ScanLine} label="Barcode" value={activeBarcode} mono />
                <SummaryItem icon={Package} label="Product" value={product?.name ?? '—'} />
                <SummaryItem icon={ShoppingCart} label="Order" value={order?.order_number ?? '—'} />
                <SummaryItem icon={User} label="Customer" value={customer?.customer_name ?? '—'} />
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-primary" />
                Full timeline ({entries.length} events)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-6 pl-8">
                <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
                {entries.map((e, i) => {
                  const meta = ACTION_META[e.action] ?? { icon: History, color: 'bg-slate-500 text-white', label: e.action };
                  const Icon = meta.icon;
                  return (
                    <div key={e.id} className="relative">
                      <div className={`absolute -left-8 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background ${meta.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-foreground">{meta.label}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(e.performed_at)}</p>
                          </div>
                          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                            Step {i + 1}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                          <DetailItem icon={User} label="Performed by" value={e.user?.full_name ?? '—'} />
                          <DetailItem icon={Package} label="Product" value={e.product?.name ?? '—'} />
                          <DetailItem icon={WarehouseIcon} label="Warehouse" value={e.warehouse ? `${e.warehouse.code} — ${e.warehouse.name}` : '—'} />
                          <DetailItem icon={ShoppingCart} label="Order" value={e.order?.order_number ?? '—'} />
                          <DetailItem icon={Building2} label="Customer" value={e.customer?.customer_name ?? '—'} />
                          {e.notes && <DetailItem icon={History} label="Notes" value={e.notes} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryItem({ icon: Icon, label, value, mono }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className={`mt-1 text-sm font-medium text-foreground ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div>
        <span className="text-xs text-muted-foreground">{label}: </span>
        <span className="text-sm text-foreground">{value}</span>
      </div>
    </div>
  );
}

export default function BoxHistoryPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-muted-foreground">Loading...</div>}>
      <BoxHistoryContent />
    </Suspense>
  );
}
