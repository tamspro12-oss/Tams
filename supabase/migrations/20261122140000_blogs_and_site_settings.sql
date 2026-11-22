-- ==============================================================================
-- TAMS PRO — BLOGS SYSTEM & EDITABLE SITE SETTINGS MIGRATION
-- File: supabase/migrations/20261122140000_blogs_and_site_settings.sql
--
-- STRICTLY ADDITIVE & IDEMPOTENT:
--   - Creates/updates `public.blog_posts` (with tags, author, is_featured, SEO fields)
--   - Creates `public.site_settings` (with seeded defaults for landing_hero & pricing_plans)
--   - Enables RLS with InitPlan-optimized `super_admin` policies using `public.has_role`
--   - Creates public Storage bucket `blog-images` with public read & admin-only write
--   - Zero destructive operations on existing tables or agency data
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. BLOG POSTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  tags TEXT[] NOT NULL DEFAULT '{}',
  author TEXT NOT NULL DEFAULT 'TAMS Pro Team',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  seo_title TEXT,
  seo_description TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent additive columns in case an earlier table layout existed
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS author TEXT NOT NULL DEFAULT 'TAMS Pro Team';

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS seo_title TEXT;

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS seo_description TEXT;

-- Safely migrate legacy `author_name` column if present from an earlier branch
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'blog_posts'
      AND column_name = 'author_name'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.blog_posts
      ALTER COLUMN author_name SET DEFAULT 'TAMS Pro Team'
    $sql$;

    EXECUTE $sql$
      UPDATE public.blog_posts
      SET author = COALESCE(NULLIF(BTRIM(author_name), ''), 'TAMS Pro Team')
      WHERE author = 'TAMS Pro Team'
        AND author_name IS NOT NULL
        AND BTRIM(author_name) <> ''
    $sql$;
  END IF;
END $$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published
  ON public.blog_posts (status, published_at DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_posts_category
  ON public.blog_posts (category);

CREATE INDEX IF NOT EXISTS idx_blog_posts_is_featured
  ON public.blog_posts (is_featured)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug
  ON public.blog_posts (slug);

-- Updated-at & auto published_at trigger
CREATE OR REPLACE FUNCTION public.set_blog_posts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at
  BEFORE INSERT OR UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_blog_posts_updated_at();

-- Enable RLS & base grants
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;

-- InitPlan-optimized RLS policies for blog_posts
DROP POLICY IF EXISTS "blog_posts_public_read_published" ON public.blog_posts;
CREATE POLICY "blog_posts_public_read_published"
  ON public.blog_posts
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "blog_posts_admin_select_all" ON public.blog_posts;
CREATE POLICY "blog_posts_admin_select_all"
  ON public.blog_posts
  FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

DROP POLICY IF EXISTS "blog_posts_admin_insert" ON public.blog_posts;
CREATE POLICY "blog_posts_admin_insert"
  ON public.blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

DROP POLICY IF EXISTS "blog_posts_admin_update" ON public.blog_posts;
CREATE POLICY "blog_posts_admin_update"
  ON public.blog_posts
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

DROP POLICY IF EXISTS "blog_posts_admin_delete" ON public.blog_posts;
CREATE POLICY "blog_posts_admin_delete"
  ON public.blog_posts
  FOR DELETE
  TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

-- ------------------------------------------------------------------------------
-- 2. SITE SETTINGS TABLE (Editable Landing & Pricing Content)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE OR REPLACE FUNCTION public.set_site_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER trg_site_settings_updated_at
  BEFORE INSERT OR UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_site_settings_updated_at();

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;

DROP POLICY IF EXISTS "site_settings_public_read" ON public.site_settings;
CREATE POLICY "site_settings_public_read"
  ON public.site_settings
  FOR SELECT
  TO anon, authenticated
  USING (key IN ('landing_hero', 'pricing_plans'));

DROP POLICY IF EXISTS "site_settings_admin_select_all" ON public.site_settings;
CREATE POLICY "site_settings_admin_select_all"
  ON public.site_settings
  FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

DROP POLICY IF EXISTS "site_settings_admin_insert" ON public.site_settings;
CREATE POLICY "site_settings_admin_insert"
  ON public.site_settings
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

DROP POLICY IF EXISTS "site_settings_admin_update" ON public.site_settings;
CREATE POLICY "site_settings_admin_update"
  ON public.site_settings
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

DROP POLICY IF EXISTS "site_settings_admin_delete" ON public.site_settings;
CREATE POLICY "site_settings_admin_delete"
  ON public.site_settings
  FOR DELETE
  TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

-- Seed initial landing hero & pricing content (safe no-op if already present)
INSERT INTO public.site_settings (key, value)
VALUES
  (
    'landing_hero',
    jsonb_build_object(
      'heading', 'Travel Agency Management System',
      'subtitle', 'Bookings, visas, accounts and vouchers, everything in one place.'
    )
  ),
  (
    'pricing_plans',
    jsonb_build_object(
      'eyebrow', 'PRICING',
      'heading', 'Choose your plan',
      'plans', jsonb_build_array(
        jsonb_build_object(
          'id', 'monthly',
          'name', 'Monthly',
          'popular', false,
          'priceFormatted', 'PKR 999',
          'originalPriceFormatted', '1,999',
          'discountBadge', '50% OFF',
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
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. STORAGE BUCKET: blog-images (Public read, super_admin-only write)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-images',
  'blog-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "blog_images_public_read" ON storage.objects;
CREATE POLICY "blog_images_public_read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'blog-images');

DROP POLICY IF EXISTS "blog_images_admin_insert" ON storage.objects;
CREATE POLICY "blog_images_admin_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'blog-images'
    AND (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  );

DROP POLICY IF EXISTS "blog_images_admin_update" ON storage.objects;
CREATE POLICY "blog_images_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'blog-images'
    AND (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  )
  WITH CHECK (
    bucket_id = 'blog-images'
    AND (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  );

DROP POLICY IF EXISTS "blog_images_admin_delete" ON storage.objects;
CREATE POLICY "blog_images_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'blog-images'
    AND (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  );

COMMIT;

