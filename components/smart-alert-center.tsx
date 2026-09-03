'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, AlertCircle, CheckCircle2, Info, ArrowRight,
  RefreshCw, ShieldAlert, Sparkles, ExternalLink
} from 'lucide-react';
import { fetchExecutiveInsights, type ExecutiveAlert, type AlertPriority } from '@/lib/executive-insights';
import { cn } from '@/lib/utils';

const PRIORITY_STYLES: Record<
  AlertPriority,
  {
    cardBg: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
  }
> = {
  critical: {
    cardBg: 'bg-red-50/50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-900/50',
    badgeBg: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200',
    badgeText: 'Critical',
    icon: AlertCircle,
    iconColor: 'text-red-600 dark:text-red-400',
  },
  warning: {
    cardBg: 'bg-amber-50/50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-900/50',
    badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
    badgeText: 'Warning',
    icon: AlertTriangle,
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    cardBg: 'bg-sky-50/50 dark:bg-sky-950/20',
    border: 'border-sky-200 dark:border-sky-900/50',
    badgeBg: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
    badgeText: 'Info',
    icon: Info,
    iconColor: 'text-sky-600 dark:text-sky-400',
  },
  success: {
    cardBg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-900/50',
    badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
    badgeText: 'Target Achieved',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
};

export function SmartAlertCenter() {
  const [alerts, setAlerts] = useState<ExecutiveAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  async function loadAlerts() {
    setLoading(true);
    const { alerts: data } = await fetchExecutiveInsights();
    setAlerts(data);
    setLoading(false);
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  if (!loading && alerts.length === 0) {
    return null; // All clear!
  }

  const criticalCount = alerts.filter(a => a.priority === 'critical').length;
  const topAlert = alerts[0];

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/15 overflow-hidden transition-all shadow-2xs">
      {/* Compact Alert Bar */}
      <div className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono">
                {alerts.length} Factory Alerts
              </span>
              {topAlert && (
                <span className="text-xs font-semibold text-foreground truncate">
                  {topAlert.title}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {topAlert && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-7 text-xs font-semibold bg-background hover:bg-muted border-border/80"
            >
              <Link href={topAlert.actionUrl}>
                {topAlert.actionLabel}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          )}

          {alerts.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
            >
              {expanded ? 'Collapse' : `View All (${alerts.length})`}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={loadAlerts}
            disabled={loading}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Refresh alerts"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Expanded Alert List */}
      {expanded && (
        <div className="p-3 pt-0 space-y-2 border-t border-border/40 mt-1">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          alerts.map((alert) => {
            const config = PRIORITY_STYLES[alert.priority];
            const Icon = config.icon;

            return (
              <div
                key={alert.id}
                className={cn(
                  'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all',
                  config.cardBg,
                  config.border
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={cn('p-1.5 rounded-lg shrink-0 mt-0.5', config.badgeBg)}>
                    <Icon className={cn('h-4 w-4', config.iconColor)} />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', config.badgeBg)}>
                        {config.badgeText}
                      </span>
                      <h4 className="text-sm font-semibold text-foreground truncate">
                        {alert.title}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {alert.description}
                    </p>
                    {alert.metric && (
                      <p className="text-xs font-mono font-semibold text-foreground mt-1">
                        Metric: <span className="text-primary">{alert.metric}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto h-9 text-xs font-semibold touch-press border-border/80 bg-background/80 hover:bg-background"
                  >
                    <Link href={alert.actionUrl}>
                      {alert.actionLabel}
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })
        )}
        </div>
      )}
    </div>
  );
}
