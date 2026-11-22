import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Calendar,
  Clock,
  ArrowRight,
  Search,
  X,
  Star,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { PRODUCTION_APP_ORIGIN } from "@/lib/authRedirect";
import {
  BLOG_QUERY_KEYS,
  BlogPost,
  fetchPublishedBlogs,
  formatBlogDate,
  getPostReadMinutes,
} from "@/lib/blogs";
import { isSafeUrl } from "@/lib/blogSanitizer";

function BlogCardSkeleton() {
  return (
    <div className="tams-card rounded-2xl overflow-hidden bg-white flex flex-col justify-between">
      <div>
        <Skeleton className="aspect-[16/9] w-full rounded-none" />
        <div className="p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-24 rounded-md" />
          </div>
          <Skeleton className="h-6 w-5/6 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
      </div>
      <div className="px-5 sm:px-6 pb-5 pt-2 flex items-center justify-between border-t border-slate-100">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-4 w-20 rounded-md" />
      </div>
    </div>
  );
}

function BlogPostCard({ post }: { post: BlogPost }) {
  const displayDate = formatBlogDate(post.published_at || post.created_at);
  const readMinutes = getPostReadMinutes(post);
  const safeCover =
    post.cover_image_url && isSafeUrl(post.cover_image_url, { allowMailto: false })
      ? post.cover_image_url
      : null;

  return (
    <Link
      to={`/blogs/${post.slug}`}
      className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-2xl"
    >
      <article className="tams-card tams-card-interactive group h-full rounded-2xl overflow-hidden flex flex-col justify-between bg-white">
        <div>
          <div className="aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-[#0F5E63]/10 via-teal-500/10 to-amber-500/10 border-b border-slate-200/70 relative">
            {safeCover ? (
              <img
                src={safeCover}
                alt={post.cover_image_alt || post.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-white/90 border border-teal-100 shadow-sm flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-[#0F5E63]" strokeWidth={1.75} />
                </div>
              </div>
            )}

            {post.is_featured && (
              <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-[#0F5E63] text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
                <Star className="w-3 h-3 fill-current" strokeWidth={1.75} />
                <span>Featured</span>
              </span>
            )}
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span className="bg-teal-50 text-teal-800 border border-teal-200/60 text-[11px] font-semibold px-2.5 py-0.5 rounded-full truncate max-w-[160px]">
                {post.category || "General"}
              </span>

              <div className="flex items-center gap-2.5 text-xs text-[#64748B] shrink-0">
                {displayDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>{displayDate}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>{readMinutes} min read</span>
                </span>
              </div>
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

        <div className="px-5 sm:px-6 pb-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#64748B] truncate">
            {post.author || "TAMS Pro Team"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F5E63] group-hover:text-[#0B4A4E] transition-colors shrink-0">
            <span>Read more</span>
            <ArrowRight
              className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-1"
              strokeWidth={1.75}
            />
          </span>
        </div>
      </article>
    </Link>
  );
}

function BlogsPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: BLOG_QUERY_KEYS.publicList,
    queryFn: fetchPublishedBlogs,
    staleTime: 15 * 1000,
    refetchOnMount: "always",
  });

  const posts = useMemo(() => data?.posts ?? [], [data?.posts]);
  const fetchError = data?.error ?? null;

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const post of posts) {
      const cat = (post.category || "General").trim();
      if (!cat) continue;
      const lower = cat.toLowerCase();
      if (!map.has(lower)) {
        map.set(lower, cat);
      }
    }
    return ["All", ...Array.from(map.values())];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesCategory =
        selectedCategory === "All" ||
        (post.category || "General").trim().toLowerCase() === selectedCategory.toLowerCase();

      if (!matchesCategory) return false;
      if (!query) return true;

      const haystack = [
        post.title,
        post.excerpt,
        post.category,
        post.author,
        post.focus_keyword || "",
        ...(Array.isArray(post.tags) ? post.tags : []),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [posts, searchQuery, selectedCategory]);

  const hasFilters = Boolean(searchQuery.trim()) || selectedCategory !== "All";

  const blogsJsonLd = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "TAMS Pro Travel Agency Insights",
        description:
          "Guides, Umrah costing formulas, PKR accounting tips, and growth workflows for travel agencies in Pakistan.",
        url: `${PRODUCTION_APP_ORIGIN}/blogs`,
        publisher: {
          "@type": "Organization",
          name: "TAMS Pro",
          url: PRODUCTION_APP_ORIGIN,
        },
        blogPost: posts.slice(0, 10).map((post) => ({
          "@type": "BlogPosting",
          headline: post.title,
          url: `${PRODUCTION_APP_ORIGIN}/blogs/${post.slug}`,
          datePublished: post.published_at || post.created_at,
          author: {
            "@type": "Organization",
            name: post.author || "TAMS Pro Team",
          },
        })),
      },
      {
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
        ],
      },
    ],
    [posts]
  );

  return (
    <div className="tams-public-landing min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      <SeoHead
        title="Blogs — TAMS Pro Travel Agency Management System"
        description="Guides, Umrah package strategies, PKR accounting tips, and operational playbooks for Pakistani travel and Umrah agencies."
        path="/blogs"
        keywords={[
          "travel agency software Pakistan",
          "umrah package software",
          "travel agency accounting Pakistan",
          "travel agency blog",
        ]}
        jsonLd={blogsJsonLd}
      />

      <PublicHeader currentPath="/blogs" />

      <main className="flex-1 py-10 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto w-full flex flex-col">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <span className="text-xs font-semibold tracking-widest uppercase text-[#0F5E63] block mb-2">
            BLOGS &amp; INSIGHTS
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0F172A] tracking-tight">
            Travel Agency Insights
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#475569] leading-relaxed">
            Practical guides on travel agency operations, Umrah accounting, invoicing, and growth in Pakistan.
          </p>
        </div>

        {/* Search & Category Filters */}
        <div className="mb-8 space-y-4">
          <div className="max-w-lg mx-auto relative">
            <Search
              className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={1.75}
            />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find articles by title, topic, or tag..."
              aria-label="Filter blog articles"
              className="tams-public-search-input h-11 pl-10 pr-10 rounded-xl text-sm shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                data-compact-btn=""
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            )}
          </div>

          {categories.length > 1 && (
            <div
              className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-1 flex-nowrap sm:flex-wrap"
              role="tablist"
              aria-label="Blog categories"
            >
              {categories.map((cat) => {
                const active = selectedCategory.toLowerCase() === cat.toLowerCase();
                return (
                  <button
                    key={cat}
                    type="button"
                    data-compact-btn=""
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all border ${
                      active
                        ? "bg-[#0F5E63] text-white border-[#0F5E63] shadow-xs"
                        : "bg-white text-[#475569] border-slate-200/80 hover:border-teal-500/40 hover:text-[#0F172A]"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content States */}
        {isLoading ? (
          <div className="tams-blogs-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <BlogCardSkeleton key={idx} />
            ))}
          </div>
        ) : fetchError ? (
          <div className="tams-card rounded-2xl bg-white p-8 sm:p-10 max-w-lg mx-auto text-center my-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/70 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <h2 className="text-lg font-bold text-[#0F172A]">Unable to load articles</h2>
            <p className="mt-2 text-sm text-[#475569]">{fetchError}</p>
            <Button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="tams-btn-primary mt-5 h-10 px-5 rounded-xl text-sm font-semibold gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              <span>Try Again</span>
            </Button>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="tams-card rounded-2xl bg-white p-8 sm:p-12 max-w-lg mx-auto text-center my-6">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 text-[#0F5E63] flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <h2 className="text-xl font-bold text-[#0F172A]">
              {hasFilters ? "No matching articles found" : "No articles published yet"}
            </h2>
            <p className="mt-2 text-sm text-[#475569] leading-relaxed">
              {hasFilters
                ? "Try clearing your search terms or selecting another category."
                : "Our team is preparing helpful operational guides for travel agencies. Check back soon or explore TAMS Pro features."}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {hasFilters ? (
                <Button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("All");
                  }}
                  className="tams-btn-primary h-10 px-5 rounded-xl text-sm font-semibold"
                >
                  Reset Filters
                </Button>
              ) : (
                <>
                  <Link to="/features">
                    <Button
                      variant="outline"
                      className="tams-btn-secondary h-10 px-5 rounded-xl text-sm font-semibold"
                    >
                      Explore Features
                    </Button>
                  </Link>
                  <Link to="/signup">
                    <Button className="tams-btn-primary h-10 px-5 rounded-xl text-sm font-semibold">
                      Sign Up Free
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="tams-blogs-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => (
              <BlogPostCard key={post.id} post={post} />
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
