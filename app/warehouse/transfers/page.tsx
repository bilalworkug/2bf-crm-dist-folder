'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { ArrowRightLeft, Search, CheckCircle, Plus, Send, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'react-hot-toast';
import { StatCard } from '@/components/stat-card';
import { EmptyState } from '@/components/empty-state';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';

type ViewMode = 'list' | 'create' | 'scan' | 'receive';

export default function TransfersPage() {
  const { profile } = useAuth();
  const [mode, setMode] = useState<ViewMode>('list');
  const [transfers, setTransfers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [fromWh, setFromWh] = useState('');
  const [toWh, setToWh] = useState('');
  const [notes, setNotes] = useState('');

  // Scan/receive state
  const [activeTransfer, setActiveTransfer] = useState<any>(null);
  const [transferItems, setTransferItems] = useState<any[]>([]);
  const [barcode, setBarcode] = useState('');
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTransfers();
    supabase.from('warehouses').select('*').order('code').then(({ data }) => {
      if (data) setWarehouses(data);
    });
  }, []);

  async function fetchTransfers() {
    setLoading(true);
    const { data } = await supabase
      .from('warehouse_transfers')
      .select('*, from_wh:warehouses!from_warehouse_id(code, name), to_wh:warehouses!to_warehouse_id(code, name), creator:profiles!created_by(full_name)')
      .order('created_at', { ascending: false });
    if (data) setTransfers(data);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!fromWh || !toWh) return toast.error('Select warehouses');
    if (fromWh === toWh) return toast.error('Cannot transfer to same warehouse');

    const { data, error } = await supabase.rpc('fn_create_transfer', {
      p_from_warehouse_id: fromWh,
      p_to_warehouse_id: toWh,
      p_notes: notes,
      p_user_id: profile.id,
      p_user_role: profile.role,
    });
    if (error) return toast.error(error.message);

    toast.success('Transfer created');
    setFromWh('');
    setToWh('');
    setNotes('');
    fetchTransfers();

    // Load the new transfer for scanning
    const { data: transfer } = await supabase
      .from('warehouse_transfers')
      .select('*, from_wh:warehouses!from_warehouse_id(code, name), to_wh:warehouses!to_warehouse_id(code, name)')
      .eq('id', data)
      .single();
    if (transfer) {
      setActiveTransfer(transfer);
      setTransferItems([]);
      setMode('scan');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function openTransfer(transfer: any, viewMode: ViewMode) {
    setActiveTransfer(transfer);
    const { data } = await supabase
      .from('transfer_items')
      .select('*, product:products(name)')
      .eq('transfer_id', transfer.id)
      .order('created_at');
    setTransferItems(data || []);
    setMode(viewMode);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function handleScanBox(e: React.FormEvent) {
    e.preventDefault();
    if (!barcode.trim() || !activeTransfer || !profile) return;
    const bc = barcode.trim().toUpperCase();
    setBarcode('');
    setScanning(true);

    const { error } = await supabase.rpc('fn_add_transfer_box', {
      p_transfer_id: activeTransfer.id,
      p_barcode: bc,
      p_user_id: profile.id,
      p_user_role: profile.role,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`✓ ${bc} added`);
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        osc.frequency.value = 800;
        osc.connect(ctx.destination);
        osc.start();
        setTimeout(() => osc.stop(), 150);
      } catch {}
      // Refresh items
      const { data } = await supabase
        .from('transfer_items')
        .select('*, product:products(name)')
        .eq('transfer_id', activeTransfer.id)
        .order('created_at');
      setTransferItems(data || []);
    }
    setScanning(false);
    inputRef.current?.focus();
  }

  async function handleSendTransfer() {
    if (!activeTransfer || !profile) return;
    const { error } = await supabase.rpc('fn_send_transfer', {
      p_transfer_id: activeTransfer.id,
      p_user_id: profile.id,
      p_user_role: profile.role,
    });
    if (error) return toast.error(error.message);
    toast.success('Transfer sent!');
    setMode('list');
    setActiveTransfer(null);
    fetchTransfers();
  }

  async function handleReceiveBox(e: React.FormEvent) {
    e.preventDefault();
    if (!barcode.trim() || !activeTransfer || !profile) return;
    const bc = barcode.trim().toUpperCase();
    setBarcode('');
    setScanning(true);

    const { error } = await supabase.rpc('fn_receive_transfer_box', {
      p_transfer_id: activeTransfer.id,
      p_barcode: bc,
      p_user_id: profile.id,
      p_user_role: profile.role,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`✓ ${bc} received`);
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        osc.frequency.value = 800;
        osc.connect(ctx.destination);
        osc.start();
        setTimeout(() => osc.stop(), 150);
      } catch {}
      const { data } = await supabase
        .from('transfer_items')
        .select('*, product:products(name)')
        .eq('transfer_id', activeTransfer.id)
        .order('created_at');
      setTransferItems(data || []);
    }
    setScanning(false);
    inputRef.current?.focus();
  }

  async function handleCompleteTransfer() {
    if (!activeTransfer || !profile) return;
    const { error } = await supabase.rpc('fn_complete_transfer', {
      p_transfer_id: activeTransfer.id,
      p_user_id: profile.id,
      p_user_role: profile.role,
    });
    if (error) return toast.error(error.message);
    toast.success('Transfer completed!');
    setMode('list');
    setActiveTransfer(null);
    fetchTransfers();
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-500/10 text-gray-400',
      sent: 'bg-blue-500/10 text-blue-500',
      receiving: 'bg-amber-500/10 text-amber-500',
      completed: 'bg-green-500/10 text-green-500',
      cancelled: 'bg-red-500/10 text-red-500',
    };
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || ''}`}>{status}</span>;
  };

  // LIST VIEW
  if (mode === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-500/10 p-2.5"><ArrowRightLeft className="h-6 w-6 text-purple-500" /></div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Warehouse Transfers</h1>
              <p className="text-sm text-muted-foreground">Transfer stock between warehouses.</p>
            </div>
          </div>
          <Button onClick={() => setMode('create')}><Plus className="h-4 w-4 mr-2" /> New Transfer</Button>
        </div>

        <div className="rounded-xl border border-white/10 bg-card shadow-sm">
          {transfers.length === 0 ? (
            <div className="p-6"><EmptyState title="No transfers" description="No warehouse transfers have been created." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transfer #</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.transfer_number}</TableCell>
                    <TableCell>{t.from_wh?.code}</TableCell>
                    <TableCell>{t.to_wh?.code}</TableCell>
                    <TableCell>{statusBadge(t.status)}</TableCell>
                    <TableCell>{t.creator?.full_name}</TableCell>
                    <TableCell>{new Date(t.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {t.status === 'draft' && <Button size="sm" onClick={() => openTransfer(t, 'scan')}>Continue</Button>}
                      {(t.status === 'sent' || t.status === 'receiving') && <Button size="sm" variant="outline" onClick={() => openTransfer(t, 'receive')}>Receive</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    );
  }

  // CREATE VIEW
  if (mode === 'create') {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Create Transfer</h1>
        <div className="rounded-xl border border-white/10 bg-card p-6 shadow-sm">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>From Warehouse *</Label>
              <Select value={fromWh} onValueChange={setFromWh}>
                <SelectTrigger><SelectValue placeholder="Source warehouse" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To Warehouse *</Label>
              <Select value={toWh} onValueChange={setToWh}>
                <SelectTrigger><SelectValue placeholder="Destination warehouse" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setMode('list')}>Cancel</Button>
              <Button type="submit" className="flex-1">Create & Start Scanning</Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // SCAN VIEW (adding boxes to draft transfer)
  if (mode === 'scan' && activeTransfer) {
    const pendingCount = transferItems.length;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Transfer: {activeTransfer.transfer_number}</h1>
            <p className="text-sm text-muted-foreground">{activeTransfer.from_wh?.code} → {activeTransfer.to_wh?.code}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setMode('list'); setActiveTransfer(null); }}>Back</Button>
            {pendingCount > 0 && (
              <Button onClick={handleSendTransfer} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Send className="h-4 w-4 mr-2" /> Send Transfer ({pendingCount} boxes)
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-card p-6 shadow-sm">
          <form onSubmit={handleScanBox} className="flex gap-3">
            <Input ref={inputRef} placeholder="Scan barcode to add..." value={barcode} onChange={e => setBarcode(e.target.value)} autoFocus className="flex-1" />
            <Button type="submit" disabled={scanning}><Search className="h-4 w-4 mr-2" /> Add</Button>
          </form>
        </div>

        <StatCard label="Boxes in Transfer" value={pendingCount} accent="primary" />

        {transferItems.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transferItems.map(ti => (
                  <TableRow key={ti.id}>
                    <TableCell className="font-mono">{ti.barcode}</TableCell>
                    <TableCell>{ti.product?.name}</TableCell>
                    <TableCell>{statusBadge(ti.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  // RECEIVE VIEW
  if (mode === 'receive' && activeTransfer) {
    const receivedCount = transferItems.filter(i => i.status === 'received').length;
    const totalCount = transferItems.length;
    const allReceived = receivedCount === totalCount && totalCount > 0;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Receive: {activeTransfer.transfer_number}</h1>
            <p className="text-sm text-muted-foreground">{activeTransfer.from_wh?.code} → {activeTransfer.to_wh?.code}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setMode('list'); setActiveTransfer(null); }}>Back</Button>
            {allReceived && (
              <Button onClick={handleCompleteTransfer} className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle className="h-4 w-4 mr-2" /> Complete Transfer
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total" value={totalCount} accent="primary" />
          <StatCard label="Received" value={receivedCount} accent="success" />
          <StatCard label="Pending" value={totalCount - receivedCount} accent="warning" />
        </div>

        <div className="rounded-xl border border-white/10 bg-card p-6 shadow-sm">
          <form onSubmit={handleReceiveBox} className="flex gap-3">
            <Input ref={inputRef} placeholder="Scan barcode to receive..." value={barcode} onChange={e => setBarcode(e.target.value)} autoFocus className="flex-1" />
            <Button type="submit" disabled={scanning}><PackageCheck className="h-4 w-4 mr-2" /> Receive</Button>
          </form>
        </div>

        <div className="rounded-xl border border-white/10 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barcode</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transferItems.map(ti => (
                <TableRow key={ti.id}>
                  <TableCell className="font-mono">{ti.barcode}</TableCell>
                  <TableCell>{ti.product?.name}</TableCell>
                  <TableCell>
                    {ti.status === 'received'
                      ? <span className="inline-flex items-center gap-1 text-green-500"><CheckCircle className="h-3.5 w-3.5" /> Received</span>
                      : <span className="text-muted-foreground">Pending</span>
                    }
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return null;
}
