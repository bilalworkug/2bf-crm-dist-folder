'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { BarcodeHistoryEntry, Warehouse, Product, Profile, Order, Customer } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { Search, ScanLine, ArrowRight, History } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/format';

interface SearchResult {
  barcode: string;
  action: string;
  performed_at: string;
  product?: Product;
  warehouse?: Warehouse;
  user?: Profile;
  order?: Order;
  customer?: Customer;
}

export default function BarcodeSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function doSearch(term: string) {
    setLoading(true);
    setSearched(true);
    const { data } = await supabase
      .from('barcode_history')
      .select('*, warehouse:warehouses(*), product:products(*), user:profiles!barcode_history_user_id_fkey(*), order:orders(*), customer:customers(*)')
      .ilike('barcode', `%${term}%`)
      .order('performed_at', { ascending: false })
      .limit(50);
    setResults((data ?? []) as SearchResult[]);
    setLoading(false);
  }

  useEffect(() => {
    // Load recent on mount
    doSearch('');
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Barcode Search"
        description="Search any barcode to see its full history across the system."
      />

      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              doSearch(query.trim());
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Enter barcode (e.g. 2BF-PROD-000001)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 font-mono"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={loading}>
              <ScanLine className="mr-2 h-4 w-4" />
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              title={searched ? 'No barcodes found' : 'Recent barcode activity'}
              description={searched ? 'Try a different search term.' : 'Search for a barcode to see its full history.'}
              icon={Search}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''} {query && `matching "${query}"`}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {results.map((r, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-foreground">{r.barcode}</p>
                      <p className="mt-0.5 text-xs uppercase tracking-wide text-primary">{r.action.replace(/_/g, ' ')}</p>
                    </div>
                    <Link href={`/box-history?barcode=${encodeURIComponent(r.barcode)}`}>
                      <Button variant="outline" size="sm">
                        <History className="mr-1.5 h-3.5 w-3.5" /> Trace
                      </Button>
                    </Link>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {r.product && <p>Product: <span className="text-foreground">{r.product.name}</span></p>}
                    {r.warehouse && <p>Warehouse: <span className="text-foreground">{r.warehouse.code} — {r.warehouse.name}</span></p>}
                    {r.order && <p>Order: <span className="text-foreground">{r.order.order_number}</span></p>}
                    {r.customer && <p>Customer: <span className="text-foreground">{r.customer.customer_name}</span></p>}
                    <p>By: <span className="text-foreground">{r.user?.full_name ?? '—'}</span> · {formatDate(r.performed_at)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
