'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';

export interface SearchResult {
  type: 'barcode' | 'customer' | 'order' | 'product' | 'transfer';
  id: string;
  title: string;
  subtitle: string;
  status?: string;
  url: string;
  extra?: string;
}

export function useGlobalSearch(query: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    if (!query || query.length < 2 || !profile) {
      setResults([]);
      return;
    }

    let active = true;
    const fetchResults = async () => {
      setLoading(true);
      
      const q = `%${query}%`;
      const role = profile.role;

      // Determine what this user is allowed to see
      const canSeeCustomers = ['admin', 'sales', 'sales_manager', 'accounts', 'accounts_manager', 'manager', 'reports'].includes(role);
      const canSeeOrders = ['admin', 'sales', 'sales_manager', 'dispatch', 'dispatch_manager', 'accounts', 'accounts_manager', 'manager', 'reports'].includes(role);
      const canSeeTransfers = ['admin', 'warehouse', 'warehouse_manager', 'manager', 'reports'].includes(role);
      
      const promises = [];

      // 1. Search Barcodes (boxes)
      promises.push(
        supabase.from('boxes').select('id, barcode, status, product:products(name), current_warehouse_id, current_warehouse:warehouses(code)').ilike('barcode', q).limit(5)
      );

      // 2. Search Products
      promises.push(
        supabase.from('products').select('id, name, sku, status').or(`name.ilike.${q},sku.ilike.${q}`).limit(5)
      );

      // 3. Search Customers
      if (canSeeCustomers) {
        promises.push(
          supabase.from('customers').select('id, customer_name, phone, company_name').or(`customer_name.ilike.${q},company_name.ilike.${q},phone.ilike.${q}`).limit(5)
        );
      } else {
        promises.push(Promise.resolve({ data: [] }));
      }

      // 4. Search Orders
      if (canSeeOrders) {
        promises.push(
          supabase.from('orders').select('id, order_number, status, total_amount, customer:customers(customer_name)').ilike('order_number', q).limit(5)
        );
      } else {
        promises.push(Promise.resolve({ data: [] }));
      }

      // 5. Search Transfers
      if (canSeeTransfers) {
        promises.push(
          supabase.from('warehouse_transfers').select('id, transfer_number, status, source:warehouses!warehouse_transfers_source_warehouse_id_fkey(code), destination:warehouses!warehouse_transfers_destination_warehouse_id_fkey(code)').ilike('transfer_number', q).limit(5)
        );
      } else {
        promises.push(Promise.resolve({ data: [] }));
      }

      const [boxesRes, productsRes, customersRes, ordersRes, transfersRes] = await Promise.all(promises);

      if (!active) return;

      const combined: SearchResult[] = [];

      let boxesData: any[] = (boxesRes.data || []) as any[];
      if (role === 'warehouse' && profile.warehouse_id) {
        boxesData = boxesData.filter(b => b.current_warehouse_id === profile.warehouse_id);
      } else if (role === 'sales') {
        boxesData = boxesData.filter(b => ['in_warehouse', 'returned'].includes(b.status));
      }

      boxesData.forEach((b: any) => {
        combined.push({
          type: 'barcode',
          id: b.id,
          title: b.barcode,
          subtitle: b.product?.name || 'Unknown Product',
          status: b.status,
          url: `/barcode-search?q=${b.barcode}`,
          extra: b.current_warehouse ? `WH: ${b.current_warehouse.code}` : ''
        });
      });

      (productsRes.data || []).forEach((p: any) => {
        combined.push({
          type: 'product',
          id: p.id,
          title: p.name,
          subtitle: `SKU: ${p.sku}`,
          status: p.status,
          url: `/products`, // No dedicated product detail page yet, just a generic link
          extra: ''
        });
      });

      (customersRes.data || []).forEach((c: any) => {
        combined.push({
          type: 'customer',
          id: c.id,
          title: c.customer_name,
          subtitle: c.company_name || 'Individual',
          url: `/customers/detail?id=${c.id}`,
          extra: c.phone || ''
        });
      });

      (ordersRes.data || []).forEach((o: any) => {
        combined.push({
          type: 'order',
          id: o.id,
          title: `Order ${o.order_number}`,
          subtitle: o.customer?.customer_name || 'Unknown',
          status: o.status,
          url: `/orders/detail?id=${o.id}`,
          extra: `$${Number(o.total_amount || 0).toFixed(2)}`
        });
      });

      (transfersRes.data || []).forEach((t: any) => {
        combined.push({
          type: 'transfer',
          id: t.id,
          title: `Transfer ${t.transfer_number}`,
          subtitle: `${t.source?.code || '?'} → ${t.destination?.code || '?'}`,
          status: t.status,
          url: `/warehouse/transfers`,
          extra: ''
        });
      });

      setResults(combined);
      setLoading(false);
    };

    const timer = setTimeout(fetchResults, 300); // debounce
    return () => { active = false; clearTimeout(timer); };
  }, [query, profile]);

  return { results, loading };
}
