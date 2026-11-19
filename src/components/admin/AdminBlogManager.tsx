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
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  FileText,
  AlertCircle,
  X,
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
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";
import {
  BLOG_QUERY_KEYS,
  BlogPost,
  BlogPostInput,
  BlogStatus,
  createBlogAdmin,
  deleteBlogAdmin,
  fetchAllBlogsAdmin,
  formatBlogDate,
  generateBlogSlug,
  toggleBlogStatusAdmin,
  updateBlogAdmin,
  uploadBlogCoverAdmin,
} from "@/lib/blogs";
import { isSafeUrl, renderSafeBlogContent } from "@/lib/blogSanitizer";

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
  category: string;
  author_name: string;
  excerpt: string;
  cover_image_url: string;
  content: string;
  seo_title: string;
  seo_description: string;
  status: BlogStatus;
  published_at: string | null;
}

const EMPTY_FORM: EditorFormState = {
  title: "",
  slug: "",
  category: "Guides",
  author_name: "TAMS Pro Team",
  excerpt: "",
  cover_image_url: "",
  content: "",
  seo_title: "",
  seo_description: "",
  status: "draft",
  published_at: null,
};

export const AdminBlogManager: React.FC = () => {
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"list" | "editor">("list");
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | BlogStatus>("all");
  const [formState, setFormState] = useState<EditorFormState>(EMPTY_FORM);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [editorView, setEditorView] = useState<"write" | "split" | "preview">("split");

  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);

  const isSubmittingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: BLOG_QUERY_KEYS.adminList,
    queryFn: fetchAllBlogsAdmin,
    staleTime: 30 * 1000,
  });

  const posts = useMemo(() => data?.posts ?? [], [data?.posts]);
  const fetchError = data?.error ?? null;

  const filteredPosts = useMemo(() => {
    if (statusFilter === "all") return posts;
    return posts.filter((p) => p.status === statusFilter);
  }, [posts, statusFilter]);

  const counts = useMemo(() => {
    const published = posts.filter((p) => p.status === "published").length;
    const draft = posts.filter((p) => p.status === "draft").length;
    return { total: posts.length, published, draft };
  }, [posts]);

  const safePreviewHtml = useMemo(
    () => renderSafeBlogContent(formState.content),
    [formState.content]
  );

  const invalidateBlogQueries = async (slug?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: BLOG_QUERY_KEYS.adminList }),
      queryClient.invalidateQueries({ queryKey: BLOG_QUERY_KEYS.publicList }),
      ...(slug
        ? [queryClient.invalidateQueries({ queryKey: BLOG_QUERY_KEYS.publicDetail(slug) })]
        : []),
    ]);
  };

  const openNewEditor = () => {
    setEditingPost(null);
    setFormState(EMPTY_FORM);
    setSlugManuallyEdited(false);
    setEditorView("split");
    setMode("editor");
  };

  const openEditEditor = (post: BlogPost) => {
    setEditingPost(post);
    setFormState({
      title: post.title,
      slug: post.slug,
      category: post.category || "General",
      author_name: post.author_name || "TAMS Pro Team",
      excerpt: post.excerpt || "",
      cover_image_url: post.cover_image_url || "",
      content: post.content || "",
      seo_title: post.seo_title || "",
      seo_description: post.seo_description || "",
      status: post.status,
      published_at: post.published_at,
    });
    setSlugManuallyEdited(true);
    setEditorView("split");
    setMode("editor");
  };

  const handleBackToList = () => {
    setMode("list");
    setEditingPost(null);
  };

  const handleTitleChange = (val: string) => {
    setFormState((prev) => ({
      ...prev,
      title: val,
      slug: !slugManuallyEdited ? generateBlogSlug(val) : prev.slug,
    }));
  };

  const handleSlugChange = (val: string) => {
    setSlugManuallyEdited(true);
    setFormState((prev) => ({
      ...prev,
      slug: val.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
    }));
  };

  const handleRegenerateSlug = () => {
    const next = generateBlogSlug(formState.title);
    setFormState((prev) => ({ ...prev, slug: next }));
    setSlugManuallyEdited(false);
  };

  const insertMarkdownSnippet = (before: string, after = "", placeholder = "") => {
    const textarea = contentTextareaRef.current;
    if (!textarea) {
      setFormState((prev) => ({
        ...prev,
        content: `${prev.content}${prev.content ? "\n" : ""}${before}${placeholder}${after}`,
      }));
      return;
    }

    const start = textarea.selectionStart ?? formState.content.length;
    const end = textarea.selectionEnd ?? formState.content.length;
    const selected = formState.content.slice(start, end) || placeholder;
    const nextValue =
      formState.content.slice(0, start) +
      before +
      selected +
      after +
      formState.content.slice(end);

    setFormState((prev) => ({ ...prev, content: nextValue }));

    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + before.length + selected.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("You appear to be offline. Connect to the internet to upload an image.");
      return;
    }

    setUploadingCover(true);
    try {
      const { url, error } = await uploadBlogCoverAdmin(file);
      if (error || !url) {
        toast.error(error || "Could not upload cover image.");
        return;
      }
      setFormState((prev) => ({ ...prev, cover_image_url: url }));
      toast.success("Cover image uploaded.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmittingRef.current || saving) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Network connection issue. You are offline, changes were not saved.");
      return;
    }

    const cleanTitle = formState.title.trim();
    const cleanSlug = generateBlogSlug(formState.slug || formState.title);

    if (!cleanTitle) {
      toast.error("Please enter a blog title.");
      return;
    }

    if (!cleanSlug) {
      toast.error("Please enter a valid URL slug (letters, numbers, and hyphens).");
      return;
    }

    const coverUrl = formState.cover_image_url.trim();
    if (coverUrl && !isSafeUrl(coverUrl, { allowMailto: false })) {
      toast.error("Cover image URL must start with https://, http://, or /.");
      return;
    }

    if (!formState.content.trim()) {
      toast.error("Please add article content before saving.");
      return;
    }

    isSubmittingRef.current = true;
    setSaving(true);

    const payload: BlogPostInput = {
      title: cleanTitle,
      slug: cleanSlug,
      category: formState.category.trim() || "General",
      author_name: formState.author_name.trim() || "TAMS Pro Team",
      excerpt: formState.excerpt.trim(),
      cover_image_url: coverUrl || null,
      content: formState.content,
      seo_title: formState.seo_title.trim() || null,
      seo_description: formState.seo_description.trim() || null,
      status: formState.status,
      published_at: formState.published_at,
    };

    try {
      const result = editingPost
        ? await updateBlogAdmin(editingPost.id, payload)
        : await createBlogAdmin(payload);

      if (result.error || !result.post) {
        toast.error(result.error || "Could not save blog post.");
        return;
      }

      await invalidateBlogQueries(result.post.slug);
      if (editingPost && editingPost.slug !== result.post.slug) {
        await invalidateBlogQueries(editingPost.slug);
      }

      toast.success(
        result.post.status === "published"
          ? "Blog post saved and published live!"
          : "Blog draft saved."
      );
      setEditingPost(result.post);
      setFormState((prev) => ({
        ...prev,
        slug: result.post!.slug,
        published_at: result.post!.published_at,
      }));
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
        toast.error(error || "Could not update publish status.");
        return;
      }
      await invalidateBlogQueries(updated.slug);
      toast.success(
        nextStatus === "published"
          ? `"${updated.title}" is now published on /blogs.`
          : `"${updated.title}" moved back to Draft.`
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deletingId) return;
    const target = deleteTarget;
    setDeletingId(target.id);
    try {
      const { error } = await deleteBlogAdmin(target.id);
      if (error) {
        toast.error(error);
        return;
      }
      await invalidateBlogQueries(target.slug);
      toast.success(`Deleted "${target.title}".`);
      setDeleteTarget(null);
    } finally {
      setDeletingId(null);
    }
  };

  useFormKeyboardNav({
    containerRef: formRef,
    enabled: mode === "editor",
    autoFocusFirst: mode === "editor",
    onSave: () => {
      void handleSave();
    },
  });

  if (mode === "editor") {
    const safeCoverPreview =
      formState.cover_image_url.trim() &&
      isSafeUrl(formState.cover_image_url.trim(), { allowMailto: false })
        ? formState.cover_image_url.trim()
        : null;

    return (
      <form ref={formRef} onSubmit={handleSave} className="space-y-6">
        {/* Top Editor Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBackToList}
              className="gap-1.5"
              data-nav-skip="true"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Blog List</span>
            </Button>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {editingPost ? "Edit Blog Post" : "Create New Blog Post"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Ctrl/Cmd + S to save anytime • Enter moves to the next field
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant={formState.status === "published" ? "default" : "secondary"}
              className={
                formState.status === "published"
                  ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                  : ""
              }
            >
              {formState.status === "published" ? "Published" : "Draft"}
            </Badge>

            <Button
              type="submit"
              data-save-button="true"
              disabled={saving || uploadingCover}
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saving ? "Saving..." : "Save Post"}</span>
            </Button>
          </div>
        </div>

        {/* Spacious 2-column Editor Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Left Column (2/3): Title, Slug, Excerpt, Markdown/Rich Content + Live Preview */}
          <div className="lg:col-span-2 space-y-5">
            <Card className="border-border/60 shadow-soft-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Article Details</CardTitle>
                <CardDescription>
                  Write your article title, URL slug, summary, and main body content.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="blog-title">Title *</Label>
                  <Input
                    id="blog-title"
                    value={formState.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. How to Automate Umrah Group Bookings"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="blog-slug">URL Slug *</Label>
                    <button
                      type="button"
                      onClick={handleRegenerateSlug}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      data-nav-skip="true"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Regenerate from title
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono bg-muted px-2.5 py-2 border border-border">
                      /blogs/
                    </span>
                    <Input
                      id="blog-slug"
                      value={formState.slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="automate-umrah-group-bookings"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="blog-excerpt">Excerpt (card summary)</Label>
                  <Textarea
                    id="blog-excerpt"
                    rows={2}
                    value={formState.excerpt}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, excerpt: e.target.value }))
                    }
                    placeholder="Short 1–2 sentence summary shown on the Blogs card grid..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Content Editor + Live Preview */}
            <Card className="border-border/60 shadow-soft-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Content *</CardTitle>
                    <CardDescription>
                      Supports Markdown headings, bold, lists, quotes, links, and images.
                    </CardDescription>
                  </div>

                  <Tabs
                    value={editorView}
                    onValueChange={(v) => setEditorView(v as "write" | "split" | "preview")}
                  >
                    <TabsList>
                      <TabsTrigger value="write" data-nav-skip="true">
                        Write
                      </TabsTrigger>
                      <TabsTrigger value="split" data-nav-skip="true">
                        Split Preview
                      </TabsTrigger>
                      <TabsTrigger value="preview" data-nav-skip="true">
                        Preview
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Formatting Toolbar */}
                {editorView !== "preview" && (
                  <div className="flex flex-wrap items-center gap-1 pt-3 border-t border-border/60">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs gap-1"
                      onClick={() => insertMarkdownSnippet("## ", "", "Section Heading")}
                      data-nav-skip="true"
                      title="Heading 2"
                    >
                      <Heading2 className="w-3.5 h-3.5" />
                      <span>H2</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs gap-1"
                      onClick={() => insertMarkdownSnippet("### ", "", "Subheading")}
                      data-nav-skip="true"
                      title="Heading 3"
                    >
                      <Heading3 className="w-3.5 h-3.5" />
                      <span>H3</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs"
                      onClick={() => insertMarkdownSnippet("**", "**", "bold text")}
                      data-nav-skip="true"
                      title="Bold"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs"
                      onClick={() => insertMarkdownSnippet("*", "*", "italic text")}
                      data-nav-skip="true"
                      title="Italic"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs"
                      onClick={() => insertMarkdownSnippet("- ", "", "List item")}
                      data-nav-skip="true"
                      title="Bullet List"
                    >
                      <List className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs"
                      onClick={() => insertMarkdownSnippet("1. ", "", "First step")}
                      data-nav-skip="true"
                      title="Numbered List"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs"
                      onClick={() => insertMarkdownSnippet("> ", "", "Key takeaway")}
                      data-nav-skip="true"
                      title="Quote"
                    >
                      <Quote className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs gap-1"
                      onClick={() =>
                        insertMarkdownSnippet("[", "](https://tamspro.vercel.app)", "Link text")
                      }
                      data-nav-skip="true"
                      title="Link"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>Link</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs gap-1"
                      onClick={() =>
                        insertMarkdownSnippet(
                          "![",
                          "](https://example.com/image.jpg)",
                          "Image description"
                        )
                      }
                      data-nav-skip="true"
                      title="Image"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Image</span>
                    </Button>
                  </div>
                )}
              </CardHeader>

              <CardContent>
                <div
                  className={
                    editorView === "split"
                      ? "grid grid-cols-1 xl:grid-cols-2 gap-4"
                      : "block"
                  }
                >
                  {editorView !== "preview" && (
                    <div>
                      <Textarea
                        ref={contentTextareaRef}
                        id="blog-content"
                        rows={16}
                        value={formState.content}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, content: e.target.value }))
                        }
                        placeholder="Write your article in Markdown or clean HTML..."
                        className="font-mono text-sm leading-relaxed min-h-[380px]"
                      />
                    </div>
                  )}

                  {editorView !== "write" && (
                    <div className="border border-border bg-white p-5 min-h-[380px] max-h-[540px] overflow-y-auto">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 pb-2 border-b border-border/60">
                        Live Sanitized Preview
                      </p>
                      {safePreviewHtml ? (
                        <div
                          className="text-slate-800 text-sm leading-7 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 [&_blockquote]:border-l-4 [&_blockquote]:border-teal-600 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-3 [&_a]:text-teal-700 [&_a]:underline [&_img]:max-w-full [&_img]:my-3 [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5"
                          dangerouslySetInnerHTML={{ __html: safePreviewHtml }}
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          Start writing on the left to see a live preview here...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar Column (1/3): Publish Status, Metadata, Cover Upload, SEO */}
          <div className="space-y-5">
            {/* Publishing Card */}
            <Card className="border-border/60 shadow-soft-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Publishing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3 p-3 border border-border bg-muted/30">
                  <div>
                    <Label htmlFor="blog-status-switch" className="font-semibold">
                      {formState.status === "published" ? "Published (Live)" : "Draft (Hidden)"}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formState.status === "published"
                        ? "Visible immediately on /blogs"
                        : "Only admins can view drafts"}
                    </p>
                  </div>
                  <Switch
                    id="blog-status-switch"
                    checked={formState.status === "published"}
                    onCheckedChange={(checked) =>
                      setFormState((prev) => ({
                        ...prev,
                        status: checked ? "published" : "draft",
                      }))
                    }
                  />
                </div>

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
                        data-nav-skip="true"
                        onClick={() => setFormState((prev) => ({ ...prev, category: cat }))}
                        className={`text-[11px] px-2 py-0.5 border transition-colors ${
                          formState.category === cat
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="blog-author">Author Name</Label>
                  <Input
                    id="blog-author"
                    value={formState.author_name}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, author_name: e.target.value }))
                    }
                    placeholder="TAMS Pro Team"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Cover Image Upload Card */}
            <Card className="border-border/60 shadow-soft-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Cover Image</CardTitle>
                <CardDescription>
                  Uploads to the public blog-covers bucket (max 5 MB).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {safeCoverPreview ? (
                  <div className="relative border border-border overflow-hidden bg-muted/20">
                    <img
                      src={safeCoverPreview}
                      alt="Cover preview"
                      className="w-full h-40 object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        setFormState((prev) => ({ ...prev, cover_image_url: "" }))
                      }
                      className="absolute top-2 right-2 h-7 px-2 text-xs gap-1"
                      data-nav-skip="true"
                    >
                      <X className="w-3.5 h-3.5" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="border border-dashed border-border p-5 text-center text-xs text-muted-foreground bg-muted/20">
                    No cover image selected
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleCoverUpload}
                  className="hidden"
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="w-full gap-2"
                  data-nav-skip="true"
                >
                  {uploadingCover ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{uploadingCover ? "Uploading..." : "Upload Cover Image"}</span>
                </Button>

                <div className="space-y-1">
                  <Label htmlFor="blog-cover-url" className="text-xs text-muted-foreground">
                    Or paste image URL
                  </Label>
                  <Input
                    id="blog-cover-url"
                    value={formState.cover_image_url}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, cover_image_url: e.target.value }))
                    }
                    placeholder="https://..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* SEO Card */}
            <Card className="border-border/60 shadow-soft-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">SEO Settings</CardTitle>
                <CardDescription>
                  Optional search metadata (falls back to Title & Excerpt).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="blog-seo-title">SEO Title</Label>
                  <Input
                    id="blog-seo-title"
                    value={formState.seo_title}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, seo_title: e.target.value }))
                    }
                    placeholder={formState.title || "Custom page title for search engines"}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="blog-seo-desc">SEO Description</Label>
                    <span className="text-[11px] text-muted-foreground">
                      {formState.seo_description.length}/160
                    </span>
                  </div>
                  <Textarea
                    id="blog-seo-desc"
                    rows={3}
                    value={formState.seo_description}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, seo_description: e.target.value }))
                    }
                    placeholder={
                      formState.excerpt || "Concise summary shown in Google search results..."
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span>Blog Posts</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {counts.total} total • {counts.published} published • {counts.draft} drafts
          </p>
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
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            type="button"
            onClick={openNewEditor}
            className="gap-1.5"
            data-save-button="true"
          >
            <Plus className="w-4 h-4" />
            <span>New Blog</span>
          </Button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2">
        {(["all", "published", "draft"] as const).map((filter) => (
          <Button
            key={filter}
            type="button"
            size="sm"
            variant={statusFilter === filter ? "default" : "outline"}
            onClick={() => setStatusFilter(filter)}
            className="capitalize text-xs h-8"
          >
            {filter}
          </Button>
        ))}
      </div>

      {/* Error Banner */}
      {fetchError && (
        <div className="p-4 border border-amber-300 bg-amber-50 text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">Unable to load blog posts</p>
            <p className="text-xs text-amber-800">{fetchError}</p>
          </div>
        </div>
      )}

      {/* List */}
      <Card className="border-border/60 shadow-soft-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading blog posts...</span>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
              <div>
                <p className="font-semibold text-sm">No blog posts found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click "New Blog" to write your first article for travel agencies.
                </p>
              </div>
              <Button type="button" size="sm" onClick={openNewEditor} className="gap-1.5">
                <Plus className="w-4 h-4" />
                <span>New Blog</span>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredPosts.map((post) => {
                const displayDate = formatBlogDate(post.published_at || post.created_at);
                const isPublished = post.status === "published";
                const isToggling = togglingId === post.id;

                return (
                  <div
                    key={post.id}
                    className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-base text-foreground truncate max-w-xl">
                          {post.title}
                        </h3>
                        <Badge
                          variant={isPublished ? "default" : "secondary"}
                          className={
                            isPublished
                              ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                              : "bg-amber-100 text-amber-900 hover:bg-amber-100"
                          }
                        >
                          {isPublished ? "Published" : "Draft"}
                        </Badge>
                        <Badge variant="outline">{post.category || "General"}</Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono">/blogs/{post.slug}</span>
                        {displayDate && <span>• {displayDate}</span>}
                        <span>• {post.author_name || "TAMS Pro Team"}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {isPublished && (
                        <a
                          href={`/blogs/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button type="button" variant="outline" size="sm" className="gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>View</span>
                          </Button>
                        </a>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditEditor(post)}
                        className="gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isToggling}
                        onClick={() => handleToggleStatus(post)}
                        className="gap-1.5"
                      >
                        {isToggling ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isPublished ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                        <span>{isPublished ? "Unpublish" : "Publish"}</span>
                      </Button>

                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(post)}
                        className="gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingId) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete blog post?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={Boolean(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? "Deleting..." : "Delete Post"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

