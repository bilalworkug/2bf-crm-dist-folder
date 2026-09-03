'use client';

import { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type KPIAccentColor = 'emerald' | 'blue' | 'amber' | 'cyan' | 'purple' | 'indigo' | 'rose';

interface ExecutiveKPICardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  progress?: {
    percent: number;
    label?: string;
  };
  accent?: KPIAccentColor;
  href?: string;
  className?: string;
}

const ACCENT_STYLES: Record<
  KPIAccentColor,
  {
    iconBg: string;
    iconText: string;
    borderGlow: string;
    progressFill: string;
  }
> = {
  emerald: {
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    iconText: 'text-emerald-500',
    borderGlow: 'hover:border-emerald-500/40',
    progressFill: 'bg-emerald-500',
  },
  blue: {
    iconBg: 'bg-blue-500/10 border-blue-500/20',
    iconText: 'text-blue-500',
    borderGlow: 'hover:border-blue-500/40',
    progressFill: 'bg-blue-500',
  },
  amber: {
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    iconText: 'text-amber-500',
    borderGlow: 'hover:border-amber-500/40',
    progressFill: 'bg-amber-500',
  },
  cyan: {
    iconBg: 'bg-cyan-500/10 border-cyan-500/20',
    iconText: 'text-cyan-500',
    borderGlow: 'hover:border-cyan-500/40',
    progressFill: 'bg-cyan-500',
  },
  purple: {
    iconBg: 'bg-purple-500/10 border-purple-500/20',
    iconText: 'text-purple-500',
    borderGlow: 'hover:border-purple-500/40',
    progressFill: 'bg-purple-500',
  },
  indigo: {
    iconBg: 'bg-indigo-500/10 border-indigo-500/20',
    iconText: 'text-indigo-500',
    borderGlow: 'hover:border-indigo-500/40',
    progressFill: 'bg-indigo-500',
  },
  rose: {
    iconBg: 'bg-rose-500/10 border-rose-500/20',
    iconText: 'text-rose-500',
    borderGlow: 'hover:border-rose-500/40',
    progressFill: 'bg-rose-500',
  },
};

export function ExecutiveKPICard({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  progress,
  accent = 'blue',
  href,
  className,
}: ExecutiveKPICardProps) {
  const styles = ACCENT_STYLES[accent];

  const cardContent = (
    <div
      className={cn(
        'group relative flex flex-col justify-between p-4 rounded-lg border border-border/80 bg-card text-card-foreground shadow-xs transition-all duration-200',
        styles.borderGlow,
        href && 'cursor-pointer hover:shadow-sm hover:-translate-y-0.5',
        className
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
            {title}
          </span>
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
              styles.iconBg,
              styles.iconText
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground">
            {value}
          </span>
          {trend && (
            <span
              className={cn(
                'inline-flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded',
                trend.isPositive
                  ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                  : 'text-rose-600 bg-rose-50 dark:bg-rose-950/40'
              )}
            >
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>

        {subtext && (
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {subtext}
          </p>
        )}
      </div>

      {progress && (
        <div className="mt-3 pt-2.5 border-t border-border/40">
          <div className="flex justify-between items-center text-[10px] text-muted-foreground mb-1">
            <span>{progress.label || 'Progress'}</span>
            <span className="font-mono font-bold text-foreground">
              {Math.min(100, Math.max(0, Math.round(progress.percent)))}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full transition-all duration-500 rounded-full', styles.progressFill)}
              style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{cardContent}</Link>;
  }

  return cardContent;
}
