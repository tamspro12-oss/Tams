import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Save,
  RotateCcw,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
  LayoutTemplate,
  CreditCard,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import {
  DEFAULT_LANDING_HERO,
  DEFAULT_PRICING_SETTINGS,
  LandingHeroSettings,
  PricingPageSettings,
  SITE_SETTINGS_QUERY_KEY,
  saveSiteSettingAdmin,
} from "@/lib/siteSettings";
import { PricingPlan } from "@/config/pricingPlans";

function clonePlans(plans: PricingPlan[]): PricingPlan[] {
  return plans.map((p) => ({
    ...p,
    bullets: [...p.bullets],
  }));
}

export const AdminSiteContentManager: React.FC = () => {
  const queryClient = useQueryClient();
  const { hero, pricing, isLoading } = useSiteSettings();

  const [heroForm, setHeroForm] = useState<LandingHeroSettings>({ ...DEFAULT_LANDING_HERO });
  const [pricingForm, setPricingForm] = useState<PricingPageSettings>({
    eyebrow: DEFAULT_PRICING_SETTINGS.eyebrow,
    heading: DEFAULT_PRICING_SETTINGS.heading,
    plans: clonePlans(DEFAULT_PRICING_SETTINGS.plans),
  });
  const [newFeatureDrafts, setNewFeatureDrafts] = useState<Record<string, string>>({});
  const [savingHero, setSavingHero] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);

  useEffect(() => {
    setHeroForm({ ...hero });
  }, [hero]);

  useEffect(() => {
    setPricingForm({
      eyebrow: pricing.eyebrow,
      heading: pricing.heading,
      plans: clonePlans(pricing.plans),
    });
  }, [pricing]);

  const handleSaveHero = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingHero) return;

    const cleanHeading = heroForm.heading.trim();
    const cleanSubtitle = heroForm.subtitle.trim();
    if (!cleanHeading || !cleanSubtitle) {
      toast.error("Hero heading and subtitle are both required.");
      return;
    }

    setSavingHero(true);
    try {
      const { success, error } = await saveSiteSettingAdmin("landing_hero", {
        heading: cleanHeading,
        subtitle: cleanSubtitle,
      });
      if (!success || error) {
        toast.error(error || "Could not save landing hero.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY });
      toast.success("Landing hero updated");
    } finally {
      setSavingHero(false);
    }
  };

  const updatePlanField = <K extends keyof PricingPlan>(
    planIndex: number,
    field: K,
    value: PricingPlan[K]
  ) => {
    setPricingForm((prev) => ({
      ...prev,
      plans: prev.plans.map((p, idx) => (idx === planIndex ? { ...p, [field]: value } : p)),
    }));
  };

  const updatePlanBullet = (planIndex: number, bulletIndex: number, text: string) => {
    setPricingForm((prev) => ({
      ...prev,
      plans: prev.plans.map((p, idx) =>
        idx === planIndex
          ? {
              ...p,
              bullets: p.bullets.map((b, bIdx) => (bIdx === bulletIndex ? text : b)),
            }
          : p
      ),
    }));
  };

  const movePlanBullet = (planIndex: number, bulletIndex: number, dir: -1 | 1) => {
    setPricingForm((prev) => ({
      ...prev,
      plans: prev.plans.map((p, idx) => {
        if (idx !== planIndex) return p;
        const target = bulletIndex + dir;
        if (target < 0 || target >= p.bullets.length) return p;
        const next = [...p.bullets];
        const [item] = next.splice(bulletIndex, 1);
        next.splice(target, 0, item);
        return { ...p, bullets: next };
      }),
    }));
  };

  const removePlanBullet = (planIndex: number, bulletIndex: number) => {
    setPricingForm((prev) => ({
      ...prev,
      plans: prev.plans.map((p, idx) =>
        idx === planIndex
          ? { ...p, bullets: p.bullets.filter((_, bIdx) => bIdx !== bulletIndex) }
          : p
      ),
    }));
  };

  const addPlanBullet = (planIndex: number, planId: string) => {
    const draft = (newFeatureDrafts[planId] || "").trim();
    if (!draft) return;
    setPricingForm((prev) => ({
      ...prev,
      plans: prev.plans.map((p, idx) =>
        idx === planIndex ? { ...p, bullets: [...p.bullets, draft] } : p
      ),
    }));
    setNewFeatureDrafts((prev) => ({ ...prev, [planId]: "" }));
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPricing) return;

    const cleanEyebrow = pricingForm.eyebrow.trim() || DEFAULT_PRICING_SETTINGS.eyebrow;
    const cleanHeading = pricingForm.heading.trim() || DEFAULT_PRICING_SETTINGS.heading;

    const cleanedPlans: PricingPlan[] = pricingForm.plans.map((plan) => ({
      ...plan,
      name: plan.name.trim(),
      priceFormatted: plan.priceFormatted.trim(),
      originalPriceFormatted:
        plan.id === "monthly" ? "" : plan.originalPriceFormatted.trim(),
      discountBadge: plan.id === "monthly" ? "" : plan.discountBadge.trim(),
      period: plan.period.trim(),
      ctaText: plan.ctaText.trim() || "Get Started",
      ctaLink: plan.ctaLink.trim() || "/signup",
      bullets: plan.bullets.map((b) => b.trim()).filter(Boolean),
    }));

    for (const plan of cleanedPlans) {
      if (!plan.name || !plan.priceFormatted) {
        toast.error("Each pricing plan must have a name and price.");
        return;
      }
      if (plan.bullets.length === 0) {
        toast.error(`Please add at least one feature for ${plan.name}.`);
        return;
      }
    }

    setSavingPricing(true);
    try {
      const { success, error } = await saveSiteSettingAdmin("pricing_plans", {
        eyebrow: cleanEyebrow,
        heading: cleanHeading,
        plans: cleanedPlans,
      });
      if (!success || error) {
        toast.error(error || "Could not save pricing content.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY });
      toast.success("Pricing plans updated");
    } finally {
      setSavingPricing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Landing Hero Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-primary" />
                <span>Landing Page Hero</span>
              </CardTitle>
              <CardDescription>
                Customize the main headline and subtitle displayed to visitors at /.
              </CardDescription>
            </div>
            <a href="/" target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Preview Home</span>
              </Button>
            </a>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSaveHero} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="hero-heading-input">Hero Heading</Label>
              <Input
                id="hero-heading-input"
                value={heroForm.heading}
                onChange={(e) => setHeroForm((prev) => ({ ...prev, heading: e.target.value }))}
                placeholder="Travel Agency Management System"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hero-subtitle-input">Hero Subtitle</Label>
              <Textarea
                id="hero-subtitle-input"
                rows={2}
                value={heroForm.subtitle}
                onChange={(e) => setHeroForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                placeholder="Bookings, visas, accounts and vouchers, everything in one place."
                required
              />
            </div>

            <div className="p-4 border bg-muted/20 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Live Text Preview
              </p>
              <p className="text-lg font-bold text-foreground">{heroForm.heading || "—"}</p>
              <p className="text-sm text-muted-foreground">{heroForm.subtitle || "—"}</p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setHeroForm({ ...DEFAULT_LANDING_HERO })}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Defaults</span>
              </Button>
              <Button type="submit" size="sm" disabled={savingHero} className="gap-1.5">
                {savingHero ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>Save Hero Content</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Pricing Plans Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <span>Pricing Plans</span>
              </CardTitle>
              <CardDescription>
                Edit the pricing page heading, plan names, prices, discount tags, and feature lists at /pricing.
              </CardDescription>
            </div>
            <a href="/pricing" target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Preview Pricing</span>
              </Button>
            </a>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSavePricing} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pricing-eyebrow">Section Eyebrow</Label>
                <Input
                  id="pricing-eyebrow"
                  value={pricingForm.eyebrow}
                  onChange={(e) =>
                    setPricingForm((prev) => ({ ...prev, eyebrow: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pricing-heading">Page Heading</Label>
                <Input
                  id="pricing-heading"
                  value={pricingForm.heading}
                  onChange={(e) =>
                    setPricingForm((prev) => ({ ...prev, heading: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {pricingForm.plans.map((plan, planIdx) => (
                <div key={plan.id} className="border p-4 space-y-4 bg-muted/10">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b">
                    <h3 className="font-semibold text-base capitalize">
                      {plan.id} Plan
                    </h3>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`popular-${plan.id}`} className="text-xs">
                        Most Popular Badge
                      </Label>
                      <Switch
                        id={`popular-${plan.id}`}
                        checked={Boolean(plan.popular)}
                        onCheckedChange={(checked) =>
                          updatePlanField(planIdx, "popular", checked)
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Plan Name</Label>
                      <Input
                        value={plan.name}
                        onChange={(e) => updatePlanField(planIdx, "name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Discount Tag</Label>
                      <Input
                        value={plan.id === "monthly" ? "" : plan.discountBadge}
                        disabled={plan.id === "monthly"}
                        placeholder={plan.id === "monthly" ? "No discount on Monthly" : "50% OFF"}
                        onChange={(e) =>
                          updatePlanField(planIdx, "discountBadge", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Current Price</Label>
                      <Input
                        value={plan.priceFormatted}
                        onChange={(e) =>
                          updatePlanField(planIdx, "priceFormatted", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Strike-through Old Price</Label>
                      <Input
                        value={plan.id === "monthly" ? "" : plan.originalPriceFormatted}
                        disabled={plan.id === "monthly"}
                        placeholder={plan.id === "monthly" ? "None on Monthly" : "19,999"}
                        onChange={(e) =>
                          updatePlanField(planIdx, "originalPriceFormatted", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Billing Period</Label>
                      <Input
                        value={plan.period}
                        onChange={(e) => updatePlanField(planIdx, "period", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Button Label</Label>
                      <Input
                        value={plan.ctaText}
                        onChange={(e) => updatePlanField(planIdx, "ctaText", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs font-semibold">Feature List</Label>
                    <div className="space-y-2">
                      {plan.bullets.map((bullet, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-1.5">
                          <Input
                            value={bullet}
                            onChange={(e) => updatePlanBullet(planIdx, bIdx, e.target.value)}
                            className="h-8 text-xs"
                          />
                          <Button
                            type="button"
                            data-compact-btn=""
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            disabled={bIdx === 0}
                            onClick={() => movePlanBullet(planIdx, bIdx, -1)}
                            aria-label="Move feature up"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            data-compact-btn=""
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            disabled={bIdx === plan.bullets.length - 1}
                            onClick={() => movePlanBullet(planIdx, bIdx, 1)}
                            aria-label="Move feature down"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            data-compact-btn=""
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-destructive hover:text-destructive"
                            onClick={() => removePlanBullet(planIdx, bIdx)}
                            aria-label="Remove feature"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        value={newFeatureDrafts[plan.id] || ""}
                        onChange={(e) =>
                          setNewFeatureDrafts((prev) => ({
                            ...prev,
                            [plan.id]: e.target.value,
                          }))
                        }
                        placeholder="Add new feature..."
                        className="h-8 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addPlanBullet(planIdx, plan.id);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => addPlanBullet(planIdx, plan.id)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  setPricingForm({
                    eyebrow: DEFAULT_PRICING_SETTINGS.eyebrow,
                    heading: DEFAULT_PRICING_SETTINGS.heading,
                    plans: clonePlans(DEFAULT_PRICING_SETTINGS.plans),
                  })
                }
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Defaults</span>
              </Button>
              <Button type="submit" size="sm" disabled={savingPricing} className="gap-1.5">
                {savingPricing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>Save Pricing Plans</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

