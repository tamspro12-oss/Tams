import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Calendar, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { PublicReveal } from "@/components/public/PublicReveal";
import {
  BLOG_QUERY_KEYS,
  fetchPublishedBlogs,
  formatBlogDate,
  BlogPost,
} from "@/lib/blogs";
import { isSafeUrl } from "@/lib/blogSanitizer";

function BlogPostCard({ post, delay }: { post: BlogPost; delay: number }) {
  const displayDate = formatBlogDate(post.published_at || post.created_at);
  const safeCover =
    post.cover_image_url && isSafeUrl(post.cover_image_url, { allowMailto: false })
      ? post.cover_image_url
      : null;

  return (
    <PublicReveal delay={delay} className="h-full">
      <Link
        to={`/blogs/${post.slug}`}
        className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-2xl"
      >
        <article className="tams-card tams-card-interactive group h-full rounded-2xl overflow-hidden flex flex-col justify-between bg-white">
          <div>
            {/* Cover Image or Subtle Gradient Fallback */}
            <div className="aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-[#0F5E63]/10 via-emerald-500/10 to-[#C9A24B]/15 border-b border-slate-200/70 relative">
              {safeCover ? (
                <img
                  src={safeCover}
                  alt={post.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="tams-icon-tile-soft w-12 h-12 rounded-2xl flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-[#0F5E63]" strokeWidth={1.75} />
                  </div>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="p-6">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="tams-discount-pill text-[11px] font-semibold px-2.5 py-0.5 rounded-full truncate max-w-[160px]">
                  {post.category || "General"}
                </span>
                {displayDate && (
                  <span className="inline-flex items-center gap-1 text-xs text-[#64748B] shrink-0">
                    <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>{displayDate}</span>
                  </span>
                )}
              </div>

              <h2 className="text-lg font-bold text-[#0F172A] tracking-tight leading-snug group-hover:text-[#0F5E63] transition-colors line-clamp-2">
                {post.title}
              </h2>

              {post.excerpt && (
                <p className="mt-2.5 text-sm text-[#475569] leading-relaxed line-clamp-3">
                  {post.excerpt}
                </p>
              )}
            </div>
          </div>

          <div className="px-6 pb-6 pt-1">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F5E63] group-hover:text-[#0B4A4E] transition-colors">
              <span>Read more</span>
              <ArrowRight
                className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-1"
                strokeWidth={1.75}
              />
            </span>
          </div>
        </article>
      </Link>
    </PublicReveal>
  );
}

function BlogsPageContent() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: BLOG_QUERY_KEYS.publicList,
    queryFn: fetchPublishedBlogs,
    staleTime: 60 * 1000,
  });

  const posts = data?.posts ?? [];
  const fetchError = data?.error ?? null;

  return (
    <div className="tams-public-landing min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      <SeoHead
        title="Blogs — TAMS Pro Travel Agency Management System"
        description="Insights, operational guides, and updates for travel and Umrah agencies."
        path="/blogs"
      />

      <PublicHeader currentPath="/blogs" />

      <main className="flex-1 py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto w-full flex flex-col">
        {/* Header */}
        <PublicReveal className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <span className="text-xs font-semibold tracking-widest uppercase text-[#0F5E63] block mb-2.5">
            Blogs
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold text-[#0F172A] tracking-tight leading-[1.14]">
            Insights for{" "}
            <span className="tams-headline-gradient">travel agencies</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-[#475569] leading-relaxed">
            Practical workflows, agency operations advice, and product updates from TAMS Pro.
          </p>
        </PublicReveal>

        {/* Loading Skeleton */}
        {isLoading ? (
          <div className="tams-blogs-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((skeletonIdx) => (
              <div
                key={skeletonIdx}
                className="tams-card rounded-2xl overflow-hidden bg-white p-0 animate-pulse"
              >
                <div className="aspect-[16/9] bg-slate-100" />
                <div className="p-6 space-y-3">
                  <div className="h-4 w-24 bg-slate-100 rounded-full" />
                  <div className="h-5 w-3/4 bg-slate-100 rounded-lg" />
                  <div className="h-4 w-full bg-slate-100 rounded-lg" />
                  <div className="h-4 w-2/3 bg-slate-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : fetchError ? (
          /* Friendly Error State (never exposes raw database errors) */
          <PublicReveal className="max-w-lg mx-auto w-full my-auto py-8">
            <div className="tams-card rounded-2xl p-8 text-center space-y-4">
              <div className="tams-icon-tile-soft w-12 h-12 rounded-2xl flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5 text-[#0F5E63]" strokeWidth={1.75} />
              </div>
              <h2 className="text-lg font-bold text-[#0F172A]">
                Articles temporarily unavailable
              </h2>
              <p className="text-sm text-[#475569] leading-relaxed">
                {fetchError}
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="tams-btn-primary h-10 px-5 rounded-xl text-xs sm:text-sm font-semibold gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
                  <span>Try again</span>
                </Button>
                <Link to="/features">
                  <Button
                    variant="outline"
                    className="tams-btn-secondary h-10 px-5 rounded-xl text-xs sm:text-sm font-semibold"
                  >
                    Explore Features
                  </Button>
                </Link>
              </div>
            </div>
          </PublicReveal>
        ) : posts.length === 0 ? (
          /* Friendly Empty State */
          <PublicReveal className="max-w-lg mx-auto w-full my-auto py-8">
            <div className="tams-card rounded-2xl p-8 sm:p-10 text-center space-y-4">
              <div className="tams-icon-tile-soft w-12 h-12 rounded-2xl flex items-center justify-center mx-auto">
                <BookOpen className="w-5 h-5 text-[#0F5E63]" strokeWidth={1.75} />
              </div>
              <h2 className="text-xl font-bold text-[#0F172A]">
                No articles published yet
              </h2>
              <p className="text-sm text-[#475569] leading-relaxed">
                Check back soon for travel agency guides, booking workflows, and product updates.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Link to="/features">
                  <Button className="tams-btn-primary h-10 px-5 rounded-xl text-xs sm:text-sm font-semibold gap-1.5">
                    <span>Explore Features</span>
                    <ArrowRight className="w-4 h-4 text-teal-100" strokeWidth={1.75} />
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button
                    variant="outline"
                    className="tams-btn-secondary h-10 px-5 rounded-xl text-xs sm:text-sm font-semibold"
                  >
                    Sign Up Free
                  </Button>
                </Link>
              </div>
            </div>
          </PublicReveal>
        ) : (
          /* Published Blog Cards Grid */
          <div className="tams-blogs-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post, idx) => (
              <BlogPostCard key={post.id} post={post} delay={(idx % 6) * 70} />
            ))}
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}

export default function BlogsPage() {
  return (
    <PublicErrorBoundary pageName="Blogs">
      <BlogsPageContent />
    </PublicErrorBoundary>
  );
}

