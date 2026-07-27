'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { CompanySettings, Product, Warehouse } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings, Building2, Package, Warehouse as WarehouseIcon, Save, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';

export default function SettingsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, p, w] = await Promise.all([
        supabase.from('company_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('products').select('*').order('name'),
        supabase.from('warehouses').select('*').order('code'),
      ]);
      setSettings(s.data as CompanySettings | null);
      setProducts(p.data ?? []);
      setWarehouses(w.data ?? []);
      setLoading(false);
    })();
  }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    const { error } = await supabase
      .from('company_settings')
      .update({
        company_name: settings.company_name,
        short_name: settings.short_name,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        website: settings.website,
        currency: settings.currency,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    if (error) toast.error(error.message);
    else toast.success('Settings saved');
  }

  if (loading) return <div className="py-24 text-center text-muted-foreground">Loading settings...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Master Data"
        description="Company settings, products, and warehouses."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" /> Company information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveSettings} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Company name</Label>
              <Input value={settings?.company_name ?? ''} onChange={(e) => setSettings({ ...settings!, company_name: e.target.value })} disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label>Short name</Label>
              <Input value={settings?.short_name ?? ''} onChange={(e) => setSettings({ ...settings!, short_name: e.target.value })} disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={settings?.address ?? ''} onChange={(e) => setSettings({ ...settings!, address: e.target.value })} disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={settings?.phone ?? ''} onChange={(e) => setSettings({ ...settings!, phone: e.target.value })} disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={settings?.email ?? ''} onChange={(e) => setSettings({ ...settings!, email: e.target.value })} disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input value={settings?.website ?? ''} onChange={(e) => setSettings({ ...settings!, website: e.target.value })} disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Input value={settings?.currency ?? ''} onChange={(e) => setSettings({ ...settings!, currency: e.target.value })} disabled={!isAdmin} />
            </div>
            {isAdmin && (
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit"><Save className="mr-2 h-4 w-4" /> Save settings</Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-primary" /> Products ({products.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="font-mono text-sm">{p.sku ?? '—'}</TableCell>
                  <TableCell>{p.category ?? '—'}</TableCell>
                  <TableCell>{p.unit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <WarehouseIcon className="h-4 w-4 text-primary" /> Warehouses ({warehouses.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Manager</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-mono font-medium">{w.code}</TableCell>
                  <TableCell>{w.name}</TableCell>
                  <TableCell>{w.location ?? '—'}</TableCell>
                  <TableCell>{w.manager_name ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
