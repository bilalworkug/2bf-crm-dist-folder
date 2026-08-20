-- Migration to fix the undocumented 'department' column on the live database
-- The live DB has a 'department' column with a NOT NULL constraint, which is not 
-- part of the official Phase 9 schema or RPC inserts. We provide a safe default.

DO $$
BEGIN
    -- Check if 'department' column exists in correction_records
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'correction_records' AND column_name = 'department'
    ) THEN
        -- Set a safe default so our RPCs can insert without explicitly providing it
        ALTER TABLE public.correction_records ALTER COLUMN department SET DEFAULT 'production';
    END IF;
END
$$;
