-- ==============================================================================
-- TAMS PRO — ADDITIVE MIGRATION: PRICING DISPLAY, BLOG UPDATES & DUAL EMAIL SYSTEMS
-- File: supabase/migrations/20261126224500_pricing_blogs_and_email_systems.sql
--
-- STRICTLY ADDITIVE & NON-DESTRUCTIVE:
--   1. Updates public.site_settings (pricing_plans display config only; zero changes to
--      existing subscriber plans, licenses, or payment history).
--   2. Updates existing rows in public.blog_posts in-place (PKR 1,999/mo with no monthly
--      discount, 50% off yearly only, and replaces umrahcal.online with TAMS Pro Umrah
--      Calculator guide — no blog posts deleted).
--   3. Creates public.system_email_logs (super_admin-only RLS for tamspro12@gmail.com logs).
--   4. Creates public.agency_email_settings (encrypted per-agency Gmail App Passwords,
--      column-level REVOKE SELECT on encrypted_app_password, strict per-agency RLS).
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. UPDATE SITE_SETTINGS PRICING DISPLAY CONFIG (Task 0)
-- ------------------------------------------------------------------------------
DO $do_pricing$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'site_settings'
  ) THEN
    INSERT INTO public.site_settings (key, value)
    VALUES (
      'pricing_plans',
      jsonb_build_object(
        'eyebrow', 'PRICING',
        'heading', 'Choose your plan',
        'plans', jsonb_build_array(
          jsonb_build_object(
            'id', 'monthly',
            'name', 'Monthly',
            'popular', false,
            'priceFormatted', 'PKR 1,999',
            'originalPriceFormatted', '',
            'discountBadge', '',
            'period', '/ month',
            'bullets', jsonb_build_array(
              'All core features',
              'Up to 2 sub-users',
              'Email integration',
              'Cloud backup',
              'Mobile access',
              'Email support'
            ),
            'ctaText', 'Get Started',
            'ctaLink', '/signup'
          ),
          jsonb_build_object(
            'id', 'yearly',
            'name', 'Yearly',
            'popular', true,
            'priceFormatted', 'PKR 9,999',
            'originalPriceFormatted', '19,999',
            'discountBadge', '50% OFF',
            'period', '/ year',
            'bullets', jsonb_build_array(
              'Everything in Monthly',
              'Priority support',
              'Advanced reports',
              'Unlimited bookings',
              'Custom branding',
              '2 months free'
            ),
            'ctaText', 'Get Started',
            'ctaLink', '/signup'
          )
        )
      )
    )
    ON CONFLICT (key) DO UPDATE
    SET
      value = EXCLUDED.value,
      updated_at = now();
  END IF;
END;
$do_pricing$;

-- ------------------------------------------------------------------------------
-- 2. UPDATE EXISTING BLOG POSTS IN SUPABASE IN-PLACE (Tasks 0 & 3 — no rows deleted)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.normalize_tams_blog_text(p_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $fn_blog$
DECLARE
  v_out TEXT := p_input;
BEGIN
  IF v_out IS NULL OR v_out = '' THEN
    RETURN v_out;
  END IF;

  -- Replace external umrahcal.online anchor tags with TAMS Pro built-in Umrah Calculator guide
  v_out := regexp_replace(
    v_out,
    '<a\s[^>]*href="https?://(www\.)?umrahcal\.online[^"]*"[^>]*>.*?</a>',
    'the built-in Umrah Calculator inside TAMS Pro (open Umrah Calculator from the sidebar, enter the SAR-to-PKR rate, Makkah and Madinah hotel nights, visa, transport, and flight fares to generate an instant PKR breakdown)',
    'gi'
  );

  -- Replace any plain-text umrahcal.online URLs or mentions
  v_out := regexp_replace(
    v_out,
    'https?://(www\.)?umrahcal\.online/?',
    'TAMS Pro built-in Umrah Calculator (/app/umrah-calculator)',
    'gi'
  );
  v_out := regexp_replace(
    v_out,
    'umrahcal\.online',
    'TAMS Pro built-in Umrah Calculator',
    'gi'
  );

  -- Enforce Task 0 pricing rules: PKR 1,999/month (no monthly discount) & 50% off only on yearly
  v_out := regexp_replace(
    v_out,
    'lock in the 50% launch discount[^.<]*PKR\s*999\s*/\s*month\s+or\s+PKR\s*9,999\s*/\s*year',
    'get started at PKR 1,999/month, or lock in 50% off on the yearly plan at PKR 9,999/year',
    'gi'
  );
  v_out := regexp_replace(
    v_out,
    'PKR\s*999\s*/\s*month\s+or\s+PKR\s*9,999\s*/\s*year\s*\(\s*50%\s*off\s*\)',
    'PKR 1,999/month, or PKR 9,999/year (50% off exclusively on the yearly plan)',
    'gi'
  );
  v_out := regexp_replace(
    v_out,
    'PKR\s*999\s*/\s*month\s*\(\s*50%\s*off\s*\)',
    'PKR 1,999/month',
    'gi'
  );
  v_out := regexp_replace(
    v_out,
    'PKR\s*999\s*(/|per\s+)\s*month',
    'PKR 1,999/month',
    'gi'
  );
  v_out := regexp_replace(
    v_out,
    'PKR\s*999\M',
    'PKR 1,999',
    'gi'
  );

  RETURN v_out;
END;
$fn_blog$;

DO $do_blogs$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'blog_posts'
  ) THEN
    UPDATE public.blog_posts
    SET
      title = pg_temp.normalize_tams_blog_text(title),
      excerpt = pg_temp.normalize_tams_blog_text(excerpt),
      content = pg_temp.normalize_tams_blog_text(content),
      seo_title = pg_temp.normalize_tams_blog_text(seo_title),
      seo_description = pg_temp.normalize_tams_blog_text(seo_description),
      updated_at = now()
    WHERE
      title ~* '(umrahcal\.online|PKR\s*999)'
      OR excerpt ~* '(umrahcal\.online|PKR\s*999)'
      OR content ~* '(umrahcal\.online|PKR\s*999)'
      OR coalesce(seo_title, '') ~* '(umrahcal\.online|PKR\s*999)'
      OR coalesce(seo_description, '') ~* '(umrahcal\.online|PKR\s*999)';

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'blog_posts'
        AND column_name = 'faq_items'
    ) THEN
      UPDATE public.blog_posts
      SET
        faq_items = pg_temp.normalize_tams_blog_text(faq_items::text)::jsonb,
        updated_at = now()
      WHERE faq_items IS NOT NULL
        AND faq_items::text ~* '(umrahcal\.online|PKR\s*999)';
    END IF;
  END IF;
END;
$do_blogs$;

-- ------------------------------------------------------------------------------
-- 3. SYSTEM EMAIL LOGS TABLE (Task 4A — Admin-only System Email history)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  email_category TEXT NOT NULL DEFAULT 'admin_message'
    CHECK (email_category IN ('test', 'welcome', 'announcement', 'admin_message')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_email_logs_created_at
  ON public.system_email_logs (created_at DESC);

ALTER TABLE public.system_email_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.system_email_logs FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.system_email_logs TO authenticated;

DROP POLICY IF EXISTS "system_email_logs_super_admin_select" ON public.system_email_logs;
CREATE POLICY "system_email_logs_super_admin_select"
  ON public.system_email_logs
  FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

-- ------------------------------------------------------------------------------
-- 4. AGENCY EMAIL SETTINGS TABLE (Task 4B — Encrypted per-agency Gmail credentials)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_email_settings (
  agency_id UUID PRIMARY KEY REFERENCES public.agencies(id) ON DELETE CASCADE,
  gmail_address TEXT NOT NULL CHECK (lower(btrim(gmail_address)) <> 'tamspro12@gmail.com'),
  encrypted_app_password TEXT NOT NULL,
  masked_hint TEXT NOT NULL DEFAULT '•••• •••• •••• ••••',
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_email_settings ENABLE ROW LEVEL SECURITY;

-- Strict column-level protection: encrypted_app_password can NEVER be read by anon/authenticated
REVOKE ALL ON TABLE public.agency_email_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT (agency_id, gmail_address, masked_hint, updated_by, updated_at)
  ON TABLE public.agency_email_settings TO authenticated;

DROP POLICY IF EXISTS "agency_email_settings_select_own_agency" ON public.agency_email_settings;
CREATE POLICY "agency_email_settings_select_own_agency"
  ON public.agency_email_settings
  FOR SELECT
  TO authenticated
  USING (agency_id = (SELECT public.current_user_agency_id()));

-- Revoke legacy plaintext password reader from authenticated users if present
DO $do_revoke_legacy$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc proc_row
    JOIN pg_catalog.pg_namespace ns_row ON ns_row.oid = proc_row.pronamespace
    WHERE ns_row.nspname = 'public'
      AND proc_row.proname = 'get_agency_smtp_password'
  ) THEN
    REVOKE ALL ON FUNCTION public.get_agency_smtp_password() FROM PUBLIC, anon, authenticated;
  END IF;
END;
$do_revoke_legacy$;

-- Internal server-side key resolver (reads Vault secret 'agency_email_encryption_key' if present,
-- otherwise derives an instance-bound key never accessible to client roles)
CREATE OR REPLACE FUNCTION public._internal_agency_email_key(p_agency_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn_key$
DECLARE
  v_vault_secret TEXT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'vault'
      AND table_name = 'decrypted_secrets'
  ) THEN
    EXECUTE $q$
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'agency_email_encryption_key'
      LIMIT 1
    $q$ INTO v_vault_secret;
  END IF;

  RETURN coalesce(nullif(v_vault_secret, ''), 'tams-pg-vault-v1:' || current_database())
    || ':' || p_agency_id::text;
END;
$fn_key$;

REVOKE ALL ON FUNCTION public._internal_agency_email_key(UUID) FROM PUBLIC, anon, authenticated;

-- Service-role-only decrypt helper for Edge Function when row was saved via SQL RPC
CREATE OR REPLACE FUNCTION public.service_decrypt_agency_email_password(p_agency_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn_dec$
DECLARE
  v_cipher TEXT;
  v_key TEXT;
BEGIN
  SELECT public.agency_email_settings.encrypted_app_password
  INTO v_cipher
  FROM public.agency_email_settings
  WHERE public.agency_email_settings.agency_id = p_agency_id;

  IF v_cipher IS NULL OR v_cipher = '' THEN
    RETURN NULL;
  END IF;

  IF v_cipher LIKE 'pgp:%' THEN
    v_key := public._internal_agency_email_key(p_agency_id);
    RETURN pgp_sym_decrypt(decode(substr(v_cipher, 5), 'base64'), v_key);
  END IF;

  RETURN NULL;
END;
$fn_dec$;

REVOKE ALL ON FUNCTION public.service_decrypt_agency_email_password(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_decrypt_agency_email_password(UUID) TO service_role;

-- Owner-only encrypted save RPC (never returns password)
CREATE OR REPLACE FUNCTION public.save_agency_email_credentials(
  p_gmail_address TEXT,
  p_app_password TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn_save$
DECLARE
  v_uid UUID := auth.uid();
  v_agency_id UUID := public.current_user_agency_id();
  v_clean_email TEXT := lower(btrim(coalesce(p_gmail_address, '')));
  v_clean_pwd TEXT := regexp_replace(coalesce(p_app_password, ''), '\s+', '', 'g');
  v_existing_cipher TEXT;
  v_cipher TEXT;
BEGIN
  IF v_uid IS NULL OR v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.is_sub_user(v_uid) THEN
    RAISE EXCEPTION 'Only the agency owner can update Gmail credentials';
  END IF;

  IF v_clean_email = '' OR v_clean_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'Please enter a valid Gmail address';
  END IF;

  IF v_clean_email = 'tamspro12@gmail.com' THEN
    RAISE EXCEPTION 'Please enter your agency own Gmail address';
  END IF;

  SELECT public.agency_email_settings.encrypted_app_password
  INTO v_existing_cipher
  FROM public.agency_email_settings
  WHERE public.agency_email_settings.agency_id = v_agency_id;

  IF v_clean_pwd = '' AND (v_existing_cipher IS NULL OR v_existing_cipher = '') THEN
    RAISE EXCEPTION 'Please enter your 16-character Gmail App Password';
  END IF;

  IF v_clean_pwd <> '' THEN
    IF v_clean_pwd !~ '^[A-Za-z0-9]{16}$' THEN
      RAISE EXCEPTION 'Gmail App Password must be 16 letters/numbers';
    END IF;
    v_cipher := 'pgp:' || encode(
      pgp_sym_encrypt(v_clean_pwd, public._internal_agency_email_key(v_agency_id)),
      'base64'
    );
  ELSE
    v_cipher := v_existing_cipher;
  END IF;

  INSERT INTO public.agency_email_settings (
    agency_id,
    gmail_address,
    encrypted_app_password,
    masked_hint,
    updated_by,
    updated_at
  )
  VALUES (
    v_agency_id,
    v_clean_email,
    v_cipher,
    '•••• •••• •••• ••••',
    v_uid,
    now()
  )
  ON CONFLICT (agency_id) DO UPDATE
  SET
    gmail_address = EXCLUDED.gmail_address,
    encrypted_app_password = EXCLUDED.encrypted_app_password,
    masked_hint = EXCLUDED.masked_hint,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  UPDATE public.agencies
  SET email = v_clean_email,
      email_password = NULL
  WHERE public.agencies.id = v_agency_id;

  RETURN jsonb_build_object(
    'connected', true,
    'gmailAddress', v_clean_email,
    'maskedPassword', '•••• •••• •••• ••••'
  );
END;
$fn_save$;

REVOKE ALL ON FUNCTION public.save_agency_email_credentials(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_agency_email_credentials(TEXT, TEXT) TO authenticated;

-- Masked status RPC for the logged-in agency (never returns plaintext or ciphertext)
CREATE OR REPLACE FUNCTION public.get_my_agency_email_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn_status$
DECLARE
  v_agency_id UUID := public.current_user_agency_id();
  v_gmail TEXT;
  v_masked TEXT;
  v_updated TIMESTAMPTZ;
  v_legacy_email TEXT;
  v_legacy_has_pwd BOOLEAN := false;
BEGIN
  IF v_agency_id IS NULL THEN
    RETURN jsonb_build_object('connected', false, 'gmailAddress', '', 'maskedPassword', '');
  END IF;

  SELECT
    public.agency_email_settings.gmail_address,
    public.agency_email_settings.masked_hint,
    public.agency_email_settings.updated_at
  INTO v_gmail, v_masked, v_updated
  FROM public.agency_email_settings
  WHERE public.agency_email_settings.agency_id = v_agency_id
    AND public.agency_email_settings.encrypted_app_password IS NOT NULL
    AND public.agency_email_settings.encrypted_app_password <> '';

  IF v_gmail IS NOT NULL AND v_gmail <> '' THEN
    RETURN jsonb_build_object(
      'connected', true,
      'gmailAddress', v_gmail,
      'maskedPassword', coalesce(v_masked, '•••• •••• •••• ••••'),
      'updatedAt', v_updated
    );
  END IF;

  SELECT
    btrim(coalesce(public.agencies.email, '')),
    (public.agencies.email_password IS NOT NULL AND public.agencies.email_password <> '')
  INTO v_legacy_email, v_legacy_has_pwd
  FROM public.agencies
  WHERE public.agencies.id = v_agency_id;

  IF v_legacy_has_pwd AND v_legacy_email <> '' AND lower(v_legacy_email) <> 'tamspro12@gmail.com' THEN
    RETURN jsonb_build_object(
      'connected', true,
      'gmailAddress', v_legacy_email,
      'maskedPassword', '•••• •••• •••• ••••',
      'updatedAt', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'connected', false,
    'gmailAddress', CASE WHEN lower(coalesce(v_legacy_email, '')) = 'tamspro12@gmail.com' THEN '' ELSE coalesce(v_legacy_email, '') END,
    'maskedPassword', ''
  );
END;
$fn_status$;

REVOKE ALL ON FUNCTION public.get_my_agency_email_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_agency_email_status() TO authenticated;

-- Update agency_smtp_configured() without single-letter aliases so both encrypted and legacy rows work
CREATE OR REPLACE FUNCTION public.agency_smtp_configured()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn_smtp$
DECLARE
  v_agency_id UUID := public.current_user_agency_id();
BEGIN
  IF v_agency_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN (
    EXISTS (
      SELECT 1
      FROM public.agency_email_settings
      WHERE public.agency_email_settings.agency_id = v_agency_id
        AND public.agency_email_settings.gmail_address IS NOT NULL
        AND public.agency_email_settings.gmail_address <> ''
        AND lower(btrim(public.agency_email_settings.gmail_address)) <> 'tamspro12@gmail.com'
        AND public.agency_email_settings.encrypted_app_password IS NOT NULL
        AND public.agency_email_settings.encrypted_app_password <> ''
    )
    OR EXISTS (
      SELECT 1
      FROM public.agencies
      WHERE public.agencies.id = v_agency_id
        AND public.agencies.email IS NOT NULL
        AND btrim(public.agencies.email) <> ''
        AND lower(btrim(public.agencies.email)) <> 'tamspro12@gmail.com'
        AND public.agencies.email_password IS NOT NULL
        AND public.agencies.email_password <> ''
    )
  );
END;
$fn_smtp$;

REVOKE ALL ON FUNCTION public.agency_smtp_configured() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agency_smtp_configured() TO authenticated;

COMMIT;
