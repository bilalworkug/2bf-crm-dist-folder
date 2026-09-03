'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
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
import {
  ScanLine, Package, AlertTriangle, CheckCircle2, Search, Camera,
  WifiOff, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Check, Trash2, RotateCcw
} from 'lucide-react';
import { ScanField } from '@/components/scanner/ScanField';
import { CameraScanner } from '@/components/scanner/CameraScanner';
import { FactoryHealthMonitor } from '@/components/factory-health-monitor';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDate, isToday } from '@/lib/format';
import { playScanAlreadyExists, playScanError } from '@/components/scanner/audio';

export type SyncStatus = 'Waiting' | 'Syncing' | 'Synced' | 'Failed' | 'Conflict';

export interface QueuedScan {
  id: string;
  barcode: string;
  productId: string;
  productName?: string;
  timestamp: number;
  status: SyncStatus;
  retryCount: number;
  lastError?: string;
}

const PAGE_SIZE = 50;

export default function ProductionPage() {
  const { profile } = useAuth();
  const [scans, setScans] = useState<(ProductionScan & { product?: Product; scanner?: Profile })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [barcode, setBarcode] = useState('');
  const [productId, setProductId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [queuedScans, setQueuedScans] = useState<QueuedScan[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCenterOpen, setSyncCenterOpen] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncFilter, setSyncFilter] = useState<'all' | 'pending' | 'failed' | 'conflict' | 'synced'>('all');

  const canEdit = profile && ['admin', 'production', 'production_manager', 'manager'].includes(profile.role);

  // Load offline queue safely from localStorage
  useEffect(() => {
    try {
      const q = localStorage.getItem('offline_scans');
      if (q) {
        const parsed = JSON.parse(q);
        const normalized: QueuedScan[] = parsed.map((item: any) => ({
          id: item.id || crypto.randomUUID(),
          barcode: item.barcode,
          productId: item.productId,
          productName: item.productName || 'Unknown Product',
          timestamp: item.timestamp || Date.now(),
          status: item.status || 'Waiting',
          retryCount: item.retryCount || 0,
          lastError: item.lastError || undefined,
        }));
        setQueuedScans(normalized);
      }
    } catch (e) {
      console.error('Failed to parse offline_scans:', e);
    }
  }, []);

  // Sync state to localStorage whenever queuedScans updates
  const updateQueueState = useCallback((newQueue: QueuedScan[]) => {
    setQueuedScans(newQueue);
    try {
      localStorage.setItem('offline_scans', JSON.stringify(newQueue));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    loadInitial();

    (async () => {
      if (!profile) return;

      if (profile.role === 'production') {
        const { data } = await supabase
          .from('product_production_assignments')
          .select('products(*)')
          .eq('production_user_id', profile.id)
          .eq('active', true);

        const assignedProducts = data
          ?.map((d) => d.products as any)
          .filter((p) => p && p.active) ?? [];

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

  // Initial load with limit(50)
  async function loadInitial() {
    setLoading(true);
    const { data } = await supabase
      .from('production_scans')
      .select('*, product:products(*), scanner:profiles!production_scans_scanned_by_fkey(*)')
      .order('scanned_at', { ascending: false })
      .range(0, PAGE_SIZE - 1);

    const items = (data ?? []) as (ProductionScan & { product?: Product; scanner?: Profile })[];
    setScans(items);
    setHasMore(items.length === PAGE_SIZE);
    setLoading(false);
  }

  // Pagination: Load more records
  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const start = scans.length;
    const end = start + PAGE_SIZE - 1;

    const { data } = await supabase
      .from('production_scans')
      .select('*, product:products(*), scanner:profiles!production_scans_scanned_by_fkey(*)')
      .order('scanned_at', { ascending: false })
      .range(start, end);

    const newItems = (data ?? []) as (ProductionScan & { product?: Product; scanner?: Profile })[];
    if (newItems.length > 0) {
      setScans((prev) => [...prev, ...newItems]);
    }
    setHasMore(newItems.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  // Robust sync queued scans
  const syncQueuedScans = useCallback(async (targetScanId?: string) => {
    if (isSyncing || queuedScans.length === 0 || !navigator.onLine) return;
    setIsSyncing(true);

    let updated = [...queuedScans];
    let syncedCount = 0;

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      // If targetScanId is specified, only sync that specific item; otherwise sync Waiting/Failed items
      if (targetScanId && item.id !== targetScanId) continue;
      if (!targetScanId && item.status !== 'Waiting' && item.status !== 'Failed') continue;

      // Mark as syncing
      updated[i] = { ...item, status: 'Syncing' };
      updateQueueState([...updated]);

      try {
        const { error } = await supabase.rpc('fn_produce_box', {
          p_barcode: item.barcode,
          p_product_id: item.productId,
        });

        if (error) {
          const isDuplicate =
            error.message.includes('duplicate key') ||
            error.message.toLowerCase().includes('already exists') ||
            error.message.toLowerCase().includes('duplicate') ||
            error.code === '23505';

          if (isDuplicate) {
            // Conflict: barcode already registered in database
            updated[i] = {
              ...item,
              status: 'Conflict',
              lastError: 'Barcode already registered on server',
            };
          } else {
            // Failure: Keep in queue with incremented retryCount
            updated[i] = {
              ...item,
              status: 'Failed',
              retryCount: item.retryCount + 1,
              lastError: error.message || 'Server RPC error',
            };
          }
        } else {
          // Success: Mark as Synced (do NOT delete automatically, operator sees confirmation)
          syncedCount++;
          updated[i] = {
            ...item,
            status: 'Synced',
            lastError: undefined,
          };
        }
      } catch (err: any) {
        // Network connection lost mid-sync
        updated[i] = {
          ...item,
          status: 'Failed',
          retryCount: item.retryCount + 1,
          lastError: err?.message || 'Network disconnected',
        };
        break;
      }
    }

    updateQueueState(updated);
    setIsSyncing(false);
    setLastSyncTime(new Date());

    if (syncedCount > 0) {
      toast.success(`Successfully synced ${syncedCount} scan(s) to server!`);
      loadInitial();
    }
  }, [isSyncing, queuedScans, updateQueueState]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queuedScans.some((s) => s.status === 'Waiting' || s.status === 'Failed') && !isSyncing) {
      syncQueuedScans();
    }
  }, [isOnline, queuedScans, isSyncing, syncQueuedScans]);

  // Submit scan (Online or Offline)
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

    const selectedProduct = products.find((p) => p.id === productId);
    const prodName = selectedProduct?.name || 'Selected Product';

    setSubmitting(true);
    setBarcode(scanCode);

    if (!isOnline) {
      // Offline mode: Store safely in Offline Sync Center
      const newScan: QueuedScan = {
        id: crypto.randomUUID(),
        barcode: scanCode.trim(),
        productId,
        productName: prodName,
        timestamp: Date.now(),
        status: 'Waiting',
        retryCount: 0,
      };
      const updatedQueue = [newScan, ...queuedScans];
      updateQueueState(updatedQueue);
      toast.success(`Scanned offline: ${scanCode} (Saved to queue)`);
      setBarcode('');
      setSubmitting(false);
      return;
    }

    // Online mode
    try {
      const { error } = await supabase.rpc('fn_produce_box', {
        p_barcode: scanCode.trim(),
        p_product_id: productId,
      });

      if (error) {
        const isDuplicate =
          error.message.includes('duplicate key') ||
          error.message.toLowerCase().includes('already exists') ||
          error.message.toLowerCase().includes('duplicate') ||
          error.code === '23505';

        if (isDuplicate) {
          playScanAlreadyExists();
          toast.error(`Barcode already exists: ${scanCode}`);
        } else if (error.message.includes('permission')) {
          playScanError();
          toast.error('You do not have permission to record production scans.');
        } else {
          playScanError();
          // Network issue occurred during RPC -> Queue locally so scan is never lost!
          const newScan: QueuedScan = {
            id: crypto.randomUUID(),
            barcode: scanCode.trim(),
            productId,
            productName: prodName,
            timestamp: Date.now(),
            status: 'Failed',
            retryCount: 1,
            lastError: error.message,
          };
          updateQueueState([newScan, ...queuedScans]);
          toast.warning(`Server error: Saved ${scanCode} to offline queue.`);
        }
        setSubmitting(false);
        return;
      }

      toast.success(`Scanned ${scanCode}`);
      setBarcode('');
      setSubmitting(false);
      setLastSyncTime(new Date());
      loadInitial();
    } catch (e: any) {
      // Offline fallback on fetch throw
      const newScan: QueuedScan = {
        id: crypto.randomUUID(),
        barcode: scanCode.trim(),
        productId,
        productName: prodName,
        timestamp: Date.now(),
        status: 'Waiting',
        retryCount: 0,
        lastError: e?.message,
      };
      updateQueueState([newScan, ...queuedScans]);
      toast.warning(`Network unreachable: Saved ${scanCode} to offline queue.`);
      setBarcode('');
      setSubmitting(false);
    }
  }

  // Queue actions
  function clearSyncedScans() {
    const remaining = queuedScans.filter((s) => s.status !== 'Synced');
    updateQueueState(remaining);
    toast.success('Cleared confirmed synced scans.');
  }

  function resolveConflict(id: string) {
    const remaining = queuedScans.filter((s) => s.id !== id);
    updateQueueState(remaining);
    toast.info('Conflict resolved / dismissed.');
  }

  function retryScan(id: string) {
    syncQueuedScans(id);
  }

  // Stats
  const waitingCount = queuedScans.filter((s) => s.status === 'Waiting').length;
  const failedCount = queuedScans.filter((s) => s.status === 'Failed').length;
  const conflictCount = queuedScans.filter((s) => s.status === 'Conflict').length;
  const syncedCount = queuedScans.filter((s) => s.status === 'Synced').length;

  const filteredQueue = useMemo(() => {
    switch (syncFilter) {
      case 'pending':
        return queuedScans.filter((s) => s.status === 'Waiting' || s.status === 'Syncing');
      case 'failed':
        return queuedScans.filter((s) => s.status === 'Failed');
      case 'conflict':
        return queuedScans.filter((s) => s.status === 'Conflict');
      case 'synced':
        return queuedScans.filter((s) => s.status === 'Synced');
      default:
        return queuedScans;
    }
  }, [queuedScans, syncFilter]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return scans.filter(
      (s) => !q || s.barcode.toLowerCase().includes(q) || s.product?.name.toLowerCase().includes(q)
    );
  }, [scans, search]);

  const scansToday = scans.filter((s) => isToday(s.scanned_at)).length;
  const [cameraOpen, setCameraOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Production Scanning"
          description="Scan finished product boxes to register produced stock."
        />
        <div className="flex items-center gap-2">
          {queuedScans.length > 0 && (
            <button
              onClick={() => setSyncCenterOpen(!syncCenterOpen)}
              className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-md text-xs font-semibold border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Offline Queue ({queuedScans.length})
              {syncCenterOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          {!isOnline && (
            <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-md text-xs font-semibold border border-red-200 dark:border-red-800">
              <WifiOff className="w-3.5 h-3.5" />
              Offline Mode
            </div>
          )}
        </div>
      </div>

      {/* Part 3 — Factory Health Monitor */}
      <FactoryHealthMonitor
        queueCount={waitingCount + failedCount}
        lastSyncTime={lastSyncTime}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Scans today" value={scansToday} icon={ScanLine} accent="success" />
        <StatCard label="Total loaded scans" value={scans.length} icon={Package} accent="primary" />
        <StatCard label="Products available" value={products.length} icon={CheckCircle2} accent="neutral" />
      </div>

      {/* Part 2 — Offline Sync Center */}
      {queuedScans.length > 0 && (
        <Card className="border-amber-500/30 dark:border-amber-500/20 shadow-md">
          <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  Offline Sync Center
                  <span className="text-xs font-normal text-muted-foreground">
                    ({queuedScans.length} total)
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  {waitingCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      {waitingCount} Waiting
                    </span>
                  )}
                  {failedCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                      {failedCount} Failed
                    </span>
                  )}
                  {conflictCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                      {conflictCount} Conflicts
                    </span>
                  )}
                  {syncedCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {syncedCount} Synced
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncQueuedScans()}
                disabled={isSyncing || !isOnline || (waitingCount === 0 && failedCount === 0)}
                className="h-8 text-xs font-medium"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync Now
              </Button>
              {syncedCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearSyncedScans}
                  className="h-8 text-xs text-muted-foreground hover:text-destructive"
                  title="Clear confirmed synced items from queue"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Clear Synced
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSyncCenterOpen(!syncCenterOpen)}
                className="h-8 w-8 p-0"
              >
                {syncCenterOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>

          {syncCenterOpen && (
            <CardContent className="p-4 pt-3">
              {/* Filter tabs */}
              <div className="flex items-center gap-1.5 mb-3 overflow-x-auto text-xs pb-1">
                {(['all', 'pending', 'failed', 'conflict', 'synced'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSyncFilter(tab)}
                    className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                      syncFilter === tab
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Sync Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Barcode</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Retries</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQueue.map((item) => (
                      <TableRow key={item.id} className="text-xs">
                        <TableCell className="font-mono font-medium">{item.barcode}</TableCell>
                        <TableCell>{item.productName || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell>{item.retryCount}</TableCell>
                        <TableCell>
                          {item.status === 'Waiting' && (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Waiting
                            </span>
                          )}
                          {item.status === 'Syncing' && (
                            <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              Syncing
                            </span>
                          )}
                          {item.status === 'Synced' && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <Check className="h-3.5 w-3.5" />
                              Synced
                            </span>
                          )}
                          {item.status === 'Failed' && (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                                <AlertCircle className="h-3 w-3" />
                                Failed
                              </span>
                              {item.lastError && (
                                <p className="text-[10px] text-muted-foreground truncate max-w-[160px]" title={item.lastError}>
                                  {item.lastError}
                                </p>
                              )}
                            </div>
                          )}
                          {item.status === 'Conflict' && (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                                <AlertTriangle className="h-3 w-3" />
                                Conflict
                              </span>
                              <p className="text-[10px] text-muted-foreground">Duplicate Barcode</p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.status === 'Waiting' || item.status === 'Failed' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => retryScan(item.id)}
                              disabled={isSyncing || !isOnline}
                              className="h-7 px-2 text-xs hover:text-sky-600"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Retry
                            </Button>
                          ) : item.status === 'Conflict' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => resolveConflict(item.id)}
                              className="h-7 px-2 text-xs text-purple-600 hover:text-purple-700"
                            >
                              Resolve
                            </Button>
                          ) : (
                            <span className="text-emerald-500 font-bold ml-2">✓</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
        </Card>
      )}

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
              <div className="sm:col-span-5 flex justify-end" />
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Hardware scanners supported! Ensure a product is selected, then simply scan any barcode. Scans made while offline are stored securely and sync automatically once reconnected.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Production History with Part 5 Pagination */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Recent Production Scans</CardTitle>
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
            <Input
              placeholder="Search by barcode, product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
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
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
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
              </div>

              {/* Mobile Stacked Cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filtered.map((s) => (
                  <div key={s.id} className="border border-border/80 rounded-xl p-4 bg-card shadow-sm space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-mono font-bold text-sm text-primary">{s.barcode}</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Produced
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{s.product?.name ?? 'Product'}</p>
                    <div className="flex justify-between items-center text-xs text-muted-foreground pt-1 border-t">
                      <span>Operator: {s.scanner?.full_name ?? '—'}</span>
                      <span>{formatDate(s.scanned_at)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More Pagination */}
              {hasMore && (
                <div className="mt-4 flex justify-center border-t border-slate-100 dark:border-slate-800 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="min-w-[140px]"
                  >
                    {loadingMore ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" />
                    ) : null}
                    {loadingMore ? 'Loading...' : 'Load More Scans'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ZXing fast scanner */}
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
