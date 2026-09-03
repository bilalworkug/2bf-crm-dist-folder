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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/status-badge';
import { UserCog, UserPlus, Shield, KeyRound } from 'lucide-react';
import { ROLES, ROLE_LABELS } from '@/lib/types';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatDateShort } from '@/lib/format';
import { ExportDropdown } from '@/components/export-dropdown';

export default function UsersPage() {
  const { profile: current } = useAuth();
  const isAdmin = current?.role === 'admin';
  const [users, setUsers] = useState<(Profile & { warehouse?: Warehouse | null })[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState({ email: '', full_name: '', role: 'reports' as RoleKey, warehouse_id: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Reset Password state ────────────────────────────────────────────
  const [resetUser, setResetUser] = useState<Profile | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

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

  // ── Reset Password helpers ──────────────────────────────────────────
  function openResetPassword(u: Profile) {
    setResetUser(u);
    setResetPassword('');
    setResetConfirmPassword('');
    setResetOpen(true);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUser) return;
    if (isResetting) return;

    // Client-side validation
    if (!resetPassword.trim()) {
      toast.error('Password is required');
      return;
    }
    if (resetPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!resetConfirmPassword.trim()) {
      toast.error('Password confirmation is required');
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`/api/admin/users/${resetUser.id}/reset-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          password: resetPassword,
          confirmPassword: resetConfirmPassword,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.message || 'Failed to reset password');
        setIsResetting(false);
        return;
      }

      toast.success('Password reset successfully. Give the temporary password to the user securely.');
      setResetOpen(false);
      setResetUser(null);
      setResetPassword('');
      setResetConfirmPassword('');
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsResetting(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    if (editing) {
      const updates: Record<string, unknown> = {
        full_name: form.full_name,
        updated_at: new Date().toISOString(),
      };
      // Use secure RPC for role/active/warehouse changes
      const { error: roleErr } = await supabase.rpc('fn_admin_update_user_role', {
        p_user_id: editing.id,
        p_role: form.role,
        p_active: null,
        p_warehouse_id: form.warehouse_id || null,
      });
      if (roleErr) { toast.error(roleErr.message); setIsSubmitting(false); return; }
      // Update name separately (allowed by self-update policy for own, admin policy for others)
      const { error } = await supabase.from('profiles').update(updates).eq('id', editing.id);
      if (error) { toast.error(error.message); setIsSubmitting(false); return; }
      toast.success('User updated');
    } else {
      if (!form.password.trim()) {
        toast.error('Password is required for new users');
        setIsSubmitting(false);
        return;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role,
          warehouse_id: form.warehouse_id || null
        })
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.message || 'Failed to create user');
        setIsSubmitting(false);
        return;
      }
      
      toast.success('User created successfully');
    }
    setIsSubmitting(false);
    setOpen(false);
    load();
  }

  async function toggleActive(u: Profile) {
    const { error } = await supabase.rpc('fn_admin_update_user_role', {
      p_user_id: u.id,
      p_role: u.role,
      p_active: !u.active,
      p_warehouse_id: u.warehouse_id || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`User ${!u.active ? 'activated' : 'deactivated'}`);
    load();
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">Only administrators can manage users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Manage user accounts, role assignments, and permissions."
        actions={
          <div className="flex gap-2">
            <ExportDropdown
              filenameBase="users"
              title="Users Report"
              headers={['Name', 'Email', 'Role', 'Warehouse', 'Status', 'Created']}
              rows={users.map((u) => [u.full_name, u.email, ROLE_LABELS[u.role] || u.role, u.warehouse?.code || '—', u.active ? 'Active' : 'Inactive', formatDateShort(u.created_at)])}
            />
            <Button onClick={openNew}>
              <UserPlus className="mr-2 h-4 w-4" /> New user
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
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
            <div className="space-y-4">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
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
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="outline" onClick={() => openEdit(u)}>Edit</Button>
                          {u.id !== current?.id && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => openResetPassword(u)}>
                                <KeyRound className="mr-1 h-3 w-3" />Reset Password
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => toggleActive(u)}>
                                {u.active ? 'Deactivate' : 'Activate'}
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Stacked Cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {users.map((u) => (
                  <div key={u.id} className="border border-border/80 rounded-xl p-4 bg-card shadow-sm space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-bold text-sm text-foreground">{u.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <Badge variant={u.active ? 'success' : 'destructive'}>
                        {u.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center text-xs pt-1 border-t">
                      <Badge variant="info">{ROLE_LABELS[u.role] || u.role}</Badge>
                      <span className="text-muted-foreground">WH: {u.warehouse?.code ?? 'None'}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button size="sm" variant="outline" onClick={() => openEdit(u)} className="flex-1 h-10 touch-press">
                        Edit
                      </Button>
                      {u.id !== current?.id && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openResetPassword(u)} className="flex-1 h-10 touch-press">
                            <KeyRound className="mr-1 h-3.5 w-3.5" /> Reset
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toggleActive(u)} className="h-10 px-2 touch-press">
                            {u.active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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

      {/* ── Edit / Create User Dialog ────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit user' : 'New user'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" inputMode="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editing} className="h-11 sm:h-10 text-base sm:text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="h-11 sm:h-10 text-base sm:text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as RoleKey })}>
                  <SelectTrigger className="h-11 sm:h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Warehouse</Label>
                <Select value={form.warehouse_id} onValueChange={(v) => setForm({ ...form, warehouse_id: v === 'none' ? '' : v })}>
                  <SelectTrigger className="h-11 sm:h-10"><SelectValue placeholder="None" /></SelectTrigger>
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
                <Input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-11 sm:h-10 text-base sm:text-sm" />
              </div>
            )}
            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting} className="w-full sm:w-auto h-11 sm:h-10">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto h-11 sm:h-10">
                {isSubmitting ? 'Saving...' : editing ? 'Save changes' : 'Create user'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Dialog ────────────────────────────────────── */}
      <Dialog open={resetOpen} onOpenChange={(v) => { setResetOpen(v); if (!v) { setResetUser(null); setResetPassword(''); setResetConfirmPassword(''); } }}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Reset Password
            </DialogTitle>
          </DialogHeader>
          {resetUser && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* Target user info */}
              <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                <p className="text-sm font-medium">{resetUser.full_name ?? '—'}</p>
                <p className="text-sm text-muted-foreground">{resetUser.email}</p>
                {!resetUser.active && (
                  <Badge variant="destructive">Inactive</Badge>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reset-password">New Temporary Password *</Label>
                <Input
                  id="reset-password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reset-confirm-password">Confirm Temporary Password *</Label>
                <Input
                  id="reset-confirm-password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Re-enter temporary password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setResetOpen(false)} disabled={isResetting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isResetting} variant="default">
                  {isResetting ? 'Resetting...' : 'Reset Password'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
