'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  warehouseId: string;
  productId: string;
  customerId: string;
  status: string;
}

interface ReportFiltersProps {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  showDate?: boolean;
  showWarehouse?: boolean;
  showProduct?: boolean;
  showCustomer?: boolean;
  showStatus?: boolean;
  warehouses?: any[];
  products?: any[];
  customers?: any[];
  statuses?: string[];
}

export function ReportFilters({
  filters,
  setFilters,
  showDate,
  showWarehouse,
  showProduct,
  showCustomer,
  showStatus,
  warehouses = [],
  products = [],
  customers = [],
  statuses = []
}: ReportFiltersProps) {

  const update = (key: keyof FilterState, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const clear = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      warehouseId: 'all',
      productId: 'all',
      customerId: 'all',
      status: 'all'
    });
  };

  const hasFilters = filters.dateFrom || filters.dateTo || filters.warehouseId !== 'all' || filters.productId !== 'all' || filters.customerId !== 'all' || filters.status !== 'all';

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end flex-wrap mb-6">
      {showDate && (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">From date</label>
            <Input type="date" value={filters.dateFrom} onChange={(e) => update('dateFrom', e.target.value)} className="w-full lg:w-44" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">To date</label>
            <Input type="date" value={filters.dateTo} onChange={(e) => update('dateTo', e.target.value)} className="w-full lg:w-44" />
          </div>
        </>
      )}
      
      {showWarehouse && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Warehouse</label>
          <Select value={filters.warehouseId} onValueChange={(v) => update('warehouseId', v)}>
            <SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All warehouses</SelectItem>
              {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.code}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {showProduct && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Product</label>
          <Select value={filters.productId} onValueChange={(v) => update('productId', v)}>
            <SelectTrigger className="w-full lg:w-48"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {showCustomer && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Customer</label>
          <Select value={filters.customerId} onValueChange={(v) => update('customerId', v)}>
            <SelectTrigger className="w-full lg:w-48"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.customer_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {showStatus && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={filters.status} onValueChange={(v) => update('status', v)}>
            <SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasFilters && (
        <Button variant="ghost" onClick={clear} className="shrink-0 mb-[1px]">
          <X className="mr-1.5 h-4 w-4" /> Clear
        </Button>
      )}
    </div>
  );
}
