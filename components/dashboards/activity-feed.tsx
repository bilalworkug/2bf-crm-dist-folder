'use client';

import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Box, ShoppingCart, Truck, Undo2, DollarSign, Factory, Package,
  CheckCircle2, AlertTriangle, Info, Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  order_created:      { label: 'Order created',      color: 'text-blue-500 bg-blue-50',     icon: ShoppingCart },
  box_received:       { label: 'Box received',        color: 'text-emerald-500 bg-emerald-50', icon: Package },
  box_allocated:      { label: 'Box allocated',       color: 'text-indigo-500 bg-indigo-50', icon: Box },
  box_dispatched:     { label: 'Box dispatched',      color: 'text-purple-500 bg-purple-50', icon: Truck },
  box_delivered:      { label: 'Box delivered',       color: 'text-green-600 bg-green-50',   icon: CheckCircle2 },
  delivery_completed: { label: 'Delivery completed',  color: 'text-green-600 bg-green-50',   icon: CheckCircle2 },
  REQUEST_RETURN:     { label: 'Return requested',    color: 'text-amber-500 bg-amber-50',   icon: Undo2 },
  APPROVE_RETURN:     { label: 'Return approved',     color: 'text-teal-500 bg-teal-50',     icon: CheckCircle2 },
  order_approved:     { label: 'Order approved',      color: 'text-blue-500 bg-blue-50',     icon: CheckCircle2 },
};

interface ActivityItem {
  action: string;
  entity_type: string;
  barcode: string | null;
  details: any;
  created_at: string;
  user_name: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  loading?: boolean;
  maxItems?: number;
  className?: string;
}

export function ActivityFeed({ items, loading, maxItems = 10, className }: ActivityFeedProps) {
  const visible = items.slice(0, maxItems);

  return (
    <Card className={cn('border-0 shadow-sm rounded-2xl bg-white overflow-hidden', className)}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Live Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-0 divide-y divide-gray-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-8 w-8 rounded-full bg-gray-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-40 rounded bg-gray-100 animate-pulse" />
                  <div className="h-2.5 w-24 rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2 text-gray-400">
            <Clock className="h-8 w-8 opacity-30" />
            <p className="text-sm font-medium">No activity yet today</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {visible.map((item, i) => {
              const cfg = ACTION_CONFIG[item.action] ?? {
                label: item.action.replace(/_/g, ' '),
                color: 'text-gray-500 bg-gray-50',
                icon: Info,
              };
              const Icon = cfg.icon;
              const time = (() => {
                try { return formatDistanceToNow(new Date(item.created_at), { addSuffix: true }); }
                catch { return '—'; }
              })();

              return (
                <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                  <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', cfg.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{cfg.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.barcode && (
                        <span className="font-mono text-[11px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                          {item.barcode}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400 truncate">{item.user_name}</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0 mt-0.5">{time}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
