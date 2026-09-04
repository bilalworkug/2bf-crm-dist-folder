'use client';

import { useState } from 'react';
import { ExecutiveFilters, ExecutiveDatePreset } from '@/lib/executive-intelligence/executive-types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Calendar, RotateCcw, Filter, ChevronDown, ChevronUp,
  Building2, Package, Users, CreditCard, CheckCircle2, X
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

const DATE_PRESETS: { label: string; value: ExecutiveDatePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: 'last_7_days' },
  { label: 'Last 30 Days', value: 'last_30_days' },
  { label: 'Last 3 Months', value: 'last_3_months' },
  { label: 'Last 6 Months', value: 'last_6_months' },
  { label: 'Last 12 Months', value: 'last_12_months' },
  { label: 'Custom', value: 'custom' },
];

export function ExecutiveFilterBar({
  filters,
  onChange,
  filterOptions,
  isLoading = false,
}: ExecutiveFilterBarProps) {
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

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

  const hasActiveFilters =
    filters.warehouseId ||
    filters.productId ||
    filters.customerId ||
    filters.paymentType ||
    filters.orderStatus ||
    filters.datePreset !== 'last_30_days';

  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/80 shadow-xs mb-6 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3">
      <div className="flex flex-col gap-3">
        {/* Main Bar: Date Preset Tabs + Mobile Toggle + Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-full scrollbar-none">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetChange(preset.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap min-h-[34px]',
                  filters.datePreset === preset.value
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            {/* Mobile Expand / Collapse Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMobileExpanded(!isMobileExpanded)}
              className="md:hidden h-8 text-xs font-medium gap-1.5 border-border/80"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {isMobileExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground gap-1"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            )}
          </div>
        </div>

        {/* Custom Date Inputs if Custom is selected */}
        {filters.datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2.5 p-2.5 bg-muted/20 rounded-lg border border-border/60">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span className="font-semibold">Custom Window:</span>
            </div>
            <Input
              type="date"
              value={filters.customStartDate || ''}
              onChange={(e) => onChange({ ...filters, customStartDate: e.target.value })}
              className="h-8 w-36 text-xs bg-background"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={filters.customEndDate || ''}
              onChange={(e) => onChange({ ...filters, customEndDate: e.target.value })}
              className="h-8 w-36 text-xs bg-background"
            />
          </div>
        )}

        {/* Dimension Filters: Desktop always shown, Mobile collapsible */}
        <div className={cn(
          'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1 border-t border-border/40',
          isMobileExpanded ? 'grid' : 'hidden md:grid'
        )}>
          {/* Warehouse Selector */}
          <div>
            <Select
              value={filters.warehouseId || 'all'}
              onValueChange={(val) => onChange({ ...filters, warehouseId: val === 'all' ? undefined : val })}
            >
              <SelectTrigger className="h-8 text-xs bg-card border-border/80">
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
          </div>

          {/* Product Selector */}
          <div>
            <Select
              value={filters.productId || 'all'}
              onValueChange={(val) => onChange({ ...filters, productId: val === 'all' ? undefined : val })}
            >
              <SelectTrigger className="h-8 text-xs bg-card border-border/80">
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
          </div>

          {/* Customer Selector */}
          <div>
            <Select
              value={filters.customerId || 'all'}
              onValueChange={(val) => onChange({ ...filters, customerId: val === 'all' ? undefined : val })}
            >
              <SelectTrigger className="h-8 text-xs bg-card border-border/80">
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
          </div>

          {/* Payment Type */}
          <div>
            <Select
              value={filters.paymentType || 'all'}
              onValueChange={(val) => onChange({ ...filters, paymentType: val === 'all' ? undefined : val })}
            >
              <SelectTrigger className="h-8 text-xs bg-card border-border/80">
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
          </div>

          {/* Order Status */}
          <div>
            <Select
              value={filters.orderStatus || 'all'}
              onValueChange={(val) => onChange({ ...filters, orderStatus: val === 'all' ? undefined : val })}
            >
              <SelectTrigger className="h-8 text-xs bg-card border-border/80">
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
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] font-medium text-muted-foreground mr-1">Active Scope:</span>
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
