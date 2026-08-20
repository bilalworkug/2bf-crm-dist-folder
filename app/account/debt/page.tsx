'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import Link from 'next/link';
import { AlertCircle, TrendingDown, Users } from 'lucide-react';
import { ExportDropdown } from '@/components/export-dropdown';

interface DebtRow {
  customer_id: string;
  customer_name: string;
  total_ordered: number;
  total_paid: number;
  outstanding: number;
  next_due: string | null;
}

export default function AccountDebtPage() {
  const { profile } = useAuth();
  const isAccount = profile?.role === 'admin' || profile?.role === 'accounts' || profile?.role === 'accounts_manager';

  const [debtRows, setDebtRows] = useState<DebtRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAccount) loadData();
  }, [isAccount]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, total_amount, paid_amount, due_date, customer:customers(id, customer_name)');

      if (error) throw error;

      // Group by customer
      const map = new Map<string, DebtRow>();
      for (const o of (orders ?? [])) {
        const cust = o.customer as any;
        if (!cust) continue;
        const key = cust.id;
        if (!map.has(key)) {
          map.set(key, {
            customer_id: key,
            customer_name: cust.customer_name,
            total_ordered: 0,
            total_paid: 0,
            outstanding: 0,
            next_due: null,
          });
        }
        const row = map.get(key)!;
        row.total_ordered += Number(o.total_amount);
        row.total_paid += Number(o.paid_amount);
        row.outstanding = row.total_ordered - row.total_paid;
        if (o.due_date) {
          if (!row.next_due || new Date(o.due_date) < new Date(row.next_due)) {
            row.next_due = o.due_date;
          }
        }
      }

      const rows = Array.from(map.values())
        .filter(r => r.outstanding > 0)
        .sort((a, b) => b.outstanding - a.outstanding);

      setDebtRows(rows);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load debt data');
    } finally {
      setLoading(false);
    }
  }

  const getStatus = (row: DebtRow) => {
    if (row.outstanding <= 0) return { label: 'PAID', color: 'bg-green-100 text-green-700' };
    if (row.total_paid > 0 && row.outstanding > 0) {
      if (row.next_due) {
        const days = (new Date(row.next_due).getTime() - Date.now()) / (1000 * 3600 * 24);
        if (days < 0) return { label: 'OVERDUE', color: 'bg-red-100 text-red-700 font-bold' };
        if (days <= 7) return { label: 'DUE SOON', color: 'bg-orange-100 text-orange-700' };
      }
      return { label: 'PARTIAL', color: 'bg-blue-100 text-blue-700' };
    }
    if (row.next_due) {
      const days = (new Date(row.next_due).getTime() - Date.now()) / (1000 * 3600 * 24);
      if (days < 0) return { label: 'OVERDUE', color: 'bg-red-100 text-red-700 font-bold' };
    }
    return { label: 'UNPAID', color: 'bg-gray-100 text-gray-700' };
  };

  if (!isAccount) return <div className="p-8">Access Denied</div>;

  const totalDebt = debtRows.reduce((sum, r) => sum + r.outstanding, 0);
  const overdueCount = debtRows.filter(r => {
    if (!r.next_due) return false;
    return new Date(r.next_due).getTime() < Date.now();
  }).length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Customer Debt"
        description="Outstanding customer balances at a glance"
      />
      
      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center"><Users className="w-4 h-4 mr-2"/> Customers with Debt</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{debtRows.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center"><TrendingDown className="w-4 h-4 mr-2"/> Total Outstanding</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-600">{formatMoney(totalDebt)} ETB</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center"><AlertCircle className="w-4 h-4 mr-2"/> Overdue</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-600">{overdueCount}</div></CardContent>
          </Card>
        </div>

        {/* Customer Debt Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Customer Debt Summary</CardTitle>
              <CardDescription>Click a customer to view their orders and payment details</CardDescription>
            </div>
            <ExportDropdown
              filenameBase="customer_debt"
              title="Customer Debt Report"
              headers={['Customer', 'Total Ordered', 'Total Paid', 'Outstanding Debt', 'Next Due Date', 'Status']}
              rows={debtRows.map((r) => [r.customer_name, r.total_ordered, r.total_paid, r.outstanding, r.next_due || 'N/A', getStatus(r).label])}
            />
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading...</p>
            ) : debtRows.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No outstanding debt. All customers are fully paid.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Total Ordered</TableHead>
                    <TableHead>Total Paid</TableHead>
                    <TableHead>Outstanding Debt</TableHead>
                    <TableHead>Next Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtRows.map(row => {
                    const status = getStatus(row);
                    return (
                      <TableRow key={row.customer_id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Link href={`/customers/detail?id=${row.customer_id}`} className="font-medium text-primary hover:underline">
                            {row.customer_name}
                          </Link>
                        </TableCell>
                        <TableCell>{formatMoney(row.total_ordered)} ETB</TableCell>
                        <TableCell className="text-green-600">{formatMoney(row.total_paid)} ETB</TableCell>
                        <TableCell className="font-bold text-red-600">{formatMoney(row.outstanding)} ETB</TableCell>
                        <TableCell>{row.next_due ? new Date(row.next_due).toLocaleDateString() : '—'}</TableCell>
                        <TableCell><Badge className={`${status.color} border-none`}>{status.label}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
