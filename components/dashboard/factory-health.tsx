'use client';
import { FactoryHealthStatus } from '@/lib/dashboard/dashboard-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, Activity } from 'lucide-react';

const StatusIndicator = ({ status, label }: { status: string; label: string }) => {
  let Icon = HelpCircle;
  let color = 'text-slate-400';
  
  if (status === 'good') {
    Icon = CheckCircle2;
    color = 'text-emerald-500';
  } else if (status === 'attention') {
    Icon = AlertTriangle;
    color = 'text-amber-500';
  } else if (status === 'issue') {
    Icon = AlertCircle;
    color = 'text-rose-500';
  }

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">{label}</span>
      <div className="flex items-center">
        <span className={`text-sm font-medium mr-2 capitalize ${color}`}>{status}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
    </div>
  );
};

export function FactoryHealthWidget({ health }: { health: FactoryHealthStatus }) {
  return (
    <Card className="h-full shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold flex items-center">
          <Activity className="w-5 h-5 mr-2 text-primary" />
          Factory Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-1">
          <StatusIndicator status={health.production} label="Production" />
          <StatusIndicator status={health.warehouse} label="Warehouse" />
          <StatusIndicator status={health.sales} label="Orders" />
          <StatusIndicator status={health.dispatch} label="Dispatch" />
          <StatusIndicator status={health.delivery} label="Delivery" />
          <StatusIndicator status={health.returns} label="Returns" />
        </div>
      </CardContent>
    </Card>
  );
}
