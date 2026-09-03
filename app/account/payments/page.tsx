'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import type { Payment } from '@/lib/types';
import { DollarSign, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { ExportDropdown } from '@/components/export-dropdown';
import { StatusBadge } from '@/components/status-badge';
import { SavedViewsBar } from '@/components/saved-views-bar';

export default function AccountPaymentsPage() {
  const { profile } = useAuth();
  const isAccount = profile?.role === 'admin' || profile?.role === 'accounts' || profile?.role === 'accounts_manager';

  const [payments, setPayments] = useState<Payment[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // KPIs
  const [kpiPending, setKpiPending] = useState(0);
  const [kpiApprovedToday, setKpiApprovedToday] = useState(0);
  const [kpiPaymentsMonth, setKpiPaymentsMonth] = useState(0);

  useEffect(() => {
    if (isAccount) {
      loadPayments();
    }
  }, [isAccount]);

  async function loadPayments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          customer:customers(customer_name),
          order:orders(order_number),
          submitter:profiles!submitted_by(full_name),
          approver:profiles!approved_by(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const px = data as unknown as Payment[];
      setPayments(px);
      
      // Calculate KPIs
      const now = new Date();
      let pending = 0;
      let appToday = 0;
      let month = 0;
      
      px.forEach(p => {
          if (p.status === 'pending') pending++;
          
          if (p.status === 'approved' && p.approved_at) {
              const appDate = new Date(p.approved_at);
              if (appDate.toDateString() === now.toDateString()) {
                  appToday++;
              }
              if (appDate.getMonth() === now.getMonth() && appDate.getFullYear() === now.getFullYear()) {
                  month++;
              }
          }
      });
      
      setKpiPending(pending);
      setKpiApprovedToday(appToday);
      setKpiPaymentsMonth(month);

    } catch (err: any) {
      toast.error(err.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }

  const displayedPayments = statusFilter === 'all'
    ? payments
    : payments.filter((p: Payment) => p.status === statusFilter);

  const handleApprove = async (paymentId: string) => {
      try {
          const { error } = await supabase.rpc('fn_approve_payment', { p_payment_id: paymentId });
          if (error) throw error;
          toast.success('Payment approved successfully');
          loadPayments();
      } catch (err: any) {
          toast.error(err.message || 'Approval failed');
      }
  };

  const handleReject = async (paymentId: string) => {
      try {
          const { error } = await supabase.rpc('fn_reject_payment', { p_payment_id: paymentId });
          if (error) throw error;
          toast.success('Payment rejected');
          loadPayments();
      } catch (err: any) {
          toast.error(err.message || 'Rejection failed');
      }
  };

  if (!isAccount) return <div className="p-8">Access Denied</div>;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Payment Management"
        description="Review, approve, and track customer payments"
      />
      
      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 space-y-6">
        
        {/* KPI Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
          <Card>
            <CardHeader className="p-3.5 sm:p-5 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center">
                <Clock className="w-4 h-4 mr-1.5 shrink-0" /> Pending Approval
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-5 pt-0">
              <div className="text-xl sm:text-2xl font-bold">{kpiPending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3.5 sm:p-5 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center">
                <CheckCircle className="w-4 h-4 mr-1.5 shrink-0" /> Approved Today
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-5 pt-0">
              <div className="text-xl sm:text-2xl font-bold">{kpiApprovedToday}</div>
            </CardContent>
          </Card>
          <Card className="col-span-2 md:col-span-1">
            <CardHeader className="p-3.5 sm:p-5 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center">
                <DollarSign className="w-4 h-4 mr-1.5 shrink-0" /> Payments This Month
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-5 pt-0">
              <div className="text-xl sm:text-2xl font-bold">{kpiPaymentsMonth}</div>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
            <div>
              <CardTitle className="text-base sm:text-lg">Payment History</CardTitle>
              <CardDescription className="text-xs sm:text-sm">All submitted payments</CardDescription>
            </div>
            <ExportDropdown
              filenameBase="payments"
              title="Payment History Report"
              headers={['Date', 'Customer', 'Order', 'Amount', 'Method', 'Status', 'Submitted By']}
              rows={payments.map((p) => [new Date(p.payment_date).toLocaleDateString(), (p as any).customer?.customer_name || '', (p as any).order?.order_number || '', p.amount, p.payment_method, p.status, (p as any).submitter?.full_name || ''])}
            />
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <SavedViewsBar
              storageKey="payments"
              views={[
                { id: 'all', label: 'All Payments', badge: payments.length },
                { id: 'pending', label: 'Pending Approval', badge: kpiPending },
                { id: 'approved', label: 'Approved', badge: payments.filter((p) => p.status === 'approved').length },
                { id: 'rejected', label: 'Rejected', badge: payments.filter((p) => p.status === 'rejected').length },
              ]}
              activeView={statusFilter}
              onSelectView={(v) => setStatusFilter(v)}
              className="mb-4 pb-2 border-b border-border/50"
            />

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : displayedPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No payments found in this view</p>
            ) : (
              <div className="space-y-4">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedPayments.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm">{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium text-sm">{(p as any).customer?.customer_name || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{(p as any).order?.order_number || '—'}</TableCell>
                          <TableCell className="font-mono font-medium text-sm">{p.amount.toFixed(2)} {p.currency}</TableCell>
                          <TableCell className="text-sm capitalize">{p.payment_method}</TableCell>
                          <TableCell>
                            <StatusBadge status={p.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            {p.status === 'pending' && (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={() => handleApprove(p.id)} className="bg-emerald-600 hover:bg-emerald-700 h-8">
                                  Approve
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleReject(p.id)} className="h-8">
                                  Reject
                                </Button>
                              </div>
                            )}
                            {p.status === 'approved' && (
                                <span className="text-xs text-muted-foreground block">Approved by {p.approver?.full_name}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Stacked Cards */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {displayedPayments.map(p => (
                    <div key={p.id} className="border border-border/80 rounded-xl p-4 bg-card shadow-sm space-y-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-bold text-sm text-foreground">{p.customer?.customer_name || 'Customer'}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">Order: {p.order?.order_number || '—'}</p>
                        </div>
                        <StatusBadge status={p.status} />
                      </div>

                      <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                        <span className="capitalize">{p.payment_method}</span>
                        <span>{new Date(p.payment_date).toLocaleDateString()}</span>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t text-sm font-semibold">
                        <span className="text-xs text-muted-foreground font-normal">Amount:</span>
                        <span className="font-mono text-primary text-base font-bold">{p.amount.toFixed(2)} {p.currency}</span>
                      </div>

                      {p.status === 'pending' && (
                        <div className="flex gap-2 pt-2 border-t">
                          <Button size="sm" onClick={() => handleApprove(p.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-10 touch-press">
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleReject(p.id)} className="flex-1 h-10 touch-press">
                            Reject
                          </Button>
                        </div>
                      )}
                      {p.status === 'approved' && (
                          <div className="pt-2 border-t text-xs text-muted-foreground">
                            Approved by {p.approver?.full_name}
                          </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
