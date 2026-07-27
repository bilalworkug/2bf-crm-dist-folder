'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Order, Customer, OrderItem, Product, Warehouse, Profile, Dispatch } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Package, Truck, Wallet, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/format';
import { ORDER_STATUSES } from '@/lib/types';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { profile } = useAuth();
  const [order, setOrder] = useState<(Order & { customer?: Customer; sales_person?: Profile | null }) | null>(null);
  const [items, setItems] = useState<(OrderItem & { product?: Product; warehouse?: Warehouse })[]>([]);
  const [dispatches, setDispatches] = useState<(Dispatch & { warehouse?: Warehouse; product?: Product })[]>([]);
  const [loading, setLoading] = useState(true);

  const canEdit = profile && ['admin', 'sales', 'dispatch', 'accounts', 'manager'].includes(profile.role);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: o } = await supabase
        .from('orders')
        .select('*, customer:customers(*), sales_person:profiles!orders_sales_person_id_fkey(*)')
        .eq('id', id)
        .maybeSingle();
      setOrder(o as (Order & { customer?: Customer; sales_person?: Profile | null }) | null);

      const { data: its } = await supabase
        .from('order_items')
        .select('*, product:products(*), warehouse:warehouses(*)')
        .eq('order_id', id);
      setItems((its ?? []) as (OrderItem & { product?: Product; warehouse?: Warehouse })[]);

      const { data: dis } = await supabase
        .from('dispatches')
        .select('*, warehouse:warehouses(*), product:products(*)')
        .eq('order_id', id)
        .order('dispatched_at', { ascending: false });
      setDispatches((dis ?? []) as (Dispatch & { warehouse?: Warehouse; product?: Product })[]);

      setLoading(false);
    })();
  }, [id]);

  async function updateStatus(status: string) {
    if (!order) return;
    const { error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', order.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Order marked as ${status}`);
      setOrder({ ...order, status });
    }
  }

  if (loading) return <div className="py-24 text-center text-muted-foreground">Loading order...</div>;
  if (!order) {
    return (
      <div className="space-y-4">
        <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </Link>
        <EmptyState title="Order not found" />
      </div>
    );
  }

  const outstanding = Number(order.total_amount) - Number(order.paid_amount);

  return (
    <div className="space-y-6">
      <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <PageHeader
        title={order.order_number}
        description={`Created ${formatDate(order.created_at)}`}
        actions={
          canEdit ? (
            <Select value={order.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : <StatusBadge status={order.status} />
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total amount" value={formatMoney(order.total_amount)} icon={ShoppingCart} accent="primary" />
        <StatCard label="Paid" value={formatMoney(order.paid_amount)} icon={Wallet} accent="success" />
        <StatCard label="Outstanding" value={formatMoney(outstanding)} icon={Wallet} accent={outstanding > 0 ? 'destructive' : 'neutral'} />
        <StatCard label="Boxes dispatched" value={dispatches.length} icon={Truck} accent="warning" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailRow label="Customer" value={order.customer?.customer_name} />
            <DetailRow label="Company" value={order.customer?.company_name} />
            <DetailRow label="Phone" value={order.customer?.phone} />
            <DetailRow label="Location" value={order.customer?.location} />
            <DetailRow label="Sales person" value={order.sales_person?.full_name} />
            <DetailRow label="Status" value={<StatusBadge status={order.status} />} />
            <DetailRow label="Created" value={formatDate(order.created_at)} />
            {order.notes && (
              <div className="pt-2">
                <p className="text-xs font-medium text-muted-foreground">Notes</p>
                <p className="mt-1 text-sm">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4 text-primary" /> Order items
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <EmptyState title="No items" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">{it.product?.name ?? '—'}</TableCell>
                        <TableCell>{it.warehouse?.code ?? '—'}</TableCell>
                        <TableCell className="text-center">{it.quantity}</TableCell>
                        <TableCell className="text-right">{formatMoney(it.unit_price)}</TableCell>
                        <TableCell className="text-right font-medium">{formatMoney(it.quantity * it.unit_price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4 text-primary" /> Dispatched boxes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dispatches.length === 0 ? (
                <EmptyState title="No boxes dispatched yet" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead>Dispatched</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispatches.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-sm">{d.barcode}</TableCell>
                        <TableCell>{d.product?.name ?? '—'}</TableCell>
                        <TableCell>{d.warehouse?.code ?? '—'}</TableCell>
                        <TableCell className="text-center">{d.quantity}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(d.dispatched_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? '—'}</span>
    </div>
  );
}
