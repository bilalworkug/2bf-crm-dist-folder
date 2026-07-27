'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { ReturnRecord, Product, Warehouse, Profile, Approval } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { Undo2, AlertTriangle, Clock, PackageX, Search, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { RETURN_TYPES } from '@/lib/types';

export default function ReturnsPage() {
  const { profile } = useAuth();
  const [returns, setReturns] = useState<(ReturnRecord & { product?: Product; warehouse?: Warehouse; processor?: Profile; approval?: Approval })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ barcode: '', product_id: '', warehouse_id: '', return_type: 'returned', reason: '', quantity: 1 });

  const canEdit = profile && ['admin', 'warehouse', 'dispatch', 'manager'].includes(profile.role);

  useEffect(() => {
    load();
    (async () => {
      const [{ data: p }, { data: w }] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('warehouses').select('*').order('code'),
      ]);
      setProducts(p ?? []);
      setWarehouses(w ?? []);
    })();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('returns')
      .select('*, product:products(*), warehouse:warehouses(*), processor:profiles!returns_processed_by_fkey(*), approval:approvals(*)')
      .order('processed_at', { ascending: false });
    setReturns((data ?? []) as (ReturnRecord & { product?: Product; warehouse?: Warehouse; processor?: Profile; approval?: Approval })[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return returns.filter((r) => {
      if (typeFilter !== 'all' && r.return_type !== typeFilter) return false;
      if (!q) return true;
      return r.barcode?.toLowerCase().includes(q) || r.product?.name.toLowerCase().includes(q) || r.reason?.toLowerCase().includes(q);
    });
  }, [returns, search, typeFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.product_id || !form.warehouse_id) {
      toast.error('Select product and warehouse');
      return;
    }
    const { error } = await supabase.from('returns').insert({
      barcode: form.barcode.trim() || null,
      product_id: form.product_id,
      warehouse_id: form.warehouse_id,
      return_type: form.return_type,
      reason: form.reason.trim() || null,
      quantity: form.quantity,
      processed_by: profile?.id,
      status: 'pending',
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Return recorded');
      setOpen(false);
      setForm({ barcode: '', product_id: '', warehouse_id: '', return_type: 'returned', reason: '', quantity: 1 });
      load();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Returns, Damaged & Expired Stock"
        description="Track returned, damaged, and expired items separately from normal stock."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Record return</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Record return / damage / expiry</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Barcode (optional)</Label>
                    <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="font-mono" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Product *</Label>
                      <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Warehouse *</Label>
                      <Select value={form.warehouse_id} onValueChange={(v) => setForm({ ...form, warehouse_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.code}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Type *</Label>
                      <Select value={form.return_type} onValueChange={(v) => setForm({ ...form, return_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RETURN_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Quantity</Label>
                      <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reason</Label>
                    <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit">Record</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total returns" value={returns.length} icon={Undo2} accent="primary" />
        <StatCard label="Pending approval" value={returns.filter((r) => r.status === 'pending').length} icon={Clock} accent="warning" />
        <StatCard label="Damaged" value={returns.filter((r) => r.return_type === 'damaged').length} icon={AlertTriangle} accent="destructive" />
        <StatCard label="Expired" value={returns.filter((r) => r.return_type === 'expired').length} icon={PackageX} accent="destructive" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by barcode, product, or reason..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {RETURN_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No returns found" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed by</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.barcode ?? '—'}</TableCell>
                    <TableCell>{r.product?.name ?? '—'}</TableCell>
                    <TableCell>{r.warehouse?.code ?? '—'}</TableCell>
                    <TableCell className="capitalize">{r.return_type}</TableCell>
                    <TableCell className="text-center">{r.quantity}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{r.reason ?? '—'}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-sm">{r.processor?.full_name ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(r.processed_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
