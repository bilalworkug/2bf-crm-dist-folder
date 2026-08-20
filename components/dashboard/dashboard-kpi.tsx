'use client';

import { KPIValue } from '@/lib/dashboard/dashboard-types';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface DashboardKPIProps {
  kpi: KPIValue;
  icon?: React.ReactNode;
  iconBgClass?: string;
  onClick?: () => void;
  className?: string;
}

export function DashboardKPI({ kpi, icon, iconBgClass, onClick, className }: DashboardKPIProps) {
  const isPositive = kpi.trend !== undefined && kpi.trend > 0;
  const isNegative = kpi.trend !== undefined && kpi.trend < 0;
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const trendColor = isPositive ? 'text-emerald-500' : isNegative ? 'text-rose-500' : 'text-slate-400';

  const sparklineData = kpi.sparkline?.map((val, i) => ({ index: i, value: val }));
  
  let statusBorder = 'border-slate-200 dark:border-slate-800';
  let statusBg = 'bg-white dark:bg-slate-900';
  if (kpi.status === 'warning') {
    statusBorder = 'border-amber-300 dark:border-amber-700/50';
    statusBg = 'bg-amber-50/50 dark:bg-amber-950/10';
  } else if (kpi.status === 'critical') {
    statusBorder = 'border-rose-300 dark:border-rose-700/50';
    statusBg = 'bg-rose-50/50 dark:bg-rose-950/10';
  } else if (kpi.status === 'success') {
    statusBorder = 'border-emerald-300 dark:border-emerald-700/50';
  }

  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all duration-200 shadow-sm", 
        statusBorder,
        statusBg,
        onClick ? "cursor-pointer hover:shadow-md hover:border-primary/50" : "",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-5 flex flex-col justify-between h-full relative z-10">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
            <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {kpi.value}
            </p>
          </div>
          {icon && (
            <div className={cn("p-2.5 rounded-xl shadow-sm border", iconBgClass || "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500")}>
              {icon}
            </div>
          )}
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center text-xs">
            {kpi.trend !== undefined && (
              <span className={cn("flex items-center font-semibold mr-2", trendColor)}>
                <TrendIcon className="w-3.5 h-3.5 mr-1" strokeWidth={3} />
                {Math.abs(kpi.trend).toFixed(1)}%
              </span>
            )}
            <span className="text-slate-500 dark:text-slate-400 truncate max-w-[150px]" title={kpi.description}>
              {kpi.description}
            </span>
          </div>
          {sparklineData && sparklineData.length > 0 && (
            <div className="w-16 h-8 opacity-80">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineData}>
                    <Area type="monotone" dataKey="value" stroke={isPositive ? '#10b981' : isNegative ? '#f43f5e' : '#64748b'} fill={isPositive ? '#10b981' : isNegative ? '#f43f5e' : '#64748b'} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
