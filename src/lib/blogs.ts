import { supabase } from "@/integrations/supabase/client";
import { toFriendlyMessage } from "@/lib/friendlyError";

export type BlogStatus = "draft" | "published";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  cover_image_url: string | null;
  status: BlogStatus;
  author_name: string;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPostInput {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  cover_image_url: string | null;
  status: BlogStatus;
  author_name: string;
  seo_title: string | null;
  seo_description: string | null;
  published_at?: string | null;
}

export const BLOG_QUERY_KEYS = {
  publicList: ["public-blogs"] as const,
  publicDetail: (slug: string) => ["public-blog", slug] as const,
  adminList: ["admin-blogs"] as const,
};

export const BLOG_COVER_MAX_BYTES = 5 * 1024 * 1024;
export const BLOG_COVER_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function generateBlogSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatBlogDate(isoDate?: string | null): string {
  if (!isoDate) return "";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function estimateReadMinutes(content: string): number {
  const words = (content || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function getFriendlyBlogError(error: unknown, fallback: string): string {
  const errObj = error as { code?: string; message?: string } | null;
  const msg = (errObj?.message || "").toLowerCase();
  if (errObj?.code === "23505" || msg.includes("duplicate key") || msg.includes("unique")) {
    return "That URL slug is already in use. Please choose a different slug.";
  }
  return toFriendlyMessage(error, fallback);
}

export async function fetchPublishedBlogs(): Promise<{
  posts: BlogPost[];
  error: string | null;
}> {
  try {
    const { data, error } = await (supabase as any)
      .from("blog_posts")
      .select(
        "id, slug, title, excerpt, content, category, cover_image_url, status, author_name, seo_title, seo_description, published_at, created_at, updated_at"
      )
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[TAMS Blogs] fetchPublishedBlogs error:", error);
      return {
        posts: [],
        error: "Articles are temporarily unavailable. Please check back shortly.",
      };
    }

    return { posts: (data as BlogPost[]) || [], error: null };
  } catch (err) {
    console.error("[TAMS Blogs] fetchPublishedBlogs exception:", err);
    return {
      posts: [],
      error: "Articles are temporarily unavailable. Please check back shortly.",
    };
  }
}

export async function fetchPublishedBlogBySlug(slug: string): Promise<{
  post: BlogPost | null;
  notFound: boolean;
  error: string | null;
}> {
  try {
    const cleanSlug = (slug || "").trim();
    if (!cleanSlug) {
      return { post: null, notFound: true, error: null };
    }

    const { data, error } = await (supabase as any)
      .from("blog_posts")
      .select(
        "id, slug, title, excerpt, content, category, cover_image_url, status, author_name, seo_title, seo_description, published_at, created_at, updated_at"
      )
      .eq("slug", cleanSlug)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.error("[TAMS Blogs] fetchPublishedBlogBySlug error:", error);
      return {
        post: null,
        notFound: false,
        error: "This article could not be loaded right now. Please try again shortly.",
      };
    }

    if (!data) {
      return { post: null, notFound: true, error: null };
    }

    return { post: data as BlogPost, notFound: false, error: null };
  } catch (err) {
    console.error("[TAMS Blogs] fetchPublishedBlogBySlug exception:", err);
    return {
      post: null,
      notFound: false,
      error: "This article could not be loaded right now. Please try again shortly.",
    };
  }
}

export async function fetchAllBlogsAdmin(): Promise<{
  posts: BlogPost[];
  error: string | null;
}> {
  try {
    const { data, error } = await (supabase as any)
      .from("blog_posts")
      .select(
        "id, slug, title, excerpt, content, category, cover_image_url, status, author_name, seo_title, seo_description, published_at, created_at, updated_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[TAMS Blogs Admin] fetchAllBlogsAdmin error:", error);
      return {
        posts: [],
        error: getFriendlyBlogError(
          error,
          "Could not load blog posts right now. Please ensure the blog migration has been applied."
        ),
      };
    }

    return { posts: (data as BlogPost[]) || [], error: null };
  } catch (err) {
    console.error("[TAMS Blogs Admin] fetchAllBlogsAdmin exception:", err);
    return {
      posts: [],
      error: "Could not load blog posts right now. Please try again shortly.",
    };
  }
}

export async function createBlogAdmin(input: BlogPostInput): Promise<{
  post: BlogPost | null;
  error: string | null;
}> {
  try {
    const payload = {
      ...input,
      published_at:
        input.status === "published"
          ? input.published_at || new Date().toISOString()
          : null,
    };

    const { data, error } = await (supabase as any)
      .from("blog_posts")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("[TAMS Blogs Admin] createBlogAdmin error:", error);
      return {
        post: null,
        error: getFriendlyBlogError(error, "Could not create blog post. Please try again."),
      };
    }

    return { post: data as BlogPost, error: null };
  } catch (err) {
    console.error("[TAMS Blogs Admin] createBlogAdmin exception:", err);
    return {
      post: null,
      error: getFriendlyBlogError(err, "Could not create blog post. Please try again."),
    };
  }
}

export async function updateBlogAdmin(
  id: string,
  input: BlogPostInput
): Promise<{
  post: BlogPost | null;
  error: string | null;
}> {
  try {
    const payload = {
      ...input,
      published_at:
        input.status === "published"
          ? input.published_at || new Date().toISOString()
          : input.published_at ?? null,
    };

    const { data, error } = await (supabase as any)
      .from("blog_posts")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[TAMS Blogs Admin] updateBlogAdmin error:", error);
      return {
        post: null,
        error: getFriendlyBlogError(error, "Could not save blog changes. Please try again."),
      };
    }

    return { post: data as BlogPost, error: null };
  } catch (err) {
    console.error("[TAMS Blogs Admin] updateBlogAdmin exception:", err);
    return {
      post: null,
      error: getFriendlyBlogError(err, "Could not save blog changes. Please try again."),
    };
  }
}

export async function toggleBlogStatusAdmin(
  id: string,
  nextStatus: BlogStatus,
  existingPublishedAt?: string | null
): Promise<{
  post: BlogPost | null;
  error: string | null;
}> {
  try {
    const updates: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "published" && !existingPublishedAt) {
      updates.published_at = new Date().toISOString();
    }

    const { data, error } = await (supabase as any)
      .from("blog_posts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[TAMS Blogs Admin] toggleBlogStatusAdmin error:", error);
      return {
        post: null,
        error: getFriendlyBlogError(error, "Could not update publish status. Please try again."),
      };
    }

    return { post: data as BlogPost, error: null };
  } catch (err) {
    console.error("[TAMS Blogs Admin] toggleBlogStatusAdmin exception:", err);
    return {
      post: null,
      error: getFriendlyBlogError(err, "Could not update publish status. Please try again."),
    };
  }
}

export async function deleteBlogAdmin(id: string): Promise<{ error: string | null }> {
  try {
    const { error } = await (supabase as any)
      .from("blog_posts")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[TAMS Blogs Admin] deleteBlogAdmin error:", error);
      return {
        error: getFriendlyBlogError(error, "Could not delete blog post. Please try again."),
      };
    }

    return { error: null };
  } catch (err) {
    console.error("[TAMS Blogs Admin] deleteBlogAdmin exception:", err);
    return {
      error: getFriendlyBlogError(err, "Could not delete blog post. Please try again."),
    };
  }
}

export async function uploadBlogCoverAdmin(file: File): Promise<{
  url: string | null;
  error: string | null;
}> {
  if (!BLOG_COVER_ALLOWED_MIME.has(file.type)) {
    return {
      url: null,
      error: "Please upload a JPEG, PNG, WebP, or GIF image.",
    };
  }

  if (file.size > BLOG_COVER_MAX_BYTES) {
    return {
      url: null,
      error: "Cover image must be 5 MB or smaller.",
    };
  }

  try {
    const ext = (file.name.split(".").pop() || "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const safeName = generateBlogSlug(file.name.replace(/\.[^.]+$/, "")) || "cover";
    const objectPath = `${Date.now()}-${safeName}.${ext || "jpg"}`;

    const { error: uploadError } = await supabase.storage
      .from("blog-covers")
      .upload(objectPath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("[TAMS Blogs Admin] uploadBlogCoverAdmin error:", uploadError);
      return {
        url: null,
        error: getFriendlyBlogError(uploadError, "Could not upload cover image. Please try again."),
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from("blog-covers")
      .getPublicUrl(objectPath);

    return { url: publicUrlData?.publicUrl || null, error: null };
  } catch (err) {
    console.error("[TAMS Blogs Admin] uploadBlogCoverAdmin exception:", err);
    return {
      url: null,
      error: getFriendlyBlogError(err, "Could not upload cover image. Please try again."),
    };
  }
}

