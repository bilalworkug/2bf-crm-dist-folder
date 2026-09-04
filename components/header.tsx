'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Search } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationCenter } from '@/components/notification-center';
import { navItemsForRole } from '@/lib/nav';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/types';

export function Header() {
  const pathname = usePathname();
  const { profile } = useAuth();

  if (!profile) return null;

  const items = navItemsForRole(profile.role);
  const current = items.find(
    (i) => pathname === i.href || (i.href !== '/dashboard' && pathname.startsWith(i.href + '/'))
  );

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/80 bg-card/90 px-4 backdrop-blur-md lg:px-6 select-none">
      {/* Breadcrumb Context */}
      <div className="flex items-center gap-2 pl-11 lg:pl-0 min-w-0">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground truncate">
          <Link href="/dashboard" className="hover:text-foreground transition-colors shrink-0">
            2BF
          </Link>
          {current && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <span className="font-semibold text-foreground truncate">{current.label}</span>
            </>
          )}
        </nav>
      </div>

      {/* Action Center & Profile Bar */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">

        {/* Global Search Trigger (Ctrl+K) */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/80 bg-muted/30 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-all touch-press"
          title="Global Search (Ctrl+K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline font-medium">Search records...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border bg-card text-[10px] font-mono shadow-2xs">
            Ctrl K
          </kbd>
        </button>

        {/* Notification Center */}
        <NotificationCenter />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Role Tag */}
        <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-border/60">
          <div className="text-right">
            <p className="text-xs font-semibold leading-tight text-foreground">{profile.full_name?.split(' ')[0] || 'User'}</p>
            <p className="text-[10px] text-muted-foreground leading-tight uppercase font-mono tracking-wider">{ROLE_LABELS[profile.role]}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
