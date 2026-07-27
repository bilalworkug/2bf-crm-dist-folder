'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Customer, Order, OrderItem, Product, Warehouse, Profile, Dispatch } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, ShoppingCart, Wallet, Package, User } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatDate, formatMoney } from '@/lib/format';

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [customer, setCustomer] = useState<(Customer & { sales_person?: Profile | null }) | null>(null);
  const [orders, setOrders] = useState<(Order & { items?: (OrderItem & { product?: Product; warehouse?: Warehouse })[]; dispatches?: Dispatch[] })[]>([]);
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
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });
      const orderList = (ords ?? []) as Order[];

      const withItems = await Promise.all(
        orderList.map(async (o) => {
          const { data: items } = await supabase
            .from('order_items')
            .select('*, product:products(*), warehouse:warehouses(*)')
            .eq('order_id', o.id);
          const { data: dispatches } = await supabase
            .from('dispatches')
            .select('*')
            .eq('order_id', o.id);
          return { ...o, items: (items ?? []) as (OrderItem & { product?: Product; warehouse?: Warehouse })[], dispatches: (dispatches ?? []) as Dispatch[] };
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
                <div className="space-y-4">
                  {orders.map((o) => (
                    <div key={o.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <Link href={`/orders/${o.id}`} className="font-medium text-foreground hover:underline">
                            {o.order_number}
                          </Link>
                          <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={o.status} />
                          <span className="text-sm font-medium">{formatMoney(o.total_amount)}</span>
                        </div>
                      </div>
                      {o.items && o.items.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {o.items.map((it) => (
                            <div key={it.id} className="flex items-center justify-between text-sm">
                              <span className="text-foreground">{it.product?.name ?? '—'}</span>
                              <span className="text-muted-foreground">
                                {it.quantity} {it.product?.unit ?? 'cartons'} · {it.warehouse?.code ?? '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {o.dispatches && o.dispatches.length > 0 && (
                        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                          {o.dispatches.length} box(es) dispatched
                        </p>
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
