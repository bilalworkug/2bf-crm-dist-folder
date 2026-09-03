'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DollarSign, CreditCard, Clock, AlertTriangle,
  RefreshCw, TrendingUp, ShieldAlert, CheckCircle2
} from 'lucide-react';
import { ExportDropdown } from '@/components/export-dropdown';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { UniversalFilterState } from './report-filter-bar';

interface FinancialIntelligenceReportProps {
  filters: UniversalFilterState;
}

interface AgingBucketRow {
  customerId: string;
  customerName: string;
  totalDebt: number;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
}

export function FinancialIntelligenceReport({ filters }: FinancialIntelligenceReportProps) {
  const [loading, setLoading] = useState(true);
  const [cashReceived, setCashReceived] = useState(0);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [pendingPaymentsTotal, setPendingPaymentsTotal] = useState(0);
  const [creditCustomersCount, setCreditCustomersCount] = useState(0);
  const [payNowCustomersCount, setPayNowCustomersCount] = useState(0);
  const [agingRows, setAgingRows] = useState<AgingBucketRow[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const start = filters.dateFrom ? `${filters.dateFrom}T00:00:00Z` : '2025-01-01T00:00:00Z';
      const end = filters.dateTo ? `${filters.dateTo}T23:59:59Z` : new Date().toISOString();

      const [paymentsRes, ordersRes, customersRes] = await Promise.all([
        supabase
          .from('payments')
          .select('id, amount, status, payment_date')
          .gte('payment_date', start)
          .lte('payment_date', end),
        supabase
          .from('orders')
          .select('id, customer_id, order_number, total_amount, paid_amount, payment_type, due_date, created_at, customer:customers(customer_name)'),
        supabase
          .from('customers')
          .select('id, customer_name'),
      ]);

      const payments = paymentsRes.data || [];
      const orders = ordersRes.data || [];
      const customers = customersRes.data || [];

      // 1. Payment metrics
      let cash = 0;
      let pendingCnt = 0;
      let pendingTot = 0;
      payments.forEach((p) => {
        if (p.status === 'approved') {
          cash += Number(p.amount || 0);
        } else if (p.status === 'pending') {
          pendingCnt += 1;
          pendingTot += Number(p.amount || 0);
        }
      });
      setCashReceived(cash);
      setPendingPaymentsCount(pendingCnt);
      setPendingPaymentsTotal(pendingTot);

      // 2. Customers classification
      const creditSet = new Set<string>();
      const payNowSet = new Set<string>();
      orders.forEach((o) => {
        if (o.payment_type === 'credit') creditSet.add(o.customer_id);
        else payNowSet.add(o.customer_id);
      });
      setCreditCustomersCount(creditSet.size);
      setPayNowCustomersCount(payNowSet.size);

      // 3. Accounts Receivable Aging Calculations
      const now = new Date().getTime();
      const customerAgingMap = new Map<string, AgingBucketRow>();

      orders.forEach((o: any) => {
        const debt = Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0));
        if (debt <= 0) return; // Fully paid, ignore

        const cId = o.customer_id;
        const cName = o.customer?.customer_name || 'Customer';

        const row = customerAgingMap.get(cId) || {
          customerId: cId,
          customerName: cName,
          totalDebt: 0,
          current: 0,
          days1to30: 0,
          days31to60: 0,
          days61to90: 0,
          days90plus: 0,
        };

        row.totalDebt += debt;

        // Determine days overdue based on due_date (or created_at if no due date)
        const refDate = o.due_date ? new Date(o.due_date).getTime() : new Date(o.created_at).getTime();
        const diffDays = Math.floor((now - refDate) / (1000 * 3600 * 24));

        if (diffDays <= 0) {
          row.current += debt;
        } else if (diffDays <= 30) {
          row.days1to30 += debt;
        } else if (diffDays <= 60) {
          row.days31to60 += debt;
        } else if (diffDays <= 90) {
          row.days61to90 += debt;
        } else {
          row.days90plus += debt;
        }

        customerAgingMap.set(cId, row);
      });

      const sortedAging = Array.from(customerAgingMap.values()).sort((a, b) => b.totalDebt - a.totalDebt);
      setAgingRows(sortedAging);
    } catch (e) {
      console.error('Failed to load financial intelligence:', e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Overall totals across buckets
  const totals = useMemo(() => {
    return agingRows.reduce(
      (acc, r) => ({
        totalDebt: acc.totalDebt + r.totalDebt,
        current: acc.current + r.current,
        days1to30: acc.days1to30 + r.days1to30,
        days31to60: acc.days31to60 + r.days31to60,
        days61to90: acc.days61to90 + r.days61to90,
        days90plus: acc.days90plus + r.days90plus,
      }),
      { totalDebt: 0, current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 }
    );
  }, [agingRows]);

  const exportHeaders = ['Customer Name', 'Current (Not Due)', '1–30 Days', '31–60 Days', '61–90 Days', '90+ Days', 'Total Outstanding'];
  const exportRows = agingRows.map((r) => [
    r.customerName,
    formatMoney(r.current),
    formatMoney(r.days1to30),
    formatMoney(r.days31to60),
    formatMoney(r.days61to90),
    formatMoney(r.days90plus),
    formatMoney(r.totalDebt),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-4 rounded-2xl border border-border/80">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Financial Intelligence & Accounts Receivable (AR) Aging
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Collections settlement, pending reviews, and debt aging buckets (Current to 90+ days).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportDropdown
            filenameBase="financial_ar_aging"
            title="2BF Accounts Receivable Aging Report"
            headers={exportHeaders}
            rows={exportRows}
            variant="outline"
            className="h-9"
          />

          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} className="h-9 text-xs touch-press">
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Financial Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="shadow-xs border-border/80 bg-emerald-50/40 dark:bg-emerald-950/20">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Total Cash Received</p>
            <h3 className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
              {formatMoney(cashReceived)}
            </h3>
            <p className="text-[11px] text-muted-foreground">Approved Payments</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Pending Verification</p>
            <h3 className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400">
              {formatMoney(pendingPaymentsTotal)}
            </h3>
            <p className="text-[11px] text-muted-foreground">{pendingPaymentsCount} approvals waiting</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Active Credit Customers</p>
            <h3 className="text-2xl font-bold font-mono text-foreground">{creditCustomersCount}</h3>
            <p className="text-[11px] text-muted-foreground">Authorized Accounts</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80 bg-rose-50/40 dark:bg-rose-950/20">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">Total AR Outstanding</p>
            <h3 className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-400">
              {formatMoney(totals.totalDebt)}
            </h3>
            <p className="text-[11px] text-muted-foreground">Across {agingRows.length} debtors</p>
          </CardContent>
        </Card>
      </div>

      {/* AR Aging Matrix */}
      <Card className="shadow-xs border-border/80">
        <CardHeader className="p-4 pb-3 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Accounts Receivable Aging Matrix
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customer debt distributed by duration since invoice due date.
            </p>
          </div>
          <span className="text-xs font-bold font-mono text-primary bg-primary/10 px-2.5 py-1 rounded-full self-start sm:self-auto">
            Total Overdue: {formatMoney(totals.totalDebt - totals.current)}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Customer Name</TableHead>
                  <TableHead className="text-xs text-right text-emerald-700 dark:text-emerald-400">Current</TableHead>
                  <TableHead className="text-xs text-right text-amber-700 dark:text-amber-400">1–30 Days</TableHead>
                  <TableHead className="text-xs text-right text-orange-700 dark:text-orange-400">31–60 Days</TableHead>
                  <TableHead className="text-xs text-right text-rose-600 dark:text-rose-400">61–90 Days</TableHead>
                  <TableHead className="text-xs text-right text-red-700 dark:text-red-500 font-bold">90+ Days</TableHead>
                  <TableHead className="text-xs text-right font-bold">Total Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agingRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                      No outstanding accounts receivable found. All orders reconciled!
                    </TableCell>
                  </TableRow>
                ) : (
                  agingRows.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-semibold text-xs py-2.5">
                        <span className="truncate max-w-[180px] block">{r.customerName}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs py-2.5 text-muted-foreground">
                        {r.current > 0 ? formatMoney(r.current) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs py-2.5 text-amber-700 dark:text-amber-400">
                        {r.days1to30 > 0 ? formatMoney(r.days1to30) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs py-2.5 text-orange-700 dark:text-orange-400">
                        {r.days31to60 > 0 ? formatMoney(r.days31to60) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs py-2.5 text-rose-600 dark:text-rose-400">
                        {r.days61to90 > 0 ? formatMoney(r.days61to90) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-xs py-2.5 text-red-700 dark:text-red-400">
                        {r.days90plus > 0 ? formatMoney(r.days90plus) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-xs text-foreground py-2.5">
                        {formatMoney(r.totalDebt)}
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
