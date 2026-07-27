'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { ProductionScan, Product, Profile } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { ScanLine, Package, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDate, isToday, startOfTodayISO } from '@/lib/format';

export default function ProductionPage() {
  const { profile } = useAuth();
  const [scans, setScans] = useState<(ProductionScan & { product?: Product; scanner?: Profile })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [barcode, setBarcode] = useState('');
  const [productId, setProductId] = useState('');
  const [batchLot, setBatchLot] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const canEdit = profile && ['admin', 'production', 'manager'].includes(profile.role);

  useEffect(() => {
    load();
    (async () => {
      const { data } = await supabase.from('products').select('*').order('name');
      setProducts(data ?? []);
    })();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('production_scans')
      .select('*, product:products(*), scanner:profiles!production_scans_scanned_by_fkey(*)')
      .order('scanned_at', { ascending: false })
      .limit(50);
    setScans((data ?? []) as (ProductionScan & { product?: Product; scanner?: Profile })[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return scans.filter(
      (s) => !q || s.barcode.toLowerCase().includes(q) || s.product?.name.toLowerCase().includes(q) || s.batch_lot?.toLowerCase().includes(q)
    );
  }, [scans, search]);

  const scansToday = scans.filter((s) => isToday(s.scanned_at)).length;

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!barcode.trim()) {
      toast.error('Enter a barcode');
      return;
    }
    if (!productId) {
      toast.error('Select a product');
      return;
    }

    setSubmitting(true);

    // Check for duplicate
    const { data: existing } = await supabase
      .from('production_scans')
      .select('id')
      .eq('barcode', barcode.trim())
      .maybeSingle();

    if (existing) {
      toast.error(`Duplicate scan: barcode ${barcode} was already scanned`);
      setSubmitting(false);
      return;
    }

    const { data: scan, error } = await supabase
      .from('production_scans')
      .insert({
        barcode: barcode.trim(),
        product_id: productId,
        batch_lot: batchLot.trim() || null,
        quantity,
        scanned_by: profile?.id,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    // Append to barcode history
    await supabase.from('barcode_history').insert({
      barcode: barcode.trim(),
      action: 'production_scan',
      product_id: productId,
      user_id: profile?.id,
      notes: batchLot.trim() || null,
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: profile?.id,
      action: 'production_scan',
      product_id: productId,
      barcode: barcode.trim(),
      entity_type: 'production_scans',
      entity_id: scan.id,
      details: { quantity, batch_lot: batchLot.trim() || null },
    });

    toast.success(`Scanned ${barcode} — ${quantity} cartons`);
    setBarcode('');
    setBatchLot('');
    setQuantity(1);
    setSubmitting(false);
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Scanning"
        description="Scan finished product boxes to register produced stock."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Scans today" value={scansToday} icon={ScanLine} accent="success" />
        <StatCard label="Total scans" value={scans.length} icon={Package} accent="primary" />
        <StatCard label="Products available" value={products.length} icon={CheckCircle2} accent="neutral" />
      </div>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanLine className="h-4 w-4 text-primary" /> Scan a box
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleScan} className="grid grid-cols-1 gap-4 sm:grid-cols-5">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Barcode *</Label>
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="e.g. 2BF-PROD-000041"
                  autoFocus
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Product *</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Batch / Lot</Label>
                <Input value={batchLot} onChange={(e) => setBatchLot(e.target.value)} placeholder="BATCH-..." />
              </div>
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              </div>
              <div className="sm:col-span-5 flex justify-end">
                <Button type="submit" disabled={submitting}>
                  <ScanLine className="mr-2 h-4 w-4" />
                  {submitting ? 'Scanning...' : 'Scan box'}
                </Button>
              </div>
            </form>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Duplicate scans are blocked. Each barcode can only be scanned once by production.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by barcode, product, or batch..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No scans found" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Batch / Lot</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead>Scanned by</TableHead>
                  <TableHead>Scanned at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm font-medium">{s.barcode}</TableCell>
                    <TableCell>{s.product?.name ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.batch_lot ?? '—'}</TableCell>
                    <TableCell className="text-center">{s.quantity}</TableCell>
                    <TableCell className="text-sm">{s.scanner?.full_name ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(s.scanned_at)}</TableCell>
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
