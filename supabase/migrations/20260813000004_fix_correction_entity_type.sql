-- Migration to fix the undocumented 'entity_type' column on the live database
-- We are just setting safe defaults for these undocumented NOT NULL columns
-- that were likely added globally to all tables.

DO $$
BEGIN
    -- Check if 'entity_type' column exists in correction_records
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'correction_records' AND column_name = 'entity_type'
    ) THEN
        ALTER TABLE public.correction_records ALTER COLUMN entity_type SET DEFAULT 'box';
    END IF;
    
    -- Let's also preemptively drop NOT NULL for any other commonly injected columns just in case
    -- We can't do this dynamically without executing dynamic SQL, so let's stick to the ones we found.
END
$$;
