'use client';

import { useMemo } from 'react';
import { Clock, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SLATaskType = 'payment' | 'dispatch' | 'delivery' | 'return' | 'correction';

export type SLAStatus = 'normal' | 'attention' | 'warning' | 'breached';

export const SLA_LIMITS_HOURS: Record<SLATaskType, number> = {
  payment: 2,
  dispatch: 4,
  delivery: 24,
  return: 12,
  correction: 12,
};

interface SLATimerProps {
  taskType: SLATaskType;
  startedAt: string | number | Date;
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}

export function computeSLAStatus(taskType: SLATaskType, startedAt: string | number | Date): {
  status: SLAStatus;
  elapsedHours: number;
  remainingMinutes: number;
  formattedElapsed: string;
  isBreached: boolean;
  limitHours: number;
} {
  const limitHours = SLA_LIMITS_HOURS[taskType] || 4;
  const startMs = new Date(startedAt).getTime();
  const nowMs = Date.now();
  const diffMs = Math.max(0, nowMs - startMs);
  const elapsedMinutes = Math.floor(diffMs / (1000 * 60));
  const elapsedHours = elapsedMinutes / 60;
  const limitMinutes = limitHours * 60;
  const remainingMinutes = limitMinutes - elapsedMinutes;

  const hours = Math.floor(elapsedMinutes / 60);
  const mins = elapsedMinutes % 60;
  const formattedElapsed = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  let status: SLAStatus = 'normal';
  if (elapsedMinutes > limitMinutes) {
    status = 'breached';
  } else if (elapsedMinutes >= limitMinutes * 0.8) {
    status = 'warning';
  } else if (elapsedMinutes >= limitMinutes * 0.5) {
    status = 'attention';
  }

  return {
    status,
    elapsedHours,
    remainingMinutes,
    formattedElapsed,
    isBreached: status === 'breached',
    limitHours,
  };
}

export function SLATimer({
  taskType,
  startedAt,
  className,
  showIcon = true,
  compact = false,
}: SLATimerProps) {
  const { status, formattedElapsed, isBreached, limitHours } = useMemo(
    () => computeSLAStatus(taskType, startedAt),
    [taskType, startedAt]
  );

  const statusStyles: Record<
    SLAStatus,
    {
      bg: string;
      text: string;
      border: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
    }
  > = {
    normal: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
      label: 'On Track',
      icon: CheckCircle2,
    },
    attention: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      label: 'Attention',
      icon: Clock,
    },
    warning: {
      bg: 'bg-orange-50 dark:bg-orange-950/40',
      text: 'text-orange-700 dark:text-orange-300',
      border: 'border-orange-200 dark:border-orange-800',
      label: 'Near SLA',
      icon: AlertTriangle,
    },
    breached: {
      bg: 'bg-red-50 dark:bg-red-950/50',
      text: 'text-red-700 dark:text-red-300',
      border: 'border-red-200 dark:border-red-800',
      label: 'Escalated / Breached',
      icon: AlertCircle,
    },
  };

  const current = statusStyles[status];
  const Icon = current.icon;

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold border',
          current.bg,
          current.text,
          current.border,
          isBreached && 'animate-pulse',
          className
        )}
        title={`Waiting ${formattedElapsed} (SLA target: ${limitHours}h)`}
      >
        {showIcon && <Icon className="h-3 w-3 shrink-0" />}
        <span>{formattedElapsed}</span>
      </span>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs border transition-colors',
        current.bg,
        current.text,
        current.border,
        isBreached && 'animate-pulse ring-1 ring-red-500/50',
        className
      )}
    >
      {showIcon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      <span className="font-mono font-bold">{formattedElapsed}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
        • {current.label} ({limitHours}h SLA)
      </span>
    </div>
  );
}
