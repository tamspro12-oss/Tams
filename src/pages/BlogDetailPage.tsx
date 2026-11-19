import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Calendar, User, BookOpen, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { PublicReveal } from "@/components/public/PublicReveal";
import {
  BLOG_QUERY_KEYS,
  estimateReadMinutes,
  fetchPublishedBlogBySlug,
  formatBlogDate,
} from "@/lib/blogs";
import { isSafeUrl, renderSafeBlogContent } from "@/lib/blogSanitizer";

function BlogDetailPageContent() {
  const { slug = "" } = useParams<{ slug: string }>();

  const { data, isLoading } = useQuery({
    queryKey: BLOG_QUERY_KEYS.publicDetail(slug),
    queryFn: () => fetchPublishedBlogBySlug(slug),
    enabled: Boolean(slug),
    staleTime: 60 * 1000,
  });

  const post = data?.post ?? null;
  const notFound = data?.notFound ?? false;
  const fetchError = data?.error ?? null;

  const safeContentHtml = useMemo(
    () => (post ? renderSafeBlogContent(post.content) : ""),
    [post]
  );

  const safeCoverUrl =
    post?.cover_image_url && isSafeUrl(post.cover_image_url, { allowMailto: false })
      ? post.cover_image_url
      : null;

  const displayDate = post ? formatBlogDate(post.published_at || post.created_at) : "";
  const readMinutes = post ? estimateReadMinutes(post.content) : 1;

  const seoTitle = post
    ? post.seo_title?.trim() || `${post.title} — TAMS Pro Blogs`
    : "Article Not Found — TAMS Pro Blogs";
  const seoDescription = post
    ? post.seo_description?.trim() ||
      post.excerpt?.trim() ||
      "Insights and practical guides for travel agencies from TAMS Pro."
    : "Read insights and guides for travel agencies on TAMS Pro.";

  return (
    <div className="tams-public-landing min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      <SeoHead title={seoTitle} description={seoDescription} path={`/blogs/${slug}`} />

      <PublicHeader currentPath="/blogs" />

      <main className="flex-1 py-10 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-[860px] mx-auto w-full flex flex-col">
        {/* Back button */}
        <div className="mb-6">
          <Link
            to="/blogs"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F5E63] hover:text-[#0B4A4E] transition-colors group"
          >
            <ArrowLeft
              className="w-4 h-4 transition-transform duration-150 group-hover:-translate-x-0.5"
              strokeWidth={1.75}
            />
            <span>Back to Blogs</span>
          </Link>
        </div>

        {isLoading ? (
          <div className="tams-card rounded-2xl p-6 sm:p-10 bg-white space-y-5 animate-pulse">
            <div className="h-5 w-28 bg-slate-100 rounded-full" />
            <div className="h-10 w-3/4 bg-slate-100 rounded-xl" />
            <div className="aspect-[16/9] w-full bg-slate-100 rounded-2xl" />
            <div className="space-y-3 pt-2">
              <div className="h-4 w-full bg-slate-100 rounded" />
              <div className="h-4 w-11/12 bg-slate-100 rounded" />
              <div className="h-4 w-4/5 bg-slate-100 rounded" />
            </div>
          </div>
        ) : fetchError ? (
          <PublicReveal className="my-auto py-8">
            <div className="tams-card rounded-2xl p-8 text-center space-y-4">
              <div className="tams-icon-tile-soft w-12 h-12 rounded-2xl flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5 text-[#0F5E63]" strokeWidth={1.75} />
              </div>
              <h1 className="text-xl font-bold text-[#0F172A]">
                Article temporarily unavailable
              </h1>
              <p className="text-sm text-[#475569] leading-relaxed">{fetchError}</p>
              <div className="pt-2">
                <Link to="/blogs">
                  <Button className="tams-btn-primary h-10 px-5 rounded-xl text-sm font-semibold">
                    Back to Blogs
                  </Button>
                </Link>
              </div>
            </div>
          </PublicReveal>
        ) : notFound || !post ? (
          <PublicReveal className="my-auto py-8">
            <div className="tams-card rounded-2xl p-8 sm:p-10 text-center space-y-4">
              <div className="tams-icon-tile-soft w-12 h-12 rounded-2xl flex items-center justify-center mx-auto">
                <BookOpen className="w-5 h-5 text-[#0F5E63]" strokeWidth={1.75} />
              </div>
              <h1 className="text-2xl font-bold text-[#0F172A]">Post not found</h1>
              <p className="text-sm text-[#475569] leading-relaxed max-w-md mx-auto">
                This article may have been moved or is not published yet. Browse all published articles on our blog.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Link to="/blogs">
                  <Button className="tams-btn-primary h-10 px-5 rounded-xl text-sm font-semibold gap-1.5">
                    <ArrowLeft className="w-4 h-4 text-teal-100" strokeWidth={1.75} />
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
          </PublicReveal>
        ) : (
          <>
            <PublicReveal>
              <article className="tams-card rounded-2xl bg-white p-6 sm:p-10">
                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-3 mb-5">
                  <span className="tams-discount-pill text-xs font-semibold px-3 py-1 rounded-full">
                    {post.category || "General"}
                  </span>
                  {displayDate && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-[#64748B] font-medium">
                      <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>{displayDate}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#64748B] font-medium">
                    <User className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>{post.author_name || "TAMS Pro Team"}</span>
                  </span>
                  <span className="text-xs text-[#64748B] font-medium">
                    • {readMinutes} min read
                  </span>
                </div>

                {/* Title */}
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
                  <div className="mt-7 mb-8 rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm">
                    <img
                      src={safeCoverUrl}
                      alt={post.title}
                      className="w-full max-h-[440px] object-cover"
                    />
                  </div>
                )}

                {/* Sanitized Article Content */}
                <div
                  className="tams-blog-prose mt-7 pt-7 border-t border-slate-200/80"
                  dangerouslySetInnerHTML={{ __html: safeContentHtml }}
                />
              </article>
            </PublicReveal>

            {/* Bottom Call-To-Action Banner */}
            <PublicReveal delay={100} className="mt-8">
              <div className="tams-card tams-banner-card rounded-2xl bg-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
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
                  <Link to="/blogs">
                    <Button
                      variant="outline"
                      size="lg"
                      className="tams-btn-secondary h-11 px-5 rounded-xl text-sm font-semibold"
                    >
                      All Blogs
                    </Button>
                  </Link>
                </div>
              </div>
            </PublicReveal>
          </>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}

export default function BlogDetailPage() {
  return (
    <PublicErrorBoundary pageName="Blog Article">
      <BlogDetailPageContent />
    </PublicErrorBoundary>
  );
}

