-- =========================================================================
-- Phase 19: Product Price Management
-- =========================================================================

-- 1. Create or Modify product_prices table
DO $$ 
BEGIN
  -- If table doesn't exist, create it
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_prices') THEN
    CREATE TABLE public.product_prices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
      price numeric(14,2) NOT NULL CHECK (price > 0),
      currency text NOT NULL DEFAULT 'USD',
      effective_from timestamptz NOT NULL DEFAULT now(),
      effective_to timestamptz,
      active boolean NOT NULL DEFAULT true,
      created_by uuid REFERENCES public.profiles(id),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      notes text
    );
  ELSE
    -- Table exists, add missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_prices' AND column_name = 'currency') THEN
      ALTER TABLE public.product_prices ADD COLUMN currency text NOT NULL DEFAULT 'USD';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_prices' AND column_name = 'effective_from') THEN
      ALTER TABLE public.product_prices ADD COLUMN effective_from timestamptz NOT NULL DEFAULT now();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_prices' AND column_name = 'effective_to') THEN
      ALTER TABLE public.product_prices ADD COLUMN effective_to timestamptz;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_prices' AND column_name = 'active') THEN
      ALTER TABLE public.product_prices ADD COLUMN active boolean NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_prices' AND column_name = 'created_by') THEN
      ALTER TABLE public.product_prices ADD COLUMN created_by uuid REFERENCES public.profiles(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_prices' AND column_name = 'notes') THEN
      ALTER TABLE public.product_prices ADD COLUMN notes text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_prices' AND column_name = 'updated_at') THEN
      ALTER TABLE public.product_prices ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
  END IF;
END $$;

-- Indexes for performance on lookup
CREATE INDEX IF NOT EXISTS idx_product_prices_product_id ON public.product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_effective_dates ON public.product_prices(effective_from, effective_to);

-- 2. RLS Policies
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them safely
DROP POLICY IF EXISTS "Admins can manage product prices" ON public.product_prices;
DROP POLICY IF EXISTS "Authenticated users can view prices" ON public.product_prices;

-- Only Admins can modify prices
CREATE POLICY "Admins can manage product prices"
  ON public.product_prices
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- All authenticated users can view active prices (sales, accounts, etc need it for order creation/reports)
CREATE POLICY "Authenticated users can view prices"
  ON public.product_prices
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
  );

-- 3. Function to calculate current effective price
CREATE OR REPLACE FUNCTION public.fn_get_current_product_price(p_product_id uuid)
RETURNS numeric(14,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price numeric(14,2);
BEGIN
  SELECT price INTO v_price
  FROM public.product_prices
  WHERE product_id = p_product_id
    AND active = true
    AND effective_from <= now()
    AND (effective_to IS NULL OR effective_to > now())
  ORDER BY effective_from DESC, created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(v_price, 0);
END;
$$;
