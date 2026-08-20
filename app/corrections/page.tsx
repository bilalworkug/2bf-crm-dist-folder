'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/nav';
import { format } from 'date-fns';
import { AlertCircle, History, Search, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/empty-state';

export default function CorrectionsHistoryPage() {
  const { profile } = useAuth();
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchCorrections();
  }, []);

  async function fetchCorrections() {
    setLoading(true);
    // Join with products, warehouses, orders, and profiles
    let query = supabase
      .from('correction_records')
      .select(`
        *,
        performed_by_profile:profiles!performed_by (full_name, email),
        old_product:products!old_product_id (name),
        new_product:products!new_product_id (name),
        old_warehouse:warehouses!old_warehouse_id (code),
        new_warehouse:warehouses!new_warehouse_id (code),
        old_order:orders!old_order_id (order_number),
        new_order:orders!new_order_id (order_number)
      `)
      .order('performed_at', { ascending: false });

    const { data, error } = await query;
    if (data) setCorrections(data);
    setLoading(false);
  }

  const filteredCorrections = corrections.filter(c => {
    if (filterType !== 'all' && c.correction_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.barcode.toLowerCase().includes(q) || 
             c.reason?.toLowerCase().includes(q) ||
             c.performed_by_profile?.full_name?.toLowerCase().includes(q);
    }
    return true;
  });

  if (profile && !canAccess('/corrections', profile.role)) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <EmptyState title="Access Denied" description="You do not have permission to view correction history." icon={AlertCircle} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <History className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Correction History</h1>
            <p className="text-sm text-muted-foreground">Audit log of all product and stock corrections.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select 
            className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="production">Production Corrections</option>
            <option value="warehouse">Warehouse Corrections</option>
            <option value="dispatch_reversal">Dispatch Reversals</option>
          </select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search barcode, reason..."
              className="pl-9 w-[250px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Barcode</th>
                <th className="px-4 py-3 font-medium">Details (Before → After)</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading corrections...</td>
                </tr>
              ) : filteredCorrections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No correction records found.</td>
                </tr>
              ) : (
                filteredCorrections.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {format(new Date(c.performed_at), 'MMM d, yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-amber-500/10 text-amber-500 ring-1 ring-inset ring-amber-500/20">
                        {c.correction_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{c.barcode}</td>
                    <td className="px-4 py-3">
                      {c.correction_type === 'production' && (
                        <div className="text-xs">
                          <span className="line-through opacity-70">{c.old_product?.name || 'Unknown'}</span>
                          <span className="mx-2">→</span>
                          <span className="font-medium text-emerald-500">{c.new_product?.name || 'Unknown'}</span>
                        </div>
                      )}
                      {c.correction_type === 'warehouse' && (
                        <div className="text-xs">
                          <span className="line-through opacity-70">{c.old_warehouse?.code || 'None'}</span>
                          <span className="mx-2">→</span>
                          <span className="font-medium text-emerald-500">{c.new_warehouse?.code || 'None'}</span>
                        </div>
                      )}
                      {c.correction_type === 'dispatch_reversal' && (
                        <div className="text-xs">
                          <span className="line-through opacity-70">Dispatched ({c.old_order?.order_number})</span>
                          <span className="mx-2">→</span>
                          <span className="font-medium text-amber-500">Allocated</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate" title={c.reason}>
                      {c.reason}
                    </td>
                    <td className="px-4 py-3">
                      {c.performed_by_profile?.full_name || 'Unknown'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
