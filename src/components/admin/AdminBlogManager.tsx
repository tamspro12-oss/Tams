import React, { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ArrowLeft,
  Save,
  Upload,
  Image as ImageIcon,
  ExternalLink,
  RefreshCw,
  Loader2,
  FileText,
  AlertCircle,
  Star,
  X,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import {
  BLOG_QUERY_KEYS,
  BlogPost,
  BlogPostInput,
  BlogStatus,
  createBlogAdmin,
  deleteBlogAdmin,
  estimateReadMinutes,
  fetchAllBlogsAdmin,
  formatBlogDate,
  generateBlogSlug,
  normalizeTags,
  toggleBlogFeaturedAdmin,
  toggleBlogStatusAdmin,
  updateBlogAdmin,
  uploadBlogImageAdmin,
} from "@/lib/blogs";
import { isSafeUrl } from "@/lib/blogSanitizer";

const CATEGORY_SUGGESTIONS = [
  "Guides",
  "Operations",
  "Umrah",
  "Finance",
  "Product Updates",
];

interface EditorFormState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string;
  category: string;
  tags: string[];
  author: string;
  status: BlogStatus;
  is_featured: boolean;
  published_at: string;
  seo_title: string;
  seo_description: string;
  focus_keyword: string;
  cover_image_alt: string;
}

function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(localStr: string): string | null {
  const trimmed = localStr.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

const EMPTY_FORM: EditorFormState = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  cover_image_url: "",
  category: "Guides",
  tags: [],
  author: "TAMS Pro Team",
  status: "draft",
  is_featured: false,
  published_at: "",
  seo_title: "",
  seo_description: "",
  focus_keyword: "",
  cover_image_alt: "",
};

export const AdminBlogManager: React.FC = () => {
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"list" | "editor">("list");
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | BlogStatus | "featured">("all");
  const [listSearch, setListSearch] = useState("");

  const [formState, setFormState] = useState<EditorFormState>(EMPTY_FORM);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [tagDraft, setTagDraft] = useState("");

  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [featuringId, setFeaturingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);

  const isSubmittingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: BLOG_QUERY_KEYS.adminList,
    queryFn: fetchAllBlogsAdmin,
    staleTime: 30 * 1000,
  });

  const posts = useMemo(() => data?.posts ?? [], [data?.posts]);
  const fetchError = data?.error ?? null;

  const counts = useMemo(() => {
    const published = posts.filter((p) => p.status === "published").length;
    const draft = posts.filter((p) => p.status === "draft").length;
    const featured = posts.filter((p) => p.is_featured).length;
    return { total: posts.length, published, draft, featured };
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return posts.filter((p) => {
      if (statusFilter === "featured" && !p.is_featured) return false;
      if ((statusFilter === "published" || statusFilter === "draft") && p.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return [p.title, p.slug, p.category, p.author, ...p.tags]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [posts, statusFilter, listSearch]);

  const invalidateBlogQueries = async (slugs: string[] = []) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: BLOG_QUERY_KEYS.adminList }),
      queryClient.invalidateQueries({ queryKey: BLOG_QUERY_KEYS.publicList }),
      ...slugs
        .filter(Boolean)
        .flatMap((slug) => [
          queryClient.invalidateQueries({ queryKey: BLOG_QUERY_KEYS.publicDetail(slug) }),
          queryClient.invalidateQueries({ queryKey: BLOG_QUERY_KEYS.related(slug) }),
        ]),
    ]);
  };

  const openNewEditor = () => {
    setEditingPost(null);
    setFormState({ ...EMPTY_FORM });
    setTagDraft("");
    setSlugManuallyEdited(false);
    setMode("editor");
  };

  const openEditEditor = (post: BlogPost) => {
    setEditingPost(post);
    setFormState({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || "",
      content: post.content || "",
      cover_image_url: post.cover_image_url || "",
      category: post.category || "Guides",
      tags: [...(post.tags || [])],
      author: post.author || "TAMS Pro Team",
      status: post.status,
      is_featured: Boolean(post.is_featured),
      published_at: toDatetimeLocalValue(post.published_at),
      seo_title: post.seo_title || "",
      seo_description: post.seo_description || "",
      focus_keyword: post.focus_keyword || "",
      cover_image_alt: post.cover_image_alt || "",
    });
    setTagDraft("");
    setSlugManuallyEdited(true);
    setMode("editor");
  };

  const handleTitleChange = (nextTitle: string) => {
    setFormState((prev) => ({
      ...prev,
      title: nextTitle,
      slug: slugManuallyEdited ? prev.slug : generateBlogSlug(nextTitle),
    }));
  };

  const handleAddTagsFromInput = (raw: string) => {
    const pieces = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (pieces.length === 0) return;
    setFormState((prev) => ({
      ...prev,
      tags: normalizeTags([...prev.tags, ...pieces]),
    }));
    setTagDraft("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormState((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tagToRemove),
    }));
  };

  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true);
    try {
      const { url, error } = await uploadBlogImageAdmin(file);
      if (error || !url) {
        toast.error(error || "Could not upload cover image.");
        return;
      }
      setFormState((prev) => ({ ...prev, cover_image_url: url }));
      toast.success("Cover image uploaded");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmittingRef.current || saving) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("You appear to be offline. Please check your connection and try again.");
      return;
    }

    const cleanTitle = formState.title.trim();
    const cleanSlug = generateBlogSlug(formState.slug || cleanTitle);
    const cleanContent = formState.content.trim();
    const cleanCover = formState.cover_image_url.trim();

    if (!cleanTitle) {
      toast.error("Please enter a blog post title.");
      return;
    }
    if (!cleanSlug) {
      toast.error("Please provide a valid URL slug.");
      return;
    }
    if (!cleanContent) {
      toast.error("Please write article content before saving.");
      return;
    }
    if (cleanCover && !isSafeUrl(cleanCover, { allowMailto: false })) {
      toast.error("Cover image URL must start with https://, http://, or /.");
      return;
    }

    const pendingTags = tagDraft.trim()
      ? normalizeTags([...formState.tags, ...tagDraft.split(",")])
      : formState.tags;

    const parsedPublishDate = fromDatetimeLocalValue(formState.published_at);

    const payload: BlogPostInput = {
      title: cleanTitle,
      slug: cleanSlug,
      excerpt: formState.excerpt.trim(),
      content: cleanContent,
      cover_image_url: cleanCover || null,
      category: formState.category.trim() || "General",
      tags: pendingTags,
      author: formState.author.trim() || "TAMS Pro Team",
      status: formState.status,
      is_featured: formState.is_featured,
      published_at:
        parsedPublishDate ??
        (formState.status === "published"
          ? editingPost?.published_at || new Date().toISOString()
          : null),
      seo_title: formState.seo_title.trim() || null,
      seo_description: formState.seo_description.trim() || null,
      focus_keyword: formState.focus_keyword.trim() || null,
      cover_image_alt: formState.cover_image_alt.trim() || null,
    };

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      const result = editingPost
        ? await updateBlogAdmin(editingPost.id, payload)
        : await createBlogAdmin(payload);

      if (result.error || !result.post) {
        toast.error(result.error || "Failed to save blog post.");
        return;
      }

      const slugsToInvalidate = [result.post.slug];
      if (editingPost?.slug && editingPost.slug !== result.post.slug) {
        slugsToInvalidate.push(editingPost.slug);
      }

      await invalidateBlogQueries(slugsToInvalidate);
      toast.success(
        editingPost
          ? result.post.status === "published"
            ? "Blog post updated and live"
            : "Draft updated"
          : result.post.status === "published"
            ? "Blog post published!"
            : "Draft created"
      );

      setEditingPost(result.post);
      setFormState({
        title: result.post.title,
        slug: result.post.slug,
        excerpt: result.post.excerpt,
        content: result.post.content,
        cover_image_url: result.post.cover_image_url || "",
        category: result.post.category,
        tags: [...result.post.tags],
        author: result.post.author,
        status: result.post.status,
        is_featured: result.post.is_featured,
        published_at: toDatetimeLocalValue(result.post.published_at),
        seo_title: result.post.seo_title || "",
        seo_description: result.post.seo_description || "",
        focus_keyword: result.post.focus_keyword || "",
        cover_image_alt: result.post.cover_image_alt || "",
      });
      setTagDraft("");
      setMode("list");
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  const handleToggleStatus = async (post: BlogPost) => {
    if (togglingId) return;
    const nextStatus: BlogStatus = post.status === "published" ? "draft" : "published";
    setTogglingId(post.id);
    try {
      const { post: updated, error } = await toggleBlogStatusAdmin(
        post.id,
        nextStatus,
        post.published_at
      );
      if (error || !updated) {
        toast.error(error || "Failed to update post status.");
        return;
      }
      await invalidateBlogQueries([updated.slug]);
      toast.success(
        updated.status === "published"
          ? `"${updated.title}" is now published on /blogs`
          : `"${updated.title}" moved back to draft`
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleFeatured = async (post: BlogPost) => {
    if (featuringId) return;
    setFeaturingId(post.id);
    try {
      const { post: updated, error } = await toggleBlogFeaturedAdmin(
        post.id,
        !post.is_featured
      );
      if (error || !updated) {
        toast.error(error || "Failed to update featured flag.");
        return;
      }
      await invalidateBlogQueries([updated.slug]);
      toast.success(updated.is_featured ? "Marked as featured post" : "Removed from featured");
    } finally {
      setFeaturingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deletingId) return;
    const target = deleteTarget;
    setDeletingId(target.id);
    try {
      const { success, error } = await deleteBlogAdmin(target.id);
      if (!success || error) {
        toast.error(error || "Failed to delete blog post.");
        return;
      }
      await invalidateBlogQueries([target.slug]);
      toast.success(`Deleted "${target.title}"`);
      setDeleteTarget(null);
    } finally {
      setDeletingId(null);
    }
  };

  if (mode === "editor") {
    return (
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMode("list")}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Posts</span>
              </Button>
              <div>
                <CardTitle className="text-xl">
                  {editingPost ? "Edit Blog Post" : "Create Blog Post"}
                </CardTitle>
                <CardDescription>
                  Publish immediately or save as draft. Changes appear live on /blogs.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {editingPost?.status === "published" && (
                <a
                  href={`/blogs/${editingPost.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button type="button" variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>View Live</span>
                  </Button>
                </a>
              )}
              <Button
                type="button"
                onClick={() => handleSave()}
                disabled={saving}
                className="gap-1.5"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{formState.status === "published" ? "Save & Publish" : "Save Draft"}</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Editor Column */}
              <div className="lg:col-span-2 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="blog-title">Title *</Label>
                  <Input
                    id="blog-title"
                    value={formState.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. Complete Guide to Umrah Package Costing in 2026"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="blog-slug">URL Slug *</Label>
                    <Button
                      type="button"
                      data-compact-btn=""
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setSlugManuallyEdited(false);
                        setFormState((prev) => ({
                          ...prev,
                          slug: generateBlogSlug(prev.title),
                        }));
                      }}
                    >
                      Auto-generate from title
                    </Button>
                  </div>
                  <Input
                    id="blog-slug"
                    value={formState.slug}
                    onChange={(e) => {
                      setSlugManuallyEdited(true);
                      setFormState((prev) => ({
                        ...prev,
                        slug: generateBlogSlug(e.target.value),
                      }));
                    }}
                    placeholder="complete-guide-to-umrah-package-costing"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Public URL: <code className="text-foreground">/blogs/{formState.slug || "your-post-slug"}</code>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="blog-excerpt">Short Excerpt</Label>
                  <Textarea
                    id="blog-excerpt"
                    rows={3}
                    value={formState.excerpt}
                    onChange={(e) => setFormState((prev) => ({ ...prev, excerpt: e.target.value }))}
                    placeholder="Concise summary shown on blog cards and search snippets..."
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Article Content *</Label>
                    <span className="text-xs text-muted-foreground">
                      ~{estimateReadMinutes(formState.content)} min read
                    </span>
                  </div>
                  <RichTextEditor
                    value={formState.content}
                    onChange={(nextHtml) =>
                      setFormState((prev) => ({ ...prev, content: nextHtml }))
                    }
                    resetKey={editingPost?.id || "new"}
                  />
                </div>
              </div>

              {/* Metadata & Publishing Sidebar */}
              <div className="space-y-5">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Publishing</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label htmlFor="blog-status-switch" className="text-sm font-medium">
                          Publish Post
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {formState.status === "published"
                            ? "Visible on /blogs immediately"
                            : "Hidden draft (admin only)"}
                        </p>
                      </div>
                      <Switch
                        id="blog-status-switch"
                        checked={formState.status === "published"}
                        onCheckedChange={(checked) =>
                          setFormState((prev) => ({
                            ...prev,
                            status: checked ? "published" : "draft",
                            published_at:
                              checked && !prev.published_at
                                ? toDatetimeLocalValue(new Date().toISOString())
                                : prev.published_at,
                          }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2 border-t">
                      <div>
                        <Label htmlFor="blog-featured-switch" className="text-sm font-medium">
                          Featured Post
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Highlights article with a Featured badge
                        </p>
                      </div>
                      <Switch
                        id="blog-featured-switch"
                        checked={formState.is_featured}
                        onCheckedChange={(checked) =>
                          setFormState((prev) => ({ ...prev, is_featured: checked }))
                        }
                      />
                    </div>

                    <div className="space-y-1.5 pt-2 border-t">
                      <Label htmlFor="blog-published-at">Publish Date</Label>
                      <Input
                        id="blog-published-at"
                        type="datetime-local"
                        value={formState.published_at}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, published_at: e.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="blog-author">Author</Label>
                      <Input
                        id="blog-author"
                        value={formState.author}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, author: e.target.value }))
                        }
                        placeholder="TAMS Pro Team"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Category &amp; Tags</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="blog-category">Category</Label>
                      <Input
                        id="blog-category"
                        value={formState.category}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, category: e.target.value }))
                        }
                        placeholder="Guides"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {CATEGORY_SUGGESTIONS.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            data-compact-btn=""
                            onClick={() => setFormState((prev) => ({ ...prev, category: cat }))}
                            className={`px-2 py-0.5 text-[11px] border transition-colors ${
                              formState.category === cat
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/50 text-foreground border-border hover:bg-muted"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t">
                      <Label htmlFor="blog-tags-input">Tags</Label>
                      <div className="flex gap-2">
                        <Input
                          id="blog-tags-input"
                          value={tagDraft}
                          onChange={(e) => setTagDraft(e.target.value)}
                          placeholder="Add tag, press Enter"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                              e.preventDefault();
                              handleAddTagsFromInput(tagDraft);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddTagsFromInput(tagDraft)}
                        >
                          Add
                        </Button>
                      </div>

                      {formState.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {formState.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="gap-1 pr-1.5 text-xs font-normal"
                            >
                              <span>#{tag}</span>
                              <button
                                type="button"
                                data-compact-btn=""
                                onClick={() => handleRemoveTag(tag)}
                                aria-label={`Remove tag ${tag}`}
                                className="hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Cover Image</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void handleCoverUpload(file);
                      }}
                    />

                    {formState.cover_image_url &&
                    isSafeUrl(formState.cover_image_url, { allowMailto: false }) ? (
                      <div className="relative border overflow-hidden">
                        <img
                          src={formState.cover_image_url}
                          alt="Cover preview"
                          className="w-full h-40 object-cover"
                        />
                        <Button
                          type="button"
                          data-compact-btn=""
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 h-7 px-2 text-xs"
                          onClick={() =>
                            setFormState((prev) => ({ ...prev, cover_image_url: "" }))
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file) void handleCoverUpload(file);
                        }}
                        className="border border-dashed p-5 text-center space-y-2 bg-muted/20"
                      >
                        <ImageIcon className="h-7 w-7 mx-auto text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG, WebP, or GIF up to 5 MB
                        </p>
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      disabled={uploadingCover}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingCover ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <span>{uploadingCover ? "Uploading..." : "Upload Cover Image"}</span>
                    </Button>

                    <div className="space-y-1">
                      <Label htmlFor="blog-cover-url" className="text-xs text-muted-foreground">
                        Or paste image URL
                      </Label>
                      <Input
                        id="blog-cover-url"
                        type="url"
                        value={formState.cover_image_url}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, cover_image_url: e.target.value }))
                        }
                        placeholder="https://..."
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">SEO Metadata (Optional)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="blog-seo-title" className="text-xs">
                        SEO Title
                      </Label>
                      <Input
                        id="blog-seo-title"
                        value={formState.seo_title}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, seo_title: e.target.value }))
                        }
                        placeholder="Defaults to post title"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="blog-seo-desc" className="text-xs">
                        Meta Description
                      </Label>
                      <Textarea
                        id="blog-seo-desc"
                        rows={2}
                        value={formState.seo_description}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, seo_description: e.target.value }))
                        }
                        placeholder="Defaults to excerpt"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="blog-focus-keyword" className="text-xs">
                        Focus Keyword
                      </Label>
                      <Input
                        id="blog-focus-keyword"
                        value={formState.focus_keyword}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, focus_keyword: e.target.value }))
                        }
                        placeholder="e.g. travel agency software Pakistan"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="blog-cover-alt" className="text-xs">
                        Cover Image Alt Text
                      </Label>
                      <Input
                        id="blog-cover-alt"
                        value={formState.cover_image_alt}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, cover_image_alt: e.target.value }))
                        }
                        placeholder="Descriptive alt text for SEO"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setMode("list")}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{editingPost ? "Save Changes" : "Create Post"}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span>Blog Posts</span>
            </CardTitle>
            <CardDescription>
              Create, edit, publish, unpublish, and feature posts shown on /blogs.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
            <Button type="button" size="sm" onClick={openNewEditor} className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span>New Blog Post</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filter Tabs + Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as "all" | BlogStatus | "featured")}
          >
            <TabsList>
              <TabsTrigger value="all">All ({counts.total})</TabsTrigger>
              <TabsTrigger value="published">Published ({counts.published})</TabsTrigger>
              <TabsTrigger value="draft">Drafts ({counts.draft})</TabsTrigger>
              <TabsTrigger value="featured">Featured ({counts.featured})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Filter posts..."
              className="pl-9 h-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : fetchError ? (
          <div className="p-6 border bg-destructive/5 text-center space-y-3">
            <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{fetchError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-10 border border-dashed text-center space-y-3">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
            <div>
              <p className="font-semibold">No blog posts found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {posts.length === 0
                  ? "Create your first article to publish it on /blogs."
                  : "No articles match the selected filter."}
              </p>
            </div>
            {posts.length === 0 && (
              <Button type="button" size="sm" onClick={openNewEditor} className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span>Create First Post</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPosts.map((post) => {
              const displayDate = formatBlogDate(post.published_at || post.created_at);
              const safeCover =
                post.cover_image_url && isSafeUrl(post.cover_image_url, { allowMailto: false })
                  ? post.cover_image_url
                  : null;

              return (
                <div
                  key={post.id}
                  className="border p-4 bg-card flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-20 h-14 border bg-muted/40 shrink-0 overflow-hidden flex items-center justify-center">
                      {safeCover ? (
                        <img
                          src={safeCover}
                          alt={post.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-base truncate max-w-md">
                          {post.title}
                        </h3>
                        <Badge
                          variant={post.status === "published" ? "default" : "secondary"}
                          className="text-[11px]"
                        >
                          {post.status === "published" ? "Published" : "Draft"}
                        </Badge>
                        {post.is_featured && (
                          <Badge variant="outline" className="text-[11px] gap-1 border-amber-500 text-amber-700">
                            <Star className="h-3 w-3 fill-current" />
                            <span>Featured</span>
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>/blogs/{post.slug}</span>
                        <span>• {post.category}</span>
                        <span>• {post.author}</span>
                        {displayDate && <span>• {displayDate}</span>}
                      </div>

                      {post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {post.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="text-[11px] bg-muted px-1.5 py-0.5 text-muted-foreground"
                            >
                              #{tag}
                            </span>
                          ))}
                          {post.tags.length > 4 && (
                            <span className="text-[11px] text-muted-foreground">
                              +{post.tags.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      data-compact-btn=""
                      variant={post.is_featured ? "default" : "outline"}
                      size="sm"
                      disabled={featuringId === post.id}
                      onClick={() => handleToggleFeatured(post)}
                      title={post.is_featured ? "Unfeature post" : "Feature post"}
                      className="gap-1.5"
                    >
                      {featuringId === post.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Star className={`h-3.5 w-3.5 ${post.is_featured ? "fill-current" : ""}`} />
                      )}
                      <span>{post.is_featured ? "Featured" : "Feature"}</span>
                    </Button>

                    <Button
                      type="button"
                      data-compact-btn=""
                      variant="outline"
                      size="sm"
                      disabled={togglingId === post.id}
                      onClick={() => handleToggleStatus(post)}
                      className="gap-1.5"
                    >
                      {togglingId === post.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : post.status === "published" ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                      <span>{post.status === "published" ? "Unpublish" : "Publish"}</span>
                    </Button>

                    {post.status === "published" && (
                      <a
                        href={`/blogs/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button type="button" data-compact-btn="" variant="outline" size="sm" className="gap-1">
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>View</span>
                        </Button>
                      </a>
                    )}

                    <Button
                      type="button"
                      data-compact-btn=""
                      variant="outline"
                      size="sm"
                      onClick={() => openEditEditor(post)}
                      className="gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      type="button"
                      data-compact-btn=""
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(post)}
                      aria-label={`Delete ${post.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete blog post?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes "{deleteTarget?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={Boolean(deletingId)}
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

