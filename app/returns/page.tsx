'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { ReturnRecord, Product, Warehouse, Profile, Order } from '@/lib/types';
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
import { Undo2, AlertTriangle, Clock, Search, Plus, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';

export default function ReturnsPage() {
  const { profile } = useAuth();
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ barcode: '', order_id: '', reason: '', condition: 'good' });

  const [orders, setOrders] = useState<Order[]>([]);

  const isManager = profile && ['admin', 'manager'].includes(profile.role);
  const canRequest = profile && ['admin', 'warehouse', 'sales', 'manager'].includes(profile.role);
  const warehouseId = profile?.warehouse_id || '00000000-0000-0000-0000-000000000001';

  useEffect(() => {
    load();
    (async () => {
      const { data: o } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      setOrders(o ?? []);
    })();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('returns')
      .select('*, product:products(*), warehouse:warehouses(*), processor:profiles!returns_requested_by_fkey(full_name), approver:profiles!returns_approved_by_fkey(full_name)')
      .order('processed_at', { ascending: false });
    setReturns(data ?? []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return returns.filter((r) => {
      if (statusFilter !== 'all' && r.approval_status !== statusFilter) return false;
      if (!q) return true;
      return r.barcode?.toLowerCase().includes(q) || r.product?.name.toLowerCase().includes(q) || r.reason?.toLowerCase().includes(q);
    });
  }, [returns, search, statusFilter]);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!form.barcode.trim() || !form.order_id) {
      toast.error('Barcode and Order are required');
      return;
    }

    const { error } = await supabase.rpc('fn_request_return', {
      p_barcode: form.barcode.trim(),
      p_order_id: form.order_id,
      p_warehouse_id: warehouseId,
      p_reason: form.reason.trim(),
      p_condition: form.condition,
      p_user_id: profile?.id,
      p_user_role: profile?.role || 'system'
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Return request submitted');
      setOpen(false);
      setForm({ barcode: '', order_id: '', reason: '', condition: 'good' });
      load();
    }
  }

  async function handleApprove(returnId: string) {
    if (!confirm('Approve this return?')) return;
    const { error } = await supabase.rpc('fn_approve_return', {
      p_return_id: returnId,
      p_user_id: profile?.id,
      p_user_role: profile?.role || 'system'
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Return approved');
      load();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Returns Workflow"
        description="Request and approve returns. Approved returns in 'good' condition become available stock."
        actions={
          canRequest ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Request Return</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Request Return</DialogTitle></DialogHeader>
                <form onSubmit={handleRequest} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Barcode *</Label>
                    <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Original Order *</Label>
                    <Select value={form.order_id} onValueChange={(v) => setForm({ ...form, order_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {orders.map((o) => <SelectItem key={o.id} value={o.id}>{o.order_number}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Condition *</Label>
                    <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">Good (Resellable)</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reason</Label>
                    <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit">Submit Request</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Pending Approval" value={returns.filter((r) => r.approval_status === 'pending').length} icon={Clock} accent="warning" />
        <StatCard label="Approved (Good)" value={returns.filter((r) => r.approval_status === 'approved' && r.condition === 'good').length} icon={Undo2} accent="success" />
        <StatCard label="Damaged / Expired" value={returns.filter((r) => r.approval_status === 'approved' && (r.condition === 'damaged' || r.condition === 'expired')).length} icon={AlertTriangle} accent="destructive" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search returns..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
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
                  <TableHead>Return #</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-xs">{r.return_number}</TableCell>
                    <TableCell className="font-mono text-xs">{r.barcode}</TableCell>
                    <TableCell>{r.product?.name ?? '—'}</TableCell>
                    <TableCell className="capitalize">{r.condition}</TableCell>
                    <TableCell>
                      {r.approval_status === 'pending' ? (
                        <StatusBadge status="pending" />
                      ) : (
                        <StatusBadge status="completed" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{r.processor?.full_name ?? '—'}</TableCell>
                    <TableCell>
                      {r.approval_status === 'pending' && isManager ? (
                        <Button size="sm" variant="outline" className="h-8 text-green-600 hover:text-green-700" onClick={() => handleApprove(r.id)}>
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                        </Button>
                      ) : (
                        r.approval_status === 'approved' && <span className="text-xs text-muted-foreground">Approved</span>
                      )}
                    </TableCell>
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
