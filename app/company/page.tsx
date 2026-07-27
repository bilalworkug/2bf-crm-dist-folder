'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { CompanySettings, Product, Warehouse } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { Logo } from '@/lib/logo';
import { Building2, Phone, Mail, Globe, MapPin, Package, Warehouse as WarehouseIcon, Factory } from 'lucide-react';

export default function CompanyPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

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
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Profile"
        description="About Two Brothers Food Complex P.L.C."
      />

      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="relative bg-sidebar p-8 text-sidebar-foreground sm:p-12">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, hsl(32 80% 50%) 0, transparent 40%), radial-gradient(circle at 70% 60%, hsl(38 90% 50%) 0, transparent 35%)' }} />
          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg">
              <svg viewBox="0 0 48 48" className="h-12 w-12" fill="none">
                <path d="M10 36V14h6v22h-6z" fill="white" />
                <path d="M18 36V14h5l4 13 4-13h5v22h-4V20l-4 13h-2l-4-13v16h-4z" fill="white" />
                <circle cx="38" cy="12" r="3" fill="#fbbf24" stroke="white" strokeWidth="1.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-sidebar-foreground">{settings?.company_name ?? 'Two Brothers Food Complex P.L.C'}</h2>
              <p className="mt-1 text-sidebar-foreground/70">{settings?.address ?? 'Addis Ababa, Ethiopia'}</p>
              <p className="mt-2 max-w-xl text-sm text-sidebar-foreground/60">
                A leading food manufacturing company producing quality biscuits, cookies, wafers, and chocolates
                for the Ethiopian market and beyond. Every box is traceable from production to customer.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Products" value={products.length} icon={Package} accent="primary" />
        <StatCard label="Warehouses" value={warehouses.length} icon={WarehouseIcon} accent="success" />
        <StatCard label="Currency" value={settings?.currency ?? 'ETB'} icon={Factory} accent="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" /> Contact information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ContactRow icon={Phone} label="Phone" value={settings?.phone} />
            <ContactRow icon={Mail} label="Email" value={settings?.email} />
            <ContactRow icon={Globe} label="Website" value={settings?.website} />
            <ContactRow icon={MapPin} label="Address" value={settings?.address} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <WarehouseIcon className="h-4 w-4 text-primary" /> Warehouses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {warehouses.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium text-foreground">{w.code} — {w.name}</p>
                    <p className="text-xs text-muted-foreground">{w.location ?? '—'}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{w.manager_name ?? 'Manager TBD'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-primary" /> Our products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <div key={p.id} className="rounded-lg border p-3">
                <p className="font-medium text-foreground">{p.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.category ?? '—'} · {p.sku ?? '—'}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
        <Logo variant="mark" />
        <span>Two Brothers Food Complex P.L.C — Factory System</span>
      </div>
    </div>
  );
}

function ContactRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-3 border-b pb-2 last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{value ?? '—'}</span>
    </div>
  );
}
