-- ==============================================================================
-- TAMS PRO — MIGRATION 00: ADD 'super_admin' TO public.app_role ENUM
-- Note: PostgreSQL requires ALTER TYPE ADD VALUE to commit in its own
-- transaction before any function or policy references the new enum value.
-- ==============================================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

