import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO } from 'date-fns';
import { DateRange } from './dashboard-types';

export function getDatesForRange(range: DateRange, customStart?: string, customEnd?: string) {
  const now = new Date();
  
  switch (range) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday':
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'quarter':
      const currentMonth = now.getMonth();
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      const quarterStart = new Date(now.getFullYear(), quarterStartMonth, 1);
      const quarterEnd = endOfMonth(new Date(now.getFullYear(), quarterStartMonth + 2, 1));
      return { start: startOfDay(quarterStart), end: endOfDay(quarterEnd) };
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'custom':
      return { 
        start: customStart ? startOfDay(parseISO(customStart)) : startOfDay(now), 
        end: customEnd ? endOfDay(parseISO(customEnd)) : endOfDay(now) 
      };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

export function formatTrend(trend?: number) {
  if (trend === undefined) return null;
  const sign = trend > 0 ? '+' : '';
  return `${sign}${trend.toFixed(1)}%`;
}

export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}
