'use client';
import { Button } from '@/components/ui/button';
import { DashboardFilters, DateRange } from '@/lib/dashboard/dashboard-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export function DashboardFilterBar({
  filters,
  onChange,
  onApply
}: {
  filters: DashboardFilters;
  onChange: (f: Partial<DashboardFilters>) => void;
  onApply: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 py-4 bg-white dark:bg-slate-900 px-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Period:</span>
        <Select 
          value={filters.dateRange} 
          onValueChange={(v) => onChange({ dateRange: v as DateRange })}
        >
          <SelectTrigger className="w-[180px] h-10 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
            <SelectValue placeholder="Select Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filters.dateRange === 'custom' && (
        <div className="flex flex-wrap items-center gap-3">
          <Input 
            type="date" 
            className="h-10 w-[150px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            value={filters.customStartDate || ''} 
            onChange={(e) => onChange({ customStartDate: e.target.value })} 
          />
          <span className="text-sm text-slate-500">to</span>
          <Input 
            type="date" 
            className="h-10 w-[150px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            value={filters.customEndDate || ''} 
            onChange={(e) => onChange({ customEndDate: e.target.value })} 
          />
        </div>
      )}

      <div className="flex items-center gap-3 ml-auto w-full sm:w-auto mt-2 sm:mt-0">
        <Button 
          onClick={() => {
            onChange({ dateRange: 'today', customStartDate: undefined, customEndDate: undefined });
            setTimeout(onApply, 10);
          }} 
          variant="ghost" 
          size="sm" 
          className="h-10 w-full sm:w-auto text-slate-500 hover:text-slate-700"
        >
          Clear
        </Button>
        <Button 
          onClick={onApply} 
          size="sm" 
          className="h-10 w-full sm:w-auto bg-primary hover:bg-primary/90 shadow-sm"
        >
          Apply Filters
        </Button>
      </div>
    </div>
  );
}
