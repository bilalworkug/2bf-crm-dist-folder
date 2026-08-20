'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { X, Calendar as CalendarIcon } from 'lucide-react';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, format } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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
  disabled?: boolean;
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
  statuses = [],
  disabled = false
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

  const handleDatePreset = (preset: string) => {
    const today = new Date();
    let from = today;
    let to = today;

    switch (preset) {
      case 'today':
        break;
      case 'yesterday':
        from = subDays(today, 1);
        to = subDays(today, 1);
        break;
      case 'this_week':
        from = startOfWeek(today, { weekStartsOn: 1 });
        to = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case 'last_week':
        const lastWeek = subDays(today, 7);
        from = startOfWeek(lastWeek, { weekStartsOn: 1 });
        to = endOfWeek(lastWeek, { weekStartsOn: 1 });
        break;
      case 'this_month':
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case 'last_month':
        const lastMonth = startOfMonth(subDays(startOfMonth(today), 1));
        from = startOfMonth(lastMonth);
        to = endOfMonth(lastMonth);
        break;
      case 'this_quarter':
        from = startOfQuarter(today);
        to = endOfQuarter(today);
        break;
      case 'this_year':
        from = startOfYear(today);
        to = endOfYear(today);
        break;
    }

    setFilters({
      ...filters,
      dateFrom: format(from, 'yyyy-MM-dd'),
      dateTo: format(to, 'yyyy-MM-dd')
    });
  };

  const hasFilters = filters.dateFrom || filters.dateTo || filters.warehouseId !== 'all' || filters.productId !== 'all' || filters.customerId !== 'all' || filters.status !== 'all';

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end flex-wrap mb-6 no-print">
      {showDate && (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Date Range</label>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[40px] px-0" disabled={disabled}>
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleDatePreset('today')}>Today</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDatePreset('yesterday')}>Yesterday</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDatePreset('this_week')}>This Week</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDatePreset('last_week')}>Last Week</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDatePreset('this_month')}>This Month</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDatePreset('last_month')}>Last Month</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDatePreset('this_quarter')}>This Quarter</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDatePreset('this_year')}>This Year</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Input type="date" value={filters.dateFrom} onChange={(e) => update('dateFrom', e.target.value)} className="w-full lg:w-36" disabled={disabled} />
              <span className="text-muted-foreground">-</span>
              <Input type="date" value={filters.dateTo} onChange={(e) => update('dateTo', e.target.value)} className="w-full lg:w-36" disabled={disabled} />
            </div>
          </div>
        </>
      )}
      
      {showWarehouse && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Warehouse</label>
          <Select value={filters.warehouseId} onValueChange={(v) => update('warehouseId', v)} disabled={disabled}>
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
          <Select value={filters.productId} onValueChange={(v) => update('productId', v)} disabled={disabled}>
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
          <Select value={filters.customerId} onValueChange={(v) => update('customerId', v)} disabled={disabled}>
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
          <Select value={filters.status} onValueChange={(v) => update('status', v)} disabled={disabled}>
            <SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasFilters && (
        <Button variant="ghost" onClick={clear} className="shrink-0 mb-[1px]" disabled={disabled}>
          <X className="mr-1.5 h-4 w-4" /> Clear
        </Button>
      )}
    </div>
  );
}
