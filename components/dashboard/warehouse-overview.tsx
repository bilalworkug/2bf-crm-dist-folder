'use client';
import { WarehouseOverviewItem } from '@/lib/dashboard/dashboard-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Warehouse, Package, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { DashboardEmptyState } from './dashboard-empty-state';

export function WarehouseOverviewWidget({ warehouses }: { warehouses: WarehouseOverviewItem[] }) {
  return (
    <Card className="col-span-full shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-bold flex items-center">
          <Warehouse className="w-6 h-6 mr-2 text-indigo-500" />
          Warehouse Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {warehouses.length === 0 ? (
          <DashboardEmptyState
            title="No warehouses"
            description="No warehouse data available."
            icon={<Warehouse className="h-8 w-8" />}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouses.map((w) => (
              <div key={w.warehouseId} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{w.warehouseName}</h3>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    w.status === 'good' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    w.status === 'attention' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                    'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                  }`}>
                    {w.status.toUpperCase()}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                      <Package className="w-4 h-4 mr-2" /> Available Stock
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{w.availableStock.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                      <ArrowDownToLine className="w-4 h-4 mr-2 text-emerald-500" /> Received Today
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{w.receivedToday.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                      <ArrowUpFromLine className="w-4 h-4 mr-2 text-amber-500" /> Dispatched Today
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{w.dispatchedToday.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
