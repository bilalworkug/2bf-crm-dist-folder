'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, ScanLine, PackageCheck, Truck, Boxes, Search, History,
  Users, ShoppingCart, Undo2, ClipboardCheck, BarChart3, ScrollText,
  UserCog, Settings, FileText, Building2, Menu, X, LogOut, ChevronLeft, Package
} from 'lucide-react';
import { Logo } from '@/lib/logo';
import { useAuth } from '@/lib/auth';
import { navItemsForRole } from '@/lib/nav';
import { ROLE_LABELS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, ScanLine, PackageCheck, Truck, Boxes, Search, History,
  Users, ShoppingCart, Undo2, ClipboardCheck, BarChart3, ScrollText,
  UserCog, Settings, FileText, Building2, Package
};

export function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!profile) return null;
  const items = navItemsForRole(profile.role);

  const content = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
          <Logo className="[&_span:first-child]:text-sidebar-foreground [&_.text-amber-600]:text-amber-400" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        <div className="space-y-1">
          {items.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground'
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/20 text-sm font-semibold text-amber-400">
            {profile.full_name?.charAt(0) ?? profile.email.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {profile.full_name ?? profile.email}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {ROLE_LABELS[profile.role]}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground shadow-md lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
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
          className="absolute right-3 top-4 z-10 text-sidebar-foreground/70 hover:text-sidebar-foreground"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
        {content}
      </aside>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        {content}
      </aside>
    </>
  );
}
