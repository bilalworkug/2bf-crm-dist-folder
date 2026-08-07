'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, ShoppingCart, FileCheck, Undo2, CheckCircle2, AlertTriangle, Truck, Package } from 'lucide-react';
import { formatDateShort } from '@/lib/format';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

interface Notification {
  id: string;
  type: 'order' | 'approval' | 'return' | 'alert' | 'dispatch' | 'stock';
  title: string;
  description: string;
  href: string;
  created_at: string;
}

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { profile } = useAuth();

  const fetchNotifications = useCallback(async () => {
    if (!profile) return;
    
    const items: Notification[] = [];
    const role = profile.role;
    const isAdmin = role === 'admin';
    const isSales = role === 'sales' || role === 'sales_manager';
    const isWarehouse = role === 'warehouse' || role === 'warehouse_manager';
    const isProduction = role === 'production' || role === 'production_manager';
    const isDispatch = role === 'dispatch' || role === 'dispatch_manager';
    const isAccounts = role === 'accounts' || role === 'accounts_manager';
    const isReturns = role === 'returns_manager';

    try {
      // 1. Orders (Sales, Accounts, Dispatch, Admin)
      if (isAdmin || isSales || isAccounts || isDispatch) {
        const { data: pendingOrders } = await supabase
          .from('orders')
          .select('id, order_number, status, payment_status, customer:customers(customer_name), created_at')
          .in('status', ['pending', 'approved'])
          .order('created_at', { ascending: false })
          .limit(10);
        
        (pendingOrders ?? []).forEach((o: any) => {
          if (o.status === 'pending' && (isAdmin || isSales || isAccounts)) {
            items.push({
              id: `order-pending-${o.id}`,
              type: 'order',
              title: `New order: ${o.order_number}`,
              description: o.customer?.customer_name ?? 'Unknown customer',
              href: '/orders',
              created_at: o.created_at,
            });
          }
          if (o.status === 'approved' && (isAdmin || isDispatch)) {
            items.push({
              id: `order-approved-${o.id}`,
              type: 'dispatch',
              title: `Ready for dispatch: ${o.order_number}`,
              description: o.customer?.customer_name ?? 'Unknown customer',
              href: '/dispatch',
              created_at: o.created_at,
            });
          }
          if (o.payment_status === 'pending' && (isAdmin || isAccounts)) {
            items.push({
              id: `order-payment-${o.id}`,
              type: 'alert',
              title: `Outstanding invoice: ${o.order_number}`,
              description: 'Payment pending',
              href: '/orders',
              created_at: o.created_at,
            });
          }
        });
      }

      // 2. Approvals (Admin, Sales Manager, Managers)
      if (isAdmin || isSales || role.includes('manager')) {
        const { data: pendingApprovals } = await supabase
          .from('approvals')
          .select('id, request_type, requester:profiles(full_name), created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5);

        (pendingApprovals ?? []).forEach((a: any) => {
          items.push({
            id: `approval-${a.id}`,
            type: 'approval',
            title: `Approval needed: ${a.request_type}`,
            description: a.requester?.full_name ?? 'Unknown user',
            href: '/approvals',
            created_at: a.created_at,
          });
        });
      }

      // 3. Returns (Admin, Returns Manager, Warehouse Manager)
      if (isAdmin || isReturns || isWarehouse) {
        const { data: pendingReturns } = await supabase
          .from('returns')
          .select('id, return_type, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5);

        (pendingReturns ?? []).forEach((r: any) => {
          items.push({
            id: `return-${r.id}`,
            type: 'return',
            title: `Return pending: ${r.return_type}`,
            description: 'Awaiting processing',
            href: '/returns',
            created_at: r.created_at,
          });
        });
      }

    } catch (e) {
      console.error(e);
    }

    // Sort and limit
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // De-duplicate by ID
    const uniqueItems = items.filter((item, index, self) => 
      index === self.findIndex((t) => (t.id === item.id))
    );

    setNotifications(uniqueItems.slice(0, 12));
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const iconFor = (type: Notification['type']) => {
    switch (type) {
      case 'order': return <ShoppingCart className="h-4 w-4 text-amber-500" />;
      case 'approval': return <FileCheck className="h-4 w-4 text-blue-500" />;
      case 'return': return <Undo2 className="h-4 w-4 text-red-500" />;
      case 'alert': return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'dispatch': return <Truck className="h-4 w-4 text-indigo-500" />;
      case 'stock': return <Package className="h-4 w-4 text-emerald-500" />;
      default: return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {notifications.length > 9 ? '9+' : notifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {notifications.length > 0 && (
            <Badge variant="secondary" className="text-xs">{notifications.length} pending</Badge>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <p className="text-sm text-muted-foreground">All caught up — no pending items.</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent"
                >
                  <div className="mt-0.5 shrink-0">{iconFor(n.type)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{n.description}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">{formatDateShort(n.created_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
