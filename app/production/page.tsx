'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
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
import { ExportDropdown } from '@/components/export-dropdown';
import { ScanLine, Package, AlertTriangle, CheckCircle2, Search, Camera, WifiOff, RefreshCw } from 'lucide-react';
import { ScanField } from '@/components/scanner/ScanField';
import { CameraScanner } from '@/components/scanner/CameraScanner';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDate, isToday } from '@/lib/format';

import { playScanAlreadyExists, playScanError } from '@/components/scanner/audio';
interface QueuedScan {
  id: string;
  barcode: string;
  productId: string;
  timestamp: number;
}

export default function ProductionPage() {
  const { profile } = useAuth();
  const [scans, setScans] = useState<(ProductionScan & { product?: Product; scanner?: Profile })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [barcode, setBarcode] = useState('');
  const [productId, setProductId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [queuedScans, setQueuedScans] = useState<QueuedScan[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const canEdit = profile && ['admin', 'production', 'production_manager', 'manager'].includes(profile.role);



  useEffect(() => {
    // Network status listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    // Load queued scans
    try {
      const q = localStorage.getItem('offline_scans');
      if (q) setQueuedScans(JSON.parse(q));
    } catch (e) {}

    load();
    (async () => {
      if (!profile) return;
      
      if (profile.role === 'production') {
        const { data } = await supabase
          .from('product_production_assignments')
          .select('products(*)')
          .eq('production_user_id', profile.id)
          .eq('active', true);
          
        const assignedProducts = data
          ?.map(d => d.products as any)
          .filter(p => p && p.active) ?? [];
          
        setProducts(assignedProducts);
      } else {
        const { data } = await supabase
          .from('products')
          .select('*')
          .eq('active', true)
          .order('name');
        setProducts(data ?? []);
      }
    })();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [profile?.id, profile?.role]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && queuedScans.length > 0 && !isSyncing) {
      syncQueuedScans();
    }
  }, [isOnline, queuedScans.length]);

  async function syncQueuedScans() {
    if (isSyncing || queuedScans.length === 0 || !isOnline) return;
    setIsSyncing(true);
    
    const remainingQueue = [...queuedScans];
    let syncedCount = 0;
    
    for (const scan of queuedScans) {
      try {
        const { error } = await supabase.rpc('fn_produce_box', {
          p_barcode: scan.barcode,
          p_product_id: scan.productId
        });

        // Even if it's a duplicate, we remove it from queue since the server processed it.
        // If it's a real network error, it would throw or return a specific code, but RPC errors usually mean the db processed it and rejected it (e.g., duplicate).
        // For robustness, if error message implies duplicate, we consider it handled.
        remainingQueue.shift(); 
        syncedCount++;
      } catch (err) {
        // If actual fetch fails (network down again), stop syncing.
        break;
      }
    }

    setQueuedScans(remainingQueue);
    localStorage.setItem('offline_scans', JSON.stringify(remainingQueue));
    setIsSyncing(false);

    if (syncedCount > 0) {
      toast.success(`Synced ${syncedCount} offline scans!`);
      load();
    }
  }

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
      setCameraOpen(false); 
      return;
    }

    setSubmitting(true);
    setBarcode(scanCode);

    if (!isOnline) {
      // Offline mode
      const newScan: QueuedScan = {
        id: crypto.randomUUID(),
        barcode: scanCode.trim(),
        productId,
        timestamp: Date.now()
      };
      const updatedQueue = [...queuedScans, newScan];
      setQueuedScans(updatedQueue);
      localStorage.setItem('offline_scans', JSON.stringify(updatedQueue));
      toast.success(`Scanned offline: ${scanCode}`);
      setBarcode('');
      setSubmitting(false);
      return;
    }

    // Online mode
    const { error } = await supabase.rpc('fn_produce_box', {
      p_barcode: scanCode.trim(),
      p_product_id: productId
    });

    if (error) {
      if (error.message.includes('duplicate key') || error.message.toLowerCase().includes('duplicate') || error.code === '23505') {
        playScanAlreadyExists();
        toast.error(`Barcode already exists: ${scanCode}`);
      } else if (error.message.includes('permission')) {
        playScanError();
        toast.error('You do not have permission to record production scans.');
      } else {
        playScanError();
        toast.error(`Scan failed: Please retry (${error.message})`);
      }
      setSubmitting(false);
      return;
    }

    toast.success(`Scanned ${scanCode}`);
    setBarcode(''); 
    setSubmitting(false);
    load();
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    await submitScan(barcode);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader
          title="Production Scanning"
          description="Scan finished product boxes to register produced stock."
        />
        <div className="flex gap-3">
          {queuedScans.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-sm font-medium border border-amber-200">
              <RefreshCw className={isSyncing ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
              {queuedScans.length} Queued
            </div>
          )}
          {!isOnline && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-sm font-medium border border-red-200">
              <WifiOff className="w-4 h-4" />
              Offline
            </div>
          )}
        </div>
      </div>

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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Barcode *</Label>
                <div className="flex gap-2">
                  <ScanField
                    onSubmit={submitScan}
                    placeholder="e.g. 2BF-PROD-000041"
                    showCamera={true}
                    disabled={submitting || !productId}
                    className="flex-1"
                  />
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
                {/* Submit is handled internally by ScanField, but keeping a prominent disabled visual button for UI consistency or we can hide it */}
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Hardware scanners are supported! Ensure a product is selected, then simply scan a barcode with your USB/Bluetooth scanner at any time. No need to click any fields.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Recent Scans</CardTitle>
          <ExportDropdown
            filenameBase="production_scans"
            title="Production Scans Report"
            headers={['Barcode', 'Product', 'Scanned By', 'Scanned At']}
            rows={filtered.map((s) => [s.barcode, s.product?.name ?? '—', s.scanner?.full_name ?? '—', formatDate(s.scanned_at)])}
            variant="outline"
            className="h-8"
          />
        </CardHeader>
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

      {/* Phase 10: ZXing fast scanner — onDetected only returns barcode; submitScan handles all business logic */}
      <CameraScanner
        active={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onDetected={(scannedText) => {
          submitScan(scannedText);
        }}
      />
    </div>
  );
}
