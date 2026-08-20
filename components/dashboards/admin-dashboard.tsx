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
  ShoppingCart, PackageCheck, Users, RefreshCcw, Download,
  ClipboardList, CreditCard, ArrowRightLeft, LayoutDashboard,
  Calendar, Bell, AlertTriangle, Info, Box, Banknote, BarChart3
} from 'lucide-react';
import Link from 'next/link';
import { XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse ${className || ''}`} />;
}

/** Map warehouse stock level to a status the StatusBadge can render with proper color */
function stockStatus(stock: number): string {
  if (stock > 100) return 'active';   // → success (green)
  if (stock > 0) return 'pending';    // → warning (orange)
  return 'overdue';                   // → destructive (red)
}

function stockLabel(stock: number): string {
  if (stock > 100) return 'Good';
  if (stock > 0) return 'Low';
  return 'Out';
}

export function AdminDashboard() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<DashboardFilters>({ dateRange: 'today' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboardData(filters, 'admin');
      setData(result);
    } catch (e: any) {
      console.error('Dashboard load error:', e);
      setError(e?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filters.dateRange, filters.customStartDate, filters.customEndDate]);

  // Derived calculations for Top Products
  const topProducts = useMemo(() => {
    if (!data?.productPerformance) return [];
    return [...data.productPerformance]
      .sort((a, b) => b.dispatched - a.dispatched) 
      .slice(0, 5);
  }, [data?.productPerformance]);

  // Derived calculations for Chart
  const chartData = useMemo(() => {
    if (!data?.ordersList || data.ordersList.length === 0) return [];
    
    const grouped: Record<string, { date: string; created: number; completed: number }> = {};
    for (const order of data.ordersList) {
      const dateStr = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!grouped[dateStr]) grouped[dateStr] = { date: dateStr, created: 0, completed: 0 };
      grouped[dateStr].created += 1;
      if (order.status === 'delivered' || order.status === 'dispatched' || order.status === 'paid') {
        grouped[dateStr].completed += 1;
      }
    }
    return Object.values(grouped).slice(-7);
  }, [data?.ordersList]);

  if (!profile) return null;

  return (
    <DashboardShell>
      {/* ════ HEADER & CONTROLS ════ */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back, {profile.full_name || 'Admin User'}</p>
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
          
          <Button variant="outline" onClick={() => exportDashboardToExcel(data as any, filters, profile?.full_name || 'User', 'Admin')} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <Download className="w-4 h-4 mr-2 text-slate-500" />
            Export
          </Button>

          <div className="flex items-center gap-4 ml-2 pl-4 border-l border-slate-200 dark:border-slate-800">
            <button className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              {(data?.pendingPayments || 0) > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                {profile.full_name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{profile.full_name || 'Admin User'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight capitalize">{profile.role?.replace('_', ' ')}</p>
              </div>
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
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <SkeletonBlock key={i} className="h-28" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SkeletonBlock className="h-[350px]" />
            <SkeletonBlock className="h-[350px]" />
          </div>
        </div>
      ) : data && (
        <div className="space-y-6">
          
          {/* ════ 8 KPI CARDS ════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardKPI 
              kpi={{ value: data.products.length, label: 'Total Products', description: 'Active items in system' }} 
              icon={<Box className="w-5 h-5 text-blue-600" />} 
              iconBgClass="bg-blue-100 border-transparent text-blue-600"
            />
            <DashboardKPI 
              kpi={{ value: data.totalInStock.toLocaleString(), label: 'Available Stock (All)', description: 'Total across all warehouses' }} 
              icon={<LayoutDashboard className="w-5 h-5 text-emerald-600" />} 
              iconBgClass="bg-emerald-100 border-transparent text-emerald-600"
            />
            <DashboardKPI 
              kpi={{ value: data.totalOrders, label: 'Orders (All)', description: 'Total orders placed' }} 
              icon={<ShoppingCart className="w-5 h-5 text-purple-600" />} 
              iconBgClass="bg-purple-100 border-transparent text-purple-600"
            />
            <DashboardKPI 
              kpi={{ value: data.totalDispatched, label: 'Dispatched (Today)', description: 'Boxes shipped' }} 
              icon={<ShoppingCart className="w-5 h-5 text-amber-600" />} 
              iconBgClass="bg-amber-100 border-transparent text-amber-600"
            />
            <DashboardKPI 
              kpi={{ value: data.totalDelivered, label: 'Delivered (Today)', description: 'Confirmed deliveries' }} 
              icon={<PackageCheck className="w-5 h-5 text-teal-600" />} 
              iconBgClass="bg-teal-100 border-transparent text-teal-600"
            />
            <DashboardKPI 
              kpi={{ value: data.totalReturned, label: 'Returns (Today)', description: 'Boxes returned' }} 
              icon={<RefreshCcw className="w-5 h-5 text-rose-600" />} 
              iconBgClass="bg-rose-100 border-transparent text-rose-600"
            />
            <DashboardKPI 
              kpi={{ value: data.totalCustomers, label: 'Customers', description: 'Active customer accounts' }} 
              icon={<Users className="w-5 h-5 text-amber-500" />} 
              iconBgClass="bg-amber-100 border-transparent text-amber-500"
            />
            <DashboardKPI 
              kpi={{ value: formatMoney(data.outstandingAmount), label: 'Outstanding Receivable', description: `From ${data.ordersList.filter(o => o.payment_type === 'credit' && ((o.total_amount||0)-(o.paid_amount||0))>0).length} credit orders` }} 
              icon={<CreditCard className="w-5 h-5 text-blue-600" />} 
              iconBgClass="bg-blue-100 border-transparent text-blue-600"
            />
          </div>

          {/* ════ MIDDLE ROW: CHART & RECENT ORDERS ════ */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            
            {/* Chart */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2 flex flex-row items-center justify-between border-b-0">
                <CardTitle className="text-sm font-bold text-slate-800">Orders Overview</CardTitle>
                <div className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1 rounded-md border border-slate-200">
                  Last 7 Days
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full mt-4">
                  {chartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">No order activity in this period.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend verticalAlign="top" height={36} iconType="square" iconSize={8} wrapperStyle={{ fontSize: '12px', top: -10 }} />
                        <Line type="monotone" dataKey="created" name="Orders Placed" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="completed" name="Orders Completed" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Orders */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">Recent Orders</CardTitle>
                <Link href="/orders" className="text-xs font-semibold text-blue-600 hover:underline">
                  View all orders
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[11px] text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50">
                      <tr>
                        <th className="px-4 py-2 font-medium">Order No.</th>
                        <th className="px-4 py-2 font-medium">Customer</th>
                        <th className="px-4 py-2 font-medium">Type</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium text-right">Total</th>
                        <th className="px-4 py-2 font-medium text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.ordersList.slice(0, 5).map((order) => (
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
                            <StatusBadge status={order.payment_type === 'credit' ? 'Credit' : 'Paid'} className="text-[10px]" />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={order.status} className="text-[10px]" />
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700 whitespace-nowrap">
                            {formatMoney(order.total_amount)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500 text-xs whitespace-nowrap">
                            {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                      {data.ordersList.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No orders found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {data.ordersList.slice(0, 5).map((order) => (
                    <div key={order.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Link href={`/orders/detail?id=${order.id}`} className="font-medium text-blue-600 text-sm">
                          {order.order_number || `SO-${order.id?.slice(0,4)}`}
                        </Link>
                        <span className="text-xs text-slate-500">
                          {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{order.customers?.name || 'Unknown'}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={order.payment_type === 'credit' ? 'Credit' : 'Paid'} className="text-[10px]" />
                          <StatusBadge status={order.status} className="text-[10px]" />
                        </div>
                        <span className="font-semibold text-sm text-slate-900 whitespace-nowrap">{formatMoney(order.total_amount)}</span>
                      </div>
                    </div>
                  ))}
                  {data.ordersList.length === 0 && (
                    <div className="p-6 text-center text-slate-500 text-sm">No orders found.</div>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* ════ LOWER ROW: 4 WIDGETS ════ */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            
            {/* 1. Top Products (By Sales Value) */}
            <Card className="shadow-sm border-slate-200 flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800">Top Products (By Sales Value)</CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col">
                <div className="flex-1">
                  <ul className="divide-y divide-slate-50">
                    {topProducts.length === 0 ? (
                       <li className="p-4 text-center text-slate-500 text-sm">No dispatch data available.</li>
                    ) : topProducts.map((p, i) => (
                      <li key={i} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-5 h-5 shrink-0 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center">{i+1}</span>
                          <span className="text-sm text-slate-700 truncate">{p.productName}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-700 whitespace-nowrap ml-2">{p.dispatched} units</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-3 border-t border-slate-100 text-center">
                  <Link href="/reports" className="text-xs font-medium text-blue-600 hover:underline">View full report</Link>
                </div>
              </CardContent>
            </Card>

            {/* 2. Payment Summary */}
            <Card className="shadow-sm border-slate-200 flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800">Payment Summary</CardTitle>
                <div className="text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">Today</div>
              </CardHeader>
              <CardContent className="p-4 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-500 flex items-center justify-center"><Banknote className="w-4 h-4" /></div>
                      <span className="text-sm font-medium text-slate-700">Total Received</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">{formatMoney(data.paidAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-500 flex items-center justify-center"><ClipboardList className="w-4 h-4" /></div>
                      <span className="text-sm font-medium text-slate-700">Pending Payments</span>
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
                      <span className="text-sm font-medium text-slate-700">Total Transactions</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{data.totalOrders}</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 text-center mt-4">
                  <Link href="/account/payments" className="text-xs font-medium text-blue-600 hover:underline">View payment report</Link>
                </div>
              </CardContent>
            </Card>

            {/* 3. Warehouse Stock Summary */}
            <Card className="shadow-sm border-slate-200 flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800">Warehouse Stock Summary</CardTitle>
                <div className="text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">All Warehouses</div>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col">
                <div className="flex-1">
                  <ul className="divide-y divide-slate-50">
                    {data.warehouseOverview.length === 0 ? (
                       <li className="p-4 text-center text-slate-500 text-sm">No warehouse data.</li>
                    ) : data.warehouseOverview.slice(0, 4).map((w, i) => (
                      <li key={i} className="px-4 py-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 truncate">{w.warehouseName}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold text-slate-900">{w.availableStock.toLocaleString()}</span>
                          <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-medium w-12 ${
                            w.availableStock > 100 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : w.availableStock > 0 
                                ? 'bg-orange-100 text-orange-700' 
                                : 'bg-red-100 text-red-700'
                          }`}>
                            {stockLabel(w.availableStock)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-3 border-t border-slate-100 text-center">
                  <Link href="/inventory" className="text-xs font-medium text-blue-600 hover:underline">View stock report</Link>
                </div>
              </CardContent>
            </Card>

            {/* 4. Quick Actions */}
            <Card className="shadow-sm border-slate-200 flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-2 gap-3 flex-1 content-start">
                <Link href="/orders" className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                   <ShoppingCart className="w-4 h-4 text-blue-500 shrink-0" />
                   <span className="text-xs font-medium text-slate-700">New Order</span>
                </Link>
                <Link href="/admin/products" className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                   <Box className="w-4 h-4 text-emerald-500 shrink-0" />
                   <span className="text-xs font-medium text-slate-700">Add Product</span>
                </Link>
                <Link href="/account/payments" className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                   <CreditCard className="w-4 h-4 text-purple-500 shrink-0" />
                   <span className="text-xs font-medium text-slate-700">Record Payment</span>
                </Link>
                <Link href="/customers" className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                   <Users className="w-4 h-4 text-amber-500 shrink-0" />
                   <span className="text-xs font-medium text-slate-700">Create Customer</span>
                </Link>
                <Link href="/warehouse/transfers" className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                   <ArrowRightLeft className="w-4 h-4 text-blue-500 shrink-0" />
                   <span className="text-xs font-medium text-slate-700">Stock Transfer</span>
                </Link>
                <Link href="/reports" className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                   <BarChart3 className="w-4 h-4 text-rose-500 shrink-0" />
                   <span className="text-xs font-medium text-slate-700">View Reports</span>
                </Link>
              </CardContent>
            </Card>

          </div>

          {/* ════ BOTTOM ALERT BARS ════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="text-sm font-semibold text-amber-900 truncate">
                  {data.overdueCredit > 0 
                    ? `${data.ordersList.filter(o => o.payment_type === 'credit' && ((o.total_amount||0)-(o.paid_amount||0))>0 && o.due_date && new Date(o.due_date) < new Date()).length} credit orders are overdue` 
                    : '0 credit orders are overdue'}
                </span>
              </div>
              <Link href="/account/customers" className="text-xs font-semibold px-3 py-1.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors whitespace-nowrap ml-2 shrink-0">View Details</Link>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50">
              <div className="flex items-center gap-2 min-w-0">
                <Info className="w-5 h-5 text-blue-600 shrink-0" />
                <span className="text-sm font-semibold text-blue-900 truncate">Low stock alert for {data.productPerformance.filter(p=>p.inStock > 0 && p.inStock < 50).length} products</span>
              </div>
              <Link href="/inventory" className="text-xs font-semibold px-3 py-1.5 rounded bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors whitespace-nowrap ml-2 shrink-0">View Details</Link>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-2 min-w-0">
                <Info className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-sm font-semibold text-emerald-900 truncate">{data.pendingPayments} payments awaiting approval</span>
              </div>
              <Link href="/approvals" className="text-xs font-semibold px-3 py-1.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors whitespace-nowrap ml-2 shrink-0">View Details</Link>
            </div>

          </div>

        </div>
      )}
    </DashboardShell>
  );
}
