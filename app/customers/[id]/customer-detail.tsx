'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Customer, Order, OrderItem, Product, Warehouse, Profile, Dispatch } from '@/lib/types';
import { Truck } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, ShoppingCart, Wallet, Package, User, Undo2, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatDate, formatMoney } from '@/lib/format';

export default function CustomerDetailClient() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [customer, setCustomer] = useState<(Customer & { sales_person?: Profile | null }) | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: c } = await supabase
        .from('customers')
        .select('*, sales_person:profiles!customers_sales_person_id_fkey(*)')
        .eq('id', id)
        .maybeSingle();
      setCustomer(c as (Customer & { sales_person?: Profile | null }) | null);

      const { data: ords } = await supabase
        .from('orders')
        .select('*, sales_person:profiles!sales_person_id(full_name)')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });
      const orderList = (ords ?? []) as any[];

      const withItems = await Promise.all(
        orderList.map(async (o) => {
          const { data: items } = await supabase
            .from('order_items')
            .select('*, product:products(*), warehouse:warehouses(*)')
            .eq('order_id', o.id);
          const { data: dispatches } = await supabase
            .from('dispatches')
            .select('*, product:products(*)')
            .eq('order_id', o.id);
          const { data: payments } = await supabase
            .from('payments')
            .select('*, processed_by_profile:profiles!payments_processed_by_fkey(full_name)')
            .eq('order_id', o.id);
          const { data: returns } = await supabase
            .from('returns')
            .select('*, product:products(*)')
            .eq('order_id', o.id);
          const { data: deliveryItems } = await supabase
            .from('delivery_items')
            .select('*, delivery:deliveries(*)')
            .eq('order_id', o.id);

          return { 
            ...o, 
            items: (items ?? []) as any[], 
            dispatches: (dispatches ?? []) as any[],
            payments: (payments ?? []) as any[],
            returns: (returns ?? []) as any[],
            delivery_items: (deliveryItems ?? []) as any[],
          };
        })
      );
      setOrders(withItems);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <div className="py-24 text-center text-muted-foreground">Loading customer...</div>;
  }

  if (!customer) {
    return (
      <div className="space-y-4">
        <Link href="/customers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to customers
        </Link>
        <EmptyState title="Customer not found" />
      </div>
    );
  }

  const totalSpent = orders.reduce((s, o) => s + Number(o.total_amount), 0);
  const totalPaid = orders.reduce((s, o) => s + Number(o.paid_amount), 0);
  const outstanding = totalSpent - totalPaid;

  return (
    <div className="space-y-6">
      <Link href="/customers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>

      <PageHeader
        title={customer.customer_name}
        description={customer.company_name ?? 'Individual customer'}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total orders" value={orders.length} icon={ShoppingCart} accent="primary" />
        <StatCard label="Total spent" value={formatMoney(totalSpent)} icon={Package} accent="neutral" />
        <StatCard label="Paid" value={formatMoney(totalPaid)} icon={Wallet} accent="success" />
        <StatCard label="Outstanding" value={formatMoney(outstanding)} icon={Wallet} accent={outstanding > 0 ? 'destructive' : 'neutral'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" /> Customer profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailRow label="First name" value={customer.first_name} />
            <DetailRow label="Last name" value={customer.last_name} />
            <DetailRow label="Company" value={customer.company_name} />
            <DetailRow label="Phone" value={customer.phone} />
            <DetailRow label="Email" value={customer.email} />
            <DetailRow label="Location" value={customer.location} />
            <DetailRow label="Contact person" value={customer.contact_person} />
            <DetailRow label="Sales person" value={customer.sales_person?.full_name ?? '—'} />
            <DetailRow label="Created" value={formatDate(customer.created_at)} />
            {customer.notes && (
              <div className="pt-2">
                <p className="text-xs font-medium text-muted-foreground">Notes</p>
                <p className="mt-1 text-sm text-foreground">{customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order history & purchase timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <EmptyState title="No orders yet" description="This customer has not placed any orders." />
              ) : (
                <div className="space-y-6">
                  {orders.map((o) => (
                    <div key={o.id} className="rounded-lg border p-4 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                        <div>
                          <Link href={`/orders/${o.id}`} className="font-medium text-foreground hover:underline">
                            {o.order_number}
                          </Link>
                          <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}{o.sales_person ? ` · ${o.sales_person.full_name}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={o.status} />
                          <span className="text-sm font-medium">{formatMoney(o.total_amount)}</span>
                        </div>
                      </div>

                      {/* Items with pricing */}
                      <div className="pl-4 border-l-2 border-primary/20 space-y-2">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider">Order Items</p>
                        {o.items.map((it: any) => (
                          <div key={it.id} className="flex items-center justify-between text-sm gap-2">
                            <span className="text-foreground">{it.product?.name ?? '—'}</span>
                            <span className="text-muted-foreground text-right">
                              {it.quantity} × {formatMoney(it.unit_price)}
                              {it.discount_amount > 0 && <span className="text-amber-500 ml-1">(-{formatMoney(it.discount_amount)})</span>}
                              <span className="ml-2 text-foreground font-medium">{formatMoney(it.quantity * it.unit_price)}</span>
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Payments */}
                      {o.payments && o.payments.length > 0 && (
                        <div className="pl-4 border-l-2 border-green-500/30 space-y-2">
                          <p className="text-xs font-semibold text-green-600 uppercase tracking-wider flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> Payments
                          </p>
                          {o.payments.map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between text-sm">
                              <div>
                                <span className="text-foreground capitalize">{p.payment_method}</span>
                                {p.reference_number && <span className="text-xs text-muted-foreground ml-2">Ref: {p.reference_number}</span>}
                                {p.processed_by_profile && <span className="text-xs text-muted-foreground ml-2">by {p.processed_by_profile.full_name}</span>}
                              </div>
                              <span className="text-green-600 font-medium">+{formatMoney(p.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Dispatches */}
                      {o.dispatches && o.dispatches.length > 0 && (
                        <div className="pl-4 border-l-2 border-blue-500/30 space-y-2">
                          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                            <Package className="w-3 h-3" /> Dispatched Barcodes
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {o.dispatches.map((d: any) => (
                              <span key={d.id} className="inline-block px-2 py-1 bg-muted text-xs font-mono rounded">
                                {d.barcode}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Returns */}
                      {o.returns && o.returns.length > 0 && (
                        <div className="pl-4 border-l-2 border-red-500/30 space-y-2">
                          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider flex items-center gap-1">
                            <Undo2 className="w-3 h-3" /> Returns
                          </p>
                          {o.returns.map((r: any) => (
                            <div key={r.id} className="flex flex-col text-sm border bg-red-50/50 dark:bg-red-950/20 p-2 rounded">
                              <div className="flex justify-between">
                                <span className="font-mono text-xs">{r.barcode}</span>
                                <StatusBadge status={r.approval_status === 'pending' ? 'pending' : r.condition === 'good' ? 'completed' : 'cancelled'} />
                              </div>
                              <span className="text-xs text-muted-foreground mt-1 capitalize">{r.product?.name} • {r.condition}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Delivered Boxes */}
                      {o.delivery_items && o.delivery_items.length > 0 && (
                        <div className="pl-4 border-l-2 border-emerald-500/30 space-y-2">
                          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                            <Truck className="w-3 h-3" /> Delivered Boxes
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {o.delivery_items.map((di: any) => (
                              <span key={di.id} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-xs font-mono rounded text-emerald-600">
                                ✓ {di.barcode}
                              </span>
                            ))}
                          </div>
                          {o.delivery_items[0]?.delivery?.receiver_name && (
                            <p className="text-xs text-muted-foreground">Receiver: {o.delivery_items[0].delivery.receiver_name}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? '—'}</span>
    </div>
  );
}
