'use client';

import { useState } from 'react';
import { ExecutiveFilters, ExecutiveDatePreset } from '@/lib/executive-intelligence/executive-types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Calendar, RotateCcw, Filter, ChevronDown, ChevronUp,
  Building2, Package, Users, CreditCard, CheckCircle2, X, SlidersHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecutiveFilterBarProps {
  filters: ExecutiveFilters;
  onChange: (updated: ExecutiveFilters) => void;
  filterOptions: {
    warehouses: { id: string; name: string }[];
    products: { id: string; name: string }[];
    customers: { id: string; name: string }[];
    paymentTypes: string[];
    orderStatuses: string[];
  };
  isLoading?: boolean;
}

const PRIMARY_PRESETS: { label: string; value: ExecutiveDatePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: '7 Days', value: 'last_7_days' },
  { label: '30 Days', value: 'last_30_days' },
  { label: '6 Months', value: 'last_6_months' },
  { label: '12 Months', value: 'last_12_months' },
];

export function ExecutiveFilterBar({
  filters,
  onChange,
  filterOptions,
  isLoading = false,
}: ExecutiveFilterBarProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const handlePresetChange = (preset: ExecutiveDatePreset) => {
    onChange({
      ...filters,
      datePreset: preset,
    });
  };

  const handleReset = () => {
    onChange({
      datePreset: 'last_30_days',
      warehouseId: undefined,
      productId: undefined,
      customerId: undefined,
      paymentType: undefined,
      orderStatus: undefined,
      customStartDate: undefined,
      customEndDate: undefined,
    });
  };

  const activeDimensionsCount = [
    filters.warehouseId,
    filters.productId,
    filters.customerId,
    filters.paymentType,
    filters.orderStatus,
  ].filter(Boolean).length;

  const hasActiveFilters =
    activeDimensionsCount > 0 ||
    filters.datePreset !== 'last_30_days' ||
    filters.customStartDate ||
    filters.customEndDate;

  return (
    <div className="bg-card/80 backdrop-blur-md rounded-xl border border-border/80 p-2.5 sm:p-3 shadow-xs mb-6">
      <div className="flex flex-col gap-2.5">
        {/* Top Clean Bar: Presets + Dimension Filter Toggle + Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-full scrollbar-none">
            {PRIMARY_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetChange(preset.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap min-h-[32px]',
                  filters.datePreset === preset.value
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {preset.label}
              </button>
            ))}

            {/* Custom / Other presets dropdown */}
            <Select
              value={['today', 'last_7_days', 'last_30_days', 'last_6_months', 'last_12_months'].includes(filters.datePreset) ? '' : filters.datePreset}
              onValueChange={(val) => handlePresetChange(val as ExecutiveDatePreset)}
            >
              <SelectTrigger className={cn(
                'h-8 text-xs font-semibold px-2.5 rounded-lg border-0 bg-muted/40 w-auto gap-1.5',
                !['today', 'last_7_days', 'last_30_days', 'last_6_months', 'last_12_months'].includes(filters.datePreset)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}>
                <Calendar className="w-3.5 h-3.5" />
                <SelectValue placeholder="More Ranges..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                <SelectItem value="custom">Custom Date Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Right Tools: Advanced Filters Toggle & Reset */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={cn(
                'h-8 text-xs font-semibold gap-1.5 border-border/80 transition-all',
                showAdvancedFilters || activeDimensionsCount > 0
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeDimensionsCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                  {activeDimensionsCount}
                </span>
              )}
              {showAdvancedFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground gap-1 px-2"
                title="Reset all filters to default"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            )}
          </div>
        </div>

        {/* Custom Range Picker Drawer */}
        {filters.datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs">
            <span className="text-muted-foreground font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              Custom Range:
            </span>
            <Input
              type="date"
              value={filters.customStartDate || ''}
              onChange={(e) => onChange({ ...filters, customStartDate: e.target.value })}
              className="h-7 w-36 text-xs bg-background"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={filters.customEndDate || ''}
              onChange={(e) => onChange({ ...filters, customEndDate: e.target.value })}
              className="h-7 w-36 text-xs bg-background"
            />
          </div>
        )}

        {/* Advanced Filters Expandable Grid */}
        {showAdvancedFilters && (
          <div className="pt-2.5 border-t border-border/40 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 animate-in fade-in-50 duration-150">
            {/* Warehouse */}
            <Select
              value={filters.warehouseId || 'all'}
              onValueChange={(val) => onChange({ ...filters, warehouseId: val === 'all' ? undefined : val })}
            >
              <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/80">
                <div className="flex items-center gap-1.5 truncate">
                  <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {filters.warehouseId
                      ? filterOptions.warehouses.find(w => w.id === filters.warehouseId)?.name || 'Warehouse'
                      : 'All Warehouses'}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warehouses</SelectItem>
                {filterOptions.warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Product */}
            <Select
              value={filters.productId || 'all'}
              onValueChange={(val) => onChange({ ...filters, productId: val === 'all' ? undefined : val })}
            >
              <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/80">
                <div className="flex items-center gap-1.5 truncate">
                  <Package className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {filters.productId
                      ? filterOptions.products.find(p => p.id === filters.productId)?.name || 'Product'
                      : 'All Products'}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {filterOptions.products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Customer */}
            <Select
              value={filters.customerId || 'all'}
              onValueChange={(val) => onChange({ ...filters, customerId: val === 'all' ? undefined : val })}
            >
              <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/80">
                <div className="flex items-center gap-1.5 truncate">
                  <Users className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {filters.customerId
                      ? filterOptions.customers.find(c => c.id === filters.customerId)?.name || 'Customer'
                      : 'All Customers'}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {filterOptions.customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Payment Type */}
            <Select
              value={filters.paymentType || 'all'}
              onValueChange={(val) => onChange({ ...filters, paymentType: val === 'all' ? undefined : val })}
            >
              <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/80">
                <div className="flex items-center gap-1.5 truncate">
                  <CreditCard className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{filters.paymentType ? filters.paymentType : 'Payment: All'}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Payment: All</SelectItem>
                {filterOptions.paymentTypes.map((pt) => (
                  <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Order Status */}
            <Select
              value={filters.orderStatus || 'all'}
              onValueChange={(val) => onChange({ ...filters, orderStatus: val === 'all' ? undefined : val })}
            >
              <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/80">
                <div className="flex items-center gap-1.5 truncate">
                  <CheckCircle2 className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {filters.orderStatus
                      ? filters.orderStatus.replace('_', ' ').toUpperCase()
                      : 'Status: All'}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: All</SelectItem>
                {filterOptions.orderStatuses.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st.replace('_', ' ').toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Active Filter Chips */}
        {activeDimensionsCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-[11px] font-medium text-muted-foreground">Active:</span>
            {filters.warehouseId && (
              <Badge variant="secondary" className="text-[11px] gap-1 px-2 py-0.5">
                Warehouse: {filterOptions.warehouses.find(w => w.id === filters.warehouseId)?.name}
                <X className="w-3 h-3 cursor-pointer" onClick={() => onChange({ ...filters, warehouseId: undefined })} />
              </Badge>
            )}
            {filters.productId && (
              <Badge variant="secondary" className="text-[11px] gap-1 px-2 py-0.5">
                Product: {filterOptions.products.find(p => p.id === filters.productId)?.name}
                <X className="w-3 h-3 cursor-pointer" onClick={() => onChange({ ...filters, productId: undefined })} />
              </Badge>
            )}
            {filters.customerId && (
              <Badge variant="secondary" className="text-[11px] gap-1 px-2 py-0.5">
                Customer: {filterOptions.customers.find(c => c.id === filters.customerId)?.name}
                <X className="w-3 h-3 cursor-pointer" onClick={() => onChange({ ...filters, customerId: undefined })} />
              </Badge>
            )}
            {filters.paymentType && (
              <Badge variant="secondary" className="text-[11px] gap-1 px-2 py-0.5">
                Payment: {filters.paymentType}
                <X className="w-3 h-3 cursor-pointer" onClick={() => onChange({ ...filters, paymentType: undefined })} />
              </Badge>
            )}
            {filters.orderStatus && (
              <Badge variant="secondary" className="text-[11px] gap-1 px-2 py-0.5">
                Status: {filters.orderStatus.replace('_', ' ')}
                <X className="w-3 h-3 cursor-pointer" onClick={() => onChange({ ...filters, orderStatus: undefined })} />
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
