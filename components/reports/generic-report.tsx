'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ReportFilters, FilterState } from './report-filters';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

export interface GenericReportProps {
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
}

export function GenericReport({
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
  limit = 500
}: GenericReportProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: '', dateTo: '', warehouseId: 'all', productId: 'all', customerId: 'all', status: 'all'
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
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

      const { data: res, error } = await query;
      if (error) console.error(error);
      setData(res || []);
      setLoading(false);
    };
    fetchData();
  }, [filters, tableName, selectQuery, dateField, warehouseField, productField, customerField, statusField, limit]);

  const exportCsv = () => {
    if (!data.length) {
      toast.error('No data to export');
      return;
    }
    const rows = [columns.map(c => c.label)];
    data.forEach(r => {
      rows.push(columns.map(c => {
        let val = c.key.split('.').reduce((o, k) => (o || {})[k], r);
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
    a.download = `${tableName}-report.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end flex-wrap gap-4">
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
        />
        <Button variant="outline" onClick={exportCsv} className="mb-6"><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(c => (
                    <TableHead key={c.key}>{c.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={columns.length} className="text-center">Loading...</TableCell></TableRow>
                ) : data.length === 0 ? (
                  <TableRow><TableCell colSpan={columns.length} className="text-center">No records found</TableCell></TableRow>
                ) : (
                  data.map((row, i) => (
                    <TableRow key={row.id || i}>
                      {columns.map(c => {
                        let val = c.key.split('.').reduce((o, k) => (o || {})[k], row);
                        if (c.format === 'date' && val) val = formatDate(val);
                        if (c.format === 'money') val = typeof val === 'number' ? `$${val.toFixed(2)}` : val;
                        return <TableCell key={c.key} className={c.key.includes('barcode') ? 'font-mono text-xs' : ''}>{val ?? '—'}</TableCell>;
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
