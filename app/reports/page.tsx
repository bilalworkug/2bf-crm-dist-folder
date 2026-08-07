'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GenericReport } from '@/components/reports/generic-report';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export default function ReportsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [p, w, c] = await Promise.all([
        supabase.from('products').select('id, name'),
        supabase.from('warehouses').select('id, code'),
        supabase.from('customers').select('id, customer_name'),
      ]);
      setProducts(p.data || []);
      setWarehouses(w.data || []);
      setCustomers(c.data || []);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports Center"
        description="Comprehensive reporting across all departments."
      />

      <Tabs defaultValue="production" className="w-full">
        <ScrollArea className="w-full border-b pb-2">
          <TabsList className="mb-2 w-max justify-start flex-nowrap">
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="dispatch">Dispatch</TabsTrigger>
            <TabsTrigger value="delivery">Delivery</TabsTrigger>
            <TabsTrigger value="returns">Returns</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="discounts">Discounts</TabsTrigger>
            <TabsTrigger value="corrections">Corrections</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <div className="mt-4">
          <TabsContent value="production">
            <GenericReport 
              tableName="production_scans"
              selectQuery="*, product:products(name), scanner:profiles!production_scans_scanned_by_fkey(full_name)"
              dateField="scanned_at"
              productField="product_id"
              products={products}
              columns={[
                { key: 'barcode', label: 'Barcode' },
                { key: 'product.name', label: 'Product' },
                { key: 'quantity', label: 'Quantity' },
                { key: 'scanner.full_name', label: 'Scanner' },
                { key: 'scanned_at', label: 'Date', format: 'date' }
              ]}
            />
          </TabsContent>

          <TabsContent value="inventory">
            <GenericReport 
              tableName="boxes"
              selectQuery="*, product:products(name), warehouse:warehouses(code)"
              dateField="created_at"
              warehouseField="current_warehouse_id"
              productField="product_id"
              statusField="status"
              products={products}
              warehouses={warehouses}
              statuses={['produced', 'in_warehouse', 'allocated', 'dispatched', 'delivered', 'damaged', 'expired', 'returned']}
              columns={[
                { key: 'barcode', label: 'Barcode' },
                { key: 'product.name', label: 'Product' },
                { key: 'status', label: 'Status' },
                { key: 'warehouse.code', label: 'Warehouse' },
                { key: 'created_at', label: 'Created At', format: 'date' }
              ]}
            />
          </TabsContent>

          <TabsContent value="warehouses">
            <GenericReport 
              tableName="warehouse_receipts"
              selectQuery="*, product:products(name), warehouse:warehouses(code), receiver:profiles(full_name)"
              dateField="received_at"
              warehouseField="warehouse_id"
              productField="product_id"
              products={products}
              warehouses={warehouses}
              columns={[
                { key: 'barcode', label: 'Barcode' },
                { key: 'product.name', label: 'Product' },
                { key: 'warehouse.code', label: 'Warehouse' },
                { key: 'receiver.full_name', label: 'Receiver' },
                { key: 'received_at', label: 'Received At', format: 'date' }
              ]}
            />
          </TabsContent>

          <TabsContent value="transfers">
            <GenericReport 
              tableName="warehouse_transfers"
              selectQuery="*, source:warehouses!warehouse_transfers_source_warehouse_id_fkey(code), destination:warehouses!warehouse_transfers_destination_warehouse_id_fkey(code), creator:profiles!warehouse_transfers_created_by_fkey(full_name)"
              dateField="created_at"
              statusField="status"
              statuses={['draft', 'sent', 'receiving', 'completed', 'cancelled']}
              columns={[
                { key: 'transfer_number', label: 'Transfer #' },
                { key: 'status', label: 'Status' },
                { key: 'source.code', label: 'Source WH' },
                { key: 'destination.code', label: 'Destination WH' },
                { key: 'creator.full_name', label: 'Created By' },
                { key: 'created_at', label: 'Date', format: 'date' }
              ]}
            />
          </TabsContent>

          <TabsContent value="sales">
            <GenericReport 
              tableName="orders"
              selectQuery="*, customer:customers(customer_name), salesperson:profiles!orders_salesperson_id_fkey(full_name)"
              dateField="created_at"
              customerField="customer_id"
              statusField="status"
              customers={customers}
              statuses={['pending', 'approved', 'rejected', 'allocated', 'dispatched', 'partially_delivered', 'delivered']}
              columns={[
                { key: 'order_number', label: 'Order #' },
                { key: 'customer.customer_name', label: 'Customer' },
                { key: 'salesperson.full_name', label: 'Salesperson' },
                { key: 'total_amount', label: 'Total Value', format: 'money' },
                { key: 'status', label: 'Status' },
                { key: 'created_at', label: 'Date', format: 'date' }
              ]}
            />
          </TabsContent>

          <TabsContent value="customers">
            <GenericReport 
              tableName="customers"
              selectQuery="*"
              dateField="created_at"
              columns={[
                { key: 'customer_name', label: 'Customer Name' },
                { key: 'company_name', label: 'Company' },
                { key: 'phone', label: 'Phone' },
                { key: 'email', label: 'Email' },
                { key: 'status', label: 'Status' }
              ]}
            />
          </TabsContent>
          
          <TabsContent value="orders">
            <GenericReport 
              tableName="orders"
              selectQuery="*, customer:customers(customer_name)"
              dateField="created_at"
              customerField="customer_id"
              customers={customers}
              columns={[
                { key: 'order_number', label: 'Order #' },
                { key: 'customer.customer_name', label: 'Customer' },
                { key: 'total_amount', label: 'Total', format: 'money' },
                { key: 'paid_amount', label: 'Paid', format: 'money' },
                { key: 'status', label: 'Status' },
                { key: 'created_at', label: 'Date', format: 'date' }
              ]}
            />
          </TabsContent>

          <TabsContent value="dispatch">
            <GenericReport 
              tableName="dispatches"
              selectQuery="*, order:orders(order_number, customer:customers(customer_name)), dispatcher:profiles!dispatches_dispatched_by_fkey(full_name)"
              dateField="dispatched_at"
              columns={[
                { key: 'barcode', label: 'Barcode' },
                { key: 'order.order_number', label: 'Order #' },
                { key: 'order.customer.customer_name', label: 'Customer' },
                { key: 'dispatcher.full_name', label: 'Dispatcher' },
                { key: 'dispatched_at', label: 'Date', format: 'date' }
              ]}
            />
          </TabsContent>

          <TabsContent value="delivery">
            <GenericReport 
              tableName="deliveries"
              selectQuery="*, order:orders(order_number, customer:customers(customer_name)), dispatcher:profiles!deliveries_dispatched_by_fkey(full_name)"
              dateField="created_at"
              statusField="status"
              statuses={['pending', 'in_transit', 'delivered', 'failed', 'cancelled']}
              columns={[
                { key: 'delivery_number', label: 'Delivery #' },
                { key: 'order.order_number', label: 'Order #' },
                { key: 'order.customer.customer_name', label: 'Customer' },
                { key: 'status', label: 'Status' },
                { key: 'driver_name', label: 'Driver' },
                { key: 'created_at', label: 'Date', format: 'date' }
              ]}
            />
          </TabsContent>

          <TabsContent value="returns">
            <GenericReport 
              tableName="returns"
              selectQuery="*, product:products(name), processor:profiles(full_name)"
              dateField="processed_at"
              productField="product_id"
              statusField="status"
              products={products}
              statuses={['pending', 'approved', 'rejected']}
              columns={[
                { key: 'barcode', label: 'Barcode' },
                { key: 'product.name', label: 'Product' },
                { key: 'return_type', label: 'Return Type' },
                { key: 'status', label: 'Status' },
                { key: 'processor.full_name', label: 'Processor' },
                { key: 'processed_at', label: 'Date', format: 'date' }
              ]}
            />
          </TabsContent>

          <TabsContent value="payments">
            <GenericReport 
              tableName="payments"
              selectQuery="*, order:orders(order_number, customer:customers(customer_name)), recorded_by:profiles(full_name)"
              dateField="payment_date"
              columns={[
                { key: 'order.order_number', label: 'Order #' },
                { key: 'order.customer.customer_name', label: 'Customer' },
                { key: 'amount', label: 'Amount', format: 'money' },
                { key: 'payment_method', label: 'Method' },
                { key: 'reference_number', label: 'Ref #' },
                { key: 'payment_date', label: 'Date', format: 'date' }
              ]}
            />
          </TabsContent>

          <TabsContent value="products">
            <GenericReport 
              tableName="products"
              selectQuery="*"
              dateField="created_at"
              columns={[
                { key: 'sku', label: 'SKU' },
                { key: 'name', label: 'Name' },
                { key: 'category', label: 'Category' },
                { key: 'status', label: 'Status' }
              ]}
            />
          </TabsContent>

          <TabsContent value="discounts">
            <GenericReport 
              tableName="approvals"
              selectQuery="*, requester:profiles(full_name)"
              dateField="created_at"
              statusField="status"
              statuses={['pending', 'approved', 'rejected']}
              columns={[
                { key: 'request_type', label: 'Type' },
                { key: 'target_id', label: 'Target ID' },
                { key: 'status', label: 'Status' },
                { key: 'requester.full_name', label: 'Requester' },
                { key: 'created_at', label: 'Date', format: 'date' }
              ]}
            />
          </TabsContent>

          <TabsContent value="corrections">
            <GenericReport 
              tableName="correction_records"
              selectQuery="*, user:profiles(full_name)"
              dateField="corrected_at"
              columns={[
                { key: 'barcode', label: 'Barcode' },
                { key: 'department', label: 'Department' },
                { key: 'field_changed', label: 'Field' },
                { key: 'old_value', label: 'Old Value' },
                { key: 'new_value', label: 'New Value' },
                { key: 'user.full_name', label: 'User' },
                { key: 'corrected_at', label: 'Date', format: 'date' }
              ]}
            />
          </TabsContent>

          <TabsContent value="audit">
            <GenericReport 
              tableName="audit_logs"
              selectQuery="*, user:profiles(full_name)"
              dateField="created_at"
              columns={[
                { key: 'action', label: 'Action' },
                { key: 'entity_type', label: 'Entity Type' },
                { key: 'entity_id', label: 'Entity ID' },
                { key: 'user.full_name', label: 'User' },
                { key: 'created_at', label: 'Date', format: 'date' }
              ]}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
