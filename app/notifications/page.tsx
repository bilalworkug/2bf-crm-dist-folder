'use client';

import { useState, useEffect, useCallback } from 'react';
import { notificationService, AppNotification } from '@/lib/notifications/notification-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Info, AlertTriangle, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch more than the popover
      const data = await notificationService.getRecentNotifications(50);
      setNotifications(data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to update notifications');
    }
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    if (!notification.read_at) {
      try {
        await notificationService.markAsRead(notification.id);
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
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Notification Center</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">View and manage your recent activity.</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleMarkAllRead}>
            <Check className="w-4 h-4 mr-2" />
            Mark all as read
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 text-center text-slate-500 animate-pulse">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center text-slate-500">You have no notifications.</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-4 p-4 md:p-6 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50 ${
                      !notif.read_at ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className={`shrink-0 mt-1 ${!notif.read_at ? 'opacity-100' : 'opacity-60'}`}>
                      {getIcon(notif.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-1">
                        <h3 className={`font-medium ${!notif.read_at ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                          {notif.title}
                        </h3>
                        <span className="text-xs text-slate-400 font-medium shrink-0">
                          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        {notif.message}
                      </p>
                      {notif.action_url && (
                        <Button 
                          variant={!notif.read_at ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleNotificationClick(notif)}
                        >
                          View Details
                        </Button>
                      )}
                    </div>

                    {!notif.read_at && (
                      <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-blue-500 mt-2" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
