'use client';

import { useState, useMemo } from 'react';
import { CustomerIntelligenceItem, PaymentBehaviorBadge } from '@/lib/executive-intelligence/executive-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Users, Search, TrendingUp, AlertTriangle, Clock,
  ArrowUpRight, Phone, MapPin, Calendar, CreditCard,
  CheckCircle2, ShoppingCart, DollarSign, Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';

interface CustomerIntelligenceProps {
  customers: CustomerIntelligenceItem[];
}

function getBehaviorBadgeColor(behavior: PaymentBehaviorBadge) {
  switch (behavior) {
    case 'Excellent':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'Good':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'Average':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'Slow Payer':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    case 'High Credit Risk':
      return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
    case 'New Account':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
  }
}

export function CustomerIntelligence({ customers }: CustomerIntelligenceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerIntelligenceItem | null>(null);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const q = searchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
    );
  }, [customers, searchTerm]);

  // Ranking cards data
  const topCustomer = customers[0] || null;
  const fastestGrowing = [...customers].sort((a, b) => b.growthPct - a.growthPct)[0] || null;
  const inactiveCustomers = customers.filter(c => c.daysSinceLastPurchase >= 45 && c.daysSinceLastPurchase < 999);
  const highestDebtCustomers = [...customers].sort((a, b) => b.outstandingBalance - a.outstandingBalance);
  const topDebtCustomer = highestDebtCustomers.find(c => c.outstandingBalance > 0) || null;

  return (
    <div className="space-y-6">
      {/* ─── RANKINGS HIGHLIGHT ROW ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Top Customer Period */}
        <Card className="border-border/80 bg-card p-3 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top Customer</p>
            <h4 className="text-xs font-bold text-foreground truncate mt-1" title={topCustomer?.name || 'None'}>
              {topCustomer?.name || 'None'}
            </h4>
          </div>
          <p className="text-sm font-extrabold text-primary mt-2">
            ETB {topCustomer ? topCustomer.totalRevenue.toLocaleString() : '0'}
          </p>
        </Card>

        {/* Fastest Growing */}
        <Card className="border-border/80 bg-card p-3 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fastest Growing</p>
            <h4 className="text-xs font-bold text-foreground truncate mt-1" title={fastestGrowing?.name || 'None'}>
              {fastestGrowing?.name || 'None'}
            </h4>
          </div>
          <p className="text-sm font-extrabold text-emerald-600 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            +{fastestGrowing?.growthPct || 0}%
          </p>
        </Card>

        {/* Highest Outstanding */}
        <Card className="border-border/80 bg-card p-3 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Highest Debt</p>
            <h4 className="text-xs font-bold text-foreground truncate mt-1" title={topDebtCustomer?.name || 'None'}>
              {topDebtCustomer?.name || 'None'}
            </h4>
          </div>
          <p className="text-sm font-extrabold text-rose-600 mt-2">
            ETB {topDebtCustomer ? topDebtCustomer.outstandingBalance.toLocaleString() : '0'}
          </p>
        </Card>

        {/* Inactive Accounts */}
        <Card className="border-border/80 bg-card p-3 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inactive (45+ Days)</p>
            <h4 className="text-xs font-bold text-foreground truncate mt-1">
              {inactiveCustomers.length} Accounts
            </h4>
          </div>
          <p className="text-sm font-extrabold text-amber-600 mt-2 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Needs Re-engagement
          </p>
        </Card>

        {/* Total Active Clients */}
        <Card className="border-border/80 bg-card p-3 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Accounts</p>
            <h4 className="text-xs font-bold text-foreground truncate mt-1">
              {customers.length} Client Records
            </h4>
          </div>
          <p className="text-sm font-extrabold text-foreground mt-2">
            100% Tracked
          </p>
        </Card>

        {/* Average AOV */}
        <Card className="border-border/80 bg-card p-3 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Average Order Size</p>
            <h4 className="text-xs font-bold text-foreground truncate mt-1">
              Cohort Mean
            </h4>
          </div>
          <p className="text-sm font-extrabold text-indigo-600 mt-2">
            ETB {Math.round(customers.reduce((sum, c) => sum + c.averageOrderValue, 0) / Math.max(1, customers.length)).toLocaleString()}
          </p>
        </Card>
      </div>

      {/* ─── CUSTOMER INTELLIGENCE TABLE ─── */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardHeader className="p-4 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Customer Financial & Ordering Intelligence
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click any customer row to open full purchase drilldown, favorite products, and credit ledger.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search customer, city, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs bg-muted/20"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold border-b border-border/60">
                <tr>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3 text-right">Revenue</th>
                  <th className="py-2.5 px-3 text-center">Orders</th>
                  <th className="py-2.5 px-3 text-right">Avg Order Value</th>
                  <th className="py-2.5 px-3">First Purchase</th>
                  <th className="py-2.5 px-3">Last Purchase</th>
                  <th className="py-2.5 px-3 text-right">Outstanding</th>
                  <th className="py-2.5 px-3 text-center">Credit Util %</th>
                  <th className="py-2.5 px-3 text-center">Payment Behavior</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground text-xs">
                      No customer intelligence records match your search filter.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust) => (
                    <tr
                      key={cust.id}
                      onClick={() => setSelectedCustomer(cust)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <span>{cust.name}</span>
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                        </div>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          {cust.city && <span>{cust.city} • </span>}
                          <span>{cust.phone || 'No phone'}</span>
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-foreground">
                        ETB {cust.totalRevenue.toLocaleString()}
                      </td>

                      <td className="py-2.5 px-3 text-center font-medium">
                        {cust.totalOrders}
                      </td>

                      <td className="py-2.5 px-3 text-right font-medium">
                        ETB {cust.averageOrderValue.toLocaleString()}
                      </td>

                      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                        {cust.firstPurchaseDate ? formatDate(cust.firstPurchaseDate) : 'N/A'}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {cust.lastPurchaseDate ? (
                          <span className={cn(
                            cust.daysSinceLastPurchase >= 45 ? 'text-amber-600 font-semibold' : 'text-muted-foreground'
                          )}>
                            {formatDate(cust.lastPurchaseDate)} ({cust.daysSinceLastPurchase}d ago)
                          </span>
                        ) : 'Never'}
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold">
                        <span className={cust.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                          ETB {cust.outstandingBalance.toLocaleString()}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex items-center gap-1 font-semibold text-[11px]">
                          <span>{cust.creditUtilizationPct}%</span>
                          <div className="w-8 h-1.5 bg-muted rounded-full overflow-hidden inline-block">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                cust.creditUtilizationPct >= 90 ? 'bg-rose-500' : cust.creditUtilizationPct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                              )}
                              style={{ width: `${Math.min(100, cust.creditUtilizationPct)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <span className={cn(
                          'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border',
                          getBehaviorBadgeColor(cust.paymentBehavior)
                        )}>
                          {cust.paymentBehavior}
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

      {/* ─── CUSTOMER DRILLDOWN DIALOG ─── */}
      {selectedCustomer && (
        <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
          <DialogContent className="max-w-2xl bg-card border-border/80">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    {selectedCustomer.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Executive Profile & Purchase Analytics
                  </DialogDescription>
                </div>
                <span className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-bold border',
                  getBehaviorBadgeColor(selectedCustomer.paymentBehavior)
                )}>
                  {selectedCustomer.paymentBehavior}
                </span>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Top Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Spend</p>
                  <p className="text-sm font-extrabold text-foreground mt-0.5">
                    ETB {selectedCustomer.totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">Orders Placed</p>
                  <p className="text-sm font-extrabold text-foreground mt-0.5">
                    {selectedCustomer.totalOrders} orders
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">Avg Order Ticket</p>
                  <p className="text-sm font-extrabold text-foreground mt-0.5">
                    ETB {selectedCustomer.averageOrderValue.toLocaleString()}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">Current Balance</p>
                  <p className={cn(
                    'text-sm font-extrabold mt-0.5',
                    selectedCustomer.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
                  )}>
                    ETB {selectedCustomer.outstandingBalance.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Detail Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-muted/20 border border-border/60 text-xs">
                <div>
                  <span className="text-muted-foreground font-medium">Favorite Product:</span>{' '}
                  <strong className="text-foreground">{selectedCustomer.favoriteProductName}</strong>{' '}
                  ({selectedCustomer.favoriteProductVolume || 0} units bought)
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">Credit Limit:</span>{' '}
                  <strong className="text-foreground">
                    {selectedCustomer.creditLimit > 0 ? `ETB ${selectedCustomer.creditLimit.toLocaleString()}` : 'No Credit Facility'}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">First Purchase:</span>{' '}
                  <span className="text-foreground">
                    {selectedCustomer.firstPurchaseDate ? formatDate(selectedCustomer.firstPurchaseDate) : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">Last Purchase:</span>{' '}
                  <span className="text-foreground">
                    {selectedCustomer.lastPurchaseDate ? `${formatDate(selectedCustomer.lastPurchaseDate)} (${selectedCustomer.daysSinceLastPurchase}d ago)` : 'Never'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">Contact Phone:</span>{' '}
                  <span className="text-foreground">{selectedCustomer.phone || 'None'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">Location:</span>{' '}
                  <span className="text-foreground">{selectedCustomer.city || 'Addis Ababa'}</span>
                </div>
              </div>

              {/* Order History Sample */}
              <div>
                <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                  Recent Order Transactions
                </h4>
                <div className="border border-border/60 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 text-muted-foreground text-[10px] font-bold">
                      <tr>
                        <th className="p-2">Order #</th>
                        <th className="p-2">Date</th>
                        <th className="p-2 text-right">Amount</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {(!selectedCustomer.orderHistorySample || selectedCustomer.orderHistorySample.length === 0) ? (
                        <tr>
                          <td colSpan={4} className="p-3 text-center text-muted-foreground">
                            No orders found for this customer.
                          </td>
                        </tr>
                      ) : (
                        selectedCustomer.orderHistorySample.map((ord) => (
                          <tr key={ord.id} className="hover:bg-muted/20">
                            <td className="p-2 font-semibold text-primary">{ord.orderNumber}</td>
                            <td className="p-2 text-muted-foreground">{formatDate(ord.createdAt)}</td>
                            <td className="p-2 text-right font-bold">ETB {ord.totalAmount.toLocaleString()}</td>
                            <td className="p-2 text-center">
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-muted">
                                {ord.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
