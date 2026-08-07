'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { WarehouseReceipt, Warehouse, Product, Profile, ProductionScan } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { PackageCheck, Boxes, Clock, AlertTriangle, Search, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDate, isToday } from '@/lib/format';

export default function WarehousePage() {
  const { profile } = useAuth();
  const [receipts, setReceipts] = useState<(WarehouseReceipt & { warehouse?: Warehouse; product?: Product; receiver?: Profile })[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [barcode, setBarcode] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canEdit = profile && ['admin', 'warehouse', 'manager'].includes(profile.role);
  const defaultWarehouse = profile?.warehouse_id ?? '';

  useEffect(() => {
    load();
    (async () => {
      const { data } = await supabase.from('warehouses').select('*').order('code');
      setWarehouses(data ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!warehouseId && defaultWarehouse) setWarehouseId(defaultWarehouse);
  }, [defaultWarehouse, warehouseId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('warehouse_receipts')
      .select('*, warehouse:warehouses(*), product:products(*), receiver:profiles!warehouse_receipts_received_by_fkey(*)')
      .order('received_at', { ascending: false })
      .limit(50);
    setReceipts((data ?? []) as (WarehouseReceipt & { warehouse?: Warehouse; product?: Product; receiver?: Profile })[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return receipts.filter((r) => !q || r.barcode.toLowerCase().includes(q) || r.product?.name.toLowerCase().includes(q) || r.warehouse?.code.toLowerCase().includes(q));
  }, [receipts, search]);

  const receiptsToday = receipts.filter((r) => isToday(r.received_at)).length;

  async function handleReceive(e: React.FormEvent) {
    e.preventDefault();
    if (!barcode.trim()) {
      toast.error('Enter a barcode');
      return;
    }
    if (!warehouseId) {
      toast.error('Select a warehouse');
      return;
    }

    setSubmitting(true);
    setLastResult(null);

    const { data: warehouseName } = await supabase.from('warehouses').select('code').eq('id', warehouseId).single();

    const { error } = await supabase.rpc('fn_receive_box', {
      p_barcode: barcode.trim(),
      p_warehouse_id: warehouseId,
      p_user_id: profile?.id,
    });

    if (error) {
      const msg = error.message;
      toast.error(msg);
      setLastResult({ type: 'error', message: msg });
      setSubmitting(false);
      return;
    }

    const msg = `Received ${barcode} into ${warehouseName?.code || 'Warehouse'}`;
    toast.success(msg);
    setLastResult({ type: 'success', message: msg });
    setBarcode('');
    setSubmitting(false);
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Receiving"
        description="Receive production-scanned boxes into a warehouse."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Received today" value={receiptsToday} icon={PackageCheck} accent="success" />
        <StatCard label="Total receipts" value={receipts.length} icon={Boxes} accent="primary" />
        <StatCard label="Awaiting receipt" value={40 - receipts.length} icon={Clock} accent="warning" hint="Scanned, not yet received" />
      </div>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageCheck className="h-4 w-4 text-primary" /> Receive a box
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReceive} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Barcode *</Label>
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scan or enter barcode"
                  autoFocus
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Warehouse *</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={submitting} className="w-full">
                  <PackageCheck className="mr-2 h-4 w-4" />
                  {submitting ? 'Receiving...' : 'Receive box'}
                </Button>
              </div>
            </form>

            {lastResult && (
              <div className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-sm ${lastResult.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                {lastResult.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                <p>{lastResult.message}</p>
              </div>
            )}

            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Only barcodes already scanned by production can be received. Random barcodes and duplicates are rejected.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by barcode, product, or warehouse..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No receipts found" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Received by</TableHead>
                  <TableHead>Received at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm font-medium">{r.barcode}</TableCell>
                    <TableCell>{r.product?.name ?? '—'}</TableCell>
                    <TableCell>{r.warehouse?.code ?? '—'}</TableCell>
                    <TableCell className="text-sm">{r.receiver?.full_name ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(r.received_at)}</TableCell>
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
