import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type Variant = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'neutral';

const VARIANTS: Record<Variant, string> = {
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  destructive: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  neutral: 'bg-muted text-muted-foreground',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const variant = statusVariant(status);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        VARIANTS[variant],
        className
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function Badge({ children, variant = 'default', className }: { children: ReactNode; variant?: Variant; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', VARIANTS[variant], className)}>
      {children}
    </span>
  );
}

function statusVariant(status: string): Variant {
  const s = status.toLowerCase();
  if (['completed', 'approved', 'paid', 'active', 'received'].includes(s)) return 'success';
  if (['pending', 'awaiting', 'partial'].includes(s)) return 'warning';
  if (['cancelled', 'rejected', 'overdue', 'damaged', 'expired'].includes(s)) return 'destructive';
  if (['dispatched', 'info'].includes(s)) return 'info';
  return 'default';
}
