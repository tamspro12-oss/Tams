import { supabase } from "@/integrations/supabase/client";
import { PRICING_PLANS, type PricingPlan } from "@/config/pricingPlans";
import { toFriendlyMessage } from "@/lib/friendlyError";

export interface LandingHeroSettings {
  heading: string;
  subtitle: string;
}

export interface PricingPageSettings {
  eyebrow: string;
  heading: string;
  plans: PricingPlan[];
}

export interface SiteSettingsData {
  hero: LandingHeroSettings;
  pricing: PricingPageSettings;
}

export interface SiteSettingRow {
  key: string;
  value: unknown;
  updated_at?: string;
}

export const SITE_SETTINGS_QUERY_KEY = ["public-site-settings"] as const;

export const DEFAULT_LANDING_HERO: LandingHeroSettings = {
  heading: "Travel Agency Management System",
  subtitle: "Bookings, visas, accounts and vouchers, everything in one place.",
};

export const DEFAULT_PRICING_SETTINGS: PricingPageSettings = {
  eyebrow: "PRICING",
  heading: "Choose your plan",
  plans: PRICING_PLANS.map((plan) => ({
    ...plan,
    bullets: [...plan.bullets],
  })),
};

export const DEFAULT_SITE_SETTINGS: SiteSettingsData = {
  hero: { ...DEFAULT_LANDING_HERO },
  pricing: {
    eyebrow: DEFAULT_PRICING_SETTINGS.eyebrow,
    heading: DEFAULT_PRICING_SETTINGS.heading,
    plans: DEFAULT_PRICING_SETTINGS.plans.map((p) => ({
      ...p,
      bullets: [...p.bullets],
    })),
  },
};

function sanitizeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function sanitizeOptionalString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeMonthlyPriceFormatted(rawPrice: string): string {
  const compact = rawPrice.replace(/\s+/g, " ").trim();
  if (/^pkr\s*999$/i.test(compact) || /^pkr\s*1999$/i.test(compact)) {
    return "PKR 1,999";
  }
  return compact;
}

function sanitizePlan(raw: unknown, fallback: PricingPlan): PricingPlan {
  if (!raw || typeof raw !== "object") {
    return { ...fallback, bullets: [...fallback.bullets] };
  }
  const obj = raw as Record<string, unknown>;
  const rawBullets = Array.isArray(obj.bullets)
    ? obj.bullets
        .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
        .map((b) => b.trim())
    : [];

  const resolvedId =
    obj.id === "yearly" ? "yearly" : obj.id === "monthly" ? "monthly" : fallback.id;
  const rawPriceFormatted = sanitizeString(obj.priceFormatted, fallback.priceFormatted);

  return {
    id: resolvedId,
    name: sanitizeString(obj.name, fallback.name),
    popular: typeof obj.popular === "boolean" ? obj.popular : Boolean(fallback.popular),
    priceFormatted:
      resolvedId === "monthly"
        ? normalizeMonthlyPriceFormatted(rawPriceFormatted)
        : rawPriceFormatted,
    originalPriceFormatted:
      resolvedId === "monthly"
        ? ""
        : sanitizeOptionalString(obj.originalPriceFormatted, fallback.originalPriceFormatted),
    discountBadge:
      resolvedId === "monthly"
        ? ""
        : sanitizeOptionalString(obj.discountBadge, fallback.discountBadge),
    period: sanitizeString(obj.period, fallback.period),
    bullets: rawBullets.length > 0 ? rawBullets : [...fallback.bullets],
    ctaText: sanitizeString(obj.ctaText, fallback.ctaText),
    ctaLink: sanitizeString(obj.ctaLink, fallback.ctaLink),
  };
}

/**
 * Safely merges database `site_settings` rows onto hardcoded fallbacks so missing,
 * partial, or legacy payloads never crash or blank out public pages.
 */
export function mergeSiteSettings(rows?: SiteSettingRow[] | null): SiteSettingsData {
  const result: SiteSettingsData = {
    hero: { ...DEFAULT_LANDING_HERO },
    pricing: {
      eyebrow: DEFAULT_PRICING_SETTINGS.eyebrow,
      heading: DEFAULT_PRICING_SETTINGS.heading,
      plans: DEFAULT_PRICING_SETTINGS.plans.map((p) => ({
        ...p,
        bullets: [...p.bullets],
      })),
    },
  };

  if (!Array.isArray(rows)) {
    return result;
  }

  for (const row of rows) {
    if (!row || typeof row.key !== "string" || !row.value || typeof row.value !== "object") {
      continue;
    }

    const val = row.value as Record<string, unknown>;

    if (row.key === "landing_hero") {
      result.hero = {
        heading: sanitizeString(val.heading, DEFAULT_LANDING_HERO.heading),
        subtitle: sanitizeString(val.subtitle, DEFAULT_LANDING_HERO.subtitle),
      };
    }

    if (row.key === "pricing_plans") {
      const rawPlans = Array.isArray(val.plans) ? val.plans : [];
      const mergedPlans = DEFAULT_PRICING_SETTINGS.plans.map((defaultPlan, index) => {
        const matched =
          rawPlans.find(
            (item) =>
              item &&
              typeof item === "object" &&
              (item as Record<string, unknown>).id === defaultPlan.id
          ) ?? rawPlans[index];
        return sanitizePlan(matched, defaultPlan);
      });

      result.pricing = {
        eyebrow: sanitizeString(val.eyebrow, DEFAULT_PRICING_SETTINGS.eyebrow),
        heading: sanitizeString(val.heading, DEFAULT_PRICING_SETTINGS.heading),
        plans: mergedPlans,
      };
    }
  }

  return result;
}

export async function fetchSiteSettings(): Promise<SiteSettingsData> {
  try {
    const { data, error } = await (supabase as any)
      .from("site_settings")
      .select("key, value, updated_at")
      .in("key", ["landing_hero", "pricing_plans"]);

    if (error) {
      console.error("[TAMS SiteSettings] fetchSiteSettings error:", error);
      return DEFAULT_SITE_SETTINGS;
    }

    return mergeSiteSettings((data as SiteSettingRow[]) || []);
  } catch (err) {
    console.error("[TAMS SiteSettings] fetchSiteSettings exception:", err);
    return DEFAULT_SITE_SETTINGS;
  }
}

export async function saveSiteSettingAdmin(
  key: "landing_hero" | "pricing_plans",
  value: LandingHeroSettings | PricingPageSettings
): Promise<{ success: boolean; error: string | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await (supabase as any)
      .from("site_settings")
      .upsert(
        {
          key,
          value,
          updated_by: user?.id ?? null,
        },
        { onConflict: "key" }
      );

    if (error) {
      console.error(`[TAMS SiteSettings] saveSiteSettingAdmin (${key}) error:`, error);
      return {
        success: false,
        error: toFriendlyMessage(error, "Could not save site content changes."),
      };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error(`[TAMS SiteSettings] saveSiteSettingAdmin (${key}) exception:`, err);
    return {
      success: false,
      error: toFriendlyMessage(err, "Could not save site content changes."),
    };
  }
}

