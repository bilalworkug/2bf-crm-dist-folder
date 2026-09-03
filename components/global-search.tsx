'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  Search, ScanLine, ShoppingCart, Users, Package,
  CreditCard, ShieldCheck, ArrowRight, Clock, X,
  Building2, Truck, UserCheck, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GlobalSearchResult {
  id: string;
  category: 'barcode' | 'order' | 'customer' | 'product' | 'user' | 'payment' | 'warehouse';
  title: string;
  subtitle: string;
  badge?: string;
  url: string;
  exact?: boolean;
}

const STORAGE_KEY = '2bf_recent_searches';

export function GlobalSearch() {
  const router = useRouter();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored).slice(0, 5));
      }
    } catch {}
  }, []);

  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
    setRecentSearches(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Listen for custom trigger event
  useEffect(() => {
    const handleTrigger = () => setOpen(true);
    window.addEventListener('open-global-search', handleTrigger);
    return () => window.removeEventListener('open-global-search', handleTrigger);
  }, []);

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Execute role-aware search query
  const executeSearch = useCallback(async (searchQuery: string) => {
    const term = searchQuery.trim();
    if (term.length < 2 || !profile) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = `%${term}%`;
    const role = profile.role;
    const isUpper = term.toUpperCase();
    const isBarcodeLike = isUpper.startsWith('TB-') || isUpper.startsWith('2BF-') || /^\d{6,}$/.test(term);
    const isOrderLike = isUpper.startsWith('SO-') || /^SO/i.test(term);

    const items: GlobalSearchResult[] = [];

    try {
      const canSeeFinance = ['admin', 'accounts', 'accounts_manager', 'manager'].includes(role);
      const canSeeUsers = role === 'admin';
      const canSeeCustomers = ['admin', 'sales', 'sales_manager', 'accounts', 'accounts_manager', 'manager'].includes(role);
      const canSeeOrders = ['admin', 'sales', 'sales_manager', 'dispatch', 'dispatch_manager', 'accounts', 'accounts_manager', 'manager'].includes(role);

      const promises: any[] = [];

      // 1. Barcode search (boxes)
      promises.push(
        supabase
          .from('boxes')
          .select('id, barcode, status, product:products(name), warehouse:warehouses(code)')
          .ilike('barcode', q)
          .limit(4)
      );

      // 2. Orders search
      if (canSeeOrders) {
        promises.push(
          supabase
            .from('orders')
            .select('id, order_number, status, total_amount, customer:customers(customer_name)')
            .ilike('order_number', q)
            .limit(4)
        );
      } else {
        promises.push(Promise.resolve({ data: [] }));
      }

      // 3. Customers search
      if (canSeeCustomers) {
        promises.push(
          supabase
            .from('customers')
            .select('id, customer_name, company_name, phone')
            .or(`customer_name.ilike.${q},company_name.ilike.${q}`)
            .limit(4)
        );
      } else {
        promises.push(Promise.resolve({ data: [] }));
      }

      // 4. Products search
      promises.push(
        supabase
          .from('products')
          .select('id, name, sku, active')
          .ilike('name', q)
          .limit(4)
      );

      // 5. Users search (Admin only)
      if (canSeeUsers) {
        promises.push(
          supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .or(`full_name.ilike.${q},email.ilike.${q}`)
            .limit(3)
        );
      } else {
        promises.push(Promise.resolve({ data: [] }));
      }

      // 6. Payments search (Finance only)
      if (canSeeFinance) {
        promises.push(
          supabase
            .from('payments')
            .select('id, amount, currency, status, customer:customers(customer_name)')
            .ilike('status', q)
            .limit(3)
        );
      } else {
        promises.push(Promise.resolve({ data: [] }));
      }

      const [boxesRes, ordersRes, custRes, prodRes, usersRes, payRes] = await Promise.all(promises);

      // Map Barcodes
      boxesRes.data?.forEach((b: any) => {
        const exact = b.barcode.toLowerCase() === term.toLowerCase();
        items.push({
          id: `barcode-${b.id}`,
          category: 'barcode',
          title: b.barcode,
          subtitle: `${b.product?.name || 'Product'} • ${b.warehouse?.code || 'In Transit'}`,
          badge: b.status,
          url: `/barcode-passport?barcode=${encodeURIComponent(b.barcode)}`,
          exact,
        });
      });

      // Map Orders
      ordersRes.data?.forEach((o: any) => {
        const exact = o.order_number.toLowerCase() === term.toLowerCase();
        items.push({
          id: `order-${o.id}`,
          category: 'order',
          title: o.order_number,
          subtitle: `${o.customer?.customer_name || 'Customer'} • ETB ${Number(o.total_amount || 0).toLocaleString()}`,
          badge: o.status,
          url: `/orders/detail?id=${o.id}`,
          exact,
        });
      });

      // Map Customers
      custRes.data?.forEach((c: any) => {
        const exact = c.customer_name.toLowerCase() === term.toLowerCase();
        items.push({
          id: `customer-${c.id}`,
          category: 'customer',
          title: c.customer_name,
          subtitle: c.company_name || c.phone || 'Customer Account',
          badge: 'Customer',
          url: `/customers/detail?id=${c.id}`,
          exact,
        });
      });

      // Map Products
      prodRes.data?.forEach((p: any) => {
        const exact = p.name.toLowerCase() === term.toLowerCase();
        items.push({
          id: `product-${p.id}`,
          category: 'product',
          title: p.name,
          subtitle: p.sku ? `SKU: ${p.sku}` : 'Product SKU',
          badge: p.active ? 'Active' : 'Inactive',
          url: `/admin/products`,
          exact,
        });
      });

      // Map Users
      usersRes.data?.forEach((u: any) => {
        items.push({
          id: `user-${u.id}`,
          category: 'user',
          title: u.full_name || u.email,
          subtitle: `${u.email} • Role: ${u.role}`,
          badge: u.role,
          url: `/users`,
        });
      });

      // Map Payments
      payRes.data?.forEach((p: any) => {
        items.push({
          id: `payment-${p.id}`,
          category: 'payment',
          title: `Payment: ${p.amount} ${p.currency || 'ETB'}`,
          subtitle: `${p.customer?.customer_name || 'Customer'}`,
          badge: p.status,
          url: `/account/payments`,
        });
      });

      // Smart Sorting: Exact matches first, then entity prioritization
      items.sort((a, b) => {
        if (a.exact && !b.exact) return -1;
        if (!a.exact && b.exact) return 1;

        if (isBarcodeLike) {
          if (a.category === 'barcode' && b.category !== 'barcode') return -1;
          if (a.category !== 'barcode' && b.category === 'barcode') return 1;
        }

        if (isOrderLike) {
          if (a.category === 'order' && b.category !== 'order') return -1;
          if (a.category !== 'order' && b.category === 'order') return 1;
        }

        return 0;
      });

      setResults(items);
      setSelectedIndex(0);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // Debounced search handler
  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      executeSearch(val);
    }, 200);
  };

  const handleSelect = (item: GlobalSearchResult) => {
    saveRecentSearch(query);
    setOpen(false);
    router.push(item.url);
  };

  // Keyboard navigation inside results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < results.length ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-150">
      <div
        className="w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-border/60 gap-3 bg-card">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search barcodes, orders, customers, products, payments... (Ctrl+K)"
            className="flex-1 bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground outline-none"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
          {query && !loading && (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
              }}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded border border-border bg-muted text-[11px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Search Results / Recents / Empty States */}
        <div className="flex-1 overflow-y-auto p-2 overscroll-contain">
          {query.trim().length === 0 ? (
            <div className="p-4 space-y-4">
              {recentSearches.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> Recent Searches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        onClick={() => {
                          setQuery(term);
                          executeSearch(term);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-border/80 bg-muted/40 text-xs font-medium text-foreground hover:bg-muted transition-colors touch-press flex items-center gap-1.5"
                      >
                        <Search className="h-3 w-3 text-muted-foreground" />
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Jump Shortcuts */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Executive Quick Jump
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => {
                      setOpen(false);
                      router.push('/barcode-passport');
                    }}
                    className="p-2.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 text-left transition-colors touch-press"
                  >
                    <ScanLine className="h-4 w-4 text-amber-500 mb-1" />
                    <p className="text-xs font-bold text-foreground">Barcode Passport</p>
                    <p className="text-[11px] text-muted-foreground">Carton timeline</p>
                  </button>
                  <button
                    onClick={() => {
                      setOpen(false);
                      router.push('/orders');
                    }}
                    className="p-2.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 text-left transition-colors touch-press"
                  >
                    <ShoppingCart className="h-4 w-4 text-primary mb-1" />
                    <p className="text-xs font-bold text-foreground">Sales Orders</p>
                    <p className="text-[11px] text-muted-foreground">Recent orders</p>
                  </button>
                  <button
                    onClick={() => {
                      setOpen(false);
                      router.push('/customers');
                    }}
                    className="p-2.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 text-left transition-colors touch-press"
                  >
                    <Users className="h-4 w-4 text-blue-500 mb-1" />
                    <p className="text-xs font-bold text-foreground">Customers</p>
                    <p className="text-[11px] text-muted-foreground">Accounts & credit</p>
                  </button>
                  <button
                    onClick={() => {
                      setOpen(false);
                      router.push('/warehouse');
                    }}
                    className="p-2.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 text-left transition-colors touch-press"
                  >
                    <Package className="h-4 w-4 text-emerald-500 mb-1" />
                    <p className="text-xs font-bold text-foreground">Warehouse</p>
                    <p className="text-[11px] text-muted-foreground">Stock & receipts</p>
                  </button>
                </div>
              </div>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="p-8 text-center text-muted-foreground space-y-1">
              <Search className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm font-semibold text-foreground">No records found</p>
              <p className="text-xs">No matches for &ldquo;{query}&rdquo; within your authorized role permissions.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                let Icon = Search;
                if (item.category === 'barcode') Icon = ScanLine;
                if (item.category === 'order') Icon = ShoppingCart;
                if (item.category === 'customer') Icon = Users;
                if (item.category === 'product') Icon = Package;
                if (item.category === 'user') Icon = UserCheck;
                if (item.category === 'payment') Icon = CreditCard;
                if (item.category === 'warehouse') Icon = Building2;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors touch-press',
                      isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('p-2 rounded-lg shrink-0', isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-foreground truncate">{item.title}</p>
                          {item.exact && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              Exact
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {item.badge && (
                        <span className="text-[11px] font-medium capitalize px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                          {item.badge.replace(/_/g, ' ')}
                        </span>
                      )}
                      <ArrowRight className={cn('h-4 w-4 opacity-0 transition-opacity', isSelected && 'opacity-100 text-primary')} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer Tips */}
        <div className="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground px-4">
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
          </div>
          <span>2BF Global Search</span>
        </div>
      </div>
    </div>
  );
}
