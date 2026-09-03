'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell, ShoppingCart, FileCheck, Undo2, CheckCircle2,
  AlertTriangle, Truck, Package, Clock, Check, X, ShieldAlert
} from 'lucide-react';
import { formatDateShort } from '@/lib/format';
import { cn } from '@/lib/utils';
import { computeSLAStatus } from '@/components/sla-timer';

export type NotificationCategory = 'all' | 'approvals' | 'operations' | 'finance' | 'escalations';

export interface AppNotificationItem {
  id: string;
  category: 'approvals' | 'operations' | 'finance' | 'escalations';
  type: string;
  title: string;
  description: string;
  href: string;
  created_at: string;
  isEscalated?: boolean;
  read?: boolean;
}

export function NotificationCenter() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('all');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Load read notifications from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('2bf_read_notifications');
      if (stored) {
        setReadIds(new Set(JSON.parse(stored)));
      }
    } catch {}
  }, []);

  const markAllAsRead = () => {
    const allIds = new Set([...Array.from(readIds), ...notifications.map((n) => n.id)]);
    setReadIds(allIds);
    try {
      localStorage.setItem('2bf_read_notifications', JSON.stringify(Array.from(allIds)));
    } catch {}
  };

  const markAsRead = (id: string) => {
    const updated = new Set(readIds);
    updated.add(id);
    setReadIds(updated);
    try {
      localStorage.setItem('2bf_read_notifications', JSON.stringify(Array.from(updated)));
    } catch {}
  };

  const fetchNotifications = useCallback(async () => {
    if (!profile) return;
    const items: AppNotificationItem[] = [];
    const role = profile.role;
    const isAdmin = role === 'admin';
    const isSales = role === 'sales' || role === 'sales_manager';
    const isWarehouse = role === 'warehouse' || role === 'warehouse_manager';
    const isDispatch = role === 'dispatch' || role === 'dispatch_manager';
    const isAccounts = role === 'accounts' || role === 'accounts_manager';

    try {
      // 1. Pending Payments (Accounts & Admin) -> SLA 2h
      if (isAdmin || isAccounts) {
        const { data: payments } = await supabase
          .from('payments')
          .select('id, amount, currency, created_at, customer:customers(customer_name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(8);

        payments?.forEach((p: any) => {
          const sla = computeSLAStatus('payment', p.created_at);
          items.push({
            id: `payment-${p.id}`,
            category: sla.isBreached ? 'escalations' : 'finance',
            type: 'payment',
            title: sla.isBreached ? `🚨 ESCALATED: Payment Awaiting Approval` : `Payment Awaiting Approval`,
            description: `${p.customer?.customer_name || 'Customer'} • ETB ${p.amount} (Waiting ${sla.formattedElapsed})`,
            href: '/account/payments',
            created_at: p.created_at,
            isEscalated: sla.isBreached,
          });
        });
      }

      // 2. Orders Ready for Dispatch -> SLA 4h
      if (isAdmin || isDispatch || isSales) {
        const { data: dispatchOrders } = await supabase
          .from('orders')
          .select('id, order_number, created_at, customer:customers(customer_name)')
          .in('status', ['approved', 'processing'])
          .order('created_at', { ascending: false })
          .limit(8);

        dispatchOrders?.forEach((o: any) => {
          const sla = computeSLAStatus('dispatch', o.created_at);
          items.push({
            id: `order-dispatch-${o.id}`,
            category: sla.isBreached ? 'escalations' : 'operations',
            type: 'dispatch',
            title: sla.isBreached ? `🚨 ESCALATED: Order Waiting Loading` : `Order Ready for Dispatch`,
            description: `${o.order_number} • ${o.customer?.customer_name || 'Customer'} (Waiting ${sla.formattedElapsed})`,
            href: '/dispatch',
            created_at: o.created_at,
            isEscalated: sla.isBreached,
          });
        });
      }

      // 3. Approvals -> SLA 12h
      if (isAdmin || role.includes('manager')) {
        const { data: approvals } = await supabase
          .from('approvals')
          .select('id, request_type, reason, requested_at, requester:profiles(full_name)')
          .eq('status', 'pending')
          .order('requested_at', { ascending: false })
          .limit(6);

        approvals?.forEach((a: any) => {
          const sla = computeSLAStatus('correction', a.requested_at);
          items.push({
            id: `approval-${a.id}`,
            category: sla.isBreached ? 'escalations' : 'approvals',
            type: 'approval',
            title: sla.isBreached ? `🚨 ESCALATED: Approval Needed` : `Approval Needed: ${a.request_type.replace(/_/g, ' ')}`,
            description: `${a.reason || 'Approval pending'} • By ${a.requester?.full_name || 'User'}`,
            href: '/approvals',
            created_at: a.requested_at,
            isEscalated: sla.isBreached,
          });
        });
      }

      // 4. Returns -> SLA 12h
      if (isAdmin || isWarehouse || role === 'returns_manager') {
        const { data: returns } = await supabase
          .from('returns')
          .select('id, return_type, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5);

        returns?.forEach((r: any) => {
          const sla = computeSLAStatus('return', r.created_at);
          items.push({
            id: `return-${r.id}`,
            category: sla.isBreached ? 'escalations' : 'operations',
            type: 'return',
            title: `Return Pending Processing`,
            description: `Type: ${r.return_type} (Waiting ${sla.formattedElapsed})`,
            href: '/returns',
            created_at: r.created_at,
            isEscalated: sla.isBreached,
          });
        });
      }

      // Sort: Escalations first, then newest timestamp
      items.sort((a, b) => {
        if (a.isEscalated && !b.isEscalated) return -1;
        if (!a.isEscalated && b.isEscalated) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setNotifications(items);
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchNotifications();

    // Supabase Realtime update on changes
    const channel = supabase
      .channel('realtime_notifications_center')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approvals' }, () => fetchNotifications())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  const filtered = notifications.filter((n) => {
    if (activeCategory === 'all') return true;
    return n.category === activeCategory;
  });

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;
  const hasEscalations = notifications.some((n) => n.isEscalated);

  const getIcon = (type: string, isEscalated?: boolean) => {
    if (isEscalated) return <ShieldAlert className="h-4 w-4 text-red-600 animate-pulse" />;
    switch (type) {
      case 'payment':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'dispatch':
        return <Truck className="h-4 w-4 text-blue-500" />;
      case 'approval':
        return <FileCheck className="h-4 w-4 text-indigo-500" />;
      case 'return':
        return <Undo2 className="h-4 w-4 text-amber-500" />;
      default:
        return <Bell className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors touch-press',
            hasEscalations && 'text-red-600'
          )}
          title="Notification & Approval Center"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full text-[10px] font-bold text-white',
                hasEscalations ? 'bg-red-600 animate-bounce' : 'bg-primary'
              )}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[92vw] sm:w-96 p-0 shadow-2xl rounded-2xl border-border/80">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">Notification Center</span>
            {unreadCount > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                {unreadCount} unread
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>

        {/* Categories Tab Bar */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border/60 overflow-x-auto text-xs bg-muted/10">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'approvals', label: 'Approvals' },
              { id: 'operations', label: 'Operations' },
              { id: 'finance', label: 'Finance' },
              { id: 'escalations', label: 'Escalated' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors touch-press',
                activeCategory === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {tab.label}
              {tab.id === 'escalations' && hasEscalations && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              )}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <ScrollArea className="max-h-[360px]">
          {loading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading notifications...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-1">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-1" />
              <p className="text-sm font-semibold text-foreground">All clear</p>
              <p className="text-xs">No pending items in this category.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map((item) => {
                const isRead = readIds.has(item.id);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => {
                      markAsRead(item.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex items-start gap-3 p-3.5 transition-colors hover:bg-muted/40 touch-press',
                      !isRead && 'bg-primary/5 dark:bg-primary/10',
                      item.isEscalated && 'bg-red-50/50 dark:bg-red-950/20'
                    )}
                  >
                    <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-muted/60">
                      {getIcon(item.type, item.isEscalated)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn('text-xs font-semibold truncate', item.isEscalated ? 'text-red-600 dark:text-red-400 font-bold' : 'text-foreground')}>
                          {item.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatDateShort(item.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
