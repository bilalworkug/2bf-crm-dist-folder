'use client';
import { ActionRequiredItem } from '@/lib/dashboard/dashboard-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, AlertTriangle, Info, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function ActionRequiredWidget({ items }: { items: ActionRequiredItem[] }) {
  return (
    <Card className="h-full shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 text-rose-500" />
          Action Required
          {items.length > 0 && (
            <span className="ml-2 bg-rose-100 text-rose-700 text-xs py-0.5 px-2 rounded-full font-medium">
              {items.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-slate-900 dark:text-slate-100 font-medium">Everything is up to date.</p>
            <p className="text-sm text-slate-500 mt-1">No pending actions required.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div 
                key={item.id} 
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  item.severity === 'critical' ? 'bg-rose-50/50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/50' :
                  item.severity === 'warning' ? 'bg-amber-50/50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/50' :
                  'bg-blue-50/50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/50'
                }`}
              >
                <div className="flex items-center">
                  {item.severity === 'critical' && <AlertCircle className="w-5 h-5 text-rose-500 mr-3 shrink-0" />}
                  {item.severity === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500 mr-3 shrink-0" />}
                  {item.severity === 'info' && <Info className="w-5 h-5 text-blue-500 mr-3 shrink-0" />}
                  <p className={`font-medium text-sm ${
                    item.severity === 'critical' ? 'text-rose-900 dark:text-rose-200' :
                    item.severity === 'warning' ? 'text-amber-900 dark:text-amber-200' :
                    'text-blue-900 dark:text-blue-200'
                  }`}>
                    {item.title}
                  </p>
                </div>
                {item.actionLabel && item.actionHref && (
                  <Button variant="ghost" size="sm" asChild className={`h-8 text-xs shrink-0 ml-4 ${
                      item.severity === 'critical' ? 'hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300' :
                      item.severity === 'warning' ? 'hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-700 dark:text-amber-300' :
                      'hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300'
                    }`}>
                    <Link href={item.actionHref}>
                      {item.actionLabel}
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
