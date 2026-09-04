'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, ScanLine, PackageCheck, Truck, Boxes, Search, History,
  Users, ShoppingCart, Undo2, ClipboardCheck, BarChart3, ScrollText,
  UserCog, Settings, FileText, Building2, Menu, X, LogOut, ChevronLeft, Package,
  ShieldCheck, ArrowRightLeft, CreditCard, BadgeDollarSign, ClipboardList, ScanSearch
} from 'lucide-react';
import { Logo } from '@/lib/logo';
import { useAuth } from '@/lib/auth';
import { navItemsForRole, NavItem } from '@/lib/nav';
import { ROLE_LABELS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, ScanLine, PackageCheck, Truck, Boxes, Search, History,
  Users, ShoppingCart, Undo2, ClipboardCheck, BarChart3, ScrollText,
  UserCog, Settings, FileText, Building2, Package, ShieldCheck, ArrowRightLeft,
  CreditCard, BadgeDollarSign, ClipboardList, ScanSearch
};

interface NavGroup {
  title: string;
  items: string[]; // hrefs
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: ['/dashboard', '/approvals', '/search'],
  },
  {
    title: 'Core Factory Flow',
    items: [
      '/orders', '/quote', '/customers',
      '/account/payments', '/account/customers', '/account/debt', '/sales/discounts',
      '/production', '/production/corrections',
      '/warehouse', '/warehouse/fulfillment', '/warehouse/transfers', '/inventory', '/warehouse/corrections',
      '/dispatch', '/delivery'
    ],
  },
  {
    title: 'Traceability & Reports',
    items: [
      '/reports', '/barcode-passport', '/barcode-search', '/box-history', '/returns'
    ],
  },
  {
    title: 'Administration',
    items: ['/admin/products', '/users', '/audit', '/settings'],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Support opening from BottomNav "More" button
  useEffect(() => {
    const handleOpen = () => setMobileOpen(true);
    window.addEventListener('open-mobile-drawer', handleOpen);
    return () => window.removeEventListener('open-mobile-drawer', handleOpen);
  }, []);

  const accessibleItems = useMemo(() => {
    if (!profile) return [];
    return navItemsForRole(profile.role);
  }, [profile]);

  const itemsByHref = useMemo(() => {
    const map = new Map<string, NavItem>();
    for (const item of accessibleItems) {
      map.set(item.href, item);
    }
    return map;
  }, [accessibleItems]);

  if (!profile) return null;

  const content = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground safe-top safe-bottom select-none">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
        <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
          <Logo className="[&_span:first-child]:text-sidebar-foreground [&_.text-amber-600]:text-amber-400" />
        </Link>
        <span className="hidden lg:inline-flex items-center rounded border border-white/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase text-sidebar-foreground/50">
          ERP/WMS
        </span>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-5">
        {NAV_GROUPS.map((group) => {
          const groupItems = group.items
            .map((href) => itemsByHref.get(href))
            .filter((item): item is NavItem => Boolean(item));

          if (groupItems.length === 0) return null;

          return (
            <div key={group.title} className="space-y-1">
              <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/40">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {groupItems.map((item) => {
                  const Icon = ICONS[item.icon] ?? LayoutDashboard;
                  const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-xs'
                          : 'text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground'
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0 transition-transform group-hover:scale-105', active ? 'text-amber-400' : 'text-sidebar-foreground/60')} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User Info & Sign Out Footer */}
      <div className="border-t border-white/10 p-3 bg-black/10">
        <div className="mb-2 flex items-center gap-3 rounded-lg bg-white/5 p-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-xs font-bold text-amber-400 border border-amber-500/30">
            {profile.full_name?.charAt(0) ?? profile.email.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">
              {profile.full_name ?? profile.email}
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">
              {ROLE_LABELS[profile.role]}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="w-full justify-start gap-2 h-8 text-xs font-semibold text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground shadow-md border border-white/10 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-200 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3.5 z-10 p-1.5 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/10"
          aria-label="Close menu"
        >
          <X className="h-4.5 w-4.5" />
        </button>
        {content}
      </aside>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block border-r border-border/40">
        {content}
      </aside>
    </>
  );
}
