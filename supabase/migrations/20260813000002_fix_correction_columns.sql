-- Migration to fix remaining missing columns in correction_records on live database

DO $$
BEGIN
    ALTER TABLE public.correction_records ADD COLUMN IF NOT EXISTS performed_by uuid REFERENCES public.profiles(id);
    ALTER TABLE public.correction_records ADD COLUMN IF NOT EXISTS performed_at timestamptz DEFAULT now();
    ALTER TABLE public.correction_records ADD COLUMN IF NOT EXISTS reason text DEFAULT 'unknown';
    
    -- Ensure NOT NULL constraint on reason and performed_by for existing records
    -- (We don't enforce NOT NULL on performed_by if we can't backfill it safely, 
    -- but we can just leave it nullable for old records, or backfill if needed).
END
$$;
