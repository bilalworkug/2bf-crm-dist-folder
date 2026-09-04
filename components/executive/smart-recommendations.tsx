'use client';

import { SmartRecommendation } from '@/lib/executive-intelligence/executive-types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles, AlertTriangle, AlertCircle, Info, CheckCircle2,
  ArrowRight, TrendingUp, Users, Package, DollarSign, Clock
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SmartRecommendationsProps {
  recommendations: SmartRecommendation[];
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'critical':
      return {
        label: 'Immediate Action',
        className: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
        icon: AlertTriangle,
      };
    case 'high':
      return {
        label: 'High Priority',
        className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        icon: AlertCircle,
      };
    case 'medium':
      return {
        label: 'Operational Watch',
        className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        icon: Clock,
      };
    default:
      return {
        label: 'Opportunity',
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        icon: TrendingUp,
      };
  }
}

function getCategoryIcon(cat: string) {
  switch (cat) {
    case 'customer':
      return Users;
    case 'product':
      return Package;
    case 'finance':
      return DollarSign;
    case 'sales':
      return TrendingUp;
    default:
      return Sparkles;
  }
}

export function SmartRecommendations({ recommendations }: SmartRecommendationsProps) {
  return (
    <Card className="border-border/80 bg-card shadow-xs">
      <CardHeader className="p-4 border-b border-border/80 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Executive Smart Recommendations Engine
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Factual commercial, credit, and production recommendations calculated from live ERP records.
          </CardDescription>
        </div>
        <Badge variant="secondary" className="text-xs font-semibold">
          {recommendations.length} Active Insights
        </Badge>
      </CardHeader>

      <CardContent className="p-4">
        {recommendations.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-foreground text-sm">All Systems Balanced</p>
            <p className="mt-1">No critical bottlenecks, stockouts, or overdue thresholds detected for this period.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recommendations.map((rec) => {
              const priorityInfo = getPriorityBadge(rec.priority);
              const PriorityIcon = priorityInfo.icon;
              const CatIcon = getCategoryIcon(rec.category);

              return (
                <div
                  key={rec.id}
                  className="flex flex-col justify-between p-3.5 rounded-xl border border-border/80 bg-muted/20 hover:border-primary/50 transition-all shadow-2xs"
                >
                  <div>
                    {/* Priority & Category Header */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className={cn(
                        'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border',
                        priorityInfo.className
                      )}>
                        <PriorityIcon className="w-3 h-3" />
                        {priorityInfo.label}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                        {rec.category}
                      </span>
                    </div>

                    {/* Recommendation Title */}
                    <h4 className="text-xs font-bold text-foreground mb-1 flex items-center gap-1.5">
                      <CatIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{rec.title}</span>
                    </h4>

                    {/* Factual Recommendation Message */}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {rec.message}
                    </p>
                  </div>

                  {/* Supporting Metrics & Action Button */}
                  <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2">
                    <div className="truncate">
                      <span className="text-[10px] text-muted-foreground block truncate">
                        {rec.supportingValue}
                      </span>
                      <strong className="text-xs font-extrabold text-foreground truncate block">
                        {rec.metric}
                      </strong>
                    </div>

                    <Button size="sm" variant="outline" asChild className="h-7 px-2.5 text-xs font-semibold gap-1 bg-card shrink-0">
                      <Link href={rec.actionUrl}>
                        <span>{rec.actionLabel}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
