-- =============================================================
-- Phase 25B: Database Performance & Target Indexes
-- Adds dedicated indexes on high-frequency tables without duplicates
-- =============================================================

-- 1. BOXES INDEXES
-- Optimizes warehouse availability lookups and box status transition queries
CREATE INDEX IF NOT EXISTS idx_boxes_status 
  ON public.boxes(status);

-- Accelerates warehouse-scoped inventory balance and allocation filtering
CREATE INDEX IF NOT EXISTS idx_boxes_current_warehouse 
  ON public.boxes(current_warehouse_id);

-- Speeds up product-level box aggregations across factories and warehouses
CREATE INDEX IF NOT EXISTS idx_boxes_product_id 
  ON public.boxes(product_id);


-- 2. BARCODE HISTORY INDEXES
-- Composite index for instant chronological Barcode Passport timeline queries
CREATE INDEX IF NOT EXISTS idx_barcode_history_timeline 
  ON public.barcode_history(barcode, performed_at DESC);

-- Accelerates event-filtered trace queries (e.g., PRODUCED, RECEIVED, DISPATCHED, DELIVERED)
CREATE INDEX IF NOT EXISTS idx_barcode_history_action 
  ON public.barcode_history(action);


-- 3. ORDERS INDEXES
-- Optimizes recent order queries and dashboard sales timeline ordering
CREATE INDEX IF NOT EXISTS idx_orders_created_at 
  ON public.orders(created_at DESC);


-- 4. PAYMENTS INDEXES
-- Accelerates payment lookup by order during fulfillment and invoice reconciliation
CREATE INDEX IF NOT EXISTS idx_payments_order_id 
  ON public.payments(order_id);

-- Optimizes customer debt calculations and credit ledger queries
CREATE INDEX IF NOT EXISTS idx_payments_customer_id 
  ON public.payments(customer_id);

-- Speeds up pending payment approvals filtering in Accounts Manager dashboard
CREATE INDEX IF NOT EXISTS idx_payments_status 
  ON public.payments(status);
