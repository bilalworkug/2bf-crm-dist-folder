'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { AuditLog, Profile, Warehouse, Product } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { ScrollText, Search, Filter, X, Download } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { ExportDropdown } from '@/components/export-dropdown';
import { toast } from 'sonner';

const ACTIONS = [
  'production_scan', 'warehouse_receipt', 'dispatch', 'order_created',
  'customer_created', 'return_processed', 'approval_requested',
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<(AuditLog & { profile?: Profile | null; warehouse?: Warehouse; product?: Product })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    load();
    (async () => {
      const { data } = await supabase.from('profiles').select('*').order('full_name');
      setProfiles(data ?? []);
    })();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('audit_logs')
      .select('*, profile:profiles!audit_logs_user_id_fkey(*), warehouse:warehouses(*), product:products(*)')
      .order('created_at', { ascending: false })
      .limit(200);
    setLogs((data ?? []) as (AuditLog & { profile?: Profile | null; warehouse?: Warehouse; product?: Product })[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter((l) => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      if (userFilter !== 'all' && l.user_id !== userFilter) return false;
      if (!q) return true;
      return l.action.toLowerCase().includes(q) || l.barcode?.toLowerCase().includes(q) || (l.profile?.full_name ?? '').toLowerCase().includes(q);
    });
  }, [logs, search, actionFilter, userFilter]);

  function clearFilters() {
    setSearch('');
    setActionFilter('all');
    setUserFilter('all');
  }

  function exportCsv() {
    const headers = ['Time', 'User', 'Action', 'Barcode', 'Product', 'Warehouse', 'Entity'];
    const rows = filtered.map((l) => [
      formatDate(l.created_at),
      l.profile?.full_name ?? '—',
      l.action,
      l.barcode ?? '—',
      l.product?.name ?? '—',
      l.warehouse?.code ?? '—',
      l.entity_type ?? '—',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  }

  const hasFilters = search || actionFilter !== 'all' || userFilter !== 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Complete record of every important action in the system."
        actions={
          <ExportDropdown
            filenameBase="audit_logs"
            title="Audit Logs Report"
            headers={['Time', 'User', 'Action', 'Barcode', 'Product', 'Warehouse', 'Entity']}
            rows={filtered.map((l) => [formatDate(l.created_at), l.profile?.full_name ?? '—', l.action, l.barcode ?? '—', l.product?.name ?? '—', l.warehouse?.code ?? '—', l.entity_type ?? '—'])}
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total log entries" value={logs.length} icon={ScrollText} accent="primary" />
        <StatCard label="Filtered results" value={filtered.length} icon={Filter} accent="neutral" />
        <StatCard label="Unique actions" value={new Set(logs.map((l) => l.action)).size} icon={ScrollText} accent="success" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by action, barcode, or user..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full lg:w-48"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ACTIONS.map((a) => <SelectItem key={a} value={a} className="capitalize">{a.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-full lg:w-48"><SelectValue placeholder="User" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" onClick={clearFilters} className="shrink-0">
                <X className="mr-1.5 h-4 w-4" /> Clear
              </Button>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No audit logs found" icon={ScrollText} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Entity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(l.created_at)}</TableCell>
                    <TableCell className="text-sm font-medium">{l.profile?.full_name ?? 'System'}</TableCell>
                    <TableCell className="capitalize">{l.action.replace(/_/g, ' ')}</TableCell>
                    <TableCell className="font-mono text-sm">{l.barcode ?? '—'}</TableCell>
                    <TableCell className="text-sm">{l.product?.name ?? '—'}</TableCell>
                    <TableCell>{l.warehouse?.code ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.entity_type ?? '—'}</TableCell>
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
