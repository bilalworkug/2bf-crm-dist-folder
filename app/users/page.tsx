'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Profile, RoleKey, Warehouse } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/status-badge';
import { UserCog, UserPlus, Shield, Building2 } from 'lucide-react';
import { ROLES, ROLE_LABELS } from '@/lib/types';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDateShort } from '@/lib/format';

export default function UsersPage() {
  const { profile: current } = useAuth();
  const [users, setUsers] = useState<(Profile & { warehouse?: Warehouse | null })[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState({ email: '', full_name: '', role: 'reports' as RoleKey, warehouse_id: '', password: '' });

  useEffect(() => {
    load();
    (async () => {
      const { data } = await supabase.from('warehouses').select('*').order('code');
      setWarehouses(data ?? []);
    })();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*, warehouse:warehouses(*)')
      .order('created_at', { ascending: false });
    setUsers((data ?? []) as (Profile & { warehouse?: Warehouse | null })[]);
    setLoading(false);
  }

  function openEdit(u: Profile) {
    setEditing(u);
    setForm({ email: u.email, full_name: u.full_name ?? '', role: u.role, warehouse_id: u.warehouse_id ?? '', password: '' });
    setOpen(true);
  }

  function openNew() {
    setEditing(null);
    setForm({ email: '', full_name: '', role: 'reports', warehouse_id: '', password: '' });
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (editing) {
      const updates: Record<string, unknown> = {
        full_name: form.full_name,
        role: form.role,
        warehouse_id: form.warehouse_id || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('profiles').update(updates).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('User updated');
    } else {
      if (!form.password.trim()) {
        toast.error('Password is required for new users');
        return;
      }
      const { data: created, error: authErr } = await supabase.auth.admin.createUser({
        email: form.email,
        password: form.password,
        email_confirm: true,
      });
      if (authErr || !created?.user) {
        toast.error(authErr?.message ?? 'Failed to create user');
        return;
      }
      const { error: profileErr } = await supabase.from('profiles').insert({
        id: created.user.id,
        email: form.email,
        full_name: form.full_name,
        role: form.role,
        warehouse_id: form.warehouse_id || null,
        active: true,
      });
      if (profileErr) { toast.error(profileErr.message); return; }
      toast.success('User created');
    }
    setOpen(false);
    load();
  }

  async function toggleActive(u: Profile) {
    const { error } = await supabase
      .from('profiles')
      .update({ active: !u.active, updated_at: new Date().toISOString() })
      .eq('id', u.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`User ${!u.active ? 'activated' : 'deactivated'}`);
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Manage user accounts, role assignments, and permissions."
        actions={
          <Button onClick={openNew}>
            <UserPlus className="mr-2 h-4 w-4" /> New user
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total users" value={users.length} icon={UserCog} accent="primary" />
        <StatCard label="Active users" value={users.filter((u) => u.active).length} icon={Shield} accent="success" />
        <StatCard label="Roles defined" value={ROLES.length} icon={Shield} accent="neutral" />
      </div>

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name ?? '—'}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell><Badge variant="info">{ROLE_LABELS[u.role]}</Badge></TableCell>
                    <TableCell>{u.warehouse?.code ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={u.active ? 'success' : 'destructive'}>{u.active ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateShort(u.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(u)}>Edit</Button>
                      {u.id !== current?.id && (
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(u)} className="ml-1">
                          {u.active ? 'Deactivate' : 'Activate'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Role permissions overview</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.key} className="rounded-lg border p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Shield className="h-3.5 w-3.5 text-primary" /> {r.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit user' : 'New user'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editing} />
            </div>
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as RoleKey })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Warehouse</Label>
                <Select value={form.warehouse_id} onValueChange={(v) => setForm({ ...form, warehouse_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <Label>Password *</Label>
                <Input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save changes' : 'Create user'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
