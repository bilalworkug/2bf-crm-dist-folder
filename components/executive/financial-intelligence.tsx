'use client';

import { FinancialIntelligenceData } from '@/lib/executive-intelligence/executive-types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  DollarSign, CreditCard, Banknote, AlertCircle,
  CheckCircle2, Clock, ArrowUpRight, ShieldCheck, PieChart
} from 'lucide-react';
import { formatMoney, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface FinancialIntelligenceProps {
  finances: FinancialIntelligenceData;
}

export function FinancialIntelligence({ finances }: FinancialIntelligenceProps) {
  const agingData = [
    { bucket: 'Current', amount: finances.arAging.current, color: '#10b981' },
    { bucket: '1–30 Days', amount: finances.arAging.days1To30, color: '#3b82f6' },
    { bucket: '31–60 Days', amount: finances.arAging.days31To60, color: '#f59e0b' },
    { bucket: '61–90 Days', amount: finances.arAging.days61To90, color: '#f97316' },
    { bucket: '90+ Days', amount: finances.arAging.days90Plus, color: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      {/* ─── TOP EXECUTIVE FINANCIAL STRIP ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Period Revenue</p>
          <p className="text-base font-extrabold text-foreground mt-1">
            ETB {finances.totalRevenue.toLocaleString()}
          </p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Total booked orders</span>
        </Card>

        <Card className="border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Cash Collections</p>
          <p className="text-base font-extrabold text-emerald-600 mt-1">
            ETB {finances.totalCollections.toLocaleString()}
          </p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Approved payments</span>
        </Card>

        <Card className="border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Collection Rate</p>
          <p className="text-base font-extrabold text-primary mt-1">
            {finances.collectionRatePct}%
          </p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Collected / Invoiced</span>
        </Card>

        <Card className="border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Accounts Receivable</p>
          <p className={cn(
            'text-base font-extrabold mt-1',
            finances.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
          )}>
            ETB {finances.outstandingBalance.toLocaleString()}
          </p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Total unpaid balance</span>
        </Card>

        <Card className="border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Credit Exposure</p>
          <p className="text-base font-extrabold text-amber-600 mt-1">
            ETB {finances.creditExposure.toLocaleString()}
          </p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">{finances.creditUtilizationPct}% of limit utilized</span>
        </Card>

        <Card className="border-border/80 bg-card p-3.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Authorized Limit</p>
          <p className="text-base font-extrabold text-indigo-600 mt-1">
            ETB {finances.totalCreditLimit.toLocaleString()}
          </p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Max total exposure</span>
        </Card>
      </div>

      {/* ─── AR AGING BUCKETS & CASH VS CREDIT ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* AR Aging Chart */}
        <Card className="border-border/80 bg-card shadow-xs lg:col-span-2">
          <CardHeader className="p-4 border-b border-border/80">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Accounts Receivable (AR) Aging Buckets
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Overdue distribution of unpaid customer balances based on payment terms and due dates.
                </CardDescription>
              </div>
              <span className="text-xs font-extrabold text-rose-600 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20">
                ETB {finances.arAging.totalReceivables.toLocaleString()} Total
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `ETB ${(val / 1000).toFixed(0)}k`}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border p-2.5 rounded-lg shadow-md text-xs">
                            <p className="font-bold text-foreground mb-1">{d.bucket}</p>
                            <p className="font-semibold text-rose-600">Outstanding: ETB {d.amount.toLocaleString()}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Outstanding Amount" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Aging Table Summary */}
            <div className="grid grid-cols-5 gap-2 mt-4 pt-3 border-t border-border/40 text-center text-xs">
              {agingData.map((b) => (
                <div key={b.bucket} className="p-2 rounded-lg bg-muted/20 border border-border/40">
                  <span className="text-[10px] text-muted-foreground font-semibold block">{b.bucket}</span>
                  <strong className="text-foreground text-xs mt-0.5 block">
                    ETB {b.amount.toLocaleString()}
                  </strong>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cash vs Credit Sales Ratio */}
        <Card className="border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <CardHeader className="p-4 border-b border-border/80">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-500" />
              Cash vs. Credit Commercial Split
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Period breakdown of immediate payment vs. credit ledger sales.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-emerald-600">Immediate / Cash Orders:</span>
                <span>{finances.cashVsCreditRatio.cashPct}% (ETB {finances.cashSalesAmount.toLocaleString()})</span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${finances.cashVsCreditRatio.cashPct}%` }} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-amber-600">Credit Term Orders:</span>
                <span>{finances.cashVsCreditRatio.creditPct}% (ETB {finances.creditSalesAmount.toLocaleString()})</span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${finances.cashVsCreditRatio.creditPct}%` }} />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/20 border border-border/60 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Credit Exposure:</span>
                <strong className="text-foreground">ETB {finances.creditExposure.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Approved Limit:</span>
                <strong className="text-foreground">ETB {finances.totalCreditLimit.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credit Utilization:</span>
                <strong className={cn(
                  finances.creditUtilizationPct >= 90 ? 'text-rose-600' : 'text-emerald-600'
                )}>
                  {finances.creditUtilizationPct}%
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── RECENT RECONCILED PAYMENTS ─── */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardHeader className="p-4 border-b border-border/80">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Recent Reconciled Collections
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Verified cash inflows approved by accounts and credited to customer balances.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold border-b border-border/60">
                <tr>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Payment Method</th>
                  <th className="py-2.5 px-3">Transaction Date</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {finances.recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      No payments recorded in this period.
                    </td>
                  </tr>
                ) : (
                  finances.recentPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        {p.customerName}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                        ETB {p.amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {p.paymentMethod}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {formatDate(p.paymentDate)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={cn(
                          'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border',
                          p.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        )}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
