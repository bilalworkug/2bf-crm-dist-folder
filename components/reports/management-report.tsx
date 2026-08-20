'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ReportFilters, FilterState } from './report-filters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Printer, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { ExportDropdown } from '@/components/export-dropdown';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export function ManagementReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'),
    dateTo: format(new Date(), 'yyyy-MM-dd'),
    warehouseId: 'all', productId: 'all', customerId: 'all', status: 'all'
  });

  const [data, setData] = useState({
    production: { boxes: 0, qty: 0, corrections: 0 },
    warehouse: { received: 0, transfersOut: 0, dispatched: 0 },
    sales: { created: 0, completed: 0, pending: 0, cancelled: 0 },
    delivery: { created: 0, completed: 0, pending: 0 },
    returns: { requests: 0, completed: 0, pending: 0 },
    corrections: { count: 0 }
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Create date boundaries
      const start = filters.dateFrom ? `${filters.dateFrom}T00:00:00Z` : '2000-01-01T00:00:00Z';
      const end = filters.dateTo ? `${filters.dateTo}T23:59:59Z` : '2099-12-31T23:59:59Z';

      // Run queries in parallel
      const [
        prodReq, 
        whReceipts, 
        dispatchesReq, 
        salesReq, 
        deliveryReq, 
        returnsReq, 
        correctionsReq
      ] = await Promise.all([
        supabase.from('production_scans').select('quantity, created_at').gte('created_at', start).lte('created_at', end),
        supabase.from('warehouse_receipts').select('id, received_at').gte('received_at', start).lte('received_at', end),
        supabase.from('dispatches').select('id, dispatched_at').gte('dispatched_at', start).lte('dispatched_at', end),
        supabase.from('orders').select('status, created_at').gte('created_at', start).lte('created_at', end),
        supabase.from('deliveries').select('status, created_at').gte('created_at', start).lte('created_at', end),
        supabase.from('returns').select('status, processed_at').gte('processed_at', start).lte('processed_at', end),
        supabase.from('correction_records').select('id, corrected_at').gte('corrected_at', start).lte('corrected_at', end)
      ]);

      if (prodReq.error) throw prodReq.error;
      
      const prodData = prodReq.data || [];
      const boxes = prodData.length;
      const qty = prodData.reduce((acc, p) => acc + (p.quantity || 1), 0);

      const salesData = salesReq.data || [];
      const deliveriesData = deliveryReq.data || [];
      const returnsData = returnsReq.data || [];

      setData({
        production: { boxes, qty, corrections: 0 },
        warehouse: { 
          received: whReceipts.data?.length || 0, 
          transfersOut: 0, 
          dispatched: dispatchesReq.data?.length || 0 
        },
        sales: { 
          created: salesData.length, 
          completed: salesData.filter(o => o.status === 'delivered').length, 
          pending: salesData.filter(o => ['pending', 'approved', 'allocated', 'dispatched'].includes(o.status)).length, 
          cancelled: salesData.filter(o => o.status === 'rejected').length 
        },
        delivery: { 
          created: deliveriesData.length, 
          completed: deliveriesData.filter(d => d.status === 'delivered').length, 
          pending: deliveriesData.filter(d => d.status === 'pending' || d.status === 'in_transit').length 
        },
        returns: { 
          requests: returnsData.length, 
          completed: returnsData.filter(r => r.status === 'approved' || r.status === 'rejected').length, 
          pending: returnsData.filter(r => r.status === 'pending').length 
        },
        corrections: { 
          count: correctionsReq.data?.length || 0 
        }
      });
    } catch (err: any) {
      console.error('Management Report Error:', err);
      setError('Unable to load report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.dateFrom, filters.dateTo]);

  const handlePrint = () => {
    window.print();
  };

  const exportPdf = () => {
    const doc = new jsPDF('portrait');
    doc.setFontSize(16);
    doc.text('2BF FACTORY ERP', 14, 15);
    doc.setFontSize(12);
    doc.text('MANAGEMENT SUMMARY REPORT', 14, 22);

    doc.setFontSize(10);
    let y = 30;
    if (filters.dateFrom || filters.dateTo) {
      doc.text(`Period: ${filters.dateFrom} to ${filters.dateTo}`, 14, y);
      y += 8;
    }
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
    y += 12;

    const sections = [
      { title: 'Production', data: [['Boxes Produced', data.production.boxes], ['Quantity Produced', data.production.qty]] },
      { title: 'Warehouse', data: [['Boxes Received', data.warehouse.received], ['Boxes Dispatched', data.warehouse.dispatched]] },
      { title: 'Sales', data: [['Orders Created', data.sales.created], ['Completed', data.sales.completed], ['Pending', data.sales.pending], ['Cancelled', data.sales.cancelled]] },
      { title: 'Delivery', data: [['Deliveries Created', data.delivery.created], ['Completed', data.delivery.completed], ['Pending', data.delivery.pending]] },
      { title: 'Returns & Corrections', data: [['Return Requests', data.returns.requests], ['Pending Returns', data.returns.pending], ['Corrections Made', data.corrections.count]] }
    ];

    sections.forEach(sec => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(sec.title, 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: sec.data,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        margin: { left: 14 }
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`2BF Factory ERP - Confidential - Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.height - 10);
    }

    doc.save(`management_summary_${new Date().getTime()}.pdf`);
  };

  return (
    <div className="space-y-6 print-container">
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold">2BF FACTORY ERP</h1>
        <h2 className="text-xl mt-1">Management Summary</h2>
        <div className="mt-4 text-sm space-y-1">
          <p><strong>Period:</strong> {filters.dateFrom} to {filters.dateTo}</p>
          <p><strong>Generated:</strong> {new Date().toLocaleString()}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-end no-print">
        <ReportFilters 
          filters={filters} 
          setFilters={setFilters} 
          showDate={true} 
          disabled={loading}
        />
        <div className="flex gap-2 mb-6 shrink-0">
          <Button variant="outline" onClick={handlePrint} disabled={loading}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          <ExportDropdown
            filenameBase="management_summary"
            title="Management Summary"
            headers={['Category', 'Metric', 'Value']}
            rows={[
              ['Production', 'Boxes Produced', data.production.boxes],
              ['Production', 'Total Quantity', data.production.qty],
              ['Warehouse', 'Received', data.warehouse.received],
              ['Warehouse', 'Dispatched', data.warehouse.dispatched],
              ['Sales', 'Orders Created', data.sales.created],
              ['Sales', 'Completed', data.sales.completed],
              ['Sales', 'Pending', data.sales.pending],
              ['Sales', 'Cancelled', data.sales.cancelled],
              ['Delivery', 'Created', data.delivery.created],
              ['Delivery', 'Completed', data.delivery.completed],
              ['Delivery', 'Pending', data.delivery.pending],
              ['Returns', 'Requests', data.returns.requests],
              ['Returns', 'Completed', data.returns.completed],
              ['Returns', 'Pending', data.returns.pending],
              ['Corrections', 'Count', data.corrections.count],
            ]}
            disabled={loading}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground border rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p>Loading management data...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 text-destructive border rounded-lg">
          <AlertTriangle className="h-10 w-10 mb-4 opacity-50" />
          <p className="font-semibold text-lg">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchData}>Retry</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <Card className="print:shadow-none print:border-gray-200">
            <CardHeader><CardTitle className="text-lg">Production</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Boxes Produced</span>
                <span className="font-bold">{data.production.boxes.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Total Quantity</span>
                <span className="font-bold">{data.production.qty.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="print:shadow-none print:border-gray-200">
            <CardHeader><CardTitle className="text-lg">Warehouse</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Received</span>
                <span className="font-bold">{data.warehouse.received.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Dispatched</span>
                <span className="font-bold">{data.warehouse.dispatched.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="print:shadow-none print:border-gray-200">
            <CardHeader><CardTitle className="text-lg">Sales</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Orders Created</span>
                <span className="font-bold">{data.sales.created.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2 text-success">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-bold">{data.sales.completed.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2 text-warning">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-bold">{data.sales.pending.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2 text-destructive">
                <span className="text-muted-foreground">Cancelled</span>
                <span className="font-bold">{data.sales.cancelled.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="print:shadow-none print:border-gray-200">
            <CardHeader><CardTitle className="text-lg">Delivery</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Deliveries Created</span>
                <span className="font-bold">{data.delivery.created.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2 text-success">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-bold">{data.delivery.completed.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2 text-warning">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-bold">{data.delivery.pending.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="print:shadow-none print:border-gray-200">
            <CardHeader><CardTitle className="text-lg">Returns & Corrections</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Return Requests</span>
                <span className="font-bold">{data.returns.requests.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2 text-warning">
                <span className="text-muted-foreground">Pending Returns</span>
                <span className="font-bold">{data.returns.pending.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2 text-destructive">
                <span className="text-muted-foreground">Corrections Made</span>
                <span className="font-bold">{data.corrections.count.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* Report Footer for Print */}
      <div className="hidden print:block mt-8 text-sm text-gray-500">
        <p>2BF Factory ERP • Confidential</p>
      </div>
    </div>
  );
}
