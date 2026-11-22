import { supabase } from "@/integrations/supabase/client";
import { toFriendlyMessage } from "@/lib/friendlyError";
import { stripHtmlToText } from "@/lib/blogSanitizer";

export type BlogStatus = "draft" | "published";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  category: string;
  tags: string[];
  author: string;
  status: BlogStatus;
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPostInput {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  category: string;
  tags: string[];
  author: string;
  status: BlogStatus;
  is_featured: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
  published_at?: string | null;
}

export const BLOG_IMAGE_BUCKET = "blog-images";

export const BLOG_QUERY_KEYS = {
  publicList: ["public-blogs"] as const,
  publicDetail: (slug: string) => ["public-blog", slug] as const,
  related: (slug: string) => ["public-blog-related", slug] as const,
  adminList: ["admin-blogs"] as const,
};

export const BLOG_COVER_MAX_BYTES = 5 * 1024 * 1024;
export const BLOG_COVER_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const BLOG_SELECT_COLUMNS =
  "id, title, slug, excerpt, content, cover_image_url, category, tags, author, status, is_featured, seo_title, seo_description, published_at, created_at, updated_at";

export function generateBlogSlug(title: string): string {
  return (title || "")
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
  const plainText = stripHtmlToText(content || "");
  const words = plainText.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function normalizeTags(tags?: string[] | null): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const item of tags) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(trimmed);
  }
  return clean;
}

export function parseTagsInput(raw: string): string[] {
  return normalizeTags((raw || "").split(","));
}

function normalizeBlogRow(row: Record<string, unknown>): BlogPost {
  const rawAuthor =
    typeof row.author === "string" && row.author.trim()
      ? row.author.trim()
      : typeof row.author_name === "string" && row.author_name.trim()
        ? row.author_name.trim()
        : "TAMS Pro Team";

  return {
    id: String(row.id || ""),
    title: String(row.title || ""),
    slug: String(row.slug || ""),
    excerpt: String(row.excerpt || ""),
    content: String(row.content || ""),
    cover_image_url: typeof row.cover_image_url === "string" ? row.cover_image_url : null,
    category:
      typeof row.category === "string" && row.category.trim() ? row.category.trim() : "General",
    tags: normalizeTags(Array.isArray(row.tags) ? (row.tags as string[]) : []),
    author: rawAuthor,
    status: row.status === "published" ? "published" : "draft",
    is_featured: Boolean(row.is_featured),
    seo_title: typeof row.seo_title === "string" ? row.seo_title : null,
    seo_description: typeof row.seo_description === "string" ? row.seo_description : null,
    published_at: typeof row.published_at === "string" ? row.published_at : null,
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || ""),
  };
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
      .select(BLOG_SELECT_COLUMNS)
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

    const rows = Array.isArray(data) ? data : [];
    return {
      posts: rows.map((row: Record<string, unknown>) => normalizeBlogRow(row)),
      error: null,
    };
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
      .select(BLOG_SELECT_COLUMNS)
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

    return {
      post: normalizeBlogRow(data as Record<string, unknown>),
      notFound: false,
      error: null,
    };
  } catch (err) {
    console.error("[TAMS Blogs] fetchPublishedBlogBySlug exception:", err);
    return {
      post: null,
      notFound: false,
      error: "This article could not be loaded right now. Please try again shortly.",
    };
  }
}

export async function fetchRelatedPublishedBlogs(
  currentPost: Pick<BlogPost, "id" | "category">,
  limit = 3
): Promise<BlogPost[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("blog_posts")
      .select(BLOG_SELECT_COLUMNS)
      .eq("status", "published")
      .neq("id", currentPost.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(12);

    if (error || !Array.isArray(data)) {
      if (error) {
        console.error("[TAMS Blogs] fetchRelatedPublishedBlogs error:", error);
      }
      return [];
    }

    const normalized = data.map((row: Record<string, unknown>) => normalizeBlogRow(row));
    const currentCategory = (currentPost.category || "").trim().toLowerCase();

    const sameCategory = normalized.filter(
      (p) => (p.category || "").trim().toLowerCase() === currentCategory
    );
    const others = normalized.filter(
      (p) => (p.category || "").trim().toLowerCase() !== currentCategory
    );

    return [...sameCategory, ...others].slice(0, limit);
  } catch (err) {
    console.error("[TAMS Blogs] fetchRelatedPublishedBlogs exception:", err);
    return [];
  }
}

export async function fetchAllBlogsAdmin(): Promise<{
  posts: BlogPost[];
  error: string | null;
}> {
  try {
    const { data, error } = await (supabase as any)
      .from("blog_posts")
      .select(BLOG_SELECT_COLUMNS)
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

    const rows = Array.isArray(data) ? data : [];
    return {
      posts: rows.map((row: Record<string, unknown>) => normalizeBlogRow(row)),
      error: null,
    };
  } catch (err) {
    console.error("[TAMS Blogs Admin] fetchAllBlogsAdmin exception:", err);
    return {
      posts: [],
      error: "Could not load blog posts right now. Please try again shortly.",
    };
  }
}

function buildBlogPayload(input: BlogPostInput): Record<string, unknown> {
  const cleanTags = normalizeTags(input.tags);
  const cleanAuthor = input.author.trim() || "TAMS Pro Team";
  const publishedAt =
    input.status === "published"
      ? input.published_at || new Date().toISOString()
      : input.published_at ?? null;

  return {
    title: input.title.trim(),
    slug: generateBlogSlug(input.slug || input.title),
    excerpt: input.excerpt.trim(),
    content: input.content,
    cover_image_url: input.cover_image_url?.trim() || null,
    category: input.category.trim() || "General",
    tags: cleanTags,
    author: cleanAuthor,
    status: input.status,
    is_featured: Boolean(input.is_featured),
    seo_title: input.seo_title?.trim() || null,
    seo_description: input.seo_description?.trim() || null,
    published_at: publishedAt,
  };
}

export async function createBlogAdmin(input: BlogPostInput): Promise<{
  post: BlogPost | null;
  error: string | null;
}> {
  try {
    const payload = buildBlogPayload(input);
    const { data, error } = await (supabase as any)
      .from("blog_posts")
      .insert(payload)
      .select(BLOG_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error("[TAMS Blogs Admin] createBlogAdmin error:", error);
      return {
        post: null,
        error: getFriendlyBlogError(error, "Could not create blog post. Please try again."),
      };
    }

    return { post: normalizeBlogRow(data as Record<string, unknown>), error: null };
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
    const payload = buildBlogPayload(input);
    const { data, error } = await (supabase as any)
      .from("blog_posts")
      .update(payload)
      .eq("id", id)
      .select(BLOG_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error("[TAMS Blogs Admin] updateBlogAdmin error:", error);
      return {
        post: null,
        error: getFriendlyBlogError(error, "Could not save blog changes. Please try again."),
      };
    }

    return { post: normalizeBlogRow(data as Record<string, unknown>), error: null };
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
      .select(BLOG_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error("[TAMS Blogs Admin] toggleBlogStatusAdmin error:", error);
      return {
        post: null,
        error: getFriendlyBlogError(error, "Could not update publish status."),
      };
    }

    return { post: normalizeBlogRow(data as Record<string, unknown>), error: null };
  } catch (err) {
    console.error("[TAMS Blogs Admin] toggleBlogStatusAdmin exception:", err);
    return {
      post: null,
      error: getFriendlyBlogError(err, "Could not update publish status."),
    };
  }
}

export async function toggleBlogFeaturedAdmin(
  id: string,
  isFeatured: boolean
): Promise<{
  post: BlogPost | null;
  error: string | null;
}> {
  try {
    const { data, error } = await (supabase as any)
      .from("blog_posts")
      .update({ is_featured: isFeatured })
      .eq("id", id)
      .select(BLOG_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error("[TAMS Blogs Admin] toggleBlogFeaturedAdmin error:", error);
      return {
        post: null,
        error: getFriendlyBlogError(error, "Could not update featured state."),
      };
    }

    return { post: normalizeBlogRow(data as Record<string, unknown>), error: null };
  } catch (err) {
    console.error("[TAMS Blogs Admin] toggleBlogFeaturedAdmin exception:", err);
    return {
      post: null,
      error: getFriendlyBlogError(err, "Could not update featured state."),
    };
  }
}

export async function deleteBlogAdmin(id: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    const { error } = await (supabase as any).from("blog_posts").delete().eq("id", id);

    if (error) {
      console.error("[TAMS Blogs Admin] deleteBlogAdmin error:", error);
      return {
        success: false,
        error: getFriendlyBlogError(error, "Could not delete blog post."),
      };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("[TAMS Blogs Admin] deleteBlogAdmin exception:", err);
    return {
      success: false,
      error: getFriendlyBlogError(err, "Could not delete blog post."),
    };
  }
}

export async function uploadBlogImageAdmin(file: File): Promise<{
  url: string | null;
  error: string | null;
}> {
  try {
    if (!file) {
      return { url: null, error: "Please select an image file." };
    }
    if (!BLOG_COVER_ALLOWED_MIME.has(file.type)) {
      return {
        url: null,
        error: "Unsupported image format. Use JPG, PNG, WebP, or GIF.",
      };
    }
    if (file.size > BLOG_COVER_MAX_BYTES) {
      return {
        url: null,
        error: "Image must be 5 MB or smaller.",
      };
    }

    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const ext = extMap[file.type] || "jpg";
    const randomPart = Math.random().toString(36).slice(2, 8);
    const filePath = `covers/${Date.now()}-${randomPart}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BLOG_IMAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("[TAMS Blogs Admin] uploadBlogImageAdmin error:", uploadError);
      return {
        url: null,
        error: getFriendlyBlogError(uploadError, "Could not upload image. Please try again."),
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from(BLOG_IMAGE_BUCKET)
      .getPublicUrl(filePath);

    return { url: publicUrlData?.publicUrl || null, error: null };
  } catch (err) {
    console.error("[TAMS Blogs Admin] uploadBlogImageAdmin exception:", err);
    return {
      url: null,
      error: getFriendlyBlogError(err, "Could not upload image. Please try again."),
    };
  }
}

