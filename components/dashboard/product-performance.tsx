'use client';
import { ProductPerformanceRow } from '@/lib/dashboard/dashboard-types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Search, Package } from 'lucide-react';
import { useState } from 'react';
import { DashboardEmptyState } from './dashboard-empty-state';

export function ProductPerformanceWidget({ data }: { data: ProductPerformanceRow[] }) {
  const [search, setSearch] = useState('');

  const filtered = data.filter(p => p.productName.toLowerCase().includes(search.toLowerCase()));
  
  const totals = filtered.reduce((acc, curr) => ({
    produced: acc.produced + curr.produced,
    inStock: acc.inStock + curr.inStock,
    allocated: acc.allocated + curr.allocated,
    dispatched: acc.dispatched + curr.dispatched,
    delivered: acc.delivered + curr.delivered,
    returned: acc.returned + curr.returned,
  }), { produced: 0, inStock: 0, allocated: 0, dispatched: 0, delivered: 0, returned: 0 });

  return (
    <Card className="col-span-full shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold">Product Performance</CardTitle>
          <CardDescription>Overview of all products across the factory lifecycle</CardDescription>
        </div>
        <div className="relative w-full sm:w-72 mt-4 sm:mt-0">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="search"
            placeholder="Search products..."
            className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <DashboardEmptyState
            title="No product data"
            description="No product activity found for the selected period."
            icon={<Package className="h-8 w-8" />}
          />
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900/80">
                <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                  <TableHead className="font-semibold text-slate-900 dark:text-slate-100 py-4">Product</TableHead>
                  <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-100">Produced (units)</TableHead>
                  <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-100">In Stock (units)</TableHead>
                  <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-100">Allocated (units)</TableHead>
                  <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-100">Dispatched (units)</TableHead>
                  <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-100">Delivered (units)</TableHead>
                  <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-100">Returned (units)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.productName} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 border-slate-200 dark:border-slate-800 transition-colors">
                    <TableCell className="font-medium py-3">{item.productName}</TableCell>
                    <TableCell className="text-right">{item.produced.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.inStock.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.allocated.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.dispatched.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.delivered.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.returned.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {filtered.length > 0 && (
                  <TableRow className="bg-slate-50 dark:bg-slate-900 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-800">
                    <TableCell className="py-4 text-slate-900 dark:text-white">TOTAL ({filtered.length} types)</TableCell>
                    <TableCell className="text-right text-slate-900 dark:text-white">{totals.produced.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-slate-900 dark:text-white">{totals.inStock.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-slate-900 dark:text-white">{totals.allocated.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-slate-900 dark:text-white">{totals.dispatched.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-slate-900 dark:text-white">{totals.delivered.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-slate-900 dark:text-white">{totals.returned.toLocaleString()}</TableCell>
                  </TableRow>
                )}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-32 text-slate-500">
                      No products found matching "{search}"
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
