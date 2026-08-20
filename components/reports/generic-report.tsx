'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ReportFilters, FilterState } from './report-filters';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Download, FileText, Printer, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ExportDropdown } from '@/components/export-dropdown';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportKPI {
  label: string;
  type: 'count' | 'sum';
  key?: string; // which data key to sum
  format?: 'money' | 'number';
}

export interface GenericReportProps {
  reportName?: string;
  tableName: string;
  columns: { key: string; label: string; format?: 'date' | 'money' | 'text' }[];
  selectQuery: string;
  dateField?: string;
  warehouseField?: string;
  productField?: string;
  statusField?: string;
  customerField?: string;
  products?: any[];
  warehouses?: any[];
  customers?: any[];
  statuses?: string[];
  limit?: number;
  kpis?: ReportKPI[];
}

export function GenericReport({
  reportName = 'Report',
  tableName,
  columns,
  selectQuery,
  dateField,
  warehouseField,
  productField,
  statusField,
  customerField,
  products = [],
  warehouses = [],
  customers = [],
  statuses = [],
  limit = 1000,
  kpis = []
}: GenericReportProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: '', dateTo: '', warehouseId: 'all', productId: 'all', customerId: 'all', status: 'all'
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from(tableName).select(selectQuery).limit(limit);
      
      if (dateField) {
        query = query.order(dateField, { ascending: false });
        if (filters.dateFrom) query = query.gte(dateField, filters.dateFrom);
        if (filters.dateTo) query = query.lte(dateField, filters.dateTo + 'T23:59:59');
      }
      
      if (warehouseField && filters.warehouseId !== 'all') {
        query = query.eq(warehouseField, filters.warehouseId);
      }
      
      if (productField && filters.productId !== 'all') {
        query = query.eq(productField, filters.productId);
      }
      
      if (customerField && filters.customerId !== 'all') {
        query = query.eq(customerField, filters.customerId);
      }

      if (statusField && filters.status !== 'all') {
        query = query.eq(statusField, filters.status);
      }

      const { data: res, error: dbError } = await query;
      if (dbError) throw dbError;
      setData(res || []);
    } catch (err: any) {
      console.error(err);
      setError('Unable to load report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, tableName, selectQuery, dateField, warehouseField, productField, customerField, statusField, limit]);

  const handlePrint = () => {
    window.print();
  };

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((o, k) => (o || {})[k], obj);
  };

  const calculateKpiValue = (kpi: ReportKPI) => {
    if (kpi.type === 'count') return data.length;
    if (kpi.type === 'sum' && kpi.key) {
      const sum = data.reduce((acc, row) => {
        const val = getNestedValue(row, kpi.key!);
        return acc + (Number(val) || 0);
      }, 0);
      return sum;
    }
    return 0;
  };

  const formatKpiValue = (val: number, format?: 'money' | 'number') => {
    if (format === 'money') return `$${val.toFixed(2)}`;
    return val.toLocaleString();
  };

  const exportCsv = () => {
    if (!data.length) return toast.error('No data to export');
    const rows = [columns.map(c => c.label)];
    data.forEach(r => {
      rows.push(columns.map(c => {
        let val = getNestedValue(r, c.key);
        if (val === null || val === undefined) val = '';
        if (c.format === 'date' && val) val = new Date(val).toLocaleDateString();
        return `"${String(val).replace(/"/g, '""')}"`;
      }));
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportName.toLowerCase().replace(/ /g, '_')}_${new Date().getTime()}.csv`;
    a.click();
  };

  const exportPdf = () => {
    if (!data.length) return toast.error('No data to export');
    
    // Determine orientation based on column count
    const orientation = columns.length > 6 ? 'landscape' : 'portrait';
    const doc = new jsPDF({ orientation });
    
    // Header
    doc.setFontSize(16);
    doc.text('2BF FACTORY ERP', 14, 15);
    doc.setFontSize(12);
    doc.text(reportName, 14, 22);

    doc.setFontSize(10);
    let y = 30;
    if (filters.dateFrom || filters.dateTo) {
      doc.text(`Period: ${filters.dateFrom || 'Start'} to ${filters.dateTo || 'End'}`, 14, y);
      y += 6;
    }
    
    let activeFilters = [];
    if (filters.warehouseId !== 'all') activeFilters.push(`Warehouse: ${warehouses.find(w=>w.id===filters.warehouseId)?.code}`);
    if (filters.productId !== 'all') activeFilters.push(`Product: ${products.find(p=>p.id===filters.productId)?.name}`);
    if (filters.customerId !== 'all') activeFilters.push(`Customer: ${customers.find(c=>c.id===filters.customerId)?.customer_name}`);
    if (filters.status !== 'all') activeFilters.push(`Status: ${filters.status}`);
    
    if (activeFilters.length > 0) {
      doc.text(`Filters: ${activeFilters.join(', ')}`, 14, y);
      y += 6;
    }

    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
    y += 10;

    // KPIs
    if (kpis.length > 0) {
      const kpiText = kpis.map(k => `${k.label}: ${formatKpiValue(calculateKpiValue(k), k.format)}`).join('   |   ');
      doc.text(kpiText, 14, y);
      y += 10;
    }

    // Table
    const tableColumns = columns.map(c => c.label);
    const tableRows = data.map(r => {
      return columns.map(c => {
        let val = getNestedValue(r, c.key);
        if (c.format === 'date' && val) val = formatDate(val);
        if (c.format === 'money' && val) val = typeof val === 'number' ? `$${val.toFixed(2)}` : val;
        return val ?? '';
      });
    });

    autoTable(doc, {
      startY: y,
      head: [tableColumns],
      body: tableRows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      didDrawPage: function (data: any) {
        const str = 'Page ' + (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.text(
          `2BF Factory ERP - Confidential - ${str}`,
          data.settings.margin.left,
          doc.internal.pageSize.height - 10
        );
      }
    });

    doc.save(`${reportName.toLowerCase().replace(/ /g, '_')}_${new Date().getTime()}.pdf`);
  };

  const defaultKpis: ReportKPI[] = kpis.length > 0 ? kpis : [{ label: 'Total Records', type: 'count' }];

  return (
    <div className="space-y-6 print-container">
      {/* Report Header for Print */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold">2BF FACTORY ERP</h1>
        <h2 className="text-xl mt-1">{reportName}</h2>
        <div className="mt-4 text-sm space-y-1">
          {filters.dateFrom || filters.dateTo ? <p><strong>Period:</strong> {filters.dateFrom || 'Start'} to {filters.dateTo || 'End'}</p> : null}
          <p><strong>Generated:</strong> {new Date().toLocaleString()}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-end no-print">
        <ReportFilters 
          filters={filters} 
          setFilters={setFilters} 
          showDate={!!dateField} 
          showWarehouse={!!warehouseField} 
          showProduct={!!productField}
          showCustomer={!!customerField}
          showStatus={!!statusField}
          products={products}
          warehouses={warehouses}
          customers={customers}
          statuses={statuses}
          disabled={loading}
        />
        <div className="flex gap-2 mb-6 shrink-0">
          <Button variant="outline" onClick={handlePrint} disabled={loading || data.length === 0}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          <ExportDropdown
            filenameBase={reportName.toLowerCase().replace(/ /g, '_')}
            title={reportName}
            headers={columns.map(c => c.label)}
            rows={data.map(r => columns.map(c => {
              let val = getNestedValue(r, c.key);
              if (c.format === 'date' && val) val = formatDate(val);
              if (c.format === 'money' && val) val = typeof val === 'number' ? `$${val.toFixed(2)}` : val;
              return val ?? '';
            }))}
            disabled={loading || data.length === 0}
          />
        </div>
      </div>

      {!loading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {defaultKpis.map((kpi, idx) => (
            <Card key={idx} className="print:shadow-none print:border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase">{kpi.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatKpiValue(calculateKpiValue(kpi), kpi.format)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <Card className="print:shadow-none print:border-none">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Loading report data...</p>
            </div>
          ) : error ? (
             <div className="flex flex-col items-center justify-center py-24 text-destructive">
               <AlertTriangle className="h-10 w-10 mb-4 opacity-50" />
               <p className="font-semibold text-lg">{error}</p>
               <Button variant="outline" className="mt-4" onClick={fetchData}>Retry</Button>
             </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
               <FileText className="h-12 w-12 mb-4 opacity-20" />
               <p className="font-medium text-lg">No records found</p>
               <p className="text-sm">No transactions match the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    {columns.map(c => (
                      <TableHead key={c.key}>{c.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row, i) => (
                    <TableRow key={row.id || i} className="print:break-inside-avoid">
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      {columns.map(c => {
                        let val = getNestedValue(row, c.key);
                        if (c.format === 'date' && val) val = formatDate(val);
                        if (c.format === 'money') val = typeof val === 'number' ? `$${val.toFixed(2)}` : val;
                        return <TableCell key={c.key} className={c.key.includes('barcode') ? 'font-mono text-xs' : ''}>{val ?? '—'}</TableCell>;
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Footer for Print */}
      <div className="hidden print:block mt-8 text-sm text-gray-500">
        <p>2BF Factory ERP • Confidential</p>
      </div>
    </div>
  );
}
