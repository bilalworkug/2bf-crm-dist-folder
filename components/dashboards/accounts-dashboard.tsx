'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { DashboardFilters } from '@/lib/dashboard/dashboard-types';
import { fetchDashboardData, DashboardData } from '@/lib/dashboard/dashboard-queries';
import { exportDashboardToPDF, exportDashboardToExcel } from '@/lib/dashboard/dashboard-export';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { DashboardKPI } from '@/components/dashboard/dashboard-kpi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreditCard, Banknote, ClipboardList, Users, RefreshCcw, Download,
  Calendar, AlertTriangle, Info, Receipt, ShoppingCart
} from 'lucide-react';
import Link from 'next/link';

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse ${className || ''}`} />;
}

export function AccountsDashboard() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<DashboardFilters>({ dateRange: 'today' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboardData(filters, 'accounts');
      setData(result);
    } catch (e: any) {
      console.error('Dashboard load error:', e);
      setError(e?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filters.dateRange]);

  // Credit orders that are overdue
  const overdueOrderCount = useMemo(() => {
    if (!data?.ordersList) return 0;
    const today = new Date().toISOString().split('T')[0];
    return data.ordersList.filter(
      (o: any) => o.payment_type === 'credit' && o.due_date && o.due_date < today && ((o.total_amount || 0) - (o.paid_amount || 0)) > 0
    ).length;
  }, [data?.ordersList]);

  if (!profile) return null;

  return (
    <DashboardShell>
      {/* ════ HEADER & CONTROLS ════ */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Accounts Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back, {profile.full_name || 'Accounts User'}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={filters.dateRange}
            onValueChange={(v: any) => { setFilters({ ...filters, dateRange: v }); }}
          >
            <SelectTrigger className="w-auto h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-medium">
              <Calendar className="w-4 h-4 mr-2 text-slate-500" />
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={loadData} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <RefreshCcw className="w-4 h-4 mr-2 text-slate-500" />
            Refresh
          </Button>

          <Button variant="outline" onClick={() => { if (data) exportDashboardToExcel(data, filters, profile?.full_name || 'User', 'Accounts'); }} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <Download className="w-4 h-4 mr-2 text-slate-500" />
            Export
          </Button>

          <div className="flex items-center gap-3 ml-2 pl-4 border-l border-slate-200 dark:border-slate-800">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm">
              {profile.full_name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{profile.full_name || 'Accounts User'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight capitalize">{profile.role?.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 shadow-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <SkeletonBlock key={i} className="h-28" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SkeletonBlock className="h-[300px]" />
            <SkeletonBlock className="h-[300px]" />
          </div>
        </div>
      ) : data && (
        <div className="space-y-6">

          {/* ════ 4 KPI CARDS ════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardKPI
              kpi={{ value: formatMoney(data.paidAmount), label: 'Payments Received', description: 'For selected period' }}
              icon={<Banknote className="w-5 h-5 text-emerald-600" />}
              iconBgClass="bg-emerald-100 border-transparent text-emerald-600"
            />
            <DashboardKPI
              kpi={{ value: formatMoney(data.outstandingAmount), label: 'Outstanding Balance', description: 'Current total receivable', status: data.outstandingAmount > 0 ? 'warning' : 'neutral' }}
              icon={<ClipboardList className="w-5 h-5 text-amber-600" />}
              iconBgClass="bg-amber-100 border-transparent text-amber-600"
            />
            <DashboardKPI
              kpi={{ value: formatMoney(data.overdueCredit), label: 'Overdue Amount', description: 'Past payment due date', status: data.overdueCredit > 0 ? 'critical' : 'neutral' }}
              icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
              iconBgClass="bg-rose-100 border-transparent text-rose-600"
            />
            <DashboardKPI
              kpi={{ value: data.pendingPayments, label: 'Pending Approvals', description: 'Payments awaiting approval', status: data.pendingPayments > 0 ? 'warning' : 'neutral' }}
              icon={<Receipt className="w-5 h-5 text-blue-600" />}
              iconBgClass="bg-blue-100 border-transparent text-blue-600"
            />
          </div>

          {/* ════ MIDDLE ROW: PAYMENT SUMMARY & CREDIT ORDERS ════ */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* Payment Summary */}
            <Card className="shadow-sm border-slate-200 flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800">Financial Overview</CardTitle>
                <div className="text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">Current State</div>
              </CardHeader>
              <CardContent className="p-4 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-500 flex items-center justify-center"><Banknote className="w-4 h-4" /></div>
                      <span className="text-sm font-medium text-slate-700">Total Received (Period)</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">{formatMoney(data.paidAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-500 flex items-center justify-center"><ClipboardList className="w-4 h-4" /></div>
                      <span className="text-sm font-medium text-slate-700">Outstanding Receivable</span>
                    </div>
                    <span className="text-sm font-bold text-amber-500 whitespace-nowrap">{formatMoney(data.outstandingAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-rose-50 text-rose-500 flex items-center justify-center"><AlertTriangle className="w-4 h-4" /></div>
                      <span className="text-sm font-medium text-slate-700">Overdue Amount</span>
                    </div>
                    <span className="text-sm font-bold text-rose-500 whitespace-nowrap">{formatMoney(data.overdueCredit)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-500 flex items-center justify-center"><CreditCard className="w-4 h-4" /></div>
                      <span className="text-sm font-medium text-slate-700">Credit Exposure</span>
                    </div>
                    <span className="text-sm font-bold text-blue-600 whitespace-nowrap">{formatMoney(data.creditExposure)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-indigo-50 text-indigo-500 flex items-center justify-center"><Users className="w-4 h-4" /></div>
                      <span className="text-sm font-medium text-slate-700">Credit Customers</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{data.authorizedCustomers}</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 text-center mt-4">
                  <Link href="/account/payments" className="text-xs font-medium text-blue-600 hover:underline">View payment report</Link>
                </div>
              </CardContent>
            </Card>

            {/* Recent Credit Orders */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">Recent Credit Orders</CardTitle>
                <Link href="/account/customers" className="text-xs font-semibold text-blue-600 hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[11px] text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50">
                      <tr>
                        <th className="px-4 py-2 font-medium">Order No.</th>
                        <th className="px-4 py-2 font-medium">Customer</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.ordersList
                        .filter((o: any) => o.payment_type === 'credit' && ((o.total_amount || 0) - (o.paid_amount || 0)) > 0)
                        .slice(0, 5)
                        .map((order: any) => (
                          <tr key={order.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-medium text-blue-600">
                              <Link href={`/orders/detail?id=${order.id}`}>
                                {order.order_number || `SO-${order.id?.slice(0,4)}`}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-slate-700 truncate max-w-[120px]">
                              {order.customers?.name || 'Unknown'}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={order.status} className="text-[10px]" />
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-rose-600 whitespace-nowrap">
                              {formatMoney((order.total_amount || 0) - (order.paid_amount || 0))}
                            </td>
                          </tr>
                        ))}
                      {data.ordersList.filter((o: any) => o.payment_type === 'credit' && ((o.total_amount || 0) - (o.paid_amount || 0)) > 0).length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No outstanding credit orders.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {data.ordersList
                    .filter((o: any) => o.payment_type === 'credit' && ((o.total_amount || 0) - (o.paid_amount || 0)) > 0)
                    .slice(0, 5)
                    .map((order: any) => (
                      <div key={order.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <Link href={`/orders/detail?id=${order.id}`} className="font-medium text-blue-600 text-sm">
                            {order.order_number || `SO-${order.id?.slice(0,4)}`}
                          </Link>
                          <StatusBadge status={order.status} className="text-[10px]" />
                        </div>
                        <p className="text-sm text-slate-700">{order.customers?.name || 'Unknown'}</p>
                        <p className="text-sm font-semibold text-rose-600">Balance: {formatMoney((order.total_amount || 0) - (order.paid_amount || 0))}</p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* ════ LOWER ROW: QUICK ACTIONS ════ */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link href="/account/payments" className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <CreditCard className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-xs font-medium text-slate-700">Record Payment</span>
              </Link>
              <Link href="/account/customers" className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <Users className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="text-xs font-medium text-slate-700">Customer Balances</span>
              </Link>
              <Link href="/account/debt" className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <ClipboardList className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-xs font-medium text-slate-700">Debt Management</span>
              </Link>
              <Link href="/reports" className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <Receipt className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-xs font-medium text-slate-700">Financial Reports</span>
              </Link>
            </CardContent>
          </Card>

          {/* ════ BOTTOM ALERT BARS ════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="text-sm font-semibold text-amber-900 truncate">
                  {overdueOrderCount > 0 ? `${overdueOrderCount} credit order(s) overdue` : 'No overdue credit orders'}
                </span>
              </div>
              <Link href="/account/customers" className="text-xs font-semibold px-3 py-1.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors whitespace-nowrap ml-2 shrink-0">View Details</Link>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-2 min-w-0">
                <Info className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-sm font-semibold text-emerald-900 truncate">{data.pendingPayments} payment(s) awaiting approval</span>
              </div>
              <Link href="/approvals" className="text-xs font-semibold px-3 py-1.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors whitespace-nowrap ml-2 shrink-0">View</Link>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50">
              <div className="flex items-center gap-2 min-w-0">
                <Info className="w-5 h-5 text-blue-600 shrink-0" />
                <span className="text-sm font-semibold text-blue-900 truncate">{data.authorizedCustomers} credit-authorized customer(s)</span>
              </div>
              <Link href="/account/customers" className="text-xs font-semibold px-3 py-1.5 rounded bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors whitespace-nowrap ml-2 shrink-0">Manage</Link>
            </div>
          </div>

        </div>
      )}
    </DashboardShell>
  );
}
