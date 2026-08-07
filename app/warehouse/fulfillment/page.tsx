'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { PackageCheck, Search, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import type { Order, OrderItem, Product, Warehouse, Profile } from '@/lib/types';
import { StatusBadge } from '@/components/status-badge';

export default function FulfillmentPage() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<(Order & { customer?: any })[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [orderItems, setOrderItems] = useState<(OrderItem & { product?: Product, allocated_count: number })[]>([]);
  
  const [barcode, setBarcode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canEdit = profile && ['admin', 'warehouse', 'manager'].includes(profile.role);
  const warehouseId = profile?.warehouse_id ?? '';

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (selectedOrderId) {
      loadOrderItems(selectedOrderId);
    } else {
      setOrderItems([]);
    }
  }, [selectedOrderId]);

  async function loadOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*, customer:customers(customer_name)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    setOrders((data ?? []) as (Order & { customer?: any })[]);
  }

  async function loadOrderItems(orderId: string) {
    const { data: items } = await supabase
      .from('order_items')
      .select('*, product:products(*)')
      .eq('order_id', orderId);

    const { data: allocations } = await supabase
      .from('order_box_allocations')
      .select('barcode, boxes!inner(product_id)')
      .eq('order_id', orderId);

    const itemsWithAllocations = items?.map((item: any) => {
      const allocated_count = allocations?.filter((a: any) => a.boxes?.product_id === item.product_id).length || 0;
      return { ...item, allocated_count };
    });

    setOrderItems((itemsWithAllocations ?? []) as (OrderItem & { product?: Product, allocated_count: number })[]);
  }

  async function handleAllocate(e: React.FormEvent) {
    e.preventDefault();
    if (!barcode.trim()) {
      toast.error('Enter a barcode');
      return;
    }
    if (!selectedOrderId) {
      toast.error('Select an order');
      return;
    }
    if (!warehouseId && profile?.role !== 'admin' && profile?.role !== 'manager') {
      toast.error('No warehouse assigned to your profile');
      return;
    }

    setSubmitting(true);
    setLastResult(null);

    const wId = warehouseId || '00000000-0000-0000-0000-000000000001';

    const { error } = await supabase.rpc('fn_allocate_box', {
      p_barcode: barcode.trim(),
      p_order_id: selectedOrderId,
      p_warehouse_id: wId,
      p_user_id: profile?.id,
      p_user_role: profile?.role || 'system'
    });

    if (error) {
      const msg = error.message;
      toast.error(msg);
      setLastResult({ type: 'error', message: msg });
      setSubmitting(false);
      return;
    }

    const msg = `Allocated ${barcode} to order`;
    toast.success(msg);
    setLastResult({ type: 'success', message: msg });
    setBarcode('');
    setSubmitting(false);
    loadOrderItems(selectedOrderId);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order Fulfillment (Allocation)"
        description="Scan boxes from your warehouse to allocate them to approved orders."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Select Approved Order</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Order *</Label>
                  <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                    <SelectTrigger><SelectValue placeholder="Select an approved order" /></SelectTrigger>
                    <SelectContent>
                      {orders.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.order_number} ({o.customer?.customer_name || 'No Customer'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {canEdit && selectedOrderId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageCheck className="h-4 w-4 text-primary" /> 2. Allocate Box
                </CardTitle>
                <CardDescription>
                  Scan a box to assign it to this order.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAllocate} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Barcode *</Label>
                    <Input
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="Scan or enter barcode"
                      autoFocus
                      className="font-mono"
                    />
                  </div>
                  <Button type="submit" disabled={submitting} className="w-full">
                    <PackageCheck className="mr-2 h-4 w-4" />
                    {submitting ? 'Allocating...' : 'Allocate Box'}
                  </Button>
                </form>

                {lastResult && (
                  <div className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-sm ${lastResult.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                    {lastResult.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <p>{lastResult.message}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Requirements</CardTitle>
              <CardDescription>Products and quantities required for the selected order.</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedOrderId ? (
                <EmptyState title="No order selected" />
              ) : orderItems.length === 0 ? (
                <EmptyState title="Order has no items" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Required Qty</TableHead>
                      <TableHead className="text-center">Allocated Qty</TableHead>
                      <TableHead className="text-center">Remaining Qty</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.map((item) => {
                      const remaining = item.quantity - item.allocated_count;
                      const isComplete = remaining <= 0;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.product?.name ?? '—'}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-center font-bold text-primary">{item.allocated_count}</TableCell>
                          <TableCell className="text-center text-muted-foreground">{remaining > 0 ? remaining : 0}</TableCell>
                          <TableCell className="text-right">
                            {isComplete ? (
                              <StatusBadge status="completed" />
                            ) : (
                              <StatusBadge status="pending" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
