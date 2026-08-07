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

export function ProductionReport({ products }: { products: any[] }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: '', dateTo: '', warehouseId: 'all', productId: 'all', customerId: 'all', status: 'all'
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let query = supabase.from('production_scans').select('*, product:products(name), scanner:profiles(full_name)').order('scanned_at', { ascending: false }).limit(500);
      
      if (filters.dateFrom) query = query.gte('scanned_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('scanned_at', filters.dateTo + 'T23:59:59');
      if (filters.productId !== 'all') query = query.eq('product_id', filters.productId);

      const { data: res } = await query;
      setData(res || []);
      setLoading(false);
    };
    fetchData();
  }, [filters]);

  const exportCsv = () => {
    if (!data.length) {
      toast.error('No data to export');
      return;
    }
    const rows = [['Barcode', 'Product', 'Quantity', 'Scanner', 'Date']];
    data.forEach(r => {
      rows.push([r.barcode, r.product?.name || '', String(r.quantity), r.scanner?.full_name || '', r.scanned_at]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production-report.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <ReportFilters filters={filters} setFilters={setFilters} showDate showProduct products={products} />
        <Button variant="outline" onClick={exportCsv} className="mb-6"><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barcode</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Scanner</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center">No production records found</TableCell></TableRow>
              ) : (
                data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.barcode}</TableCell>
                    <TableCell>{row.product?.name}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell>{row.scanner?.full_name}</TableCell>
                    <TableCell>{formatDate(row.scanned_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
