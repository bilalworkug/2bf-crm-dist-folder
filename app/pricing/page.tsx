'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/nav';
import { 
  Building2, Plus, RefreshCw, AlertCircle, History, BadgeDollarSign, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { StatCard } from '@/components/stat-card';
import { EmptyState } from '@/components/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
}

interface PriceHistory {
  id: string;
  price: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_at: string;
  profile: { full_name: string, email: string } | null;
}

export default function PricingPage() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [activePrices, setActivePrices] = useState<Record<string, number>>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [history, setHistory] = useState<PriceHistory[]>([]);
  
  const [newPrice, setNewPrice] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      fetchHistory(selectedProduct.id);
    }
  }, [selectedProduct]);

  async function fetchProducts() {
    setLoading(true);
    const { data: prods } = await supabase.from('products').select('*').order('name');
    if (prods) setProducts(prods);

    const { data: prices } = await supabase
      .from('product_prices')
      .select('product_id, price')
      .eq('is_active', true);
    
    if (prices) {
      const map: Record<string, number> = {};
      prices.forEach(p => map[p.product_id] = p.price);
      setActivePrices(map);
    }
    setLoading(false);
  }

  async function fetchHistory(productId: string) {
    const { data, error } = await supabase
      .from('product_prices')
      .select('*, profile:profiles(full_name, email)')
      .eq('product_id', productId)
      .order('effective_from', { ascending: false });
    
    if (data) {
      setHistory(data as any);
    }
  }

  async function handleSetPrice(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    if (!profile) return toast.error('Not authenticated');

    const priceNum = parseFloat(newPrice);
    if (isNaN(priceNum) || priceNum < 0) return toast.error('Invalid price');
    if (!reason.trim()) return toast.error('Reason is required');

    setSubmitting(true);
    const { error } = await supabase.rpc('fn_set_product_price', {
      p_product_id: selectedProduct.id,
      p_new_price: priceNum,
      p_admin_id: profile.id,
      p_admin_role: profile.role,
      p_reason: reason
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Price updated successfully');
      setNewPrice('');
      setReason('');
      fetchProducts();
      fetchHistory(selectedProduct.id);
    }
    setSubmitting(false);
  }

  if (profile && !canAccess('/pricing', profile.role)) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <EmptyState 
          title="Access Denied" 
          description="You do not have permission to view pricing management."
          icon={AlertCircle} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Pricing Management</h1>
          <p className="text-sm text-muted-foreground">Manage standard product prices and view historical changes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Products List */}
        <div className="rounded-xl border border-white/10 bg-card shadow-sm lg:col-span-1">
          <div className="border-b border-white/10 px-6 py-4">
            <h2 className="font-semibold text-card-foreground">Products</h2>
          </div>
          <div className="divide-y divide-white/5">
            {products.map(p => {
              const currentPrice = activePrices[p.id];
              const isSelected = selectedProduct?.id === p.id;
              
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className={`flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-white/5 ${isSelected ? 'bg-primary/10' : ''}`}
                >
                  <div>
                    <p className="font-medium text-foreground">{p.name}</p>
                    <p className="text-sm text-muted-foreground">{p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-amber-500">
                      {currentPrice !== undefined ? `$${currentPrice.toFixed(2)}` : 'Not set'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Product Details */}
        <div className="space-y-6 lg:col-span-2">
          {selectedProduct ? (
            <>
              {/* Set Price Form */}
              <div className="rounded-xl border border-white/10 bg-card shadow-sm p-6">
                <h2 className="mb-4 text-lg font-semibold text-card-foreground">Update Standard Price</h2>
                <form onSubmit={handleSetPrice} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>New Price (USD)</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={newPrice}
                        onChange={e => setNewPrice(e.target.value)}
                        placeholder="e.g. 10.50"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Reason for Change</Label>
                      <Input 
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="e.g. Annual price adjustment"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white">
                    {submitting ? 'Saving...' : 'Set Active Price'}
                  </Button>
                </form>
              </div>

              {/* Price History */}
              <div className="rounded-xl border border-white/10 bg-card shadow-sm">
                <div className="border-b border-white/10 px-6 py-4 flex items-center gap-2">
                  <History className="h-5 w-5 text-muted-foreground" />
                  <h2 className="font-semibold text-card-foreground">Price History for {selectedProduct.name}</h2>
                </div>
                {history.length === 0 ? (
                  <div className="p-6">
                    <EmptyState title="No history" description="This product has no recorded price history." />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Effective From</TableHead>
                        <TableHead>Effective To</TableHead>
                        <TableHead>Set By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map(h => (
                        <TableRow key={h.id}>
                          <TableCell className="font-medium">${h.price.toFixed(2)}</TableCell>
                          <TableCell>
                            {h.is_active 
                              ? <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-500">Active</span>
                              : <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Historical</span>
                            }
                          </TableCell>
                          <TableCell>{new Date(h.effective_from).toLocaleString()}</TableCell>
                          <TableCell>{h.effective_to ? new Date(h.effective_to).toLocaleString() : '—'}</TableCell>
                          <TableCell>{h.profile?.full_name || h.profile?.email || 'System'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[400px] items-center justify-center rounded-xl border border-white/10 bg-card/50">
              <EmptyState 
                title="No product selected" 
                description="Select a product from the list to view its price history and update its active price."
                icon={BadgeDollarSign} 
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
