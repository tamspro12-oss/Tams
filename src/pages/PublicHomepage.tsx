import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Plane,
  ArrowRight,
  CalendarCheck,
  FileCheck,
  Ticket,
  Receipt,
  FileText,
  Calculator,
  BarChart3,
  BookOpen,
  Calendar,
  Clock,
  LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { Tile } from "@/components/public/Tile";
import { MobileInstallButton } from "@/components/MobileInstallButton";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { PRODUCTION_APP_ORIGIN } from "@/lib/authRedirect";
import {
  BLOG_QUERY_KEYS,
  fetchPublishedBlogs,
  formatBlogDate,
  getPostReadMinutes,
} from "@/lib/blogs";
import { isSafeUrl } from "@/lib/blogSanitizer";

interface StripItem {
  id: string;
  title: string;
  icon: LucideIcon;
}

const STRIP_ITEMS: StripItem[] = [
  { id: "bookings", title: "Bookings", icon: CalendarCheck },
  { id: "invoicing", title: "Invoicing", icon: FileCheck },
  { id: "vouchers", title: "Vouchers", icon: Ticket },
  { id: "ledger", title: "Ledger", icon: Receipt },
  { id: "umrah-calc", title: "Umrah Calculator", icon: Calculator },
  { id: "quotations", title: "Quotations", icon: FileText },
  { id: "reports", title: "Reports", icon: BarChart3 },
];

function HomepageContent() {
  const { hero } = useSiteSettings();

  const { data: blogsData } = useQuery({
    queryKey: BLOG_QUERY_KEYS.publicList,
    queryFn: fetchPublishedBlogs,
    staleTime: 60 * 1000,
  });

  const latestPosts = useMemo(() => (blogsData?.posts ?? []).slice(0, 3), [blogsData?.posts]);

  const homepageJsonLd = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "TAMS Pro",
        url: PRODUCTION_APP_ORIGIN,
        logo: `${PRODUCTION_APP_ORIGIN}/icons/tams-icon-512.png`,
        email: "tamspro12@gmail.com",
        telephone: "+92-319-0846768",
        areaServed: "PK",
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "TAMS Pro — Travel Agency Management System",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Desktop PWA, Android, iOS",
        url: PRODUCTION_APP_ORIGIN,
        description: hero.subtitle,
        offers: [
          {
            "@type": "Offer",
            name: "Monthly Plan",
            price: "1999",
            priceCurrency: "PKR",
            url: `${PRODUCTION_APP_ORIGIN}/pricing`,
          },
          {
            "@type": "Offer",
            name: "Yearly Plan",
            price: "9999",
            priceCurrency: "PKR",
            url: `${PRODUCTION_APP_ORIGIN}/pricing`,
          },
        ],
      },
    ],
    [hero.subtitle]
  );

  return (
    <div className="public-site tams-public-landing min-h-screen bg-[var(--bg,#F8F5EE)] text-[var(--ink,#0B1F2A)] flex flex-col">
      <SeoHead
        title="TAMS Pro — Travel Agency Management System"
        description={hero.subtitle}
        path="/"
        keywords={[
          "travel agency management system Pakistan",
          "travel agency software Pakistan",
          "umrah package software",
          "travel agent accounting software",
        ]}
        jsonLd={homepageJsonLd}
      />

      <PublicHeader currentPath="/" />

      <main className="flex-1 flex flex-col justify-between max-w-[1200px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-16 gap-10 sm:gap-12">
        {/* Section A: Hero (dark gradient hero-from to hero-to with soft gold radial glow in corner) */}
        <section className="tams-home-hero relative overflow-hidden rounded-3xl px-5 py-10 sm:px-10 sm:py-14 lg:py-16 flex flex-col items-center justify-center text-center w-full">
          <div className="w-12 h-12 rounded-2xl bg-[var(--tint,#E4F2EF)] border border-[var(--accent,#C9A24B)]/40 text-[var(--primary,#0F5C63)] flex items-center justify-center mx-auto mb-6 shadow-xs">
            <Plane className="w-5 h-5 text-[var(--primary,#0F5C63)]" strokeWidth={1.75} />
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-[52px] font-bold text-white tracking-tight leading-[1.12] max-w-4xl mx-auto">
            {hero.heading}
          </h1>

          <p className="tams-hero-subtext mt-4 sm:mt-5 text-base sm:text-lg lg:text-xl text-[#CFE3E0] max-w-2xl mx-auto leading-relaxed font-normal">
            {hero.subtitle}
          </p>

          <div className="mt-7 sm:mt-8 flex flex-wrap items-center justify-center gap-3.5 w-full sm:w-auto">
            <Link to="/login" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="tams-btn-hero-gold w-full sm:w-auto h-11 px-6 rounded-xl text-sm font-semibold gap-2 bg-[var(--accent,#C9A24B)] text-[var(--ink,#0B1F2A)] shadow-sm group"
              >
                <span>Login</span>
                <ArrowRight className="w-4 h-4 text-[var(--ink,#0B1F2A)] group-hover:translate-x-0.5 group-hover:transition-transform group-hover:duration-200" strokeWidth={1.75} />
              </Button>
            </Link>

            <Link to="/signup" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="tams-btn-hero-outline w-full sm:w-auto h-11 px-6 rounded-xl text-sm font-semibold bg-transparent border border-white/85 text-white"
              >
                Sign Up Free
              </Button>
            </Link>
          </div>

          <div className="md:hidden mt-3 w-full">
            <MobileInstallButton variant="hero-cta" />
          </div>
        </section>

        {/* Section B: 7 Equal Tiles Strip */}
        <section className="w-full text-center">
          <div className="tams-home-strip-grid tams-grid-gap grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5 lg:gap-4">
            {STRIP_ITEMS.map((item) => (
              <Tile
                key={item.id}
                icon={item.icon}
                title={item.title}
                compact
                noTruncate
                to="/features"
                className="h-[118px] sm:h-[124px] lg:h-[132px] p-4"
              />
            ))}
          </div>

          <div className="mt-6">
            <Link
              to="/features"
              className="inline-flex items-center gap-1.5 min-h-[44px] md:min-h-0 text-sm font-semibold text-[var(--primary,#0F5C63)] hover:text-[var(--primary-hover,#0B4A50)] hover:transition-colors hover:duration-200 group"
            >
              <span>View all features</span>
              <ArrowRight className="w-4 h-4 text-[var(--primary,#0F5C63)] group-hover:translate-x-0.5 group-hover:transition-transform group-hover:duration-200" strokeWidth={1.75} />
            </Link>
          </div>
        </section>

        {/* Section C: Latest Blog Guides Preview */}
        {latestPosts.length > 0 && (
          <section className="w-full" aria-labelledby="home-blog-preview-heading">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-5">
              <div>
                <span className="text-xs font-semibold tracking-widest uppercase text-[var(--primary,#0F5C63)] block mb-1">
                  RESOURCES FOR TRAVEL AGENTS
                </span>
                <h2
                  id="home-blog-preview-heading"
                  className="text-xl sm:text-2xl font-bold text-[var(--ink,#0B1F2A)] tracking-tight"
                >
                  Latest from the TAMS Pro Blog
                </h2>
              </div>
              <Link
                to="/blogs"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary,#0F5C63)] hover:text-[var(--primary-hover,#0B4A50)] hover:transition-colors hover:duration-200 group"
              >
                <span>View all articles</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:transition-transform group-hover:duration-200" strokeWidth={1.75} />
              </Link>
            </div>

            <div className="tams-blogs-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {latestPosts.map((post) => {
                const safeCover =
                  post.cover_image_url && isSafeUrl(post.cover_image_url, { allowMailto: false })
                    ? post.cover_image_url
                    : null;
                const displayDate = formatBlogDate(post.published_at || post.created_at);
                const readMin = getPostReadMinutes(post);

                return (
                  <Link
                    key={post.id}
                    to={`/blogs/${post.slug}`}
                    className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63]"
                  >
                    <article className="tams-card tams-card-interactive group h-full rounded-2xl overflow-hidden bg-[var(--card,#FFFFFF)] flex flex-col justify-between">
                      <div>
                        <div className="tams-blog-cover aspect-[16/9] w-full overflow-hidden border-b border-[var(--border,#E5E0D3)]">
                          {safeCover ? (
                            <img
                              src={safeCover}
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

                        <div className="p-5">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                            <span className="bg-[var(--tint,#E4F2EF)] text-[var(--primary,#0F5C63)] border border-[var(--border,#E5E0D3)] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                              {post.category || "Guide"}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-[var(--body,#4A5A63)]">
                              {displayDate && (
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="w-3 h-3" strokeWidth={1.75} />
                                  <span>{displayDate}</span>
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" strokeWidth={1.75} />
                                <span>{readMin}m</span>
                              </span>
                            </div>
                          </div>

                          <h3 className="text-base font-bold text-[var(--ink,#0B1F2A)] group-hover:text-[var(--primary,#0F5C63)] group-hover:transition-colors group-hover:duration-200 line-clamp-2 leading-snug">
                            {post.title}
                          </h3>

                          {post.excerpt && (
                            <p className="mt-2 text-xs sm:text-sm text-[var(--body,#4A5A63)] line-clamp-2 leading-relaxed">
                              {post.excerpt}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="px-5 pb-4 pt-1">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary,#0F5C63)]">
                          <span>Read guide</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:transition-transform group-hover:duration-200" />
                        </span>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Section D: Final CTA Clean Rounded-2xl Banner */}
        <section className="w-full">
          <div className="tams-card tams-banner-card rounded-2xl bg-[var(--card,#FFFFFF)] px-6 py-6 sm:px-8 sm:py-7 flex flex-col sm:flex-row items-center justify-between gap-4">
            <h2 className="text-lg sm:text-xl font-semibold text-[var(--ink,#0B1F2A)] tracking-tight">
              Ready to get started?
            </h2>

            <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
              <Link to="/login" className="w-full sm:w-auto">
                <Button
                  size="sm"
                  className="tams-btn-primary w-full sm:w-auto h-11 md:h-10 px-5 rounded-xl text-xs sm:text-sm font-semibold gap-1.5 bg-[var(--primary,#0F5C63)] text-white hover:bg-[var(--primary-hover,#0B4A50)] shadow-sm group"
                >
                  <span>Login</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#E4F2EF] group-hover:translate-x-0.5 group-hover:transition-transform group-hover:duration-200" strokeWidth={1.75} />
                </Button>
              </Link>

              <Link to="/signup" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="tams-btn-secondary w-full sm:w-auto h-11 md:h-10 px-5 rounded-xl text-xs sm:text-sm font-semibold bg-[var(--card,#FFFFFF)] border border-[var(--border,#E5E0D3)] text-[var(--ink,#0B1F2A)]"
                >
                  Sign Up Free
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter compact />
    </div>
  );
}

export default function PublicHomepage() {
  return (
    <PublicErrorBoundary pageName="Home">
      <HomepageContent />
    </PublicErrorBoundary>
  );
}
