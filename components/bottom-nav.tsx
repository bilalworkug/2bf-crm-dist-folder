'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, ScanLine, ShoppingCart, PackageCheck,
  Truck, ClipboardCheck, CreditCard, Users, Search, Menu
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  onOpenMenu?: () => void;
}

export function BottomNav({ onOpenMenu }: BottomNavProps) {
  const pathname = usePathname();
  const { profile } = useAuth();

  if (!profile) return null;

  const handleMoreClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpenMenu) {
      onOpenMenu();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-mobile-drawer'));
    }
  };

  const navItems = useMemo(() => {
    const role = profile.role;

    // Default items
    let primaryAction = {
      label: 'Orders',
      href: '/orders',
      icon: ShoppingCart,
      active: pathname.startsWith('/orders') || pathname.startsWith('/quote'),
    };

    let secondaryAction = {
      label: 'Search',
      href: '/search',
      icon: Search,
      active: pathname === '/search',
    };

    if (role === 'dispatch' || role === 'dispatch_manager') {
      primaryAction = {
        label: 'Dispatch',
        href: '/dispatch',
        icon: Truck,
        active: pathname.startsWith('/dispatch'),
      };
      secondaryAction = {
        label: 'Orders',
        href: '/orders',
        icon: ShoppingCart,
        active: pathname.startsWith('/orders'),
      };
    } else if (role === 'warehouse' || role === 'warehouse_manager') {
      primaryAction = {
        label: 'Warehouse',
        href: '/warehouse',
        icon: PackageCheck,
        active: pathname.startsWith('/warehouse'),
      };
      secondaryAction = {
        label: 'Orders',
        href: '/orders',
        icon: ShoppingCart,
        active: pathname.startsWith('/orders'),
      };
    } else if (role === 'production' || role === 'production_manager') {
      primaryAction = {
        label: 'Scan',
        href: '/production',
        icon: ScanLine,
        active: pathname.startsWith('/production'),
      };
      secondaryAction = {
        label: 'Warehouse',
        href: '/warehouse',
        icon: PackageCheck,
        active: pathname.startsWith('/warehouse'),
      };
    } else if (role === 'accounts' || role === 'accounts_manager') {
      primaryAction = {
        label: 'Approvals',
        href: '/approvals',
        icon: ClipboardCheck,
        active: pathname.startsWith('/approvals'),
      };
      secondaryAction = {
        label: 'Payments',
        href: '/account/payments',
        icon: CreditCard,
        active: pathname.startsWith('/account/payments'),
      };
    } else if (role === 'sales') {
      primaryAction = {
        label: 'Orders',
        href: '/orders',
        icon: ShoppingCart,
        active: pathname.startsWith('/orders') || pathname.startsWith('/quote'),
      };
      secondaryAction = {
        label: 'Customers',
        href: '/customers',
        icon: Users,
        active: pathname.startsWith('/customers'),
      };
    } else if (role === 'admin' || role === 'manager') {
      primaryAction = {
        label: 'Approvals',
        href: '/approvals',
        icon: ClipboardCheck,
        active: pathname.startsWith('/approvals'),
      };
      secondaryAction = {
        label: 'Orders',
        href: '/orders',
        icon: ShoppingCart,
        active: pathname.startsWith('/orders'),
      };
    }

    return [
      {
        label: 'Home',
        href: '/dashboard',
        icon: LayoutDashboard,
        active: pathname === '/dashboard',
      },
      primaryAction,
      secondaryAction,
      {
        label: 'Search',
        href: '/search',
        icon: Search,
        active: pathname === '/search',
      },
    ];
  }, [profile.role, pathname]);

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-card/95 backdrop-blur-md border-t border-border/70 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.active;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors touch-press relative',
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {isActive && (
                <span className="absolute top-0 w-8 h-1 bg-primary rounded-full" />
              )}
              <Icon className={cn('h-5 w-5 mb-1 transition-transform', isActive && 'scale-110 text-primary')} />
              <span className="text-[11px] leading-tight tracking-tight">{item.label}</span>
            </Link>
          );
        })}

        {/* More Tab -> Opens full menu drawer */}
        <button
          onClick={handleMoreClick}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 text-muted-foreground hover:text-foreground transition-colors touch-press"
          aria-label="Open full menu"
        >
          <Menu className="h-5 w-5 mb-1" />
          <span className="text-[11px] leading-tight tracking-tight">More</span>
        </button>
      </div>
    </nav>
  );
}
