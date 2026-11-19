-- ==============================================================================
-- TAMS PRO — ADDITIVE MIGRATION: BLOGS & COVER IMAGES STORAGE
-- File: supabase/migrations/20261119_01_blog_posts_and_covers.sql
--
-- STRICTLY ADDITIVE:
--   - Creates ONLY new table `public.blog_posts`, its indexes, trigger, RLS policies,
--     and new storage bucket `blog-covers` with its storage policies.
--   - Zero DROP, ALTER, DELETE, TRUNCATE, or UPDATE on any existing table/data.
--   - Reuses existing `public.has_role(auth.uid(), 'super_admin'::public.app_role)`.
-- ==============================================================================

BEGIN;

-- 1. New table: public.blog_posts
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  author_name TEXT NOT NULL DEFAULT 'TAMS Pro Team',
  seo_title TEXT,
  seo_description TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published
  ON public.blog_posts (status, published_at DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug
  ON public.blog_posts (slug);

-- 2. New trigger function for updated_at & automatic published_at
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_blog_posts_updated_at'
      AND tgrelid = 'public.blog_posts'::regclass
  ) THEN
    CREATE TRIGGER trg_blog_posts_updated_at
      BEFORE INSERT OR UPDATE ON public.blog_posts
      FOR EACH ROW
      EXECUTE FUNCTION public.set_blog_posts_updated_at();
  END IF;
END $$;

-- 3. Enable RLS on the new blog_posts table & grant base privileges
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;

-- 4. Additive RLS policies on public.blog_posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_posts' AND policyname = 'blog_posts_public_read_published'
  ) THEN
    CREATE POLICY "blog_posts_public_read_published"
      ON public.blog_posts
      FOR SELECT
      TO anon, authenticated
      USING (status = 'published');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_posts' AND policyname = 'blog_posts_admin_select_all'
  ) THEN
    CREATE POLICY "blog_posts_admin_select_all"
      ON public.blog_posts
      FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_posts' AND policyname = 'blog_posts_admin_insert'
  ) THEN
    CREATE POLICY "blog_posts_admin_insert"
      ON public.blog_posts
      FOR INSERT
      TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_posts' AND policyname = 'blog_posts_admin_update'
  ) THEN
    CREATE POLICY "blog_posts_admin_update"
      ON public.blog_posts
      FOR UPDATE
      TO authenticated
      USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_posts' AND policyname = 'blog_posts_admin_delete'
  ) THEN
    CREATE POLICY "blog_posts_admin_delete"
      ON public.blog_posts
      FOR DELETE
      TO authenticated
      USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;

-- 5. New public storage bucket: blog-covers (5 MB image limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-covers',
  'blog-covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 6. Additive storage.objects policies scoped strictly to bucket_id = 'blog-covers'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'blog_covers_public_read'
  ) THEN
    CREATE POLICY "blog_covers_public_read"
      ON storage.objects
      FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'blog-covers');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'blog_covers_admin_insert'
  ) THEN
    CREATE POLICY "blog_covers_admin_insert"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'blog-covers'
        AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'blog_covers_admin_update'
  ) THEN
    CREATE POLICY "blog_covers_admin_update"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'blog-covers'
        AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
      )
      WITH CHECK (
        bucket_id = 'blog-covers'
        AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'blog_covers_admin_delete'
  ) THEN
    CREATE POLICY "blog_covers_admin_delete"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'blog-covers'
        AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
      );
  END IF;
END $$;

-- 7. Optional single DRAFT sample post (invisible to public; admin can edit, publish, or delete)
INSERT INTO public.blog_posts (
  slug,
  title,
  excerpt,
  content,
  category,
  status,
  author_name,
  seo_title,
  seo_description
)
VALUES (
  'welcome-sample-draft',
  '[Sample Draft] Welcome to TAMS Pro Insights',
  'A sample draft article demonstrating headings, lists, links, and formatting. Edit, publish, or delete this draft from the Admin Panel.',
  E'## Getting Started with TAMS Pro Blogs\n\nThis is a **sample draft** created so you can preview how articles look inside the Admin Panel before publishing your first real post.\n\n### What you can include in an article\n\n- Clear headings and short paragraphs for easy reading\n- **Bold highlights** and *italic emphasis*\n- Step-by-step numbered workflows\n- Helpful links and cover images\n\n> Tip: Switch the status toggle from **Draft** to **Published** whenever you are ready to make an article live on `/blogs`.',
  'Guides',
  'draft',
  'TAMS Pro Team',
  'Welcome to TAMS Pro Insights',
  'Sample draft article for TAMS Pro Admins.'
)
ON CONFLICT (slug) DO NOTHING;

COMMIT;

