'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Product } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Plus, Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { ExportDropdown } from '@/components/export-dropdown';

interface QuoteItem {
  product_id: string;
  products_per_carton: number;
}

export default function QuotePage() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '', email: '', notes: '',
  });
  const [items, setItems] = useState<QuoteItem[]>([{ product_id: '', products_per_carton: 1 }]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('products').select('*').order('name');
      setProducts(data ?? []);
    })();
  }, []);

  function addItem() {
    setItems([...items, { product_id: '', products_per_carton: 1 }]);
  }
  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }
  function updateItem(idx: number, field: keyof QuoteItem, value: string | number) {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    setItems(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()) {
      toast.error('Please fill in your name and phone number');
      return;
    }
    if (!items[0].product_id) {
      toast.error('Add at least one product');
      return;
    }
    setSubmitting(true);

    // Save as a customer + order for tracking
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .insert({
        first_name: form.first_name,
        last_name: form.last_name,
        customer_name: `${form.first_name} ${form.last_name}`,
        phone: form.phone,
        email: form.email,
        notes: `Quote request: ${form.notes || '—'}`,
        sales_person_id: profile?.id,
      })
      .select()
      .single();

    if (custErr) {
      toast.error(custErr.message);
      setSubmitting(false);
      return;
    }

    const orderNum = `QUOTE-${Date.now().toString().slice(-6)}`;
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        order_number: orderNum,
        customer_id: customer.id,
        status: 'pending',
        notes: `Quote request: ${form.notes || '—'}`,
        sales_person_id: profile?.id,
        total_amount: 0,
        paid_amount: 0,
      })
      .select()
      .single();

    if (orderErr) {
      toast.error(orderErr.message);
      setSubmitting(false);
      return;
    }

    const orderItems = items
      .filter((it) => it.product_id)
      .map((it) => ({
        order_id: order.id,
        product_id: it.product_id,
        quantity: it.products_per_carton,
        unit_price: 0,
      }));

    await supabase.from('order_items').insert(orderItems);

    await supabase.from('audit_logs').insert({
      user_id: profile?.id,
      action: 'order_created',
      entity_type: 'orders',
      entity_id: order.id,
      details: { order_number: orderNum, type: 'quote' },
    });

    toast.success('Quote request submitted — our team will contact you');
    setForm({ first_name: '', last_name: '', phone: '', email: '', notes: '' });
    setItems([{ product_id: '', products_per_carton: 1 }]);
    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quote / Product Order"
        description="Request a quote or place a product order. Our team will follow up."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" /> Your details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>First Name *</Label>
                    <Input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name *</Label>
                    <Input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Phone Number *</Label>
                    <Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email Address</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Products</Label>
                  {items.map((it, idx) => (
                    <div key={idx} className="flex items-end gap-2">
                      <div className="flex-1 space-y-1.5">
                        <Select value={it.product_id} onValueChange={(v) => updateItem(idx, 'product_id', v)}>
                          <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                          <SelectContent>
                            {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-40 space-y-1.5">
                        <Input
                          type="number"
                          min={1}
                          placeholder="Per carton"
                          value={it.products_per_carton}
                          onChange={(e) => updateItem(idx, 'products_per_carton', Number(e.target.value))}
                        />
                      </div>
                      {items.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add product
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label>Additional Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any special requirements..." />
                </div>

                <Button type="submit" disabled={submitting} className="w-full">
                  <Send className="mr-2 h-4 w-4" />
                  {submitting ? 'Submitting...' : 'Submit quote request'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Our products</CardTitle>
            <ExportDropdown
              filenameBase="quote_products"
              title="Available Products"
              headers={['Product', 'Category']}
              rows={products.map((p) => [p.name, p.category])}
              variant="outline"
              className="h-8"
            />
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Choose from our full range of biscuits, cookies, wafers, and chocolates.
            </p>
            <div className="space-y-2">
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <span className="font-medium text-foreground">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.category}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
