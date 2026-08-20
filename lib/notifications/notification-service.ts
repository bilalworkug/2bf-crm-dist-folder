import { supabase } from '@/lib/supabase/client';

export type NotificationType = 
  | 'order_created'
  | 'order_ready_for_dispatch'
  | 'order_dispatched'
  | 'order_delivered'
  | 'payment_pending_approval'
  | 'payment_approved'
  | 'payment_rejected'
  | 'credit_overdue'
  | 'low_stock'
  | 'system_alert';

export interface AppNotification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  message: string;
  entity_type: string;
  entity_id: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

export const notificationService = {
  /**
   * Fetches the latest notifications for the current user.
   */
  async getRecentNotifications(limit = 20) {
    const { data, error } = await supabase
      .from('app_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data as AppNotification[];
  },

  /**
   * Gets the count of unread notifications.
   */
  async getUnreadCount() {
    const { count, error } = await supabase
      .from('app_notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);

    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(id: string) {
    const { error } = await supabase
      .from('app_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Marks all notifications as read for the current user.
   */
  async markAllAsRead() {
    // Getting user to ensure we only update their own (RLS already enforces this, but for extra safety)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('app_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', user.id)
      .is('read_at', null);

    if (error) throw error;
  }
};
