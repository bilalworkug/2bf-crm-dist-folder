'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { AuditLog, Profile } from '@/lib/types';
import { timeAgo } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmptyState } from '@/components/empty-state';
import { Activity } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/types';

const ACTION_LABELS: Record<string, string> = {
  production_scan: 'Production scan',
  warehouse_receipt: 'Warehouse receipt',
  dispatch: 'Dispatch',
  order_created: 'Order created',
  customer_created: 'Customer created',
  return_processed: 'Return processed',
  approval_requested: 'Approval requested',
  login: 'Sign in',
  logout: 'Sign out',
};

export function RecentActivity({ limit = 8 }: { limit?: number }) {
  const [logs, setLogs] = useState<(AuditLog & { profile?: Profile | null })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('*, profile:profiles!audit_logs_user_id_fkey(*)')
        .order('created_at', { ascending: false })
        .limit(limit);
      setLogs((data ?? []) as (AuditLog & { profile?: Profile | null })[]);
      setLoading(false);
    })();
  }, [limit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState title="No recent activity" icon={Activity} />
        ) : (
          <ScrollArea className="h-[360px] pr-3">
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {log.profile?.full_name?.charAt(0) ?? '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {ACTION_LABELS[log.action] ?? log.action}
                      {log.barcode && (
                        <span className="ml-1.5 font-mono text-xs text-muted-foreground">{log.barcode}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.profile?.full_name ?? 'Unknown'}
                      {log.profile && ` · ${ROLE_LABELS[log.profile.role]}`}
                      {' · '}
                      {timeAgo(log.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
