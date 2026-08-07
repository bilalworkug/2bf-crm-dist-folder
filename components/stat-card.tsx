import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  trend?: number;
  accent?: 'primary' | 'success' | 'warning' | 'destructive' | 'neutral';
}

const ACCENTS: Record<NonNullable<StatCardProps['accent']>, string> = {
  primary: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  destructive: 'bg-red-500/10 text-red-600 dark:text-red-400',
  neutral: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
};

export function StatCard({ label, value, icon: Icon, hint, trend, accent = 'primary' }: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          {Icon && (
            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', ACCENTS[accent])}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
        {typeof trend === 'number' && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            {trend >= 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
            )}
            <span className={trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
              {Math.abs(trend)}%
            </span>
            <span className="text-muted-foreground">vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
