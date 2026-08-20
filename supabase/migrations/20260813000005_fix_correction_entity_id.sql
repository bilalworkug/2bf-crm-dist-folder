-- Migration to fix the undocumented 'entity_id' column on the live database

DO $$
BEGIN
    -- Check if 'entity_id' column exists in correction_records
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'correction_records' AND column_name = 'entity_id'
    ) THEN
        ALTER TABLE public.correction_records ALTER COLUMN entity_id DROP NOT NULL;
    END IF;
END
$$;
