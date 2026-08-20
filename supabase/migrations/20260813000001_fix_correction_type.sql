-- Migration to fix missing columns in correction_records on live database
-- This ensures the table perfectly matches the expected Phase 9 schema without data loss.

DO $$
BEGIN
    -- Add all potential missing columns safely
    ALTER TABLE public.correction_records ADD COLUMN IF NOT EXISTS correction_type text DEFAULT 'production';
    ALTER TABLE public.correction_records ADD COLUMN IF NOT EXISTS old_product_id uuid REFERENCES public.products(id);
    ALTER TABLE public.correction_records ADD COLUMN IF NOT EXISTS new_product_id uuid REFERENCES public.products(id);
    ALTER TABLE public.correction_records ADD COLUMN IF NOT EXISTS old_warehouse_id uuid REFERENCES public.warehouses(id);
    ALTER TABLE public.correction_records ADD COLUMN IF NOT EXISTS new_warehouse_id uuid REFERENCES public.warehouses(id);
    ALTER TABLE public.correction_records ADD COLUMN IF NOT EXISTS old_order_id uuid REFERENCES public.orders(id);
    ALTER TABLE public.correction_records ADD COLUMN IF NOT EXISTS new_order_id uuid REFERENCES public.orders(id);
    ALTER TABLE public.correction_records ADD COLUMN IF NOT EXISTS old_status text;
    ALTER TABLE public.correction_records ADD COLUMN IF NOT EXISTS new_status text;
    ALTER TABLE public.correction_records ADD COLUMN IF NOT EXISTS notes text;
    ALTER TABLE public.correction_records ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed';

    -- Ensure NOT NULL constraint on correction_type for existing records
    UPDATE public.correction_records SET correction_type = 'production' WHERE correction_type IS NULL;
    ALTER TABLE public.correction_records ALTER COLUMN correction_type SET NOT NULL;
END
$$;
