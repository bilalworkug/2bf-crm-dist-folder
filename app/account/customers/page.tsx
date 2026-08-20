'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Customer } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import { Search, CreditCard, Users, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { ExportDropdown } from '@/components/export-dropdown';

interface CreditStatus {
  customer_id: string;
  customer_name: string;
  credit_allowed: boolean;
  credit_limit: number;
  outstanding: number;
  available_credit: number;
  payment_terms_days: number;
  active: boolean;
  notes: string | null;
}

export default function CustomerCreditPage() {
  const { profile } = useAuth();
  const isManager = profile?.role === 'admin' || profile?.role === 'accounts_manager';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [creditData, setCreditData] = useState<Map<string, CreditStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, allowed, not_allowed

  // Dialog State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    credit_allowed: false,
    credit_limit: 0,
    payment_terms_days: 30,
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isManager) {
      loadData();
    }
  }, [isManager]);

  async function loadData() {
    setLoading(true);
    try {
      // Load all customers
      const { data: custs, error: custErr } = await supabase.from('customers').select('*').order('customer_name');
      if (custErr) throw custErr;
      setCustomers(custs ?? []);

      // Load credit status for each customer via RPC
      // Note: In a real very large DB, you'd paginate this or have a view. For this phase, we map over customers.
      const map = new Map<string, CreditStatus>();
      
      // Batch loading could be better, but we only have 1 RPC that takes single ID.
      // Fetching raw data is faster for bulk.
      const { data: settings, error: setErr } = await supabase.from('customer_credit_settings').select('*');
      if (setErr) throw setErr;

      // We also need outstanding debt. Let's do a bulk query for outstanding credit orders
      const { data: orders, error: ordErr } = await supabase
        .from('orders')
        .select('customer_id, total_amount, paid_amount')
        .eq('payment_type', 'credit')
        .not('status', 'eq', 'cancelled');
        
      if (ordErr) throw ordErr;

      const outstandingMap = new Map<string, number>();
      orders?.forEach(o => {
          const debt = (Number(o.total_amount) - Number(o.paid_amount));
          if (debt > 0) {
              outstandingMap.set(o.customer_id, (outstandingMap.get(o.customer_id) || 0) + debt);
          }
      });

      for (const c of (custs ?? [])) {
        const setting = settings?.find(s => s.customer_id === c.id);
        const outstanding = outstandingMap.get(c.id) || 0;
        
        let allowed = false;
        let limit = 0;
        let terms = 30;
        let active = false;
        let notes = null;

        if (setting) {
            allowed = setting.credit_allowed;
            limit = Number(setting.credit_limit);
            terms = setting.payment_terms_days;
            active = setting.active;
            notes = setting.notes;
        }

        map.set(c.id, {
          customer_id: c.id,
          customer_name: c.customer_name,
          credit_allowed: allowed && active,
          credit_limit: limit,
          outstanding,
          available_credit: Math.max(0, limit - outstanding),
          payment_terms_days: terms,
          active: setting ? setting.active : true, // default new ones to true
          notes: notes,
        });
      }
      
      setCreditData(map);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let res = customers.map(c => creditData.get(c.id)!).filter(Boolean);
    
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(r => r.customer_name.toLowerCase().includes(q));
    }
    
    if (filter === 'allowed') {
      res = res.filter(r => r.credit_allowed);
    } else if (filter === 'not_allowed') {
      res = res.filter(r => !r.credit_allowed);
    }
    
    return res;
  }, [customers, creditData, search, filter]);

  // KPIs
  const totalAllowed = Array.from(creditData.values()).filter(v => v.credit_allowed).length;
  const totalExposure = Array.from(creditData.values()).reduce((sum, v) => sum + (v.credit_allowed ? v.credit_limit : 0), 0);
  const totalAvailable = Array.from(creditData.values()).reduce((sum, v) => sum + (v.credit_allowed ? v.available_credit : 0), 0);

  const openManageDialog = (customerId: string) => {
    const data = creditData.get(customerId);
    if (!data) return;
    
    setSelectedCustomerId(customerId);
    setForm({
      credit_allowed: data.credit_allowed,
      credit_limit: data.credit_limit,
      payment_terms_days: data.payment_terms_days,
      notes: data.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.rpc('fn_upsert_customer_credit', {
        p_customer_id: selectedCustomerId,
        p_credit_allowed: form.credit_allowed,
        p_credit_limit: form.credit_limit,
        p_payment_terms_days: form.payment_terms_days,
        p_notes: form.notes || null,
      });

      if (error) throw error;
      
      toast.success('Credit settings updated successfully');
      setIsDialogOpen(false);
      loadData(); // refresh
    } catch (err: any) {
      toast.error(err.message || 'Failed to update credit settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isManager) {
    return <div className="p-8"><EmptyState title="Access Denied" description="Only Account Managers and Admins can manage customer credit." /></div>;
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Customer Credit Management"
        description="Authorize and manage customer credit limits and payment terms."
      />
      
      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 space-y-6">
        
        {/* KPI Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <ShieldAlert className="w-4 h-4 mr-2" /> Credit Enabled Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAllowed} <span className="text-sm font-normal text-muted-foreground">/ {customers.length}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <CreditCard className="w-4 h-4 mr-2" /> Total Credit Exposure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(totalExposure)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-2" /> Total Available Credit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatMoney(totalAvailable)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Table */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Credit Limits</CardTitle>
            <CardDescription>Manage who is allowed to purchase on credit.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search customer name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="allowed">Credit Allowed</SelectItem>
                  <SelectItem value="not_allowed">Credit Disabled</SelectItem>
                </SelectContent>
              </Select>
              <ExportDropdown
                filenameBase="customer_credit"
                title="Customer Credit Report"
                headers={['Customer', 'Credit Allowed', 'Credit Limit', 'Outstanding', 'Available Credit', 'Payment Terms (days)']}
                rows={filtered.map((r) => [r.customer_name, r.credit_allowed ? 'Yes' : 'No', r.credit_limit, r.outstanding, r.available_credit, r.payment_terms_days])}
              />
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />)}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState title="No customers found" />
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Credit</TableHead>
                        <TableHead className="text-right">Limit</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="text-right">Due Terms</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(row => (
                        <TableRow key={row.customer_id}>
                          <TableCell className="font-medium">{row.customer_name}</TableCell>
                          <TableCell>
                            {row.credit_allowed ? 
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none"><CheckCircle2 className="w-3 h-3 mr-1"/> YES</Badge> : 
                              <Badge variant="outline" className="text-muted-foreground"><XCircle className="w-3 h-3 mr-1"/> NO</Badge>
                            }
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatMoney(row.credit_limit)}</TableCell>
                          <TableCell className="text-right font-mono text-red-600">{formatMoney(row.outstanding)}</TableCell>
                          <TableCell className="text-right font-mono font-medium text-green-600">{formatMoney(row.available_credit)}</TableCell>
                          <TableCell className="text-right">{row.credit_allowed ? `${row.payment_terms_days} days` : '—'}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => openManageDialog(row.customer_id)}>
                              Manage
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Manage Customer Credit</DialogTitle>
            <DialogDescription>
              {creditData.get(selectedCustomerId!)?.customer_name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            
            <div className="flex items-center justify-between border rounded-md p-3">
                <div className="space-y-0.5">
                    <Label className="text-base">Credit Allowed</Label>
                    <p className="text-sm text-muted-foreground">Allow this customer to create debt orders.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={form.credit_allowed ? "yes" : "no"} onValueChange={(v) => setForm({...form, credit_allowed: v === 'yes'})}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="yes" className="text-green-600 font-medium">YES</SelectItem>
                            <SelectItem value="no">NO</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {form.credit_allowed && (
                <>
                <div className="space-y-1.5 pt-2">
                    <Label>Credit Limit (ETB)</Label>
                    <Input 
                        type="number" 
                        min={0}
                        step={100}
                        required 
                        value={form.credit_limit} 
                        onChange={(e) => setForm({...form, credit_limit: Number(e.target.value)})} 
                        className="font-mono text-lg"
                    />
                </div>

                <div className="space-y-1.5 pt-2">
                    <Label>Payment Terms (Days)</Label>
                    <div className="flex items-center gap-2">
                        <Input 
                            type="number" 
                            min={0} 
                            max={365}
                            required 
                            value={form.payment_terms_days} 
                            onChange={(e) => setForm({...form, payment_terms_days: Number(e.target.value)})} 
                        />
                        <span className="text-muted-foreground text-sm">days due</span>
                    </div>
                </div>
                </>
            )}

            <div className="space-y-1.5 pt-2">
                <Label>Notes (Optional)</Label>
                <Textarea 
                    value={form.notes} 
                    onChange={(e) => setForm({...form, notes: e.target.value})} 
                    placeholder="Approval reason or specific conditions..." 
                />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Credit Settings'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
