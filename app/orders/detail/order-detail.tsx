'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Order, Customer, OrderItem, Product, Warehouse, Profile, Dispatch, Payment, PaymentDocument } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, Truck, Wallet, ShoppingCart, Download, DollarSign, Calendar, Upload, FileText, CheckCircle, CheckCircle2, XCircle, Clock, FileCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/format';
import { generatePDFReport } from '@/lib/pdf-export';
import { ORDER_STATUSES, type OrderHandover } from '@/lib/types';
import { generateWaybillPDF } from '@/lib/waybill-export';
import { ExportDropdown } from '@/components/export-dropdown';
import { WorkflowProgress } from '@/components/workflow-progress';
import { cn } from '@/lib/utils';

export default function OrderDetailClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { profile } = useAuth();
  
  const [order, setOrder] = useState<(Order & { customer?: Customer; sales_person?: Profile | null }) | null>(null);
  const [items, setItems] = useState<(OrderItem & { product?: Product; warehouse?: Warehouse; allocated_count: number; dispatched_count: number })[]>([]);
  const [dispatches, setDispatches] = useState<(Dispatch & { warehouse?: Warehouse; product?: Product })[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentDocs, setPaymentDocs] = useState<PaymentDocument[]>([]);
  const [handovers, setHandovers] = useState<(OrderHandover & { profile?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingOrder, setCompletingOrder] = useState(false);

  const canEditOrder = profile && ['admin', 'sales', 'dispatch', 'accounts', 'manager'].includes(profile.role);
  const isAccountOrAdmin = profile && ['admin', 'accounts', 'accounts_manager'].includes(profile.role);
  const canManageCompletion = profile && ['admin', 'manager', 'dispatch_manager', 'accounts_manager'].includes(profile.role);

  // Fulfillment Calculations (Phase 29)
  const totalOrdered = items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const totalDispatched = dispatches.length;
  const totalRemaining = Math.max(0, totalOrdered - totalDispatched);
  const fulfillmentPercent = totalOrdered > 0 ? Math.min(100, Math.round((totalDispatched / totalOrdered) * 1000) / 10) : 0;
  const isFullyDispatched = totalOrdered > 0 && totalRemaining === 0;
  const hasHandover = handovers.length > 0;
  const isEligibleForCompletion = isFullyDispatched && hasHandover && order?.status !== 'completed';

  // Modals state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentReference, setPaymentReference] = useState('');
  
  const [isDueDateModalOpen, setIsDueDateModalOpen] = useState(false);
  const [dueDateInput, setDueDateInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingForPayment, setUploadingForPayment] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: o, error: orderErr } = await supabase
        .from('orders')
        .select('*, customer:customers(*), sales_person:profiles!orders_sales_person_id_fkey(*)')
        .eq('id', id)
        .maybeSingle();
      if (orderErr) throw orderErr;
      setOrder(o as any);

      const { data: its } = await supabase.from('order_items').select('*, product:products(*), warehouse:warehouses(*)').eq('order_id', id);
      const { data: allocations } = await supabase.from('order_box_allocations').select('barcode, boxes!inner(product_id)').eq('order_id', id);
      const { data: dis } = await supabase.from('dispatches').select('*, warehouse:warehouses(*), product:products(*)').eq('order_id', id).order('dispatched_at', { ascending: false });
      const { data: hoData } = await supabase.from('order_handovers').select('*, profile:profiles!handed_over_by(*)').eq('order_id', id).order('created_at', { ascending: false });

      setDispatches((dis ?? []) as any);
      setHandovers((hoData ?? []) as any);

      const itemsMapped = its?.map((item: any) => {
        const allocated_count = allocations?.filter((a: any) => a.boxes?.product_id === item.product_id).length || 0;
        const dispatched_count = dis?.filter((d: any) => d.product_id === item.product_id).length || 0;
        return { ...item, allocated_count, dispatched_count };
      });
      setItems((itemsMapped ?? []) as any);

      await fetchPayments();
    } catch (err: any) {
      toast.error(err.message || 'Error loading order');
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteOrder() {
    if (!order) return;
    setCompletingOrder(true);
    try {
      const { data, error } = await supabase.rpc('fn_complete_order', {
        p_order_id: order.id,
        p_notes: 'Closed via Order Detail Desk'
      });
      if (error) throw error;
      toast.success(`Order ${order.order_number} successfully marked COMPLETED!`);
      loadData();
    } catch (err: any) {
      toast.error('Completion blocked: ' + err.message);
    } finally {
      setCompletingOrder(false);
    }
  }

  function handleDownloadOrderWaybill() {
    if (!order) return;
    const ho = handovers[0];
    generateWaybillPDF({
      waybillNumber: ho?.waybill_number || ho?.handover_number || `WB-${order.order_number}`,
      handoverNumber: ho?.handover_number || 'N/A',
      orderNumber: order.order_number,
      orderDate: formatDate(order.created_at),
      customerName: order.customer?.customer_name || 'Customer',
      customerCompany: order.customer?.company_name,
      customerPhone: order.customer?.phone,
      customerLocation: order.customer?.location,
      recipientType: ho?.recipient_type || 'customer',
      recipientName: ho?.recipient_name || 'Receiver',
      recipientPhone: ho?.recipient_phone,
      driverName: ho?.driver_name,
      transportCompany: ho?.transport_company,
      vehiclePlate: ho?.vehicle_plate,
      notes: ho?.notes,
      items: items.map((it) => ({
        sku: it.product?.sku || 'SKU',
        productName: it.product?.name || 'Product',
        cartonsDispatched: it.dispatched_count || 0,
      })),
      totalCartons: totalDispatched,
      dispatcherName: profile?.full_name || 'Dispatch Staff',
      dispatcherRole: profile?.role?.replace(/_/g, ' '),
    });
    toast.success('Waybill / Gate Pass PDF downloaded.');
  }

  async function fetchPayments() {
    const { data: pays } = await supabase
      .from('payments')
      .select('*, submitter:profiles!submitted_by(full_name), approver:profiles!approved_by(full_name)')
      .eq('order_id', id)
      .order('created_at', { ascending: false });
    
    setPayments(pays ?? []);
    
    if (pays && pays.length > 0) {
        const pIds = pays.map(p => p.id);
        const { data: docs } = await supabase.from('payment_documents').select('*').in('payment_id', pIds);
        setPaymentDocs(docs ?? []);
    }
  }

  async function updateStatus(status: string) {
    if (!order) return;
    const { error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', order.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Order marked as ${status}`);
      setOrder({ ...order, status });
    }
  }

  const submitPayment = async () => {
      if (!order) return;
      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0) return toast.error('Enter a valid amount');

      try {
          const { error } = await supabase.rpc('fn_submit_payment', {
              p_order_id: order.id,
              p_amount: amount,
              p_payment_method: paymentMethod,
              p_reference: paymentReference
          });
          if (error) throw error;
          toast.success('Payment recorded (Pending Approval)');
          setIsPaymentModalOpen(false);
          fetchPayments();
      } catch (err: any) {
          toast.error(err.message || 'Failed to submit payment');
      }
  };

  const handleApprovePayment = async (paymentId: string) => {
      try {
          const { error } = await supabase.rpc('fn_approve_payment', { p_payment_id: paymentId });
          if (error) throw error;
          toast.success('Payment approved!');
          loadData(); // Reload order completely to get new paid_amount
      } catch (err: any) {
          toast.error(err.message || 'Failed to approve payment');
      }
  };

  const handleRejectPayment = async (paymentId: string) => {
      try {
          const { error } = await supabase.rpc('fn_reject_payment', { p_payment_id: paymentId });
          if (error) throw error;
          toast.success('Payment rejected');
          fetchPayments();
      } catch (err: any) {
          toast.error(err.message || 'Failed to reject payment');
      }
  };

  const saveDueDate = async () => {
      if (!order) return;
      try {
          const { error } = await supabase.rpc('fn_set_order_due_date', {
              p_order_id: order.id,
              p_due_date: dueDateInput
          });
          if (error) throw error;
          toast.success('Due date updated');
          setIsDueDateModalOpen(false);
          setOrder({ ...order, due_date: dueDateInput });
      } catch (err: any) {
          toast.error(err.message || 'Failed to update due date');
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0 || !uploadingForPayment || !profile) return;
      
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${uploadingForPayment}-${Date.now()}.${fileExt}`;
      
      toast.info('Uploading proof...');
      try {
          const { error: uploadError } = await supabase.storage
              .from('payment_proofs')
              .upload(fileName, file);
              
          if (uploadError) throw uploadError;
          
          const { error: dbError } = await supabase.from('payment_documents').insert({
              payment_id: uploadingForPayment,
              document_type: 'Proof of Payment',
              file_name: file.name,
              storage_path: fileName,
              uploaded_by: profile.id
          });
          
          if (dbError) throw dbError;
          toast.success('Proof uploaded successfully');
          fetchPayments();
      } catch (err: any) {
          toast.error(err.message || 'Failed to upload proof');
      } finally {
          setUploadingForPayment(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };
  
  const viewDocument = async (path: string) => {
      try {
          const { data, error } = await supabase.storage.from('payment_proofs').createSignedUrl(path, 60);
          if (error) throw error;
          window.open(data.signedUrl, '_blank');
      } catch (err: any) {
          toast.error(err.message || 'Failed to open document');
      }
  };

  const getFinancialStatus = () => {
      if (!order) return { label: 'UNKNOWN', color: 'bg-gray-100 text-gray-700' };
      
      const outstanding = Number(order.total_amount) - Number(order.paid_amount);
      const pendingPayments = payments.filter(p => p.status === 'pending');
      
      if (pendingPayments.length > 0) return { label: 'PENDING APPROVAL', color: 'bg-yellow-100 text-yellow-700' };
      if (outstanding <= 0) return { label: 'PAID', color: 'bg-green-100 text-green-700' };
      
      if (order.due_date) {
          const days = (new Date(order.due_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
          if (days < 0) return { label: 'OVERDUE', color: 'bg-red-100 text-red-700 font-bold' };
          if (days === 0) return { label: 'DUE TODAY', color: 'bg-orange-100 text-orange-700' };
          if (days <= 7) return { label: 'DUE SOON', color: 'bg-orange-100 text-orange-700' };
      }
      
      if (Number(order.paid_amount) > 0) return { label: 'PARTIALLY PAID', color: 'bg-blue-100 text-blue-700' };
      return { label: 'UNPAID', color: 'bg-gray-100 text-gray-700' };
  };

  async function exportPdf() {
    if (!order) return;
    toast.info('Generating PDF...');
    try {
      await generatePDFReport({
        title: `Order Invoice: ${order.order_number}`,
        subtitle: `Customer: ${order.customer?.company_name || order.customer?.customer_name || 'N/A'}\nDate: ${formatDate(order.created_at)}\nStatus: ${order.status}`,
        filename: `2BF-Invoice-${order.order_number}.pdf`,
        tables: [
          {
            title: 'Order Summary',
            head: [['Total Amount', 'Paid Amount', 'Outstanding']],
            body: [[
              formatMoney(order.total_amount), 
              formatMoney(order.paid_amount), 
              formatMoney(Number(order.total_amount) - Number(order.paid_amount))
            ]]
          },
          {
            title: 'Order Items',
            head: [['Product', 'Warehouse', 'Quantity', 'Unit Price', 'Subtotal']],
            body: items.map(it => [
              it.product?.name ?? '—', 
              it.warehouse?.code ?? '—',
              it.quantity, 
              formatMoney(it.unit_price), 
              formatMoney(it.quantity * it.unit_price)
            ])
          }
        ]
      });
      toast.success('PDF Exported Successfully!');
    } catch (error) {
      toast.error('Failed to generate PDF');
    }
  }
  
  const handleOrderExport = async (type: 'pdf' | 'excel' | 'csv') => {
    if (!order) return;
    
    if (type === 'pdf') {
      await exportPdf();
      return true; // handled
    }
    
    if (type === 'excel') {
        const { exportToExcel } = await import('@/lib/export');
        const userName = profile?.full_name || 'System User';
        const userRole = profile?.role || 'user';
        
        const headers = ['Product', 'Warehouse', 'Quantity', 'Unit Price', 'Subtotal'];
        const rows = items.map(it => [
            it.product?.name ?? '—', 
            it.warehouse?.code ?? '—',
            it.quantity, 
            it.unit_price, 
            it.quantity * it.unit_price
        ]);
        
        exportToExcel(
          `2BF-Invoice-${order.order_number}.xlsx`,
          'Order Details',
          headers,
          rows,
          `Order Invoice: ${order.order_number} - ${order.customer?.company_name || order.customer?.customer_name || 'N/A'}`,
          userName,
          userRole
        );
        toast.success('Excel generated successfully');
        return true;
    }
    
    if (type === 'csv') {
        const { exportToCsv } = await import('@/lib/export');
        const headers = ['Product', 'Warehouse', 'Quantity', 'Unit Price', 'Subtotal'];
        const rows = items.map(it => [
            it.product?.name ?? '—', 
            it.warehouse?.code ?? '—',
            it.quantity, 
            it.unit_price, 
            it.quantity * it.unit_price
        ]);
        exportToCsv(`2BF-Invoice-${order.order_number}.csv`, headers, rows);
        toast.success('CSV generated successfully');
        return true;
    }
  };

  async function exportReceipt(payment: Payment) {
      if (!order || !payment) return;
      toast.info('Generating Receipt...');
      try {
        await generatePDFReport({
          title: `Payment Receipt: ${payment.reference_number || payment.id.substring(0,8).toUpperCase()}`,
          subtitle: `Customer: ${order.customer?.customer_name || 'N/A'}\nOrder: ${order.order_number}\nDate: ${formatDate(payment.created_at)}`,
          filename: `2BF-Receipt-${order.order_number}.pdf`,
          tables: [
            {
              title: 'Payment Details',
              head: [['Amount Paid', 'Method', 'Status', 'Processed By']],
              body: [[
                `${formatMoney(payment.amount)} ETB`, 
                payment.payment_method, 
                payment.status.toUpperCase(),
                payment.approver?.full_name || payment.submitter?.full_name || 'System'
              ]]
            }
          ]
        });
        toast.success('Receipt Generated Successfully!');
      } catch (error) {
        toast.error('Failed to generate Receipt');
      }
  }

  if (loading) return <div className="py-24 text-center text-muted-foreground">Loading order...</div>;
  if (!order) {
    return (
      <div className="space-y-4">
        <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </Link>
        <EmptyState title="Order not found" />
      </div>
    );
  }

  const outstanding = Number(order.total_amount) - Number(order.paid_amount);
  const finStatus = getFinancialStatus();
  const latestPayment = payments.length > 0 ? payments[0].payment_method : 'None';

  return (
    <div className="space-y-6">
      <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <PageHeader
        title={order.order_number}
        description={`Created ${formatDate(order.created_at)}`}
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            {hasHandover && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadOrderWaybill}
                className="h-9 text-xs font-semibold"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Waybill PDF
              </Button>
            )}

            {canManageCompletion && order.status !== 'completed' && (
              <Button
                size="sm"
                onClick={handleCompleteOrder}
                disabled={completingOrder || !isEligibleForCompletion}
                className={cn(
                  'h-9 text-xs font-bold transition-all',
                  isEligibleForCompletion
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    : 'bg-muted text-muted-foreground border border-border/80'
                )}
                title={
                  !isFullyDispatched
                    ? `Cannot complete: partial dispatch (${totalDispatched}/${totalOrdered} cartons loaded)`
                    : !hasHandover
                    ? 'Cannot complete: Gate Handover not yet recorded'
                    : 'Finalize & Close Order'
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                {completingOrder ? 'Completing...' : 'Complete Order'}
              </Button>
            )}

            <ExportDropdown
              filenameBase={`order_${order.order_number}`}
              title={`Order ${order.order_number}`}
              headers={[]}
              rows={[]}
              className="text-sm"
              onExport={handleOrderExport}
            />
            {canEditOrder ? (
              <Select value={order.status} onValueChange={updateStatus}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : <StatusBadge status={order.status} />}
          </div>
        }
      />

      {/* PHASE 27: Live Automatic Workflow Progress */}
      <WorkflowProgress order={order} payments={payments} dispatches={dispatches} />

      {/* PHASE 20 UX: Financial Snapshot */}
      <Card className="border-l-4 border-l-primary shadow-xs bg-card">
          <CardHeader className="pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                  <CardTitle className="text-lg flex items-center"><DollarSign className="w-5 h-5 mr-2 text-primary"/> Financial Snapshot</CardTitle>
                  <CardDescription>Real-time payment and debt information</CardDescription>
              </div>
              <Badge className={`${finStatus.color} px-3 py-1 text-sm border-none shadow-sm`}>{finStatus.label}</Badge>
          </CardHeader>
          <CardContent>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Order #{order.order_number}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-muted-foreground">{formatDate(order.created_at)}</p>
                  <span className="text-muted-foreground">•</span>
                  {order.payment_type === 'credit' ? (
                      <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">CREDIT</Badge>
                  ) : (
                      <Badge variant="outline" className="text-slate-700 bg-slate-50 border-slate-200">PAY NOW</Badge>
                  )}
                  <span className="text-muted-foreground">•</span>
                  <StatusBadge status={order.status} />
                </div>
              </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 py-4">
                  <div>
                      <p className="text-sm text-muted-foreground">Order Total</p>
                      <p className="font-bold text-lg">{formatMoney(order.total_amount)} <span className="text-xs">ETB</span></p>
                  </div>
                  <div>
                      <p className="text-sm text-muted-foreground">Amount Paid</p>
                      <p className="font-bold text-lg text-green-600">{formatMoney(order.paid_amount)} <span className="text-xs">ETB</span></p>
                  </div>
                  <div>
                      <p className="text-sm text-muted-foreground">Outstanding Debt</p>
                      <p className={`font-bold text-lg ${outstanding > 0 ? 'text-red-600' : ''}`}>{formatMoney(outstanding)} <span className="text-xs">ETB</span></p>
                  </div>
                  <div>
                      <p className="text-sm text-muted-foreground">Due Date</p>
                      <p className="font-medium text-lg">{order.due_date ? new Date(order.due_date).toLocaleDateString() : '—'}</p>
                  </div>
                  <div>
                      <p className="text-sm text-muted-foreground">Latest Method</p>
                      <p className="font-medium text-lg capitalize">{latestPayment}</p>
                  </div>
              </div>
              
              {isAccountOrAdmin && (
                  <div className="flex flex-wrap gap-3 pt-4 border-t mt-2">
                      <Button onClick={() => {
                          setPaymentAmount('');
                          setPaymentReference('');
                          setPaymentMethod('Bank Transfer');
                          setIsPaymentModalOpen(true);
                      }}>
                          + Add Payment
                      </Button>
                      <Button variant="outline" onClick={() => {
                          setDueDateInput(order.due_date ? new Date(order.due_date).toISOString().split('T')[0] : '');
                          setIsDueDateModalOpen(true);
                      }}>
                          <Calendar className="w-4 h-4 mr-2"/> Set Due Date
                      </Button>
                  </div>
              )}
          </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailRow label="Customer" value={order.customer?.customer_name} />
            <DetailRow label="Company" value={order.customer?.company_name} />
            <DetailRow label="Phone" value={order.customer?.phone} />
            <DetailRow label="Location" value={order.customer?.location} />
            <DetailRow label="Sales person" value={order.sales_person?.full_name} />
            <DetailRow label="Status" value={<StatusBadge status={order.status} />} />
            <DetailRow label="Created" value={formatDate(order.created_at)} />
            {order.notes && (
              <div className="pt-2">
                <p className="text-xs font-medium text-muted-foreground">Notes</p>
                <p className="mt-1 text-sm">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4 text-primary" /> Order items (Physical Boxes)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <EmptyState title="No items" />
              ) : (
                <div className="space-y-4">
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-center">Ordered</TableHead>
                          <TableHead className="text-center text-blue-600">Allocated</TableHead>
                          <TableHead className="text-center text-primary font-bold">Dispatched</TableHead>
                          <TableHead className="text-center">Remaining</TableHead>
                          <TableHead className="text-center">Fulfillment</TableHead>
                          <TableHead className="text-right">Unit price</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((it) => {
                          const remainingToDispatch = Math.max(0, it.quantity - it.dispatched_count);
                          const fPercent = it.quantity > 0 ? Math.round((it.dispatched_count / it.quantity) * 100) : 0;
                          return (
                            <TableRow key={it.id}>
                              <TableCell className="font-medium">
                                {it.product?.name ?? '—'}
                                {it.product?.sku && <span className="text-[10px] text-muted-foreground font-mono block">SKU: {it.product.sku}</span>}
                              </TableCell>
                              <TableCell className="text-center font-bold font-mono">{it.quantity}</TableCell>
                              <TableCell className="text-center text-blue-600 font-bold font-mono">{it.allocated_count}</TableCell>
                              <TableCell className="text-center text-primary font-bold font-mono">{it.dispatched_count}</TableCell>
                              <TableCell className="text-center font-mono">
                                {remainingToDispatch === 0 ? (
                                  <span className="text-emerald-600 font-bold">0</span>
                                ) : (
                                  <span className="text-amber-600 font-bold">{remainingToDispatch}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <span className={cn(
                                  'text-[10px] font-bold px-2 py-0.5 rounded-md border',
                                  fPercent === 100 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 border-emerald-200/60' : fPercent > 0 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 border-amber-200/60' : 'bg-muted text-muted-foreground border-border/40'
                                )}>
                                  {fPercent}%
                                </span>
                              </TableCell>
                              <TableCell className="text-right">{formatMoney(it.unit_price)} ETB</TableCell>
                              <TableCell className="text-right font-medium">{formatMoney(it.quantity * it.unit_price)} ETB</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:hidden">
                    {items.map((it) => {
                      const remainingToDispatch = Math.max(0, it.quantity - it.dispatched_count);
                      const fPercent = it.quantity > 0 ? Math.round((it.dispatched_count / it.quantity) * 100) : 0;
                      return (
                        <div key={it.id} className="rounded-lg border border-border/80 p-3.5 bg-card text-card-foreground shadow-2xs flex flex-col space-y-2">
                          <div className="font-medium text-lg text-primary border-b pb-2 flex items-center justify-between">
                            <span>{it.product?.name ?? '—'}</span>
                            <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded-md border border-border/60">{fPercent}%</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm pt-2">
                            <div><span className="text-muted-foreground block text-xs">Ordered</span><span className="font-bold text-base font-mono">{it.quantity}</span></div>
                            <div><span className="text-muted-foreground block text-xs">Remaining to Dispatch</span><span className="font-bold text-base font-mono text-amber-600">{remainingToDispatch}</span></div>
                            <div><span className="text-muted-foreground block text-xs">Allocated</span><span className="font-bold text-base font-mono text-blue-600">{it.allocated_count}</span></div>
                            <div><span className="text-muted-foreground block text-xs">Dispatched (Stock Out)</span><span className="font-bold text-base font-mono text-primary">{it.dispatched_count}</span></div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-3 border-t mt-2 text-sm">
                            <div><span className="text-muted-foreground block text-xs">Unit Price</span>{formatMoney(it.unit_price)} ETB</div>
                            <div className="text-right"><span className="text-muted-foreground block text-xs">Subtotal</span><span className="font-bold text-base">{formatMoney(it.quantity * it.unit_price)} ETB</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PHASE 29: Dispatch Handover & Waybill Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileCheck className="h-4 w-4 text-primary" /> Dispatch Handover & Gate Pass (Waybill)
                </CardTitle>
                <CardDescription className="text-xs">
                  Physical custody transfer records at the factory gate
                </CardDescription>
              </div>
              {hasHandover && (
                <Button size="sm" variant="outline" onClick={handleDownloadOrderWaybill} className="h-8 text-xs font-semibold">
                  <Download className="h-3.5 w-3.5 mr-1" /> Download Waybill PDF
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {handovers.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
                  <Truck className="h-7 w-7 text-muted-foreground mx-auto" />
                  <p className="text-xs font-semibold">No Custody Handover Recorded Yet</p>
                  <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                    {totalDispatched > 0
                      ? `This order has ${totalDispatched} cartons dispatched. Custody transfer must be recorded at the factory loading gate to complete the order.`
                      : 'Cartons must be physically scanned and dispatched first before gate handover can take place.'}
                  </p>
                  {totalDispatched > 0 && (
                    <div className="pt-2">
                      <Link href="/dispatch">
                        <Button size="sm" variant="secondary" className="h-8 text-xs font-semibold">
                          Go to Dispatch Desk
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs bg-muted/30">
                          <TableHead>Waybill / Handover #</TableHead>
                          <TableHead>Receiver</TableHead>
                          <TableHead>Driver / Transport</TableHead>
                          <TableHead>Vehicle Plate</TableHead>
                          <TableHead className="text-center">Cartons</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {handovers.map((ho) => (
                          <TableRow key={ho.id} className="text-xs">
                            <TableCell className="font-mono font-bold text-primary">
                              {ho.waybill_number || ho.handover_number}
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold block">{ho.recipient_name}</span>
                              <span className="text-[10px] text-muted-foreground capitalize">({ho.recipient_type.replace(/_/g, ' ')})</span>
                            </TableCell>
                            <TableCell>
                              {ho.driver_name || '—'}
                              {ho.transport_company && <span className="text-[10px] text-muted-foreground block">{ho.transport_company}</span>}
                            </TableCell>
                            <TableCell className="font-mono">{ho.vehicle_plate || '—'}</TableCell>
                            <TableCell className="text-center font-bold font-mono text-emerald-600">{ho.cartons_handed_over}</TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(ho.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4 text-primary" /> Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <EmptyState title="No payments recorded yet" />
              ) : (
                <div className="space-y-4">
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Proof</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((p) => {
                          const docs = paymentDocs.filter(d => d.payment_id === p.id);
                          return (
                          <TableRow key={p.id}>
                            <TableCell className="text-sm whitespace-nowrap">{formatDate(p.created_at)}</TableCell>
                            <TableCell className="capitalize">{p.payment_method}</TableCell>
                            <TableCell className="font-medium font-mono">{formatMoney(p.amount)} ETB</TableCell>
                            <TableCell>
                              {p.status === 'pending' && <Badge variant="outline" className="text-yellow-600 bg-yellow-50"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>}
                              {p.status === 'approved' && <Badge variant="outline" className="text-green-600 bg-green-50"><CheckCircle className="w-3 h-3 mr-1"/> Approved</Badge>}
                              {p.status === 'rejected' && <Badge variant="outline" className="text-red-600 bg-red-50"><XCircle className="w-3 h-3 mr-1"/> Rejected</Badge>}
                            </TableCell>
                            <TableCell>
                               {docs.length > 0 ? (
                                   <Button variant="ghost" size="sm" onClick={() => viewDocument(docs[0].storage_path)} className="h-8 px-2 text-xs">
                                       <FileText className="w-3 h-3 mr-1"/> View Proof
                                   </Button>
                               ) : isAccountOrAdmin ? (
                                   <Button variant="ghost" size="sm" onClick={() => { setUploadingForPayment(p.id); fileInputRef.current?.click(); }} className="h-8 px-2 text-xs">
                                       <Upload className="w-3 h-3 mr-1"/> Upload Proof
                                   </Button>
                               ) : (
                                   <span className="text-xs text-muted-foreground">No proof</span>
                               )}
                            </TableCell>
                            <TableCell className="text-right">
                              {p.status === 'pending' && isAccountOrAdmin && (
                                <div className="flex justify-end space-x-2">
                                  <Button size="sm" onClick={() => handleApprovePayment(p.id)} className="bg-green-600 hover:bg-green-700 h-8 px-2 text-xs">Approve</Button>
                                  <Button size="sm" variant="destructive" onClick={() => handleRejectPayment(p.id)} className="h-8 px-2 text-xs">Reject</Button>
                                </div>
                              )}
                              {p.status === 'approved' && (
                                  <Button size="sm" variant="outline" onClick={() => exportReceipt(p)} className="h-8 px-2 text-xs">Receipt</Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:hidden">
                    {payments.map((p) => {
                      const docs = paymentDocs.filter(d => d.payment_id === p.id);
                      return (
                        <div key={p.id} className="border rounded-md p-4 bg-white shadow-sm flex flex-col space-y-3">
                           <div className="flex justify-between items-center border-b pb-2">
                             <div className="font-mono font-bold text-lg">{formatMoney(p.amount)} ETB</div>
                             <div>
                                {p.status === 'pending' && <Badge variant="outline" className="text-yellow-600 bg-yellow-50"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>}
                                {p.status === 'approved' && <Badge variant="outline" className="text-green-600 bg-green-50"><CheckCircle className="w-3 h-3 mr-1"/> Approved</Badge>}
                                {p.status === 'rejected' && <Badge variant="outline" className="text-red-600 bg-red-50"><XCircle className="w-3 h-3 mr-1"/> Rejected</Badge>}
                             </div>
                           </div>
                           <div className="grid grid-cols-2 gap-2 text-sm">
                              <div><span className="text-muted-foreground block text-xs">Date</span>{formatDate(p.created_at)}</div>
                              <div className="text-right"><span className="text-muted-foreground block text-xs">Method</span><span className="capitalize">{p.payment_method}</span></div>
                           </div>
                           <div className="flex justify-between items-center pt-2 border-t mt-2">
                              <div>
                                {docs.length > 0 ? (
                                     <Button variant="outline" size="sm" onClick={() => viewDocument(docs[0].storage_path)} className="text-xs h-8 px-2">
                                         <FileText className="w-3 h-3 mr-1"/> View Proof
                                     </Button>
                                 ) : isAccountOrAdmin ? (
                                     <Button variant="outline" size="sm" onClick={() => { setUploadingForPayment(p.id); fileInputRef.current?.click(); }} className="text-xs h-8 px-2">
                                         <Upload className="w-3 h-3 mr-1"/> Upload
                                     </Button>
                                 ) : (
                                     <span className="text-xs text-muted-foreground">No proof</span>
                                 )}
                              </div>
                              <div className="flex gap-2">
                                {p.status === 'pending' && isAccountOrAdmin && (
                                  <>
                                    <Button size="sm" variant="destructive" onClick={() => handleRejectPayment(p.id)} className="h-8 px-2 text-xs">Reject</Button>
                                    <Button size="sm" onClick={() => handleApprovePayment(p.id)} className="bg-green-600 hover:bg-green-700 h-8 px-2 text-xs">Approve</Button>
                                  </>
                                )}
                                {p.status === 'approved' && (
                                    <Button size="sm" variant="outline" onClick={() => exportReceipt(p)} className="h-8 px-2 text-xs">Receipt</Button>
                                )}
                              </div>
                           </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Hidden file input for uploads */}
      <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*,.pdf" 
          onChange={handleFileUpload} 
      />

      {/* Payment Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="w-[95vw] md:w-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-muted-foreground">Order Total</Label>
                    <div className="p-2 bg-gray-50 border rounded-md font-bold text-gray-700">{formatMoney(order.total_amount)} ETB</div>
                </div>
                <div className="space-y-2">
                    <Label className="text-muted-foreground">Outstanding</Label>
                    <div className="p-2 bg-red-50 border border-red-100 rounded-md font-bold text-red-700">{formatMoney(outstanding)} ETB</div>
                </div>
            </div>
            
            <div className="space-y-2">
              <Label>Amount Received (ETB)</Label>
              <Input 
                type="number" 
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(e.target.value)} 
                placeholder={`e.g. ${outstanding}`}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <select 
                  className="w-full border rounded-md p-2 text-sm bg-background"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
              >
                  <option>Bank Transfer</option>
                  <option>Cash</option>
                  <option>Cheque</option>
                  <option>Card</option>
                  <option>Mobile Money</option>
                  <option>Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Reference Number (Optional)</Label>
              <Input 
                value={paymentReference} 
                onChange={(e) => setPaymentReference(e.target.value)} 
                placeholder="Transaction ID / Cheque Number"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)} className="w-full sm:w-auto h-11 sm:h-auto">Cancel</Button>
            <Button onClick={submitPayment} className="w-full sm:w-auto h-11 sm:h-auto">Submit Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Due Date Modal */}
      <Dialog open={isDueDateModalOpen} onOpenChange={setIsDueDateModalOpen}>
        <DialogContent className="w-[95vw] md:w-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Set Due Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input 
                type="date" 
                value={dueDateInput} 
                onChange={(e) => setDueDateInput(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDueDateModalOpen(false)} className="w-full sm:w-auto h-11 sm:h-auto">Cancel</Button>
            <Button onClick={saveDueDate} className="w-full sm:w-auto h-11 sm:h-auto">Save Due Date</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? '—'}</span>
    </div>
  );
}
