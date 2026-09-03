'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Approval, Profile, Payment } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ExportDropdown } from '@/components/export-dropdown';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import {
  ClipboardCheck, CheckCircle2, XCircle, Clock, Search,
  CreditCard, FileCheck, DollarSign, Undo2, ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { SLATimer, type SLATaskType } from '@/components/sla-timer';
import { cn } from '@/lib/utils';

export interface UnifiedApprovalItem {
  id: string;
  source: 'approval' | 'payment';
  requestType: string;
  department: string;
  customerName?: string;
  orderNumber?: string;
  amountOrUnits?: string;
  reason?: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  taskType: SLATaskType;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
  rawItem: any;
}

export default function UniversalApprovalPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<UnifiedApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal state
  const [reviewing, setReviewing] = useState<UnifiedApprovalItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const role = profile?.role || '';
  const isAdmin = role === 'admin';
  const isAccounts = role === 'accounts' || role === 'accounts_manager' || isAdmin;
  const isManager = role.includes('manager') || isAdmin;

  const loadData = useCallback(async () => {
    setLoading(true);
    const unified: UnifiedApprovalItem[] = [];

    try {
      // 1. Fetch from approvals table
      const { data: approvalsData } = await supabase
        .from('approvals')
        .select('*, requester:profiles!approvals_requested_by_fkey(full_name), reviewer:profiles!approvals_reviewed_by_fkey(full_name)')
        .order('requested_at', { ascending: false });

      approvalsData?.forEach((a: any) => {
        let taskType: SLATaskType = 'correction';
        let dept = 'Operations';
        const rt = (a.request_type || '').toLowerCase();

        if (rt.includes('credit')) {
          taskType = 'payment';
          dept = 'Accounts';
        } else if (rt.includes('discount')) {
          taskType = 'payment';
          dept = 'Sales';
        } else if (rt.includes('return')) {
          taskType = 'return';
          dept = 'Warehouse';
        } else if (rt.includes('correction')) {
          taskType = 'correction';
          dept = 'Production';
        }

        unified.push({
          id: `app-${a.id}`,
          source: 'approval',
          requestType: a.request_type,
          department: dept,
          reason: a.reason || '—',
          requestedBy: a.requester?.full_name || 'System User',
          requestedAt: a.requested_at,
          status: a.status,
          taskType,
          reviewedBy: a.reviewer?.full_name,
          reviewNotes: a.review_notes,
          rawItem: a,
        });
      });

      // 2. Fetch pending payments (Unified into Approval Center!)
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*, customer:customers(customer_name), order:orders(order_number), approver:profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(50);

      paymentsData?.forEach((p: any) => {
        unified.push({
          id: `pay-${p.id}`,
          source: 'payment',
          requestType: 'Payment Approval',
          department: 'Accounts',
          customerName: p.customer?.customer_name,
          orderNumber: p.order?.order_number,
          amountOrUnits: `ETB ${Number(p.amount).toLocaleString()}`,
          reason: `Method: ${p.payment_method}`,
          requestedBy: p.customer?.customer_name || 'Accounts Staff',
          requestedAt: p.payment_date || p.created_at,
          status: p.status,
          taskType: 'payment',
          reviewedBy: p.approver?.full_name,
          reviewNotes: p.notes,
          rawItem: p,
        });
      });

      // Sort by status (pending first), then newest timestamp
      unified.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
      });

      setItems(unified);
    } catch (err) {
      console.error('Failed to load approval center:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (typeFilter !== 'all') {
        if (typeFilter === 'payment' && item.source !== 'payment') return false;
        if (typeFilter === 'approval' && item.source !== 'approval') return false;
        if (typeFilter === 'credit' && !item.requestType.toLowerCase().includes('credit')) return false;
        if (typeFilter === 'return' && !item.requestType.toLowerCase().includes('return')) return false;
      }
      if (!q) return true;
      return (
        item.requestType.toLowerCase().includes(q) ||
        (item.customerName && item.customerName.toLowerCase().includes(q)) ||
        (item.orderNumber && item.orderNumber.toLowerCase().includes(q)) ||
        (item.reason && item.reason.toLowerCase().includes(q)) ||
        item.requestedBy.toLowerCase().includes(q)
      );
    });
  }, [items, search, typeFilter, statusFilter]);

  // Handle decisions: Payments call existing RPC, Approvals update table
  async function handleDecision(decision: 'approved' | 'rejected') {
    if (!reviewing || !profile) return;
    setSubmitting(true);

    try {
      if (reviewing.source === 'payment') {
        if (decision === 'approved') {
          const { error } = await supabase.rpc('fn_approve_payment', {
            p_payment_id: reviewing.rawItem.id,
          });
          if (error) throw error;
          toast.success('Payment approved and credited to ledger');
        } else {
          const { error } = await supabase
            .from('payments')
            .update({ status: 'rejected' })
            .eq('id', reviewing.rawItem.id);
          if (error) throw error;
          toast.success('Payment rejected');
        }
      } else {
        // Generic approval request
        const { error } = await supabase
          .from('approvals')
          .update({
            status: decision,
            reviewed_by: profile.id,
            reviewed_at: new Date().toISOString(),
            review_notes: reviewNotes.trim() || null,
          })
          .eq('id', reviewing.rawItem.id);
        if (error) throw error;
        toast.success(`Request ${decision}`);
      }

      setReviewing(null);
      setReviewNotes('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  }

  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const approvedCount = items.filter((i) => i.status === 'approved').length;
  const rejectedCount = items.filter((i) => i.status === 'rejected').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Universal Approval Center"
        description="Unified factory inbox for payments, credit authorizations, discounts, returns, and corrections."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Pending Review" value={pendingCount} icon={Clock} accent="warning" />
        <StatCard label="Approved" value={approvedCount} icon={CheckCircle2} accent="success" />
        <StatCard label="Rejected" value={rejectedCount} icon={XCircle} accent="destructive" />
        <StatCard label="Total Requests" value={items.length} icon={ClipboardCheck} accent="primary" />
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 border-b border-border/60">
          <div>
            <CardTitle className="text-base font-bold">Approval Requests</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live authorization requests sorted by SLA urgency.
            </p>
          </div>
          <ExportDropdown
            filenameBase="approval_requests"
            title="Approval Center Report"
            headers={['Type', 'Department', 'Customer/Order', 'Details', 'Requested By', 'Status', 'Requested At']}
            rows={filtered.map((a) => [
              a.requestType,
              a.department,
              a.orderNumber || a.customerName || '—',
              a.amountOrUnits || a.reason || '—',
              a.requestedBy,
              a.status,
              formatDate(a.requestedAt),
            ])}
            variant="outline"
            className="h-9"
          />
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by request type, customer, order, or requester..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 sm:h-10 text-base sm:text-sm"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-44 h-11 sm:h-10 text-base sm:text-sm">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="payment">Payments</SelectItem>
                <SelectItem value="approval">Operational Approvals</SelectItem>
                <SelectItem value="credit">Credit Limits</SelectItem>
                <SelectItem value="return">Returns</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 h-11 sm:h-10 text-base sm:text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No approval requests found" icon={ClipboardCheck} />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type & Department</TableHead>
                      <TableHead>Reference / Customer</TableHead>
                      <TableHead>Details / Amount</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>SLA Wait</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-semibold text-sm capitalize">{item.requestType.replace(/_/g, ' ')}</div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">{item.department}</span>
                        </TableCell>
                        <TableCell>
                          {item.customerName && <div className="font-medium text-sm text-foreground">{item.customerName}</div>}
                          {item.orderNumber && <div className="text-xs font-mono text-muted-foreground">{item.orderNumber}</div>}
                          {!item.customerName && !item.orderNumber && <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {item.amountOrUnits ? (
                            <span className="font-mono font-bold text-primary">{item.amountOrUnits}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground max-w-xs truncate block">{item.reason}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{item.requestedBy}</TableCell>
                        <TableCell>
                          {item.status === 'pending' ? (
                            <SLATimer taskType={item.taskType} startedAt={item.requestedAt} compact />
                          ) : (
                            <span className="text-xs text-muted-foreground">{formatDate(item.requestedAt)}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={item.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {item.status === 'pending' ? (
                            <Button
                              size="sm"
                              onClick={() => {
                                setReviewing(item);
                                setReviewNotes('');
                              }}
                              className="h-8 touch-press"
                            >
                              Review
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">{item.reviewedBy ? `By ${item.reviewedBy}` : 'Completed'}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Stacked Cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filtered.map((item) => (
                  <div
                    key={item.id}
                    className="border border-border/80 rounded-xl p-4 bg-card shadow-xs space-y-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] uppercase font-bold px-2 py-0.2 rounded-full bg-primary/10 text-primary">
                            {item.department}
                          </span>
                          <span className="font-bold text-sm text-foreground capitalize">
                            {item.requestType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {item.customerName && (
                          <p className="text-xs font-medium text-foreground mt-1">{item.customerName}</p>
                        )}
                        {item.orderNumber && (
                          <p className="text-xs font-mono text-muted-foreground">{item.orderNumber}</p>
                        )}
                      </div>
                      <StatusBadge status={item.status} />
                    </div>

                    <div className="flex justify-between items-center text-xs pt-1 border-t">
                      <span className="text-muted-foreground">Details:</span>
                      {item.amountOrUnits ? (
                        <span className="font-mono font-bold text-primary">{item.amountOrUnits}</span>
                      ) : (
                        <span className="text-foreground max-w-[200px] truncate">{item.reason}</span>
                      )}
                    </div>

                    {item.status === 'pending' && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">SLA Elapsed:</span>
                        <SLATimer taskType={item.taskType} startedAt={item.requestedAt} compact />
                      </div>
                    )}

                    {item.status === 'pending' && (
                      <Button
                        size="lg"
                        onClick={() => {
                          setReviewing(item);
                          setReviewNotes('');
                        }}
                        className="w-full h-11 text-sm font-semibold touch-press"
                      >
                        Review & Decide
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Decision Dialog */}
      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Approval Request</DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground uppercase font-bold text-[10px]">Type</span>
                  <span className="font-semibold text-foreground capitalize">{reviewing.requestType.replace(/_/g, ' ')}</span>
                </div>
                {reviewing.customerName && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground uppercase font-bold text-[10px]">Customer</span>
                    <span className="font-medium text-foreground">{reviewing.customerName}</span>
                  </div>
                )}
                {reviewing.amountOrUnits && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground uppercase font-bold text-[10px]">Amount / Value</span>
                    <span className="font-mono font-bold text-primary">{reviewing.amountOrUnits}</span>
                  </div>
                )}
                {reviewing.reason && (
                  <div className="pt-1 border-t">
                    <span className="text-muted-foreground uppercase font-bold text-[10px] block mb-0.5">Notes / Reason</span>
                    <p className="text-foreground">{reviewing.reason}</p>
                  </div>
                )}
                <div className="pt-1 border-t flex justify-between items-center">
                  <span className="text-muted-foreground uppercase font-bold text-[10px]">Requested By</span>
                  <span className="text-muted-foreground">{reviewing.requestedBy}</span>
                </div>
              </div>

              {reviewing.source === 'approval' && (
                <div className="space-y-1.5">
                  <Label>Manager Review Notes (Optional)</Label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add operational notes or decision remarks..."
                    rows={2}
                  />
                </div>
              )}

              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                <Button
                  variant="destructive"
                  onClick={() => handleDecision('rejected')}
                  disabled={submitting}
                  className="w-full sm:w-auto h-11 sm:h-10 touch-press"
                >
                  <XCircle className="mr-2 h-4 w-4" /> Reject
                </Button>
                <Button
                  onClick={() => handleDecision('approved')}
                  disabled={submitting}
                  className="w-full sm:w-auto h-11 sm:h-10 bg-emerald-600 hover:bg-emerald-700 text-white touch-press"
                >
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
