'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/nav';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { EmptyState } from '@/components/empty-state';
import { ExportDropdown } from '@/components/export-dropdown';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function DiscountApprovalsPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingDiscounts();
  }, []);

  async function fetchPendingDiscounts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        *,
        order:orders(order_number, customer:customers(customer_name), sales_person:profiles!sales_person_id(full_name)),
        product:products(name, sku)
      `)
      .eq('discount_status', 'pending')
      .order('created_at', { ascending: false });
    
    if (data) setItems(data);
    setLoading(false);
  }

  async function handleApproval(itemId: string, isApproved: boolean) {
    if (!profile) return;
    
    const { error } = await supabase.rpc('fn_approve_discount', {
      p_order_item_id: itemId,
      p_is_approved: isApproved
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Discount ${isApproved ? 'approved' : 'rejected'}`);
      fetchPendingDiscounts();
    }
  }

  if (profile && !['admin', 'sales_manager'].includes(profile.role)) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <EmptyState 
          title="Access Denied" 
          description="Only Sales Managers and Admins can approve discounts."
          icon={AlertCircle} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Pending Discounts</h1>
          <p className="text-sm text-muted-foreground">Review and approve discount requests from Sales.</p>
        </div>
        <ExportDropdown
          filenameBase="pending_discounts"
          title="Pending Discounts Report"
          headers={['Order', 'Customer', 'Sales Rep', 'Product', 'Standard', 'Discount', 'Final Price', 'Reason']}
          rows={items.map((it) => [
            it.order?.order_number || '',
            it.order?.customer?.customer_name || '',
            it.order?.sales_person?.full_name || '',
            it.product?.name || '',
            `$${it.standard_price}`,
            `-$${it.discount_amount}`,
            `$${it.unit_price}`,
            it.discount_reason || ''
          ])}
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-card shadow-sm">
        {items.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No pending requests" description="There are currently no discount requests awaiting approval." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Sales Rep</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Standard</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Final Price</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(it => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.order?.order_number}</TableCell>
                  <TableCell>{it.order?.customer?.customer_name}</TableCell>
                  <TableCell>{it.order?.sales_person?.full_name}</TableCell>
                  <TableCell>{it.product?.name}</TableCell>
                  <TableCell>${it.standard_price}</TableCell>
                  <TableCell className="text-destructive">-${it.discount_amount}</TableCell>
                  <TableCell className="font-bold text-success">${it.unit_price}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={it.discount_reason}>{it.discount_reason}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="default" className="bg-success hover:bg-success/90" onClick={() => handleApproval(it.id, true)}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleApproval(it.id, false)}>
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
