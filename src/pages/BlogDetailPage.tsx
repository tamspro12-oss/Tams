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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { PRODUCTION_APP_ORIGIN } from "@/lib/authRedirect";
import {
  BLOG_QUERY_KEYS,
  estimateReadMinutes,
  fetchPublishedBlogBySlug,
  fetchRelatedPublishedBlogs,
  formatBlogDate,
} from "@/lib/blogs";
import { isSafeUrl, renderSafeBlogContent } from "@/lib/blogSanitizer";

function DetailLoadingSkeleton() {
  return (
    <div className="tams-card rounded-2xl bg-white p-6 sm:p-10 space-y-6">
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

  const safeCoverUrl = useMemo(() => {
    if (!post?.cover_image_url) return null;
    return isSafeUrl(post.cover_image_url, { allowMailto: false }) ? post.cover_image_url : null;
  }, [post?.cover_image_url]);

  const safeContentHtml = useMemo(() => {
    return post ? renderSafeBlogContent(post.content) : "";
  }, [post]);

  const displayDate = formatBlogDate(post?.published_at || post?.created_at);
  const readMinutes = estimateReadMinutes(post?.content || "");

  const seoTitle = post
    ? (post.seo_title?.trim() || `${post.title} — TAMS Pro Blog`)
    : "Blog Article — TAMS Pro";
  const seoDescription = post
    ? (post.seo_description?.trim() ||
      post.excerpt?.trim() ||
      "Read operational insights for travel agencies on TAMS Pro.")
    : "Travel agency management guides and updates from TAMS Pro.";
  const canonicalPath = slug ? `/blogs/${slug}` : "/blogs";
  const shareUrl = `${PRODUCTION_APP_ORIGIN}${canonicalPath}`;

  const blogJsonLd = post
    ? {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: seoDescription,
        image: safeCoverUrl ? [safeCoverUrl] : [`${PRODUCTION_APP_ORIGIN}/icons/tams-icon-512.png`],
        datePublished: post.published_at || post.created_at,
        dateModified: post.updated_at || post.published_at || post.created_at,
        author: {
          "@type": "Person",
          name: post.author || "TAMS Pro Team",
        },
        publisher: {
          "@type": "Organization",
          name: "TAMS Pro",
          logo: {
            "@type": "ImageObject",
            url: `${PRODUCTION_APP_ORIGIN}/icons/tams-icon-512.png`,
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": shareUrl,
        },
      }
    : undefined;

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
    <div className="tams-public-landing min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
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
        jsonLd={blogJsonLd}
      />

      <PublicHeader currentPath="/blogs" />

      <main className="flex-1 py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-[920px] mx-auto w-full flex flex-col">
        <div className="mb-6">
          <Link
            to="/blogs"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F5E63] hover:text-[#0B4A4E] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            <span>Back to all blogs</span>
          </Link>
        </div>

        {isLoading ? (
          <DetailLoadingSkeleton />
        ) : fetchError ? (
          <div className="tams-card rounded-2xl bg-white p-8 sm:p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/70 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <h1 className="text-xl font-bold text-[#0F172A]">Unable to load article</h1>
            <p className="mt-2 text-sm text-[#475569]">{fetchError}</p>
            <div className="mt-6">
              <Link to="/blogs">
                <Button className="tams-btn-primary h-10 px-5 rounded-xl text-sm font-semibold">
                  Browse All Blogs
                </Button>
              </Link>
            </div>
          </div>
        ) : notFound || !post ? (
          <div className="tams-card rounded-2xl bg-white p-8 sm:p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 text-[#0F5E63] flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Article not found</h1>
            <p className="mt-2 text-sm text-[#475569] max-w-md mx-auto leading-relaxed">
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
            <article className="tams-card rounded-2xl bg-white p-6 sm:p-10">
              {/* Meta Row */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mb-5">
                <span className="bg-teal-50 text-teal-800 border border-teal-200/60 text-xs font-semibold px-3 py-1 rounded-full">
                  {post.category || "General"}
                </span>

                {post.is_featured && (
                  <span className="inline-flex items-center gap-1 bg-[#0F5E63] text-white text-xs font-semibold px-3 py-1 rounded-full">
                    <Star className="w-3 h-3 fill-current" strokeWidth={1.75} />
                    <span>Featured</span>
                  </span>
                )}

                {displayDate && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#64748B] font-medium">
                    <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>{displayDate}</span>
                  </span>
                )}

                <span className="inline-flex items-center gap-1.5 text-xs text-[#64748B] font-medium">
                  <User className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>{post.author || "TAMS Pro Team"}</span>
                </span>

                <span className="inline-flex items-center gap-1.5 text-xs text-[#64748B] font-medium">
                  <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>{readMinutes} min read</span>
                </span>
              </div>

              {/* Title & Excerpt */}
              <h1 className="text-2xl sm:text-4xl font-bold text-[#0F172A] tracking-tight leading-[1.18]">
                {post.title}
              </h1>

              {post.excerpt && (
                <p className="mt-4 text-base sm:text-lg text-[#475569] leading-relaxed">
                  {post.excerpt}
                </p>
              )}

              {/* Cover Image */}
              {safeCoverUrl && (
                <div className="mt-7 mb-7 rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm">
                  <img
                    src={safeCoverUrl}
                    alt={post.title}
                    className="w-full max-h-[440px] object-cover"
                  />
                </div>
              )}

              {/* Rich Article Body */}
              <div
                className="tams-blog-prose mt-7 pt-7 border-t border-slate-200/80"
                dangerouslySetInnerHTML={{ __html: safeContentHtml }}
              />

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-200/70 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] mr-1">
                    <Tag className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>Tags:</span>
                  </span>
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-medium text-[#475569] bg-slate-100 border border-slate-200/70 px-2.5 py-1 rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Share Buttons */}
              <div className="mt-8 pt-6 border-t border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                  <Share2 className="w-4 h-4 text-[#0F5E63]" strokeWidth={1.75} />
                  <span>Share this article</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-compact-btn=""
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-[#0F172A] hover:bg-slate-50 transition-colors"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-teal-700" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#475569]" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <a
                    href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 transition-colors"
                  >
                    WhatsApp
                  </a>

                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-800 hover:bg-slate-200/70 transition-colors"
                  >
                    X / Twitter
                  </a>

                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100 transition-colors"
                  >
                    LinkedIn
                  </a>

                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    Facebook
                  </a>
                </div>
              </div>
            </article>

            {/* Related Posts */}
            {relatedPosts.length > 0 && (
              <section className="mt-10" aria-labelledby="related-posts-heading">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h2
                    id="related-posts-heading"
                    className="text-xl font-bold text-[#0F172A] tracking-tight"
                  >
                    Related posts
                  </h2>
                  <Link
                    to="/blogs"
                    className="text-xs sm:text-sm font-semibold text-[#0F5E63] hover:text-[#0B4A4E] inline-flex items-center gap-1"
                  >
                    <span>All articles</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="tams-related-blogs-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {relatedPosts.map((related) => {
                    const relCover =
                      related.cover_image_url &&
                      isSafeUrl(related.cover_image_url, { allowMailto: false })
                        ? related.cover_image_url
                        : null;
                    const relDate = formatBlogDate(related.published_at || related.created_at);

                    return (
                      <Link
                        key={related.id}
                        to={`/blogs/${related.slug}`}
                        className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                      >
                        <article className="tams-card tams-card-interactive group h-full rounded-2xl overflow-hidden bg-white flex flex-col justify-between">
                          <div>
                            <div className="aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-[#0F5E63]/10 to-teal-500/10 border-b border-slate-200/70">
                              {relCover ? (
                                <img
                                  src={relCover}
                                  alt={related.title}
                                  loading="lazy"
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <BookOpen className="w-5 h-5 text-[#0F5E63]" strokeWidth={1.75} />
                                </div>
                              )}
                            </div>

                            <div className="p-4">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="bg-teal-50 text-teal-800 border border-teal-200/60 text-[11px] font-semibold px-2 py-0.5 rounded-full truncate">
                                  {related.category || "General"}
                                </span>
                                {relDate && (
                                  <span className="text-[11px] text-[#64748B] shrink-0">
                                    {relDate}
                                  </span>
                                )}
                              </div>

                              <h3 className="text-sm font-bold text-[#0F172A] group-hover:text-[#0F5E63] transition-colors line-clamp-2 leading-snug">
                                {related.title}
                              </h3>
                            </div>
                          </div>

                          <div className="px-4 pb-4 pt-1">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F5E63]">
                              <span>Read article</span>
                              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                            </span>
                          </div>
                        </article>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* CTA Banner */}
            <div className="mt-8 tams-card tams-banner-card rounded-2xl bg-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0F172A] tracking-tight">
                  Ready to streamline your travel agency?
                </h2>
                <p className="text-xs sm:text-sm text-[#475569] mt-1">
                  Bookings, visas, accounts and vouchers, everything in one place.
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
                      className="w-4 h-4 text-teal-100 transition-transform duration-150 group-hover:translate-x-0.5"
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

