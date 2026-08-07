'use client';

import { LucideIcon, ArrowUpRight, ArrowDownRight, Search, Bell, AlertTriangle, Info, CheckCircle2, XCircle, Calendar, Download, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MiniSparkline } from './enterprise-charts';

export const ACCENT_COLORS = {
  primary: 'bg-indigo-600 text-white',
  success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  warning: 'bg-amber-50 text-amber-600 border-amber-100',
  destructive: 'bg-rose-50 text-rose-600 border-rose-100',
  neutral: 'bg-slate-50 text-slate-600 border-slate-100',
  info: 'bg-blue-50 text-blue-600 border-blue-100',
};

// 1. Header (Inspired by Image)
export function EnterpriseWelcomeHeader({ 
  title = "Executive Dashboard",
  breadcrumbs = ["Home", "Executive Dashboard"]
}: { 
  title?: string;
  breadcrumbs?: string[];
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-start justify-between mb-6 gap-4 pt-2">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-gray-900 mb-1.5">
          {title}
        </h1>
        <div className="flex items-center text-[13px] text-gray-500 font-medium">
          {breadcrumbs.map((crumb, idx) => (
            <span key={idx} className="flex items-center">
              <span className={idx === breadcrumbs.length - 1 ? "text-gray-900" : "hover:text-gray-900 cursor-pointer transition-colors"}>
                {crumb}
              </span>
              {idx < breadcrumbs.length - 1 && <span className="mx-2 text-gray-300">&gt;</span>}
            </span>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Button variant="outline" className="h-9 px-4 rounded-lg border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 shadow-sm transition-all duration-200 hover:shadow-md bg-white">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition-all duration-200 hover:shadow-md bg-white">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// 2. Premium KPI Card (Matching Image Aesthetic)
export interface EnterpriseKPICardProps {
  label: string;
  value: string | number;
  trend?: number;
  trendLabel?: string;
  icon?: LucideIcon;
  iconColorClass?: string;
  iconBgClass?: string;
  sparklineData?: number[];
  sparklineColor?: string;
  valueColorClass?: string;
}

export function EnterpriseKPICard({ 
  label, 
  value, 
  trend, 
  trendLabel = "vs Last Year",
  icon: Icon,
  iconColorClass = "text-emerald-500",
  iconBgClass = "bg-emerald-50 border-emerald-100",
  sparklineData = [10, 25, 15, 30, 20, 40, 35],
  sparklineColor = "#10b981",
  valueColorClass = "text-emerald-500",
}: EnterpriseKPICardProps) {
  return (
    <Card className="border border-gray-100 shadow-premium rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-premium-hover bg-white group cursor-pointer">
      <CardContent className="p-5 flex flex-col h-full">
        {/* Top Row: Label & Icon */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border transition-colors duration-300", iconBgClass, iconColorClass)}>
                <Icon className="h-5 w-5" />
              </div>
            )}
            <p className="text-sm font-bold text-gray-800">{label}</p>
          </div>
        </div>
        
        {/* Middle Row: Large Value */}
        <div className="mt-4 mb-4 pl-1">
          <h3 className={cn("text-[32px] font-bold tracking-tight transition-transform duration-300 group-hover:-translate-y-1", valueColorClass)}>
            {value}
          </h3>
        </div>

        {/* Bottom Row: Trend & Sparkline */}
        <div className="mt-auto flex items-end justify-between pl-1">
          <div className="flex items-center gap-1.5 pb-1">
            {typeof trend === 'number' && (
              <div className={cn("flex items-center text-[13px] font-bold", trend >= 0 ? "text-emerald-500" : "text-amber-500")}>
                {trend >= 0 ? '+' : ''}{trend}%
                {trend >= 0 ? <ArrowUpRight className="h-3 w-3 ml-0.5" /> : <ArrowDownRight className="h-3 w-3 ml-0.5" />}
              </div>
            )}
            <span className="text-[11px] text-gray-400 font-medium">{trendLabel}</span>
          </div>
          
          <div className="h-10 w-28 -mr-2">
            <MiniSparkline data={sparklineData} color={sparklineColor} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 3. Quick Actions / Small Stat Cards
export interface QuickAction {
  label: string;
  icon: LucideIcon;
  href: string;
  count?: string | number;
  subtitle?: string;
}

export function EnterpriseQuickActions({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {actions.map((action, i) => (
        <Link 
          key={i} 
          href={action.href}
          className="flex flex-col bg-white rounded-3xl p-5 shadow-sm hover:shadow-md transition-all group border border-transparent hover:border-gray-100"
        >
          <div className="flex justify-between items-start mb-4">
             <div className="h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center">
               <action.icon className="h-4 w-4 text-gray-500" />
             </div>
             <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-50 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
               <ArrowUpRight className="h-3 w-3" />
             </div>
          </div>
          <div>
            <h4 className="text-2xl font-bold text-gray-900">{action.count ?? ''}</h4>
            <div className="flex items-center gap-1.5 mt-1">
               <p className="font-semibold text-sm text-gray-700">{action.label}</p>
            </div>
            {action.subtitle && <p className="text-xs text-gray-400 mt-1">{action.subtitle}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}

// 4. Alerts Panel
export function AlertsPanel({ alerts }: { alerts: { id: string; title: string; type: 'critical' | 'warning' | 'info' | 'success'; message: string }[] }) {
  const TYPE_MAP = {
    critical: { icon: XCircle, color: 'text-rose-600 bg-rose-50 border-rose-100' },
    warning: { icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 border-amber-100' },
    info: { icon: Info, color: 'text-blue-600 bg-blue-50 border-blue-100' },
    success: { icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' }
  };

  return (
    <Card className="h-full border-0 shadow-sm rounded-3xl bg-white overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-gray-900">System Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        {alerts.map(alert => {
          const style = TYPE_MAP[alert.type];
          const Icon = style.icon;
          return (
            <div key={alert.id} className={cn("flex items-start gap-3 p-4 rounded-2xl border", style.color)}>
              <Icon className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{alert.title}</span>
                <span className="text-xs mt-1 opacity-90 leading-relaxed">{alert.message}</span>
              </div>
            </div>
          );
        })}
        {alerts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-3 opacity-50" />
            <p className="text-sm font-medium">All systems operational</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
