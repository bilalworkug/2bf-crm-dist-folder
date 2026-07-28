'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationsDropdown } from '@/components/notifications-dropdown';
import { navItemsForRole } from '@/lib/nav';
import { useAuth } from '@/lib/auth';

export function Header() {
  const pathname = usePathname();
  const { profile } = useAuth();
  if (!profile) return null;

  const items = navItemsForRole(profile.role);
  const current = items.find(
    (i) => pathname === i.href || pathname.startsWith(i.href + '/')
  );

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-card/80 px-4 backdrop-blur-md lg:px-8">
      <div className="flex items-center gap-2 pl-12 lg:pl-0">
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            Home
          </Link>
          {current && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              <span className="font-medium text-foreground">{current.label}</span>
            </>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <NotificationsDropdown />
        <ThemeToggle />
      </div>
    </header>
  );
}
