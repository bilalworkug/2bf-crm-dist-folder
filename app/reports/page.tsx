'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GenericReport } from '@/components/reports/generic-report';
import { ManagementReport } from '@/components/reports/management-report';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export default function ReportsPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

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

  if (authLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!profile) return null; // Let middleware handle login redirect

  const role = profile.role;
  const isProd = role === 'production';
  const isWh = role === 'warehouse';
  
  if (isProd || isWh) {
    return <div className="p-8 text-center text-red-500 font-bold">403 - Unauthorized. You do not have permission to view reports.</div>;
  }

  const isSales = role === 'sales' || role === 'sales_manager';
  const isDispatch = role === 'dispatch' || role === 'dispatch_manager';
  const isAccounts = role === 'accounts';
  const isReturnsManager = role === 'returns_manager';
  const hasFullAccess = role === 'admin' || role === 'manager' || role === 'reports';

  const canSeeProduction = hasFullAccess || role === 'production_manager';
  const canSeeSales = hasFullAccess || isSales || isAccounts;
  const canSeeDispatch = hasFullAccess || isDispatch || isSales;
  const canSeeReturns = hasFullAccess || isReturnsManager || isDispatch || isSales;
  const canSeeAudit = hasFullAccess;

  const defaultTab = hasFullAccess ? 'management' : canSeeProduction ? 'production' : canSeeSales ? 'sales' : canSeeDispatch ? 'dispatch' : 'returns';

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="Reports Center"
          description="Comprehensive reporting across all departments."
        />
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <ScrollArea className="w-full border-b pb-2 no-print">
          <TabsList className="mb-2 w-max justify-start flex-nowrap">
            {hasFullAccess && <TabsTrigger value="management">Management</TabsTrigger>}
            {canSeeProduction && <TabsTrigger value="production">Production</TabsTrigger>}
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
            {canSeeSales && <TabsTrigger value="sales">Sales</TabsTrigger>}
            {canSeeSales && <TabsTrigger value="customers">Customers</TabsTrigger>}
            {canSeeSales && <TabsTrigger value="orders">Orders</TabsTrigger>}
            {canSeeDispatch && <TabsTrigger value="dispatch">Dispatch</TabsTrigger>}
            {canSeeDispatch && <TabsTrigger value="delivery">Delivery</TabsTrigger>}
            {canSeeReturns && <TabsTrigger value="returns">Returns</TabsTrigger>}
            {canSeeSales && <TabsTrigger value="payments">Payments</TabsTrigger>}
            <TabsTrigger value="products">Products</TabsTrigger>
            {canSeeSales && <TabsTrigger value="discounts">Discounts</TabsTrigger>}
            <TabsTrigger value="corrections">Corrections</TabsTrigger>
            {canSeeAudit && <TabsTrigger value="audit">Audit Logs</TabsTrigger>}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <div className="mt-4">
          {hasFullAccess && (
            <TabsContent value="management">
              <ManagementReport />
            </TabsContent>
          )}

          <TabsContent value="production">
            <GenericReport 
              reportName="Production Report"
              tableName="production_scans"
              selectQuery="*, product:products(name), scanner:profiles!production_scans_scanned_by_fkey(full_name)"
              dateField="scanned_at"
              productField="product_id"
              products={products}
              kpis={[
                { label: 'Total Boxes', type: 'count' },
                { label: 'Total Quantity', type: 'sum', key: 'quantity' }
              ]}
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
              reportName="Inventory Status Report"
              tableName="boxes"
              selectQuery="*, product:products(name), warehouse:warehouses(code)"
              dateField="created_at"
              warehouseField="current_warehouse_id"
              productField="product_id"
              statusField="status"
              products={products}
              warehouses={warehouses}
              statuses={['produced', 'in_warehouse', 'allocated', 'dispatched', 'delivered', 'damaged', 'expired', 'returned']}
              kpis={[
                { label: 'Total Boxes in System', type: 'count' }
              ]}
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
              reportName="Warehouse Receiving Report"
              tableName="warehouse_receipts"
              selectQuery="*, product:products(name), warehouse:warehouses(code), receiver:profiles(full_name)"
              dateField="received_at"
              warehouseField="warehouse_id"
              productField="product_id"
              products={products}
              warehouses={warehouses}
              kpis={[
                { label: 'Total Receipts', type: 'count' }
              ]}
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
              reportName="Warehouse Transfer Report"
              tableName="warehouse_transfers"
              selectQuery="*, source:warehouses!warehouse_transfers_source_warehouse_id_fkey(code), destination:warehouses!warehouse_transfers_destination_warehouse_id_fkey(code), creator:profiles!warehouse_transfers_created_by_fkey(full_name)"
              dateField="created_at"
              statusField="status"
              statuses={['draft', 'sent', 'receiving', 'completed', 'cancelled']}
              kpis={[
                { label: 'Total Transfers', type: 'count' }
              ]}
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
              reportName="Sales Orders Report"
              tableName="orders"
              selectQuery="*, customer:customers(customer_name), salesperson:profiles!orders_salesperson_id_fkey(full_name)"
              dateField="created_at"
              customerField="customer_id"
              statusField="status"
              customers={customers}
              statuses={['pending', 'approved', 'rejected', 'allocated', 'dispatched', 'partially_delivered', 'delivered']}
              kpis={[
                { label: 'Total Orders', type: 'count' },
                { label: 'Total Value', type: 'sum', key: 'total_amount', format: 'money' }
              ]}
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
              reportName="Customer Report"
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
              reportName="Detailed Orders Report"
              tableName="orders"
              selectQuery="*, customer:customers(customer_name)"
              dateField="created_at"
              customerField="customer_id"
              customers={customers}
              kpis={[
                { label: 'Total Orders', type: 'count' },
                { label: 'Total Value', type: 'sum', key: 'total_amount', format: 'money' },
                { label: 'Total Paid', type: 'sum', key: 'paid_amount', format: 'money' }
              ]}
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
              reportName="Dispatch Report"
              tableName="dispatches"
              selectQuery="*, order:orders(order_number, customer:customers(customer_name)), dispatcher:profiles!dispatches_dispatched_by_fkey(full_name)"
              dateField="dispatched_at"
              kpis={[
                { label: 'Total Dispatched Boxes', type: 'count' }
              ]}
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
              reportName="Delivery Report"
              tableName="deliveries"
              selectQuery="*, order:orders(order_number, customer:customers(customer_name)), dispatcher:profiles!deliveries_dispatched_by_fkey(full_name)"
              dateField="created_at"
              statusField="status"
              statuses={['pending', 'in_transit', 'delivered', 'failed', 'cancelled']}
              kpis={[
                { label: 'Total Deliveries', type: 'count' }
              ]}
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
              reportName="Returns Report"
              tableName="returns"
              selectQuery="*, product:products(name), processor:profiles(full_name)"
              dateField="processed_at"
              productField="product_id"
              statusField="status"
              products={products}
              statuses={['pending', 'approved', 'rejected']}
              kpis={[
                { label: 'Total Returns Processed', type: 'count' }
              ]}
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
              reportName="Payments Report"
              tableName="payments"
              selectQuery="*, order:orders(order_number, customer:customers(customer_name)), recorded_by:profiles(full_name)"
              dateField="payment_date"
              kpis={[
                { label: 'Total Transactions', type: 'count' },
                { label: 'Total Collected', type: 'sum', key: 'amount', format: 'money' }
              ]}
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
              reportName="Products List"
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
              reportName="Discounts & Approvals Report"
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
              reportName="Corrections Audit Report"
              tableName="correction_records"
              selectQuery="*, user:profiles(full_name)"
              dateField="corrected_at"
              kpis={[
                { label: 'Total Corrections', type: 'count' }
              ]}
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
              reportName="System Audit Logs"
              tableName="audit_logs"
              selectQuery="*, user:profiles(full_name)"
              dateField="created_at"
              kpis={[
                { label: 'Total Events Logged', type: 'count' }
              ]}
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
