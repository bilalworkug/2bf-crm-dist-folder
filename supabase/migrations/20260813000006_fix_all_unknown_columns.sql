-- Migration to drop NOT NULL constraints from all undocumented columns on correction_records
-- We are doing this dynamically because the live database contains numerous injected columns
-- (department, entity_type, entity_id, field_name, etc.) that are blocking the RPC.

DO $$
DECLARE
    col_name text;
BEGIN
    FOR col_name IN 
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'correction_records' 
          AND is_nullable = 'NO'
          AND column_name NOT IN (
              'id', 
              'barcode', 
              'correction_type', 
              'performed_by', 
              'reason', 
              'status'
          )
    LOOP
        EXECUTE format('ALTER TABLE public.correction_records ALTER COLUMN %I DROP NOT NULL;', col_name);
    END LOOP;
END
$$;
