// Pricing Plans Configuration for TAMS Pro
// Single source of truth for pricing constants and plans

export interface PricingPlan {
  id: "monthly" | "yearly";
  name: string;
  popular?: boolean;
  priceFormatted: string;
  originalPriceFormatted: string;
  discountBadge: string;
  period: string;
  bullets: string[];
  ctaText: string;
  ctaLink: string;
}

export const PRICING_CONSTANTS = {
  monthly: {
    price: 999,
    originalPrice: 1999,
    discount: "50% OFF",
    period: "/ month",
  },
  yearly: {
    price: 9999,
    originalPrice: 19999,
    discount: "50% OFF",
    period: "/ year",
  },
} as const;

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "monthly",
    name: "Monthly",
    priceFormatted: "PKR 999",
    originalPriceFormatted: "1,999",
    discountBadge: "50% OFF",
    period: "/ month",
    bullets: [
      "All core features",
      "Up to 2 sub-users",
      "Email integration",
      "Cloud backup",
      "Mobile access",
      "Email support",
    ],
    ctaText: "Get Started",
    ctaLink: "/signup",
  },
  {
    id: "yearly",
    name: "Yearly",
    popular: true,
    priceFormatted: "PKR 9,999",
    originalPriceFormatted: "19,999",
    discountBadge: "50% OFF",
    period: "/ year",
    bullets: [
      "Everything in Monthly",
      "Priority support",
      "Advanced reports",
      "Unlimited bookings",
      "Custom branding",
      "2 months free",
    ],
    ctaText: "Get Started",
    ctaLink: "/signup",
  },
];
