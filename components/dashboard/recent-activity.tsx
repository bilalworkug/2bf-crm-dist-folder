'use client';
import { ActivityEvent } from '@/lib/dashboard/dashboard-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { 
  Factory, Package, ShoppingCart, Truck, 
  RotateCcw, ClipboardCheck, Clock
} from 'lucide-react';
import { DashboardEmptyState } from './dashboard-empty-state';

const getEventIcon = (type: ActivityEvent['type']) => {
  switch (type) {
    case 'production': return <Factory className="w-4 h-4 text-purple-500" />;
    case 'warehouse': return <Package className="w-4 h-4 text-emerald-500" />;
    case 'order': return <ShoppingCart className="w-4 h-4 text-blue-500" />;
    case 'dispatch': return <Truck className="w-4 h-4 text-amber-500" />;
    case 'delivery': return <ClipboardCheck className="w-4 h-4 text-indigo-500" />;
    case 'return': return <RotateCcw className="w-4 h-4 text-rose-500" />;
    case 'approval': return <ClipboardCheck className="w-4 h-4 text-teal-500" />;
    default: return <Clock className="w-4 h-4 text-slate-500" />;
  }
};

const getEventBg = (type: ActivityEvent['type']) => {
  switch (type) {
    case 'production': return 'bg-purple-50 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800';
    case 'warehouse': return 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800';
    case 'order': return 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800';
    case 'dispatch': return 'bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800';
    case 'delivery': return 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800';
    case 'return': return 'bg-rose-50 border-rose-100 dark:bg-rose-900/20 dark:border-rose-800';
    case 'approval': return 'bg-teal-50 border-teal-100 dark:bg-teal-900/20 dark:border-teal-800';
    default: return 'bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-700';
  }
};

export function RecentActivityWidget({ events }: { events: ActivityEvent[] }) {
  return (
    <Card className="h-full shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold flex items-center">
          <Clock className="w-5 h-5 mr-2 text-slate-500" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {events.length === 0 ? (
          <DashboardEmptyState
            title="No recent activity"
            description="No actions have been recorded recently."
            icon={<Clock className="h-8 w-8" />}
          />
        ) : (
          <div className="relative border-l border-slate-200 dark:border-slate-800 ml-4 space-y-6 pb-2">
            {events.map((event) => (
              <div key={event.id} className="relative pl-6">
                <div className={`absolute -left-3.5 top-1 p-1.5 rounded-full border bg-white dark:bg-slate-900 z-10 ${getEventBg(event.type)}`}>
                  {getEventIcon(event.type)}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-baseline justify-between mb-0.5">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {event.description}
                    </span>
                    <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
                      {formatDistanceToNow(parseISO(event.time), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center flex-wrap gap-2">
                    {event.user && <span>User: {event.user}</span>}
                    {event.productName && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{event.productName}</span>
                      </>
                    )}
                    {event.barcode && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                        <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{event.barcode}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
