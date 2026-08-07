'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Input } from '@/components/ui/input';
import { useGlobalSearch } from '@/lib/use-global-search';
import { Search as SearchIcon, ScanLine, Users, ShoppingCart, Package, ArrowRightLeft, Loader2, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import Link from 'next/link';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const { results, loading } = useGlobalSearch(query);

  const icons = {
    barcode: <ScanLine className="h-5 w-5 text-amber-500" />,
    customer: <Users className="h-5 w-5 text-blue-500" />,
    order: <ShoppingCart className="h-5 w-5 text-primary" />,
    product: <Package className="h-5 w-5 text-emerald-500" />,
    transfer: <ArrowRightLeft className="h-5 w-5 text-purple-500" />
  };

  const sections = ['barcode', 'customer', 'order', 'product', 'transfer'] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Search"
        description="Search for barcodes, customers, orders, products, and transfers."
      />

      <div className="relative">
        <SearchIcon className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Type to search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 py-6 text-lg rounded-xl shadow-sm bg-card border-2 border-transparent focus-visible:border-primary focus-visible:ring-0 transition-colors"
          autoFocus
        />
        {loading && <Loader2 className="absolute right-4 top-3.5 h-5 w-5 animate-spin text-muted-foreground" />}
      </div>

      {query.length > 0 && query.length < 2 && (
        <p className="text-sm text-muted-foreground text-center py-8">Please type at least 2 characters to search.</p>
      )}

      {query.length >= 2 && !loading && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <SearchIcon className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No results found</p>
          <p className="text-sm text-muted-foreground mt-1">We couldn&apos;t find anything matching &quot;{query}&quot;</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {sections.map(sec => {
            const secResults = results.filter(r => r.type === sec);
            if (secResults.length === 0) return null;

            return (
              <div key={sec} className="space-y-3">
                <h3 className="text-sm font-semibold capitalize text-muted-foreground px-1 border-b pb-2 flex items-center gap-2">
                  {icons[sec]} {sec}s ({secResults.length})
                </h3>
                <div className="space-y-2">
                  {secResults.map(r => (
                    <Link key={`${r.type}-${r.id}`} href={r.url} className="block group">
                      <Card className="transition-all hover:shadow-md hover:border-primary/50 group-hover:bg-accent/50">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="bg-card border rounded-md p-2 shadow-sm">
                            {icons[r.type]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <p className="font-semibold text-foreground truncate">{r.title}</p>
                              {r.status && (
                                <StatusBadge status={r.status} className="scale-90 origin-top-right ml-2" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate mt-0.5">{r.subtitle}</p>
                            {r.extra && (
                              <p className="text-xs font-medium text-muted-foreground mt-1">{r.extra}</p>
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
