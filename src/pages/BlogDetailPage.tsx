import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Clock,
  User,
  Share2,
  Check,
  Copy,
  Star,
  AlertCircle,
  Tag,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { BlogLeadCaptureBox } from "@/components/public/BlogLeadCaptureBox";
import { PRODUCTION_APP_ORIGIN } from "@/lib/authRedirect";
import {
  BLOG_QUERY_KEYS,
  BlogFaqItem,
  BlogPost,
  fetchPopularPublishedBlogs,
  fetchPublishedBlogBySlug,
  fetchRelatedPublishedBlogs,
  formatBlogDate,
  getPostReadMinutes,
} from "@/lib/blogs";
import { isSafeUrl, renderSafeBlogContent, stripHtmlToText } from "@/lib/blogSanitizer";

function extractFaqItemsFallback(rawContent: string): BlogFaqItem[] {
  if (!rawContent) return [];
  const faqSectionMatch = rawContent.match(
    /<h2[^>]*>[^<]*(?:frequently asked questions|faq)[^<]*<\/h2>([\s\S]*)$/i
  );
  if (!faqSectionMatch) return [];

  const section = faqSectionMatch[1];
  const pairs: BlogFaqItem[] = [];
  const regex = /<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(section)) !== null) {
    const question = stripHtmlToText(match[1]);
    const answer = stripHtmlToText(match[2]);
    if (question && answer) {
      pairs.push({ question, answer });
    }
  }
  return pairs.slice(0, 6);
}

function CompactBlogCard({ post }: { post: BlogPost }) {
  const coverUrl =
    post.cover_image_url && isSafeUrl(post.cover_image_url, { allowMailto: false })
      ? post.cover_image_url
      : null;
  const dateLabel = formatBlogDate(post.published_at || post.created_at);

  return (
    <Link
      to={`/blogs/${post.slug}`}
      className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63]"
    >
      <article className="tams-card tams-card-interactive group h-full rounded-2xl overflow-hidden bg-[var(--card,#FFFFFF)] flex flex-col justify-between">
        <div>
          <div className="tams-blog-cover aspect-[16/9] w-full overflow-hidden border-b border-[var(--border,#E5E0D3)]">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={post.cover_image_alt || post.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-[1.03] group-hover:transition-transform group-hover:duration-200"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-[#CFE3E0]" strokeWidth={1.75} />
              </div>
            )}
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="bg-[var(--tint,#E4F2EF)] text-[var(--primary,#0F5C63)] border border-[var(--border,#E5E0D3)] text-[11px] font-semibold px-2 py-0.5 rounded-full truncate">
                {post.category || "General"}
              </span>
              {dateLabel && (
                <span className="text-[11px] text-[var(--body,#4A5A63)] shrink-0">{dateLabel}</span>
              )}
            </div>

            <h3 className="text-sm font-bold text-[var(--ink,#0B1F2A)] group-hover:text-[var(--primary,#0F5C63)] group-hover:transition-colors group-hover:duration-200 line-clamp-2 leading-snug">
              {post.title}
            </h3>
          </div>
        </div>

        <div className="px-4 pb-4 pt-1">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary,#0F5C63)]">
            <span>Read article</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:transition-transform group-hover:duration-200" />
          </span>
        </div>
      </article>
    </Link>
  );
}

function DetailLoadingSkeleton() {
  return (
    <div className="tams-card rounded-2xl bg-[var(--card,#FFFFFF)] p-6 sm:p-10 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="h-4 w-24 rounded-md" />
      </div>
      <Skeleton className="h-10 w-5/6 rounded-md" />
      <Skeleton className="h-5 w-3/4 rounded-md" />
      <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
      <div className="space-y-3 pt-4">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-11/12 rounded-md" />
        <Skeleton className="h-4 w-5/6 rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
      </div>
    </div>
  );
}

function BlogDetailContent() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [copiedLink, setCopiedLink] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: BLOG_QUERY_KEYS.publicDetail(slug),
    queryFn: () => fetchPublishedBlogBySlug(slug),
    enabled: Boolean(slug),
    staleTime: 15 * 1000,
    refetchOnMount: "always",
  });

  const post = data?.post ?? null;
  const notFound = Boolean(data?.notFound) || !slug;
  const fetchError = data?.error ?? null;

  const { data: relatedPosts = [] } = useQuery({
    queryKey: BLOG_QUERY_KEYS.related(slug),
    queryFn: () => fetchRelatedPublishedBlogs({ id: post!.id, category: post!.category }, 3),
    enabled: Boolean(post?.id),
    staleTime: 60 * 1000,
  });

  const popularExcludeIds = useMemo(
    () => (post ? [post.id, ...relatedPosts.map((r) => r.id)] : []),
    [post, relatedPosts]
  );

  const { data: popularPosts = [] } = useQuery({
    queryKey: BLOG_QUERY_KEYS.popular(popularExcludeIds.join(",")),
    queryFn: () => fetchPopularPublishedBlogs(popularExcludeIds, 4),
    enabled: Boolean(post?.id),
    staleTime: 60 * 1000,
  });

  const safeCoverUrl = useMemo(() => {
    if (!post?.cover_image_url) return null;
    return isSafeUrl(post.cover_image_url, { allowMailto: false }) ? post.cover_image_url : null;
  }, [post?.cover_image_url]);

  const safeContentHtml = useMemo(() => {
    return post ? renderSafeBlogContent(post.content) : "";
  }, [post]);

  const displayDate = formatBlogDate(post?.published_at || post?.created_at);
  const readMinutes = getPostReadMinutes(post);

  const seoTitle = post
    ? (post.seo_title?.trim() || `${post.title} — TAMS Pro`)
    : "Blog Article — TAMS Pro";
  const seoDescription = post
    ? (post.seo_description?.trim() ||
      post.excerpt?.trim() ||
      "Read operational insights for Pakistani travel agencies on TAMS Pro.")
    : "Travel agency management guides and updates from TAMS Pro.";
  const canonicalPath = slug ? `/blogs/${slug}` : "/blogs";
  const shareUrl = `${PRODUCTION_APP_ORIGIN}${canonicalPath}`;

  const seoKeywords = useMemo(() => {
    if (!post) return [];
    return [
      post.focus_keyword || "",
      ...(post.secondary_keywords || []),
      ...(post.tags || []),
    ].filter(Boolean);
  }, [post]);

  const structuredData = useMemo(() => {
    if (!post) return undefined;

    const plainWords = stripHtmlToText(post.content).split(/\s+/).filter(Boolean).length;
    const ogFallbackImage = `${PRODUCTION_APP_ORIGIN}/icons/tams-icon-512.png`;
    const schemaImage =
      safeCoverUrl && !/\.svg(?:[?#].*)?$/i.test(safeCoverUrl)
        ? /^https?:\/\//i.test(safeCoverUrl)
          ? safeCoverUrl
          : `${PRODUCTION_APP_ORIGIN}${safeCoverUrl}`
        : ogFallbackImage;

    const articleSchema = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: seoDescription,
      image: [schemaImage],
      articleSection: post.category || "Travel Software",
      keywords: seoKeywords.join(", "),
      wordCount: plainWords,
      datePublished: post.published_at || post.created_at,
      dateModified: post.updated_at || post.published_at || post.created_at,
      author: {
        "@type": "Organization",
        name: post.author || "TAMS Pro Team",
        url: PRODUCTION_APP_ORIGIN,
      },
      publisher: {
        "@type": "Organization",
        name: "TAMS Pro",
        url: PRODUCTION_APP_ORIGIN,
        logo: {
          "@type": "ImageObject",
          url: ogFallbackImage,
        },
      },
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": shareUrl,
      },
    };

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: `${PRODUCTION_APP_ORIGIN}/`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Blogs",
          item: `${PRODUCTION_APP_ORIGIN}/blogs`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: post.title,
          item: shareUrl,
        },
      ],
    };

    const faqs =
      post.faq_items && post.faq_items.length > 0
        ? post.faq_items
        : extractFaqItemsFallback(post.content);

    const schemas: object[] = [articleSchema, breadcrumbSchema];

    if (faqs.length > 0) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      });
    }

    return schemas;
  }, [post, safeCoverUrl, seoDescription, seoKeywords, shareUrl]);

  const handleCopyLink = async () => {
    const urlToCopy =
      typeof window !== "undefined" ? window.location.href : shareUrl;
    try {
      await navigator.clipboard.writeText(urlToCopy);
      setCopiedLink(true);
      toast.success("Article link copied");
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Could not copy link automatically");
    }
  };

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(post?.title || "TAMS Pro Blog");

  return (
    <div className="public-site tams-public-landing min-h-screen bg-[var(--bg,#F8F5EE)] text-[var(--ink,#0B1F2A)] flex flex-col">
      <SeoHead
        title={seoTitle}
        description={seoDescription}
        path={canonicalPath}
        image={safeCoverUrl}
        type={post ? "article" : "website"}
        publishedTime={post?.published_at || post?.created_at}
        modifiedTime={post?.updated_at}
        author={post?.author}
        tags={post?.tags}
        keywords={seoKeywords}
        jsonLd={structuredData}
      />

      <PublicHeader currentPath="/blogs" />

      <main className="flex-1 py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-[960px] mx-auto w-full flex flex-col">
        {/* Breadcrumb / Back Navigation */}
        <nav className="mb-6 flex flex-wrap items-center justify-between gap-3" aria-label="Breadcrumb">
          <Link
            to="/blogs"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary,#0F5C63)] hover:text-[var(--primary-hover,#0B4A50)] hover:transition-colors hover:duration-200"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            <span>Back to all blogs</span>
          </Link>

          <ol className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--body,#4A5A63)]">
            <li>
              <Link to="/" className="hover:text-[var(--ink,#0B1F2A)] hover:transition-colors hover:duration-200">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link to="/blogs" className="hover:text-[var(--ink,#0B1F2A)] hover:transition-colors hover:duration-200">
                Blogs
              </Link>
            </li>
            {post ? (
              <>
                <li aria-hidden="true">/</li>
                <li className="text-[var(--ink,#0B1F2A)] font-medium truncate max-w-[260px]">
                  {post.title}
                </li>
              </>
            ) : null}
          </ol>
        </nav>

        {isLoading ? (
          <DetailLoadingSkeleton />
        ) : fetchError ? (
          <div className="tams-card rounded-2xl bg-[var(--card,#FFFFFF)] p-8 sm:p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--tint,#E4F2EF)] border border-[var(--accent,#C9A24B)]/40 text-[var(--primary,#0F5C63)] flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <h1 className="text-xl font-bold text-[var(--ink,#0B1F2A)]">Unable to load article</h1>
            <p className="mt-2 text-sm text-[var(--body,#4A5A63)]">{fetchError}</p>
            <div className="mt-6">
              <Link to="/blogs">
                <Button className="tams-btn-primary h-10 px-5 rounded-xl text-sm font-semibold">
                  Browse All Blogs
                </Button>
              </Link>
            </div>
          </div>
        ) : notFound || !post ? (
          <div className="tams-card rounded-2xl bg-[var(--card,#FFFFFF)] p-8 sm:p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--tint,#E4F2EF)] border border-[var(--border,#E5E0D3)] text-[var(--primary,#0F5C63)] flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-bold text-[var(--ink,#0B1F2A)]">Article not found</h1>
            <p className="mt-2 text-sm text-[var(--body,#4A5A63)] max-w-md mx-auto leading-relaxed">
              This blog post may have been moved, unpublished, or does not exist.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link to="/blogs">
                <Button className="tams-btn-primary h-10 px-5 rounded-xl text-sm font-semibold gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Browse All Blogs</span>
                </Button>
              </Link>
              <Link to="/signup">
                <Button
                  variant="outline"
                  className="tams-btn-secondary h-10 px-5 rounded-xl text-sm font-semibold"
                >
                  Sign Up Free
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <article className="tams-card rounded-2xl bg-[var(--card,#FFFFFF)] p-6 sm:p-10">
              {/* Meta Row */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mb-5">
                <span className="bg-[var(--tint,#E4F2EF)] text-[var(--primary,#0F5C63)] border border-[var(--border,#E5E0D3)] text-xs font-semibold px-3 py-1 rounded-full">
                  {post.category || "General"}
                </span>

                {post.is_featured && (
                  <span className="inline-flex items-center gap-1 bg-[var(--accent,#C9A24B)] text-[var(--ink,#0B1F2A)] text-xs font-bold px-3 py-1 rounded-full">
                    <Star className="w-3 h-3 fill-current" strokeWidth={1.75} />
                    <span>Featured</span>
                  </span>
                )}

                {displayDate && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[var(--body,#4A5A63)] font-medium">
                    <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>{displayDate}</span>
                  </span>
                )}

                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--body,#4A5A63)] font-medium">
                  <User className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>{post.author || "TAMS Pro Team"}</span>
                </span>

                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--body,#4A5A63)] font-medium">
                  <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>{readMinutes} min read</span>
                </span>
              </div>

              {/* Single H1 with Main Keyword */}
              <h1 className="text-2xl sm:text-4xl font-bold text-[var(--ink,#0B1F2A)] tracking-tight leading-[1.18]">
                {post.title}
              </h1>

              {post.excerpt && (
                <p className="mt-4 text-base sm:text-lg text-[var(--body,#4A5A63)] leading-relaxed">
                  {post.excerpt}
                </p>
              )}

              {/* Cover Image */}
              {safeCoverUrl && (
                <div className="mt-7 mb-7 rounded-2xl overflow-hidden border border-[var(--border,#E5E0D3)] shadow-sm">
                  <img
                    src={safeCoverUrl}
                    alt={post.cover_image_alt || post.title}
                    className="w-full max-h-[440px] object-cover"
                  />
                </div>
              )}

              {/* Rich Article Body */}
              <div
                className="tams-blog-prose mt-7 pt-7 border-t border-[var(--border,#E5E0D3)]"
                dangerouslySetInnerHTML={{ __html: safeContentHtml }}
              />

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="mt-8 pt-6 border-t border-[var(--border,#E5E0D3)] flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--body,#4A5A63)] mr-1">
                    <Tag className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>Topics:</span>
                  </span>
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-medium text-[var(--primary,#0F5C63)] bg-[var(--tint,#E4F2EF)] border border-[var(--border,#E5E0D3)] px-2.5 py-1 rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Share Buttons */}
              <div className="mt-8 pt-6 border-t border-[var(--border,#E5E0D3)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink,#0B1F2A)]">
                  <Share2 className="w-4 h-4 text-[var(--primary,#0F5C63)]" strokeWidth={1.75} />
                  <span>Share this article</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-compact-btn=""
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--card,#FFFFFF)] border border-[var(--border,#E5E0D3)] text-[var(--ink,#0B1F2A)] hover:bg-[var(--tint,#E4F2EF)] hover:border-[var(--accent,#C9A24B)] hover:transition-colors hover:duration-200"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[var(--primary,#0F5C63)]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[var(--body,#4A5A63)]" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <a
                    href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--tint,#E4F2EF)] border border-[var(--border,#E5E0D3)] text-[var(--primary,#0F5C63)] hover:border-[var(--accent,#C9A24B)] hover:transition-colors hover:duration-200"
                  >
                    WhatsApp
                  </a>

                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--tint,#E4F2EF)] border border-[var(--border,#E5E0D3)] text-[var(--ink,#0B1F2A)] hover:border-[var(--accent,#C9A24B)] hover:transition-colors hover:duration-200"
                  >
                    X / Twitter
                  </a>

                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--tint,#E4F2EF)] border border-[var(--border,#E5E0D3)] text-[var(--primary,#0F5C63)] hover:border-[var(--accent,#C9A24B)] hover:transition-colors hover:duration-200"
                  >
                    LinkedIn
                  </a>

                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--tint,#E4F2EF)] border border-[var(--border,#E5E0D3)] text-[var(--primary,#0F5C63)] hover:border-[var(--accent,#C9A24B)] hover:transition-colors hover:duration-200"
                  >
                    Facebook
                  </a>
                </div>
              </div>
            </article>

            {/* WhatsApp & Walkthrough Lead Capture Box */}
            <BlogLeadCaptureBox sourceSlug={post.slug} articleTitle={post.title} />

            {/* Related Posts */}
            {relatedPosts.length > 0 && (
              <section className="mt-10" aria-labelledby="related-posts-heading">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h2
                    id="related-posts-heading"
                    className="text-xl font-bold text-[var(--ink,#0B1F2A)] tracking-tight"
                  >
                    Related posts
                  </h2>
                  <Link
                    to="/blogs"
                    className="text-xs sm:text-sm font-semibold text-[var(--primary,#0F5C63)] hover:text-[var(--primary-hover,#0B4A50)] hover:transition-colors hover:duration-200 inline-flex items-center gap-1"
                  >
                    <span>All articles</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="tams-related-blogs-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {relatedPosts.map((related) => (
                    <CompactBlogCard key={related.id} post={related} />
                  ))}
                </div>
              </section>
            )}

            {/* Popular Articles */}
            {popularPosts.length > 0 && (
              <section className="mt-10" aria-labelledby="popular-articles-heading">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[var(--primary,#0F5C63)]" strokeWidth={1.75} />
                    <h2
                      id="popular-articles-heading"
                      className="text-xl font-bold text-[var(--ink,#0B1F2A)] tracking-tight"
                    >
                      Popular articles
                    </h2>
                  </div>
                  <Link
                    to="/blogs"
                    className="text-xs sm:text-sm font-semibold text-[var(--primary,#0F5C63)] hover:text-[var(--primary-hover,#0B4A50)] hover:transition-colors hover:duration-200 inline-flex items-center gap-1"
                  >
                    <span>Browse library</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {popularPosts.map((popular) => {
                    const popDate = formatBlogDate(popular.published_at || popular.created_at);
                    const popRead = getPostReadMinutes(popular);
                    return (
                      <Link
                        key={popular.id}
                        to={`/blogs/${popular.slug}`}
                        className="tams-card tams-card-interactive group rounded-2xl bg-[var(--card,#FFFFFF)] p-4 flex items-start justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63]"
                      >
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 text-[11px] text-[var(--body,#4A5A63)]">
                            <span className="bg-[var(--tint,#E4F2EF)] text-[var(--primary,#0F5C63)] border border-[var(--border,#E5E0D3)] font-semibold px-2 py-0.5 rounded-full">
                              {popular.category || "Guide"}
                            </span>
                            {popDate && <span>{popDate}</span>}
                            <span>• {popRead} min</span>
                          </div>
                          <h3 className="text-sm font-bold text-[var(--ink,#0B1F2A)] group-hover:text-[var(--primary,#0F5C63)] group-hover:transition-colors group-hover:duration-200 line-clamp-2 leading-snug">
                            {popular.title}
                          </h3>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[var(--primary,#0F5C63)] shrink-0 mt-1 group-hover:translate-x-0.5 group-hover:transition-transform group-hover:duration-200" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Bottom CTA Banner */}
            <div className="mt-8 tams-card tams-banner-card rounded-2xl bg-[var(--card,#FFFFFF)] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[var(--ink,#0B1F2A)] tracking-tight">
                  Ready to streamline your travel agency?
                </h2>
                <p className="text-xs sm:text-sm text-[var(--body,#4A5A63)] mt-1">
                  Bookings, visas, accounts and vouchers, everything in one place—PKR 1,999/month or PKR 9,999/year (50% off on the yearly plan).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <Link to="/signup">
                  <Button
                    size="lg"
                    className="tams-btn-primary h-11 px-6 rounded-xl text-sm font-semibold gap-2 group"
                  >
                    <span>Sign Up Free</span>
                    <ArrowRight
                      className="w-4 h-4 text-[#E4F2EF] group-hover:translate-x-0.5 group-hover:transition-transform group-hover:duration-200"
                      strokeWidth={1.75}
                    />
                  </Button>
                </Link>
                <Link to="/pricing">
                  <Button
                    variant="outline"
                    size="lg"
                    className="tams-btn-secondary h-11 px-5 rounded-xl text-sm font-semibold"
                  >
                    View Pricing
                  </Button>
                </Link>
              </div>
            </div>
          </>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}

export default function BlogDetailPage() {
  return (
    <PublicErrorBoundary pageName="Blog Post">
      <BlogDetailContent />
    </PublicErrorBoundary>
  );
}
