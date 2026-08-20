'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { DashboardFilters } from '@/lib/dashboard/dashboard-types';
import { fetchDashboardData, DashboardData } from '@/lib/dashboard/dashboard-queries';
import { exportDashboardToPDF, exportDashboardToExcel } from '@/lib/dashboard/dashboard-export';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { DashboardKPI } from '@/components/dashboard/dashboard-kpi';
import { ProductPerformanceWidget } from '@/components/dashboard/product-performance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ShoppingCart, Users, Package, RefreshCcw, Download,
  Calendar, AlertTriangle, Info, CreditCard, TrendingUp
} from 'lucide-react';
import Link from 'next/link';

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse ${className || ''}`} />;
}

export function SalesDashboard() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<DashboardFilters>({ dateRange: 'today' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboardData(filters, 'sales');
      setData(result);
    } catch (e: any) {
      console.error('Dashboard load error:', e);
      setError(e?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filters.dateRange]);

  // Top selling products by dispatched
  const topProducts = useMemo(() => {
    if (!data?.productPerformance) return [];
    return [...data.productPerformance]
      .sort((a, b) => b.dispatched - a.dispatched)
      .slice(0, 5);
  }, [data?.productPerformance]);

  // Low stock products
  const lowStockProducts = useMemo(() => {
    if (!data?.productPerformance) return [];
    return data.productPerformance.filter(p => p.inStock > 0 && p.inStock < 50);
  }, [data?.productPerformance]);

  if (!profile) return null;

  return (
    <DashboardShell>
      {/* ════ HEADER & CONTROLS ════ */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Sales Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back, {profile.full_name || 'Sales User'}</p>
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

          <Button variant="outline" onClick={() => { if (data) exportDashboardToExcel(data, filters, profile?.full_name || 'User', 'Sales'); }} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <Download className="w-4 h-4 mr-2 text-slate-500" />
            Export
          </Button>

          <div className="flex items-center gap-3 ml-2 pl-4 border-l border-slate-200 dark:border-slate-800">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
              {profile.full_name?.charAt(0).toUpperCase() || 'S'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{profile.full_name || 'Sales User'}</p>
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
            <SkeletonBlock className="h-[350px]" />
            <SkeletonBlock className="h-[350px]" />
          </div>
        </div>
      ) : data && (
        <div className="space-y-6">

          {/* ════ 4 KPI CARDS ════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardKPI
              kpi={{ value: data.totalOrders, label: 'Orders Placed', description: 'For selected period' }}
              icon={<ShoppingCart className="w-5 h-5 text-blue-600" />}
              iconBgClass="bg-blue-100 border-transparent text-blue-600"
            />
            <DashboardKPI
              kpi={{ value: data.pendingOrders, label: 'Pending Orders', description: 'Awaiting approval', status: data.pendingOrders > 0 ? 'warning' : 'neutral' }}
              icon={<ShoppingCart className="w-5 h-5 text-amber-600" />}
              iconBgClass="bg-amber-100 border-transparent text-amber-600"
            />
            <DashboardKPI
              kpi={{ value: data.totalCustomers, label: 'Customers', description: 'Active customer accounts' }}
              icon={<Users className="w-5 h-5 text-indigo-600" />}
              iconBgClass="bg-indigo-100 border-transparent text-indigo-600"
            />
            <DashboardKPI
              kpi={{ value: data.totalInStock.toLocaleString(), label: 'Available Inventory', description: 'Boxes ready to sell' }}
              icon={<Package className="w-5 h-5 text-emerald-600" />}
              iconBgClass="bg-emerald-100 border-transparent text-emerald-600"
            />
          </div>

          {/* ════ MIDDLE ROW: RECENT ORDERS & TOP PRODUCTS ════ */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

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
                            <StatusBadge status={order.status} className="text-[10px]" />
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700 whitespace-nowrap">
                            {formatMoney(order.total_amount)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500 text-xs whitespace-nowrap">
                            {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                      {data.ordersList.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No orders found for this period.</td></tr>
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
                        <StatusBadge status={order.status} className="text-[10px]" />
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

            {/* Top Products */}
            <Card className="shadow-sm border-slate-200 flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800">Top Products (By Sales)</CardTitle>
                <div className="text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">This Period</div>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col">
                <div className="flex-1">
                  <ul className="divide-y divide-slate-50">
                    {topProducts.length === 0 ? (
                      <li className="p-4 text-center text-slate-500 text-sm">No sales data available.</li>
                    ) : topProducts.map((p, i) => (
                      <li key={i} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-5 h-5 shrink-0 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center">{i+1}</span>
                          <span className="text-sm text-slate-700 truncate">{p.productName}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">{p.dispatched} sold</span>
                          <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-medium w-12 ${
                            p.inStock > 100
                              ? 'bg-emerald-100 text-emerald-700'
                              : p.inStock > 0
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-red-100 text-red-700'
                          }`}>
                            {p.inStock > 100 ? 'Good' : p.inStock > 0 ? 'Low' : 'Out'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-3 border-t border-slate-100 text-center">
                  <Link href="/inventory" className="text-xs font-medium text-blue-600 hover:underline">View full inventory</Link>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* ════ LOWER ROW: PRODUCT PERFORMANCE & QUICK ACTIONS ════ */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

            {/* Product Performance */}
            <div className="col-span-full xl:col-span-3">
              <ProductPerformanceWidget data={data.productPerformance} />
            </div>

            {/* Quick Actions */}
            <Card className="shadow-sm border-slate-200 flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-1 gap-3 flex-1 content-start">
                <Link href="/orders" className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <ShoppingCart className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700">Create New Order</span>
                </Link>
                <Link href="/customers" className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <Users className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700">View Customers</span>
                </Link>
                <Link href="/quote" className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <CreditCard className="w-4 h-4 text-purple-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700">Generate Quote</span>
                </Link>
                <Link href="/inventory" className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <Package className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700">Check Inventory</span>
                </Link>
              </CardContent>
            </Card>

          </div>

          {/* ════ BOTTOM ALERT BARS ════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="text-sm font-semibold text-amber-900 truncate">
                  {data.pendingOrders > 0
                    ? `${data.pendingOrders} order(s) pending approval`
                    : 'No pending orders'}
                </span>
              </div>
              <Link href="/orders" className="text-xs font-semibold px-3 py-1.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors whitespace-nowrap ml-2 shrink-0">View Orders</Link>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50">
              <div className="flex items-center gap-2 min-w-0">
                <Info className="w-5 h-5 text-blue-600 shrink-0" />
                <span className="text-sm font-semibold text-blue-900 truncate">
                  {lowStockProducts.length > 0
                    ? `Low stock alert for ${lowStockProducts.length} product(s)`
                    : 'All products sufficiently stocked'}
                </span>
              </div>
              <Link href="/inventory" className="text-xs font-semibold px-3 py-1.5 rounded bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors whitespace-nowrap ml-2 shrink-0">View Inventory</Link>
            </div>
          </div>

        </div>
      )}
    </DashboardShell>
  );
}
