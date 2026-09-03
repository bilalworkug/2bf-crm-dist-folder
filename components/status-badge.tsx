import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import {
  Check, Clock, AlertTriangle, XCircle, Truck, Info,
  ShieldCheck, FileCheck, CheckCircle2
} from 'lucide-react';

type Variant = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'purple' | 'neutral';

const VARIANTS: Record<Variant, string> = {
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  destructive: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800',
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800',
  purple: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
  neutral: 'bg-muted text-muted-foreground border border-border/60',
};

function getStatusIcon(status: string) {
  const s = status.toLowerCase();
  if (s === 'completed') {
    return ShieldCheck;
  }
  if (s === 'handed_over') {
    return FileCheck;
  }
  if (['approved', 'paid', 'active', 'received', 'delivered', 'synced'].includes(s)) {
    return Check;
  }
  if (['pending', 'awaiting', 'partial', 'partially_delivered', 'partially_dispatched', 'waiting', 'in_progress'].includes(s)) {
    return Clock;
  }
  if (['damaged', 'expired', 'warning', 'conflict', 'due_soon'].includes(s)) {
    return AlertTriangle;
  }
  if (['cancelled', 'rejected', 'overdue', 'failed', 'inactive'].includes(s)) {
    return XCircle;
  }
  if (['dispatched', 'in_transit'].includes(s)) {
    return Truck;
  }
  return Info;
}

function statusVariant(status: string): Variant {
  const s = status.toLowerCase();
  if (s === 'handed_over') return 'purple';
  if (['completed', 'approved', 'paid', 'active', 'received', 'delivered', 'synced'].includes(s)) return 'success';
  if (['pending', 'awaiting', 'partial', 'partially_delivered', 'partially_dispatched', 'waiting', 'in_progress'].includes(s)) return 'warning';
  if (['cancelled', 'rejected', 'overdue', 'damaged', 'expired', 'failed', 'conflict'].includes(s)) return 'destructive';
  if (['dispatched', 'info', 'in_transit'].includes(s)) return 'info';
  return 'default';
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const variant = statusVariant(status);
  const Icon = getStatusIcon(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold tracking-tight capitalize',
        VARIANTS[variant],
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{status.replace(/_/g, ' ')}</span>
    </span>
  );
}

export function Badge({ children, variant = 'default', className }: { children: ReactNode; variant?: Variant; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold', VARIANTS[variant], className)}>
      {children}
    </span>
  );
}
