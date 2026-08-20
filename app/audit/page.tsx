'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { Search } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { ExportDropdown } from '@/components/export-dropdown';

export default function AuditLogsPage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const isAdminOrManager = profile && ['admin', 'manager'].includes(profile.role);

  useEffect(() => {
    if (!isAdminOrManager) {
      setLoading(false);
      return;
    }
    load();
  }, [isAdminOrManager]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('audit_logs')
      .select('*, user:profiles!audit_logs_user_id_fkey(full_name), warehouse:warehouses(code)')
      .order('created_at', { ascending: false })
      .limit(100);
    setLogs(data ?? []);
    setLoading(false);
  }

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.barcode?.toLowerCase().includes(q) ||
      l.entity_id?.toLowerCase().includes(q) ||
      l.details?.toLowerCase().includes(q) ||
      l.user?.full_name?.toLowerCase().includes(q)
    );
  });

  if (!isAdminOrManager && !loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Audit Logs" description="System activity tracking." />
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            You do not have permission to view audit logs.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="System activity tracking for security and accountability."
        actions={
          <ExportDropdown
            filenameBase="audit_logs"
            title="Audit Logs Report"
            headers={['Timestamp', 'User', 'Role', 'Action', 'Barcode', 'Warehouse', 'Details']}
            rows={filtered.map((l) => [formatDate(l.created_at), l.user?.full_name ?? '—', l.user_role ?? '—', l.action, l.barcode ?? '—', l.warehouse?.code ?? '—', l.details ? JSON.stringify(l.details) : '—'])}
          />
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search logs by action, barcode, details..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No audit logs found" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(l.created_at)}</TableCell>
                      <TableCell className="text-sm font-medium">{l.user?.full_name || 'System'}</TableCell>
                      <TableCell className="text-xs capitalize">{l.role}</TableCell>
                      <TableCell className="text-xs font-semibold uppercase tracking-wider">{l.action.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="font-mono text-xs">{l.barcode ?? '—'}</TableCell>
                      <TableCell className="text-xs">{l.warehouse?.code ?? '—'}</TableCell>
                      <TableCell className="text-xs max-w-sm truncate" title={l.details}>{l.details ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
