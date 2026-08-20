'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/nav';
import { AlertCircle, Undo2, Play, Pause, Square, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScanField } from '@/components/scanner/ScanField';
import { toast } from 'react-hot-toast';
import { EmptyState } from '@/components/empty-state';
import { StatCard } from '@/components/stat-card';
import { CameraScanner } from '@/components/scanner/CameraScanner';
import { playScanSuccess, playScanAlreadyExists, playScanError } from '@/components/scanner/audio';

type ScanResult = 'Corrected' | 'Wrong Product' | 'Not Found' | 'Already Corrected' | 'Cannot Correct' | 'Error';

interface HistoryItem {
  id: string;
  time: Date;
  barcode: string;
  result: ScanResult;
  beforeProductName: string;
  afterProductName: string;
  message?: string;
}

export default function ProductionCorrectionsPage() {
  const { profile } = useAuth();
  
  // Setup State
  const [sessionMode, setSessionMode] = useState<'setup' | 'active'>('setup');
  const [products, setProducts] = useState<any[]>([]);
  const [beforeProductId, setBeforeProductId] = useState('');
  const [afterProductId, setAfterProductId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  // Active Session State
  const [isPaused, setIsPaused] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState({ scanned: 0, corrected: 0, rejected: 0, duplicates: 0, errors: 0 });
  
  // Refs for stable access inside callbacks (avoid stale closures)
  const processedBarcodes = useRef<Set<string>>(new Set());
  const processingBarcodesRef = useRef<Set<string>>(new Set());
  const sessionConfigRef = useRef({ beforeProductId: '', afterProductId: '', reason: '', notes: '', beforeProductName: '', afterProductName: '' });
  const isPausedRef = useRef(false);
  const sessionModeRef = useRef<'setup' | 'active'>('setup');
  const manualInputRef = useRef<HTMLInputElement>(null);

  // Derived product names
  const beforeProductName = products.find(p => p.id === beforeProductId)?.name || '';
  const afterProductName = products.find(p => p.id === afterProductId)?.name || '';

  // Keep refs in sync with state
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { sessionModeRef.current = sessionMode; }, [sessionMode]);
  useEffect(() => {
    sessionConfigRef.current = { beforeProductId, afterProductId, reason, notes, beforeProductName, afterProductName };
  }, [beforeProductId, afterProductId, reason, notes, beforeProductName, afterProductName]);

  useEffect(() => {
    supabase.from('products').select('*').eq('active', true).order('name').then(({ data }) => {
      if (data) setProducts(data);
    });
  }, []);

  const startSession = () => {
    if (!beforeProductId || !afterProductId || !reason.trim()) {
      return toast.error('Please fill all required fields');
    }
    if (beforeProductId === afterProductId) {
      return toast.error('Before and After products must be different');
    }
    setIsConfirming(false);
    setSessionMode('active');
    setIsPaused(false);
    setStats({ scanned: 0, corrected: 0, rejected: 0, duplicates: 0, errors: 0 });
    setHistory([]);
    processedBarcodes.current.clear();
    processingBarcodesRef.current.clear();
  };

  const endSession = () => {
    if (window.confirm(`End this correction session?\n\nScanned: ${stats.scanned}\nCorrected: ${stats.corrected}\nRejected: ${stats.rejected}\nDuplicates: ${stats.duplicates}\nErrors: ${stats.errors}`)) {
      setSessionMode('setup');
      setBeforeProductId('');
      setAfterProductId('');
      setReason('');
      setNotes('');
      processedBarcodes.current.clear();
      processingBarcodesRef.current.clear();
    }
  };

  const addHistoryEntry = useCallback((barcode: string, result: ScanResult, message?: string) => {
    const cfg = sessionConfigRef.current;
    setHistory(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      time: new Date(),
      barcode,
      result,
      beforeProductName: cfg.beforeProductName,
      afterProductName: cfg.afterProductName,
      message
    }, ...prev].slice(0, 50)); // Keep last 50
  }, []);

  const processBarcode = useCallback(async (code: string) => {
    const trimmedCode = code.trim();
    if (!trimmedCode || isPausedRef.current || sessionModeRef.current !== 'active') return;

    // Duplicate protection — in-memory check, no RPC call
    if (processedBarcodes.current.has(trimmedCode)) {
      playScanAlreadyExists();
      addHistoryEntry(trimmedCode, 'Already Corrected', 'This barcode has already been corrected in this session.');
      setStats(s => ({ ...s, scanned: s.scanned + 1, duplicates: s.duplicates + 1 }));
      return;
    }

    // Prevent concurrent processing of the *same* barcode
    if (processingBarcodesRef.current.has(trimmedCode)) return;
    processingBarcodesRef.current.add(trimmedCode);

    const cfg = sessionConfigRef.current;

    try {
      setStats(s => ({ ...s, scanned: s.scanned + 1 }));

      // 1. Fetch box to provide client-side UX feedback
      const { data: box, error: boxError } = await supabase
        .from('boxes')
        .select('*, product:products(*)')
        .eq('barcode', trimmedCode)
        .single();

      if (boxError || !box) {
        playScanError();
        addHistoryEntry(trimmedCode, 'Not Found', 'No database record exists for this barcode.');
        setStats(s => ({ ...s, rejected: s.rejected + 1 }));
        return;
      }

      // 2. Client-side Before Product check (UX fast-fail; server re-verifies)
      if (box.product_id !== cfg.beforeProductId) {
        playScanError();
        addHistoryEntry(trimmedCode, 'Wrong Product', `Expected: ${cfg.beforeProductName}, Actual: ${box.product?.name || 'Unknown'}`);
        setStats(s => ({ ...s, rejected: s.rejected + 1 }));
        return;
      }

      // 3. Client-side status check (UX fast-fail; server re-verifies)
      if (!['produced', 'in_warehouse'].includes(box.status)) {
        playScanError();
        addHistoryEntry(trimmedCode, 'Cannot Correct', `Current status: ${box.status}`);
        setStats(s => ({ ...s, rejected: s.rejected + 1 }));
        return;
      }

      // 4. Execute secure RPC — server validates auth, role, before product, status atomically
      const { error: rpcError } = await supabase.rpc('fn_correct_production_box_safe', {
        p_barcode: trimmedCode,
        p_expected_before_product_id: cfg.beforeProductId,
        p_new_product_id: cfg.afterProductId,
        p_reason: cfg.reason,
        p_notes: cfg.notes
      });

      if (rpcError) {
        playScanError();
        let safeMsg = rpcError.message || 'Correction failed';
        if (safeMsg.includes('Unauthorized')) {
          safeMsg = 'You are not authorized to perform this correction.';
        } else if (safeMsg.includes('23505') || safeMsg.toLowerCase().includes('duplicate') || safeMsg.includes('already exists')) {
          safeMsg = 'This barcode has already been processed.';
        } else if (safeMsg.toLowerCase().includes('status')) {
          safeMsg = 'This box cannot be corrected in its current status.';
        } else if (safeMsg.toLowerCase().includes('product')) {
          safeMsg = 'This box belongs to a different product.';
        }
        addHistoryEntry(trimmedCode, 'Error', safeMsg);
        setStats(s => ({ ...s, errors: s.errors + 1 }));
      } else {
        processedBarcodes.current.add(trimmedCode);
        playScanSuccess();
        addHistoryEntry(trimmedCode, 'Corrected');
        setStats(s => ({ ...s, corrected: s.corrected + 1 }));
      }
    } catch (err: any) {
      playScanError();
      addHistoryEntry(trimmedCode, 'Error', 'An unexpected error occurred. Please try again.');
      setStats(s => ({ ...s, errors: s.errors + 1 }));
    } finally {
      processingBarcodesRef.current.delete(trimmedCode);
    }
  }, [addHistoryEntry]);

  const handleManualSubmitString = (code: string) => {
    if (!isPaused && sessionConfigRef.current) {
      processBarcode(code);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBarcode.trim()) return;
    handleManualSubmitString(manualBarcode);
    setManualBarcode('');
    setTimeout(() => {
      manualInputRef.current?.focus();
    }, 10);
  };

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
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Undo2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Production Corrections</h1>
            <p className="text-sm text-muted-foreground">Bulk correction mode for incorrect product scans.</p>
          </div>
        </div>
        {sessionMode === 'active' && (
          <Button variant="destructive" onClick={endSession}>
            <Square className="h-4 w-4 mr-2" />
            Finish Correction Session
          </Button>
        )}
      </div>

      {/* ─── SETUP MODE ─────────────────────────────────────────────────── */}
      {sessionMode === 'setup' && (
        <div className="rounded-xl border border-white/10 bg-card p-6 shadow-sm max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold mb-6">Setup Correction Session</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Old Product (Expected)</Label>
              <select
                value={beforeProductId}
                onChange={(e) => setBeforeProductId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>New Product (Change To)</Label>
              <select
                value={afterProductId}
                onChange={(e) => setAfterProductId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Production boxes were recorded under the wrong product"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
              />
            </div>

            {beforeProductId && afterProductId && beforeProductId === afterProductId && (
              <p className="text-sm text-destructive font-medium">Old and New products must be different.</p>
            )}

            {/* Preview */}
            {beforeProductId && afterProductId && beforeProductId !== afterProductId && (
              <div className="rounded-lg border border-white/10 bg-muted/30 p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Preview</p>
                <p className="font-bold text-amber-500">{beforeProductName}</p>
                <p className="text-muted-foreground text-lg my-1">↓</p>
                <p className="font-bold text-emerald-500">{afterProductName}</p>
              </div>
            )}

            <div className="pt-4">
              {!isConfirming ? (
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700" 
                  onClick={() => setIsConfirming(true)}
                  disabled={!beforeProductId || !afterProductId || !reason.trim() || beforeProductId === afterProductId}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Correction Session
                </Button>
              ) : (
                <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/10 space-y-4">
                  <p className="font-semibold text-amber-500 text-sm">
                    You are about to correct multiple boxes from:
                  </p>
                  <div className="text-center">
                    <p className="font-bold text-lg">{beforeProductName}</p>
                    <p className="text-muted-foreground text-sm my-1">↓</p>
                    <p className="font-bold text-lg">{afterProductName}</p>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    This action will permanently create correction records and inventory/history events. Continue?
                  </p>
                  <div className="text-xs text-muted-foreground text-center italic space-y-1">
                    <p>Reason: {reason}</p>
                    {notes && <p>Notes: {notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setIsConfirming(false)}>Cancel</Button>
                    <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={startSession}>Confirm &amp; Start</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── ACTIVE SESSION MODE ─────────────────────────────────────────── */}
      {sessionMode === 'active' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Scanner & Inputs */}
          <div className="lg:col-span-1 space-y-4">
            {/* Session info header */}
            <div className="rounded-xl border border-white/10 bg-card p-4 shadow-sm">
              <div className="text-center">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Correction Session</h3>
                <div className="font-bold text-lg text-amber-500">{beforeProductName}</div>
                <div className="text-xs text-muted-foreground my-1">↓</div>
                <div className="font-bold text-lg text-emerald-500">{afterProductName}</div>
                <div className="text-xs text-muted-foreground mt-2 italic space-y-1">
                  <p>{reason}</p>
                  {notes && <p>Notes: {notes}</p>}
                </div>
              </div>
            </div>

            {/* Camera scanner */}
            <div className="rounded-xl border border-white/10 bg-card shadow-sm overflow-hidden">
              {!isPaused ? (
                <CameraScanner 
                  active={true}
                  onDetected={processBarcode}
                  onClose={() => setIsPaused(true)}
                />
              ) : (
                <div className="h-[300px] bg-black flex flex-col items-center justify-center p-6 text-center">
                  <Pause className="h-12 w-12 text-slate-500 mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">Session Paused</h3>
                  <p className="text-slate-400 text-sm mb-4">Camera inactive. Session data preserved.</p>
                  <Button onClick={() => setIsPaused(false)} className="bg-blue-600 hover:bg-blue-700">
                    <Play className="h-4 w-4 mr-2" />
                    Resume Scanning
                  </Button>
                </div>
              )}
            </div>

            {/* Manual entry */}
            <div className="rounded-xl border border-white/10 bg-card p-4 shadow-sm">
              <div className="space-y-2">
                <Label className="text-xs">Manual / USB Scanner Entry</Label>
                <ScanField
                  onSubmit={handleManualSubmitString}
                  placeholder="Scan or type barcode..."
                  disabled={isPaused}
                  autoFocus
                  showCamera={true}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Counters */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Scanned" value={stats.scanned} accent="neutral" />
              <StatCard label="Corrected" value={stats.corrected} accent="success" />
              <StatCard label="Rejected" value={stats.rejected} accent="warning" />
              <StatCard label="Duplicates" value={stats.duplicates} accent="warning" />
              <StatCard label="Errors" value={stats.errors} accent="destructive" />
            </div>
          </div>

          {/* Right Column: History */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-white/10 bg-card shadow-sm h-full flex flex-col">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="font-semibold">Correction Queue</h2>
                <span className="text-xs text-muted-foreground">{history.length} entries</span>
              </div>
              <div className="flex-1 overflow-auto p-0 min-h-[400px] max-h-[70vh]">
                {history.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground p-8">
                    No boxes scanned yet in this session.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-4 text-left font-medium text-muted-foreground">#</th>
                        <th className="py-2 px-4 text-left font-medium text-muted-foreground">Barcode</th>
                        <th className="py-2 px-4 text-left font-medium text-muted-foreground">Current Product</th>
                        <th className="py-2 px-4 text-left font-medium text-muted-foreground">New Product</th>
                        <th className="py-2 px-4 text-left font-medium text-muted-foreground">Status</th>
                        <th className="py-2 px-4 text-left font-medium text-muted-foreground">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {history.map((item, i) => (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 text-muted-foreground">{history.length - i}</td>
                          <td className="py-3 px-4 font-mono font-medium">{item.barcode}</td>
                          <td className="py-3 px-4">{item.beforeProductName}</td>
                          <td className="py-3 px-4">{item.afterProductName}</td>
                          <td className="py-3 px-4">
                            {item.result === 'Corrected' && (
                              <span className="inline-flex items-center gap-1.5 text-emerald-500 font-medium text-xs">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Corrected
                              </span>
                            )}
                            {item.result === 'Wrong Product' && (
                              <span className="inline-flex items-center gap-1.5 text-amber-500 font-medium text-xs">
                                <XCircle className="h-3.5 w-3.5" /> Wrong Product
                              </span>
                            )}
                            {['Not Found', 'Cannot Correct', 'Error'].includes(item.result) && (
                              <span className="inline-flex items-center gap-1.5 text-red-500 font-medium text-xs">
                                <AlertCircle className="h-3.5 w-3.5" /> {item.result}
                              </span>
                            )}
                            {item.result === 'Already Corrected' && (
                              <span className="inline-flex items-center gap-1.5 text-yellow-500 font-medium text-xs">
                                <AlertCircle className="h-3.5 w-3.5" /> Duplicate
                              </span>
                            )}
                            {item.message && item.result !== 'Corrected' && (
                              <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate" title={item.message}>
                                {item.message}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                            {item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
