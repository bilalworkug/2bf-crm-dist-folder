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

export default function AccountPaymentsPage() {
  const { profile } = useAuth();
  const isAccount = profile?.role === 'admin' || profile?.role === 'accounts' || profile?.role === 'accounts_manager';

  const [payments, setPayments] = useState<Payment[]>([]);
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Clock className="w-4 h-4 mr-2" /> Pending Approval
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiPending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" /> Approved Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiApprovedToday}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <DollarSign className="w-4 h-4 mr-2" /> Payments This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiPaymentsMonth}</div>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>All submitted payments</CardDescription>
            </div>
            <ExportDropdown
              filenameBase="payments"
              title="Payment History Report"
              headers={['Date', 'Customer', 'Order', 'Amount', 'Method', 'Status', 'Submitted By']}
              rows={payments.map((p) => [new Date(p.payment_date).toLocaleDateString(), (p as any).customer?.customer_name || '', (p as any).order?.order_number || '', p.amount, p.payment_method, p.status, (p as any).submitter?.full_name || ''])}
            />
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading...</p>
            ) : (
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
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{p.customer?.customer_name}</TableCell>
                      <TableCell>{p.order?.order_number}</TableCell>
                      <TableCell className="font-mono">{p.amount.toFixed(2)} {p.currency}</TableCell>
                      <TableCell>{p.payment_method}</TableCell>
                      <TableCell>
                          {p.status === 'pending' && <Badge variant="outline" className="text-yellow-600 bg-yellow-50">Pending</Badge>}
                          {p.status === 'approved' && <Badge variant="outline" className="text-green-600 bg-green-50">Approved</Badge>}
                          {p.status === 'rejected' && <Badge variant="outline" className="text-red-600 bg-red-50">Rejected</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.status === 'pending' && (
                          <div className="flex justify-end space-x-2">
                            <Button size="sm" onClick={() => handleApprove(p.id)} className="bg-green-600 hover:bg-green-700">Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleReject(p.id)}>Reject</Button>
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
