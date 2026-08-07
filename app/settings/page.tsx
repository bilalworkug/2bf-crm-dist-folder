'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Profile, Product, Warehouse, RoleKey } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { User, Phone, Save, Mail, Briefcase, Warehouse as WarehouseIcon, Package, Truck, Contact } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';

export default function SettingsPage() {
  const { profile, refresh } = useAuth();
  const isAdmin = profile?.role === 'admin';
  
  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Admin Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    
    (async () => {
      const [p, w] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('warehouses').select('*').order('code'),
      ]);
      setProducts(p.data ?? []);
      setWarehouses(w.data ?? []);
      setLoading(false);
    })();
  }, [isAdmin]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    
    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      toast.error('Full Name cannot be empty');
      return;
    }

    if (trimmedPhone && !/^\+?[0-9\s\-()]{7,20}$/.test(trimmedPhone)) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: trimmedName,
        phone: trimmedPhone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);
      
    setIsSaving(false);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Profile updated successfully');
      await refresh();
    }
  }

  if (!profile) return null;
  if (loading) return <div className="py-24 text-center text-muted-foreground">Loading settings...</div>;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your personal profile and preferences."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" /> My Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center border-b pb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary shrink-0">
                {fullName?.charAt(0) || profile.email.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-1">
                <h3 className="font-medium text-foreground">{fullName || profile.email}</h3>
                <p className="text-sm text-muted-foreground">{ROLE_LABELS[profile.role]}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="fullName" 
                    className="pl-9" 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)} 
                    placeholder="Enter your full name"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="phone" 
                    className="pl-9" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="email" className="pl-9" value={profile.email} disabled />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="role">Role</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="role" className="pl-9" value={ROLE_LABELS[profile.role]} disabled />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="employeeId">Employee ID</Label>
                <div className="relative">
                  <Contact className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="employeeId" className="pl-9" value={profile.id.substring(0, 8).toUpperCase()} disabled />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="department">Department</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="department" className="pl-9" value={ROLE_LABELS[profile.role].split(' ')[0]} disabled />
                </div>
              </div>
              
              {profile.warehouse_id && (
                <div className="space-y-1.5">
                  <Label htmlFor="warehouse">Assigned Warehouse</Label>
                  <div className="relative">
                    <WarehouseIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="warehouse" className="pl-9" value={profile.warehouse_id} disabled />
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="space-y-6 pt-4">
          <div className="border-b pb-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">System Administration</h2>
            <p className="text-sm text-muted-foreground mt-1">Master data and system configuration</p>
          </div>
          
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.slice(0, 5).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="font-mono text-sm">{p.sku ?? '—'}</TableCell>
                        <TableCell>{p.category ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {products.length > 5 && (
                  <div className="mt-4 text-center text-sm text-muted-foreground">
                    + {products.length - 5} more products
                  </div>
                )}
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warehouses.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-mono font-medium">{w.code}</TableCell>
                        <TableCell>{w.name}</TableCell>
                        <TableCell>{w.location ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            
            {/* Future Modules Placeholders */}
            <Card className="opacity-60 grayscale hover:grayscale-0 transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-4 w-4 text-primary" /> Vehicles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-4">Coming soon</p>
              </CardContent>
            </Card>
            
            <Card className="opacity-60 grayscale hover:grayscale-0 transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Contact className="h-4 w-4 text-primary" /> Drivers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-4">Coming soon</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
