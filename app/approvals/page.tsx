'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Approval, Profile } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { ClipboardCheck, CheckCircle2, XCircle, Clock, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';

export default function ApprovalsPage() {
  const { profile } = useAuth();
  const [approvals, setApprovals] = useState<(Approval & { requester?: Profile; reviewer?: Profile | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewing, setReviewing] = useState<(Approval & { requester?: Profile; reviewer?: Profile | null }) | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canReview = profile && ['admin', 'manager'].includes(profile.role);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('approvals')
      .select('*, requester:profiles!approvals_requested_by_fkey(*), reviewer:profiles!approvals_reviewed_by_fkey(*)')
      .order('requested_at', { ascending: false });
    setApprovals((data ?? []) as (Approval & { requester?: Profile; reviewer?: Profile | null })[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return approvals.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (!q) return true;
      return a.request_type.toLowerCase().includes(q) || a.reason?.toLowerCase().includes(q) || (a.requester?.full_name ?? '').toLowerCase().includes(q);
    });
  }, [approvals, search, statusFilter]);

  async function handleReview(decision: 'approved' | 'rejected') {
    if (!reviewing || !profile) return;
    setSubmitting(true);
    const { error } = await supabase
      .from('approvals')
      .update({
        status: decision,
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes.trim() || null,
      })
      .eq('id', reviewing.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Approval ${decision}`);
      setReviewing(null);
      setReviewNotes('');
      load();
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Review and act on approval requests for important operations."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Pending" value={approvals.filter((a) => a.status === 'pending').length} icon={Clock} accent="warning" />
        <StatCard label="Approved" value={approvals.filter((a) => a.status === 'approved').length} icon={CheckCircle2} accent="success" />
        <StatCard label="Rejected" value={approvals.filter((a) => a.status === 'rejected').length} icon={XCircle} accent="destructive" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by type, reason, or requester..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No approval requests" icon={ClipboardCheck} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Requested by</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Reviewed by</TableHead>
                  <TableHead>Status</TableHead>
                  {canReview && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium capitalize">{a.request_type.replace(/_/g, ' ')}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{a.reason ?? '—'}</TableCell>
                    <TableCell className="text-sm">{a.requester?.full_name ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(a.requested_at)}</TableCell>
                    <TableCell className="text-sm">{a.reviewer?.full_name ?? '—'}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    {canReview && (
                      <TableCell className="text-right">
                        {a.status === 'pending' ? (
                          <Button size="sm" variant="outline" onClick={() => { setReviewing(a); setReviewNotes(a.review_notes ?? ''); }}>
                            Review
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">{a.review_notes ?? '—'}</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review approval request</DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-3">
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium capitalize">{reviewing.request_type.replace(/_/g, ' ')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{reviewing.reason ?? '—'}</p>
                <p className="mt-2 text-xs text-muted-foreground">Requested by {reviewing.requester?.full_name ?? '—'} on {formatDate(reviewing.requested_at)}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Review notes</Label>
                <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Add notes about this decision..." />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleReview('rejected')} disabled={submitting}>
                  <XCircle className="mr-2 h-4 w-4" /> Reject
                </Button>
                <Button onClick={() => handleReview('approved')} disabled={submitting}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
