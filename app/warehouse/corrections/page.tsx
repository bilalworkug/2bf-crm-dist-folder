'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/nav';
import { AlertCircle, Search, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { EmptyState } from '@/components/empty-state';
import { StatCard } from '@/components/stat-card';

export default function WarehouseCorrectionsPage() {
  const { profile } = useAuth();
  const [barcode, setBarcode] = useState('');
  const [boxData, setBoxData] = useState<any>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [newWhId, setNewWhId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from('warehouses').select('*').order('code').then(({ data }) => {
      if (data) setWarehouses(data);
    });
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!barcode.trim()) return;
    setLoading(true);
    const { data, error } = await supabase.from('boxes').select('*, warehouse:warehouses(*)').eq('barcode', barcode.trim()).single();
    if (error || !data) {
      toast.error('Barcode not found');
      setBoxData(null);
    } else {
      setBoxData(data);
      setNewWhId(data.warehouse_id || '');
    }
    setLoading(false);
  }

  async function handleCorrect(e: React.FormEvent) {
    e.preventDefault();
    if (!boxData || !profile) return;
    if (!reason.trim()) return toast.error('Reason mandatory');

    setSubmitting(true);
    const { error } = await supabase.rpc('fn_correct_warehouse_box', {
      p_barcode: boxData.barcode,
      p_new_warehouse_id: newWhId,
      p_reason: reason
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Warehouse corrected');
      setBoxData(null);
      setBarcode('');
    }
    setSubmitting(false);
  }

  if (profile && !['admin', 'warehouse_manager'].includes(profile.role)) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <EmptyState title="Access Denied" description="Only Warehouse Managers can access this." icon={AlertCircle} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5"><Undo2 className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Warehouse Corrections</h1>
          <p className="text-sm text-muted-foreground">Fix incorrect warehouse assignment.</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-card p-6 shadow-sm">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 space-y-2">
            <Label>Scan Barcode to Correct</Label>
            <div className="flex gap-2">
              <Input placeholder="Scan barcode..." value={barcode} onChange={e => setBarcode(e.target.value)} autoFocus />
              <Button type="submit" disabled={loading}><Search className="h-4 w-4 mr-2" />Find</Button>
            </div>
          </div>
        </form>
      </div>

      {boxData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Current Status" value={boxData.status} accent="primary" />
            <StatCard label="Current Warehouse" value={boxData.warehouse?.code || 'None'} />
          </div>

          {boxData.status === 'in_warehouse' ? (
            <div className="rounded-xl border border-white/10 bg-card p-6 shadow-sm">
              <form onSubmit={handleCorrect} className="space-y-4">
                <div className="space-y-2">
                  <Label>Correct Warehouse</Label>
                  <select value={newWhId} onChange={(e) => setNewWhId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" required>
                    <option value="" disabled>Select</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.code}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white" disabled={submitting}>Confirm</Button>
              </form>
            </div>
          ) : (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center text-destructive">
              <p>Cannot correct warehouse. Box is in <strong>{boxData.status}</strong> status.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
