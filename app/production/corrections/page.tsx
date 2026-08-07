'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/nav';
import { AlertCircle, ScanLine, Search, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { EmptyState } from '@/components/empty-state';
import { StatCard } from '@/components/stat-card';

export default function ProductionCorrectionsPage() {
  const { profile } = useAuth();
  const [barcode, setBarcode] = useState('');
  const [boxData, setBoxData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [newProductId, setNewProductId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from('products').select('*').order('name').then(({ data }) => {
      if (data) setProducts(data);
    });
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!barcode.trim()) return;
    
    setLoading(true);
    setBoxData(null);
    setNewProductId('');
    setReason('');

    const { data, error } = await supabase
      .from('boxes')
      .select('*, product:products(*)')
      .eq('barcode', barcode.trim())
      .single();
    
    if (error || !data) {
      toast.error('Barcode not found');
    } else {
      setBoxData(data);
      setNewProductId(data.product_id);
    }
    setLoading(false);
  }

  async function handleCorrect(e: React.FormEvent) {
    e.preventDefault();
    if (!boxData || !profile) return;

    if (newProductId === boxData.product_id) {
      return toast.error('Please select a different product to correct');
    }

    if (!reason.trim()) {
      return toast.error('Correction reason is mandatory');
    }

    setSubmitting(true);
    const { error } = await supabase.rpc('fn_correct_production_box', {
      p_barcode: boxData.barcode,
      p_new_product_id: newProductId,
      p_reason: reason,
      p_manager_id: profile.id,
      p_manager_role: profile.role
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Production box corrected successfully');
      setBoxData(null);
      setBarcode('');
    }
    setSubmitting(false);
  }

  if (profile && !canAccess('/production/corrections', profile.role)) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <EmptyState 
          title="Access Denied" 
          description="You do not have permission to view production corrections."
          icon={AlertCircle} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Undo2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Production Corrections</h1>
          <p className="text-sm text-muted-foreground">Fix incorrect product scans for boxes in production or warehouse.</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-card p-6 shadow-sm">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 space-y-2">
            <Label>Scan Barcode to Correct</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Scan or type barcode..."
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                autoFocus
              />
              <Button type="submit" disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                Find Box
              </Button>
            </div>
          </div>
        </form>
      </div>

      {boxData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Current Status" value={boxData.status} accent="primary" />
            <StatCard label="Current Product" value={boxData.product.name} />
          </div>

          {['produced', 'in_warehouse'].includes(boxData.status) ? (
            <div className="rounded-xl border border-white/10 bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-card-foreground">Execute Correction</h2>
              <form onSubmit={handleCorrect} className="space-y-4">
                <div className="space-y-2">
                  <Label>Correct Product</Label>
                  <select
                    value={newProductId}
                    onChange={(e) => setNewProductId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    <option value="" disabled>Select correct product</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Reason for Correction</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Operator selected wrong product during scan"
                    required
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white" disabled={submitting}>
                    {submitting ? 'Applying Correction...' : 'Confirm Correction'}
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center text-destructive">
              <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-80" />
              <h3 className="font-semibold text-lg">Correction Not Allowed</h3>
              <p className="text-sm opacity-90 mt-1">
                This box is in <strong>{boxData.status}</strong> status. Production corrections can only be made when the box is <em>produced</em> or <em>in_warehouse</em>.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
