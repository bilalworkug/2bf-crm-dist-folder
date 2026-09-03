'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Customer, Profile } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { Users, UserPlus, Search, Phone, MapPin, Building2, Download } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDateShort } from '@/lib/format';
import { ExportDropdown } from '@/components/export-dropdown';
import { SavedViewsBar } from '@/components/saved-views-bar';

export default function CustomersPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<(Customer & { sales_person?: Profile | null; order_count?: number })[]>([]);
  const [viewFilter, setViewFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', customer_name: '', company_name: '',
    phone: '', email: '', location: '', contact_person: '', notes: '',
  });

  const canEdit = profile && ['admin', 'sales', 'accounts', 'manager'].includes(profile.role);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('*, sales_person:profiles!customers_sales_person_id_fkey(*)')
      .order('created_at', { ascending: false });
    const customers = (data ?? []) as (Customer & { sales_person?: Profile | null })[];
    const withCounts = await Promise.all(
      customers.map(async (c) => {
        const { count } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', c.id);
        return { ...c, order_count: count ?? 0 };
      })
    );
    setCustomers(withCounts);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter((c) => {
      if (viewFilter === 'with_orders' && (c.order_count ?? 0) === 0) return false;
      if (viewFilter === 'without_orders' && (c.order_count ?? 0) > 0) return false;
      if (!q) return true;
      return (
        c.customer_name.toLowerCase().includes(q) ||
        c.company_name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q)
      );
    });
  }, [customers, search, viewFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    const { error } = await supabase.from('customers').insert({
      ...form,
      sales_person_id: profile?.id,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Customer created');
      setOpen(false);
      setForm({ first_name: '', last_name: '', customer_name: '', company_name: '', phone: '', email: '', location: '', contact_person: '', notes: '' });
      load();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage customer records and view their order history."
        actions={
          canEdit ? (
            <div className="flex gap-2">
              <ExportDropdown
                filenameBase="customers"
                title="Customers Report"
                headers={['Name', 'Company', 'Phone', 'Email', 'Location', 'Orders', 'Created']}
                rows={filtered.map((c) => [c.customer_name, c.company_name ?? '', c.phone ?? '', c.email ?? '', c.location ?? '', c.order_count ?? 0, formatDateShort(c.created_at)])}
              />
              <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="h-11 sm:h-10 touch-press"><UserPlus className="mr-2 h-4 w-4" /> New customer</Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New customer</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>First name</Label>
                      <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="h-11 sm:h-10 text-base sm:text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Last name</Label>
                      <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="h-11 sm:h-10 text-base sm:text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Customer name *</Label>
                    <Input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="h-11 sm:h-10 text-base sm:text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company name</Label>
                    <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="h-11 sm:h-10 text-base sm:text-sm" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Phone</Label>
                      <Input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-11 sm:h-10 text-base sm:text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input type="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11 sm:h-10 text-base sm:text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Location</Label>
                    <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="h-11 sm:h-10 text-base sm:text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact person</Label>
                    <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="h-11 sm:h-10 text-base sm:text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                  <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto h-11 sm:h-10">Cancel</Button>
                    <Button type="submit" className="w-full sm:w-auto h-11 sm:h-10">Create customer</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Total customers" value={customers.length} icon={Users} accent="primary" />
        <StatCard label="With orders" value={customers.filter((c) => (c.order_count ?? 0) > 0).length} icon={Building2} accent="success" />
        <StatCard label="Filtered results" value={filtered.length} icon={Search} accent="neutral" />
      </div>

      <Card>
        <CardContent className="p-4">
          <SavedViewsBar
            storageKey="customers"
            views={[
              { id: 'all', label: 'All Customers', badge: customers.length },
              { id: 'with_orders', label: 'Active with Orders', badge: customers.filter((c) => (c.order_count ?? 0) > 0).length },
              { id: 'without_orders', label: 'New / No Orders', badge: customers.filter((c) => (c.order_count ?? 0) === 0).length },
            ]}
            activeView={viewFilter}
            onSelectView={(v) => setViewFilter(v)}
            className="mb-3.5 pb-2 border-b border-border/50"
          />

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, company, phone, email, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 sm:h-10 text-base sm:text-sm"
            />
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No customers found" description="Try adjusting your search or create a new customer." />
          ) : (
            <div className="space-y-4">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-center">Orders</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/customers/detail?id=${c.id}`)}>
                          <TableCell className="font-medium">
                            <div>
                              <p className="text-foreground">{c.customer_name}</p>
                              <p className="text-xs text-muted-foreground">{c.email ?? '—'}</p>
                            </div>
                          </TableCell>
                          <TableCell>{c.company_name ?? '—'}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1.5 text-sm">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              {c.phone ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1.5 text-sm">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              {c.location ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-medium">{c.order_count ?? 0}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDateShort(c.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Stacked Cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filtered.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/customers/detail?id=${c.id}`)}
                    className="border border-border/80 rounded-xl p-4 bg-card shadow-sm space-y-2.5 cursor-pointer touch-press"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-bold text-sm text-foreground">{c.customer_name}</p>
                        {c.company_name && (
                          <p className="text-xs text-muted-foreground">{c.company_name}</p>
                        )}
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                        {c.order_count ?? 0} orders
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t">
                      <span className="flex items-center gap-1 truncate">
                        <Phone className="h-3 w-3 shrink-0" />
                        {c.phone ?? 'No phone'}
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {c.location ?? 'No location'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t">
                      <span className="truncate">{c.email ?? 'No email'}</span>
                      <span>Joined {formatDateShort(c.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
