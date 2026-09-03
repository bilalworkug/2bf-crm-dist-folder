'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Calendar, Filter, X, ChevronDown, ChevronUp,
  Building2, Package, Users, DollarSign, RotateCcw
} from 'lucide-react';
import {
  format, subDays, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear
} from 'date-fns';
import { cn } from '@/lib/utils';

export interface UniversalFilterState {
  dateFrom: string;
  dateTo: string;
  warehouseId: string;
  productId: string;
  customerId: string;
  paymentType: string;
  status: string;
}

export const INITIAL_FILTERS: UniversalFilterState = {
  dateFrom: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
  dateTo: format(new Date(), 'yyyy-MM-dd'),
  warehouseId: 'all',
  productId: 'all',
  customerId: 'all',
  paymentType: 'all',
  status: 'all',
};

interface ReportFilterBarProps {
  filters: UniversalFilterState;
  setFilters: (filters: UniversalFilterState) => void;
  warehouses?: { id: string; code: string }[];
  products?: { id: string; name: string }[];
  customers?: { id: string; customer_name: string }[];
  showPaymentType?: boolean;
  showStatus?: boolean;
  className?: string;
}

export function ReportFilterBar({
  filters,
  setFilters,
  warehouses = [],
  products = [],
  customers = [],
  showPaymentType = true,
  showStatus = true,
  className,
}: ReportFilterBarProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const update = (key: keyof UniversalFilterState, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const applyPreset = (preset: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all') => {
    const today = new Date();
    let from = today;
    let to = today;

    if (preset === 'today') {
      from = today;
      to = today;
    } else if (preset === 'week') {
      from = startOfWeek(today, { weekStartsOn: 1 });
      to = endOfWeek(today, { weekStartsOn: 1 });
    } else if (preset === 'month') {
      from = startOfMonth(today);
      to = endOfMonth(today);
    } else if (preset === 'year') {
      from = startOfYear(today);
      to = endOfYear(today);
    } else if (preset === 'all') {
      from = new Date(2025, 0, 1);
      to = today;
    }

    setFilters({
      ...filters,
      dateFrom: format(from, 'yyyy-MM-dd'),
      dateTo: format(to, 'yyyy-MM-dd'),
    });
  };

  const hasActiveFilters =
    filters.warehouseId !== 'all' ||
    filters.productId !== 'all' ||
    filters.customerId !== 'all' ||
    filters.paymentType !== 'all' ||
    filters.status !== 'all';

  return (
    <div
      className={cn(
        'sticky top-16 z-20 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md p-3 sm:p-4 shadow-sm space-y-3 no-print',
        className
      )}
    >
      {/* Header with Quick Presets & Mobile Toggle */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-0.5">
          <span className="text-muted-foreground font-semibold flex items-center gap-1 mr-1">
            <Calendar className="h-3.5 w-3.5" /> Date:
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset('today')}
            className="h-7 px-2.5 text-xs touch-press"
          >
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset('week')}
            className="h-7 px-2.5 text-xs touch-press"
          >
            This Week
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset('month')}
            className="h-7 px-2.5 text-xs touch-press"
          >
            This Month
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset('year')}
            className="h-7 px-2.5 text-xs touch-press"
          >
            This Year
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground touch-press"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Reset
            </Button>
          )}

          {/* Mobile Collapse Toggle */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMobileExpanded(!mobileExpanded)}
            className="sm:hidden h-7 text-xs flex items-center gap-1"
          >
            <Filter className="h-3 w-3" />
            Filters
            {mobileExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Filter Inputs Grid */}
      <div
        className={cn(
          'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1',
          !mobileExpanded && 'hidden sm:grid'
        )}
      >
        {/* Date From */}
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground font-semibold">From Date</Label>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => update('dateFrom', e.target.value)}
            className="h-9 text-xs"
          />
        </div>

        {/* Date To */}
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground font-semibold">To Date</Label>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => update('dateTo', e.target.value)}
            className="h-9 text-xs"
          />
        </div>

        {/* Warehouse */}
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground font-semibold">Warehouse</Label>
          <Select value={filters.warehouseId} onValueChange={(v) => update('warehouseId', v)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Product */}
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground font-semibold">Product</Label>
          <Select value={filters.productId} onValueChange={(v) => update('productId', v)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Customer */}
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground font-semibold">Customer</Label>
          <Select value={filters.customerId} onValueChange={(v) => update('customerId', v)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.customer_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Payment Type */}
        {showPaymentType && (
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground font-semibold">Payment Terms</Label>
            <Select value={filters.paymentType} onValueChange={(v) => update('paymentType', v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Terms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terms</SelectItem>
                <SelectItem value="pay_now">Pay Now</SelectItem>
                <SelectItem value="credit">Credit Account</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
