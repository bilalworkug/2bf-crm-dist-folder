'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Order, Customer, Profile, Warehouse, Product } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { ShoppingCart, Plus, Search, Clock, CheckCircle2, XCircle, Download, Trash2, Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDateShort, formatMoney } from '@/lib/format';
import { ORDER_STATUSES } from '@/lib/types';
import { ExportDropdown } from '@/components/export-dropdown';
import { SavedViewsBar } from '@/components/saved-views-bar';

export default function OrdersPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<(Order & { customer?: Customer; sales_person?: Profile | null })[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activePrices, setActivePrices] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    customer_id: string;
    notes: string;
    payment_type: 'pay_now' | 'credit';
    items: { product_id: string; quantity: number }[];
  }>({
    customer_id: '',
    notes: '',
    payment_type: 'pay_now',
    items: [{ product_id: '', quantity: 1 }],
  });

  const [creditStatus, setCreditStatus] = useState<any>(null);
  const [fetchingCredit, setFetchingCredit] = useState(false);

  const canEdit = profile && ['admin', 'sales', 'dispatch', 'accounts', 'manager'].includes(profile.role);

  useEffect(() => {
    load();
    (async () => {
      const [{ data: c }, { data: p }, { data: pr }] = await Promise.all([
        supabase.from('customers').select('*').order('customer_name'),
        supabase.from('products').select('*').eq('active', true).order('name'),
        supabase.from('product_prices').select('product_id, price').eq('active', true),
      ]);
      setCustomers(c ?? []);
      setProducts(p ?? []);
      
      const priceMap = new Map<string, number>();
      if (pr) {
          pr.forEach(priceObj => {
              priceMap.set(priceObj.product_id, Number(priceObj.price));
          });
      }
      setActivePrices(priceMap);
    })();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, customer:customers(*), sales_person:profiles!orders_sales_person_id_fkey(*)')
      .order('created_at', { ascending: false });
    setOrders((data ?? []) as (Order & { customer?: Customer; sales_person?: Profile | null })[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer?.customer_name.toLowerCase().includes(q) ||
        o.customer?.company_name?.toLowerCase().includes(q)
      );
    });
  }, [orders, search, statusFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id) return toast.error('Select a customer');
    if (!form.items[0].product_id) return toast.error('Add at least one product');

    // Filter valid items
    const validItems = form.items.filter(it => it.product_id && it.quantity > 0);
    if (validItems.length === 0) return toast.error('Add at least one valid product');

    // Pre-flight check for missing prices
    for (const it of validItems) {
        if (!activePrices.has(it.product_id)) {
            return toast.error('Cannot order a product without an active price. Contact an Admin.');
        }
    }

    if (form.payment_type === 'credit') {
        if (!creditStatus?.credit_allowed) {
            return toast.error('This customer is not authorized for credit.');
        }
        
        let orderTotal = 0;
        validItems.forEach(it => {
            orderTotal += (activePrices.get(it.product_id) || 0) * it.quantity;
        });
        
        if (orderTotal > creditStatus.available_credit) {
            return toast.error(`Order total exceeds available credit (${formatMoney(creditStatus.available_credit)}).`);
        }
    }

    try {
        const { data, error } = await supabase.rpc('fn_create_sales_order', {
            p_customer_id: form.customer_id,
            p_notes: form.notes,
            p_items: validItems,
            p_payment_type: form.payment_type
        });

        if (error) throw error;

        toast.success('Order created successfully!');
        setOpen(false);
        setForm({ customer_id: '', notes: '', payment_type: 'pay_now', items: [{ product_id: '', quantity: 1 }] });
        setCreditStatus(null);
        load();
    } catch (err: any) {
        toast.error(err.message || 'Failed to create order');
    }
  }

  function addItem() {
    setForm({ ...form, items: [...form.items, { product_id: '', quantity: 1 }] });
  }

  function removeItem(index: number) {
    if (form.items.length === 1) return;
    const newItems = [...form.items];
    newItems.splice(index, 1);
    setForm({ ...form, items: newItems });
  }

  function updateItem(idx: number, field: string, value: string | number) {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, items });
  }

  async function handleCustomerChange(customerId: string) {
      setForm({ ...form, customer_id: customerId, payment_type: 'pay_now' });
      setCreditStatus(null);
      
      if (!customerId) return;
      
      setFetchingCredit(true);
      try {
          const { data, error } = await supabase.rpc('fn_get_customer_credit_status', { p_customer_id: customerId });
          if (error) throw error;
          setCreditStatus(data);
      } catch (err: any) {
          console.error("Error fetching credit status", err);
      } finally {
          setFetchingCredit(false);
      }
  }

  // Calculate Display Totals
  let displayTotal = 0;
  
  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Create and track customer orders through the fulfillment flow."
        actions={
          <div className="flex gap-2">
            <ExportDropdown
              filenameBase="orders"
              title="Orders Report"
              headers={['Order #', 'Customer', 'Status', 'Total', 'Paid', 'Sales person', 'Created']}
              rows={filtered.map((o) => [o.order_number, o.customer?.customer_name ?? '', o.status, o.total_amount, o.paid_amount, o.sales_person?.full_name ?? '', formatDateShort(o.created_at)])}
            />
            {canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> New order</Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl w-[95vw] md:w-auto max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New order</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Customer *</Label>
                      <Select value={form.customer_id} onValueChange={handleCustomerChange}>
                        <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.customer_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {form.customer_id && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-slate-50">
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700">Credit Status</Label>
                            {fetchingCredit ? (
                                <p className="text-sm text-muted-foreground animate-pulse">Checking credit...</p>
                            ) : creditStatus?.credit_allowed ? (
                                <div className="space-y-1">
                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none mb-2">✓ Credit Approved</Badge>
                                    <div className="grid grid-cols-2 text-sm">
                                        <span className="text-muted-foreground">Credit Limit:</span>
                                        <span className="font-mono">{formatMoney(creditStatus.credit_limit)}</span>
                                        <span className="text-muted-foreground">Outstanding:</span>
                                        <span className="font-mono text-red-600">{formatMoney(creditStatus.outstanding)}</span>
                                        <span className="text-muted-foreground font-medium mt-1">Available:</span>
                                        <span className="font-mono font-medium text-green-600 mt-1">{formatMoney(creditStatus.available_credit)}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <Badge variant="outline" className="text-muted-foreground mb-2">Payment Required</Badge>
                                    <p className="text-sm text-muted-foreground">Credit: Disabled</p>
                                </div>
                            )}
                        </div>
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold text-slate-700">Payment Type</Label>
                            <div className="flex flex-col space-y-2">
                                <label className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer transition-colors ${form.payment_type === 'pay_now' ? 'bg-primary/5 border-primary' : 'bg-white hover:bg-slate-100'}`}>
                                    <input 
                                        type="radio" 
                                        name="payment_type" 
                                        value="pay_now" 
                                        checked={form.payment_type === 'pay_now'} 
                                        onChange={() => setForm({...form, payment_type: 'pay_now'})} 
                                        className="h-4 w-4 text-primary"
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-medium">PAY NOW</span>
                                        <span className="text-xs text-muted-foreground">Standard order, payment required</span>
                                    </div>
                                </label>
                                <label className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer transition-colors ${!creditStatus?.credit_allowed ? 'opacity-50 cursor-not-allowed bg-slate-100' : form.payment_type === 'credit' ? 'bg-primary/5 border-primary' : 'bg-white hover:bg-slate-100'}`}>
                                    <input 
                                        type="radio" 
                                        name="payment_type" 
                                        value="credit" 
                                        disabled={!creditStatus?.credit_allowed}
                                        checked={form.payment_type === 'credit'} 
                                        onChange={() => setForm({...form, payment_type: 'credit'})} 
                                        className="h-4 w-4 text-primary"
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-medium">CREDIT</span>
                                        <span className="text-xs text-muted-foreground">Buy on debt ({creditStatus?.payment_terms_days || 30} days terms)</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                  )}

                  <div className="space-y-2 bg-gray-50 p-3 md:p-4 rounded-md border">
                    <Label className="text-base font-bold">Products</Label>
                    
                    <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground mb-2 px-1">
                        <div className="col-span-5">Product</div>
                        <div className="col-span-2">Quantity</div>
                        <div className="col-span-2 text-right">Unit Price</div>
                        <div className="col-span-2 text-right">Line Total</div>
                        <div className="col-span-1"></div>
                    </div>

                    {form.items.map((it, idx) => {
                      const price = activePrices.has(it.product_id) ? activePrices.get(it.product_id)! : 0;
                      const hasNoPrice = it.product_id !== '' && !activePrices.has(it.product_id);
                      const lineTotal = price * it.quantity;
                      displayTotal += lineTotal;
                      
                      return (
                      <div key={idx} className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-2 md:items-center mb-6 md:mb-2 border-b md:border-b-0 pb-4 md:pb-0">
                        <div className="md:col-span-5">
                          <Label className="md:hidden text-xs text-muted-foreground mb-1 block">Product</Label>
                          <Select value={it.product_id} onValueChange={(v) => updateItem(idx, 'product_id', v)}>
                            <SelectTrigger><SelectValue placeholder="Select Product" /></SelectTrigger>
                            <SelectContent>
                              {products.map((p) => {
                                const pPrice = activePrices.get(p.id);
                                const hasPrice = pPrice !== undefined && pPrice > 0;
                                const displayStr = hasPrice ? `ETB ${pPrice.toFixed(2)}` : 'No price set';
                                return (
                                  <SelectItem key={p.id} value={p.id} disabled={!hasPrice}>
                                    {p.name} — {displayStr}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          {hasNoPrice && (
                              <p className="text-xs text-red-500 mt-1">Price unavailable. Contact Admin.</p>
                          )}
                        </div>
                        <div className="md:col-span-2">
                          <Label className="md:hidden text-xs text-muted-foreground mb-1 block">Quantity</Label>
                          <Input type="number" min={1} placeholder="Qty" value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} />
                        </div>
                        <div className="md:col-span-2 flex justify-between md:block md:text-right text-sm text-gray-500 bg-gray-100 p-3 md:p-2 rounded md:flex md:items-center md:justify-end">
                            <span className="md:hidden text-xs font-medium text-muted-foreground">Unit Price:</span>
                            <span>{hasNoPrice ? 'N/A' : `ETB ${price.toFixed(2)}`}</span>
                        </div>
                        <div className="md:col-span-2 flex justify-between md:block md:text-right font-medium text-sm bg-gray-100 p-3 md:p-2 rounded md:flex md:items-center md:justify-end">
                            <span className="md:hidden text-xs font-medium text-muted-foreground">Line Total:</span>
                            <span>{hasNoPrice ? 'N/A' : `ETB ${lineTotal.toFixed(2)}`}</span>
                        </div>
                        <div className="md:col-span-1 flex justify-end md:justify-end mt-2 md:mt-0">
                          <Button variant="outline" size="sm" className="md:border-none md:shadow-none" onClick={() => removeItem(idx)} disabled={form.items.length === 1}>
                            <Trash2 className="h-4 w-4 text-red-500 md:mr-0 mr-2" /> <span className="md:hidden text-red-500">Remove</span>
                          </Button>
                        </div>
                      </div>
                      )
                    })}
                    <Button variant="outline" size="sm" onClick={addItem} className="mt-2 w-full md:w-auto h-10 md:h-auto">
                      <Plus className="h-4 w-4 mr-2" /> Add Item
                    </Button>
                  </div>

                  <div className="p-4 bg-gray-50 flex items-center justify-between mt-auto">
                    <div>
                        <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">Total Amount</p>
                        <p className="text-2xl font-bold text-primary">ETB {displayTotal.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Notes (Optional)</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any specific requirements..." />
                  </div>
                  <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto h-11 sm:h-auto">Cancel</Button>
                    <Button type="submit" className="w-full sm:w-auto h-11 sm:h-auto">Create Order</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            ) : undefined}
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3">
        <StatCard label="Total Orders" value={orders.length} icon={ShoppingCart} accent="primary" />
        <StatCard label="Pending / Cleared" value={orders.filter((o) => o.status === 'pending' || o.status === 'approved').length} icon={Clock} accent="warning" />
        <StatCard label="In Dispatch" value={orders.filter((o) => o.status === 'dispatched' || o.status === 'partially_dispatched').length} icon={Truck} accent="neutral" />
        <StatCard label="Handed Over" value={orders.filter((o) => o.status === 'handed_over').length} icon={CheckCircle2} accent="primary" />
        <StatCard label="Completed" value={orders.filter((o) => o.status === 'completed').length} icon={CheckCircle2} accent="success" />
      </div>

      <Card>
        <CardContent className="p-4">
          <SavedViewsBar
            storageKey="orders"
            views={[
              { id: 'all', label: 'All Orders', badge: orders.length },
              { id: 'pending', label: 'Pending / Cleared', badge: orders.filter((o) => o.status === 'pending' || o.status === 'approved').length },
              { id: 'dispatched', label: 'Dispatched', badge: orders.filter((o) => o.status === 'dispatched' || o.status === 'partially_dispatched').length },
              { id: 'handed_over', label: 'Handed Over', badge: orders.filter((o) => o.status === 'handed_over').length },
              { id: 'completed', label: 'Completed', badge: orders.filter((o) => o.status === 'completed').length },
            ]}
            activeView={statusFilter}
            onSelectView={(v) => setStatusFilter(v)}
            className="mb-3.5 pb-2 border-b border-border/50"
          />

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search order number or customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No orders found" />
          ) : (
            <div className="space-y-4">
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Sales person</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((o) => (
                      <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/orders/detail?id=${o.id}`)}>
                          <TableCell className="font-mono font-medium">{o.order_number}</TableCell>
                          <TableCell>{o.customer?.customer_name ?? '—'}</TableCell>
                          <TableCell><StatusBadge status={o.status} /></TableCell>
                          <TableCell className="font-medium">{formatMoney(o.total_amount)}</TableCell>
                          <TableCell>{formatMoney(o.paid_amount)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{o.sales_person?.full_name ?? '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDateShort(o.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {filtered.map((o) => (
                  <div key={o.id} className="rounded-lg border border-border/80 p-3.5 bg-card text-card-foreground shadow-2xs flex flex-col space-y-2 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push(`/orders/detail?id=${o.id}`)}>
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-semibold text-primary">{o.order_number}</span>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Customer:</span> {o.customer?.customer_name ?? '—'}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Total:</span> <span className="font-medium">{formatMoney(o.total_amount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t mt-2">
                      <span>{o.sales_person?.full_name ?? '—'}</span>
                      <span>{formatDateShort(o.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
