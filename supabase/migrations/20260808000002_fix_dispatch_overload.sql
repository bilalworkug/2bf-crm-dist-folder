-- =============================================================
-- FIX: Drop old fn_dispatch_box overloads that cause ambiguity
-- Run this in the Supabase SQL Editor.
-- =============================================================

-- Drop the 5-parameter version (the legacy one that caused ambiguity)
DROP FUNCTION IF EXISTS public.fn_dispatch_box(character varying, uuid, uuid, uuid, character varying);
DROP FUNCTION IF EXISTS public.fn_dispatch_box(text, uuid, uuid, uuid, text);

-- Just to be safe, drop the 4 parameter varchar version if it exists
DROP FUNCTION IF EXISTS public.fn_dispatch_box(character varying, uuid, uuid, uuid);
