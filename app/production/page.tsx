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
import { ScanLine, Package, AlertTriangle, CheckCircle2, Search, Camera } from 'lucide-react';
import { CameraScanner } from '@/components/camera-scanner';
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
      (s) => !q || s.barcode.toLowerCase().includes(q) || s.product?.name.toLowerCase().includes(q)
    );
  }, [scans, search]);

  const scansToday = scans.filter((s) => isToday(s.scanned_at)).length;

  const [cameraOpen, setCameraOpen] = useState(false);

  async function submitScan(scanCode: string) {
    if (!scanCode.trim()) {
      toast.error('Empty barcode scanned');
      return;
    }
    if (!productId) {
      toast.error('Select a product before scanning');
      setCameraOpen(false); // Force user to select product
      return;
    }

    setSubmitting(true);
    setBarcode(scanCode); // Update input field so user sees what was just scanned

    const { error } = await supabase.rpc('fn_produce_box', {
      p_barcode: scanCode.trim(),
      p_product_id: productId,
      p_user_id: profile?.id,
    });

    if (error) {
      if (error.message.includes('duplicate key') || error.code === '23505') {
        toast.error(`Duplicate scan: barcode ${scanCode} was already scanned`);
      } else {
        toast.error(error.message);
      }
      setSubmitting(false);
      return;
    }

    toast.success(`Scanned ${scanCode}`);
    setBarcode(''); 
    // We intentionally don't reset productId so they can keep scanning rapidly
    setSubmitting(false);
    load();
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    await submitScan(barcode);
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
                <div className="flex gap-2">
                  <Input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="e.g. 2BF-PROD-000041"
                    autoFocus
                    className="font-mono flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => setCameraOpen(true)} title="Scan with camera">
                    <Camera className="h-4 w-4 text-primary" />
                  </Button>
                </div>
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
                  <TableHead>Scanned by</TableHead>
                  <TableHead>Scanned at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm font-medium">{s.barcode}</TableCell>
                    <TableCell>{s.product?.name ?? '—'}</TableCell>
                    <TableCell className="text-sm">{s.scanner?.full_name ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(s.scanned_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CameraScanner
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={(scannedText) => {
          submitScan(scannedText);
        }}
      />
    </div>
  );
}
