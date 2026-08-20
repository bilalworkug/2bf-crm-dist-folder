'use client';

import { useState, useEffect, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, Check, CheckCircle2, Info, AlertTriangle, AlertCircle, Clock } from 'lucide-react';
import { notificationService, AppNotification } from '@/lib/notifications/notification-service';
import { supabase } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function NotificationsPopover() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [data, count] = await Promise.all([
        notificationService.getRecentNotifications(10),
        notificationService.getUnreadCount()
      ]);
      setNotifications(data);
      setUnreadCount(count);
    } catch (e) {
      console.error('Failed to load notifications', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Setup Supabase Realtime Subscription
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase.channel(`notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'app_notifications',
            filter: `recipient_id=eq.${user.id}`
          },
          (payload: any) => {
            // Refetch immediately to get the latest ordered data and accurate count
            loadData();
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadData]);

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to update notifications');
    }
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    setOpen(false);
    if (!notification.read_at) {
      try {
        await notificationService.markAsRead(notification.id);
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n));
      } catch (e) {
        console.error(e);
      }
    }
    if (notification.action_url) {
      router.push(notification.action_url);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'order_created':
      case 'order_ready_for_dispatch':
      case 'order_dispatched':
      case 'order_delivered':
        return <Info className="w-5 h-5 text-blue-500" />;
      case 'payment_pending_approval':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'payment_approved':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'payment_rejected':
      case 'credit_overdue':
        return <AlertTriangle className="w-5 h-5 text-rose-500" />;
      default:
        return <Info className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-10 w-10 bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
          <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-950">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0 shadow-lg rounded-xl overflow-hidden border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full text-xs font-medium">
                {unreadCount} unread
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="h-8 text-xs px-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              <Check className="w-3.5 h-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <div className="max-h-[350px] overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 flex flex-col items-center">
              <Clock className="w-6 h-6 mb-2 animate-pulse text-slate-300" />
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 flex flex-col items-center">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-slate-400" />
              </div>
              You're all caught up!
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`flex items-start gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                    !notif.read_at ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  }`}
                >
                  <div className={`mt-0.5 shrink-0 ${!notif.read_at ? 'opacity-100' : 'opacity-60'}`}>
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-tight mb-1 truncate ${!notif.read_at ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!notif.read_at && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <Link href="/notifications" onClick={() => setOpen(false)} className="block w-full py-2 text-center text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
            View All Notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
