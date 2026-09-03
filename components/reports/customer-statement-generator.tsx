'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  FileText, User, Printer, Download,
  CreditCard, DollarSign, Calendar, CheckCircle2
} from 'lucide-react';
import { generatePDFReport } from '@/lib/pdf-export';
import { formatMoney, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import type { UniversalFilterState } from './report-filter-bar';

interface StatementEntry {
  id: string;
  date: string;
  reference: string;
  type: 'ORDER' | 'PAYMENT';
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface CustomerStatementGeneratorProps {
  filters: UniversalFilterState;
  customers: { id: string; customer_name: string }[];
}

export function CustomerStatementGenerator({ filters, customers }: CustomerStatementGeneratorProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [customerData, setCustomerData] = useState<any>(null);
  const [creditData, setCreditData] = useState<any>(null);
  const [statementRows, setStatementRows] = useState<StatementEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Sync selected customer if list loads late
  useEffect(() => {
    if (!selectedCustomerId && customers.length > 0) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  const loadStatement = useCallback(async () => {
    if (!selectedCustomerId) return;
    setLoading(true);

    try {
      const [custRes, creditRes, ordersRes, paymentsRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', selectedCustomerId).single(),
        supabase.from('customer_credit').select('*').eq('customer_id', selectedCustomerId).maybeSingle(),
        supabase.from('orders').select('*').eq('customer_id', selectedCustomerId).order('created_at', { ascending: true }),
        supabase.from('payments').select('*').eq('customer_id', selectedCustomerId).eq('status', 'approved').order('payment_date', { ascending: true }),
      ]);

      setCustomerData(custRes.data || null);
      setCreditData(creditRes.data || null);

      const orders = ordersRes.data || [];
      const payments = paymentsRes.data || [];

      // Combine orders and payments into a chronological event stream
      const combined: {
        date: string;
        ref: string;
        type: 'ORDER' | 'PAYMENT';
        desc: string;
        debit: number;
        credit: number;
      }[] = [];

      orders.forEach((o: any) => {
        combined.push({
          date: o.created_at,
          ref: o.order_number,
          type: 'ORDER',
          desc: `Sales Order (Status: ${o.status})`,
          debit: Number(o.total_amount || 0),
          credit: 0,
        });
      });

      payments.forEach((p: any) => {
        combined.push({
          date: p.payment_date || p.created_at,
          ref: p.id.slice(0, 8).toUpperCase(),
          type: 'PAYMENT',
          desc: `Payment Received (${p.payment_method})`,
          debit: 0,
          credit: Number(p.amount || 0),
        });
      });

      // Sort by date ascending to calculate running balance
      combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let balance = 0;
      const ledger: StatementEntry[] = combined.map((entry, idx) => {
        balance = balance + entry.debit - entry.credit;
        return {
          id: `entry-${idx}`,
          date: entry.date,
          reference: entry.ref,
          type: entry.type,
          description: entry.desc,
          debit: entry.debit,
          credit: entry.credit,
          runningBalance: balance,
        };
      });

      setStatementRows(ledger);
    } catch (e) {
      console.error('Failed to load customer statement:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerId]);

  useEffect(() => {
    loadStatement();
  }, [loadStatement]);

  const totalOutstanding = statementRows.length > 0 ? statementRows[statementRows.length - 1].runningBalance : 0;
  const creditLimit = Number(creditData?.credit_limit || 0);
  const availableCredit = Math.max(0, creditLimit - totalOutstanding);

  // Generate official PDF Statement
  const exportPDFStatement = async () => {
    if (!customerData) return;
    toast.info('Generating official statement PDF...');

    try {
      const statementHead = [['Date', 'Reference', 'Transaction Description', 'Debit (ETB)', 'Credit (ETB)', 'Balance (ETB)']];
      const statementBody = statementRows.map((r) => [
        formatDate(r.date),
        r.reference,
        r.description,
        r.debit > 0 ? formatMoney(r.debit) : '—',
        r.credit > 0 ? formatMoney(r.credit) : '—',
        formatMoney(r.runningBalance),
      ]);

      await generatePDFReport({
        title: `Official Customer Statement: ${customerData.company_name || customerData.customer_name}`,
        subtitle: `Statement Date: ${new Date().toLocaleDateString()} | Credit Limit: ${formatMoney(creditLimit)} | Total Due: ${formatMoney(totalOutstanding)}`,
        filename: `Statement_${customerData.customer_name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
        tables: [
          {
            title: 'Account Ledger & Transaction History',
            head: statementHead,
            body: statementBody,
          },
        ],
      });
      toast.success('Customer statement downloaded');
    } catch (e: any) {
      toast.error('Failed to generate statement: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Customer Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-4 rounded-2xl border border-border/80 no-print">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Customer Statement Generator
          </h2>
          <p className="text-xs text-muted-foreground">
            Printable chronological debit/credit ledger with running balances and credit terms.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
            <SelectTrigger className="w-[220px] h-10 text-xs">
              <SelectValue placeholder="Select Customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.customer_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={exportPDFStatement}
            disabled={loading || !customerData}
            className="h-10 text-xs font-semibold touch-press shadow-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download PDF Statement
          </Button>

          <Button
            variant="outline"
            onClick={() => window.print()}
            className="h-10 text-xs touch-press"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print
          </Button>
        </div>
      </div>

      {/* Statement Header Card */}
      {customerData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="shadow-xs border-border/80">
            <CardContent className="p-4 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Customer Info</p>
              <h3 className="text-base font-bold text-foreground">
                {customerData.company_name || customerData.customer_name}
              </h3>
              <p className="text-xs text-muted-foreground">{customerData.phone || 'No phone'} • {customerData.location || 'Ethiopia'}</p>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-border/80">
            <CardContent className="p-4 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Credit Authorized</p>
              <h3 className="text-xl font-bold font-mono text-foreground">
                {formatMoney(creditLimit)}
              </h3>
              <p className="text-xs text-muted-foreground">
                Available: <span className="text-emerald-600 font-bold">{formatMoney(availableCredit)}</span>
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-border/80 bg-rose-50/40 dark:bg-rose-950/20">
            <CardContent className="p-4 space-y-1">
              <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">Net Outstanding Balance</p>
              <h3 className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-400">
                {formatMoney(totalOutstanding)}
              </h3>
              <p className="text-xs text-muted-foreground">Current Amount Due</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chronological Statement Ledger */}
      <Card className="shadow-xs border-border/80">
        <CardHeader className="p-4 pb-3 border-b border-border/60 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Statement Transaction Ledger
          </CardTitle>
          <span className="text-xs text-muted-foreground font-mono">{statementRows.length} entries</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Reference</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs text-right text-rose-600">Debit (Orders)</TableHead>
                  <TableHead className="text-xs text-right text-emerald-600">Credit (Payments)</TableHead>
                  <TableHead className="text-xs text-right font-bold">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statementRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                      No order or payment activity found for this customer.
                    </TableCell>
                  </TableRow>
                ) : (
                  statementRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs font-medium py-2.5">
                        {formatDate(row.date)}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-foreground py-2.5">
                        {row.reference}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-2.5">
                        {row.description}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs py-2.5 text-rose-600 font-semibold">
                        {row.debit > 0 ? formatMoney(row.debit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs py-2.5 text-emerald-600 font-semibold">
                        {row.credit > 0 ? formatMoney(row.credit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-xs py-2.5 text-foreground">
                        {formatMoney(row.runningBalance)}
                      </TableCell>
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
