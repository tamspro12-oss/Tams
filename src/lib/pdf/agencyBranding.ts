import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";
import { loadAgencyTemplateCore } from "@/lib/agencyTemplatesCore";
import { invalidateQueriesByPrefix } from "@/lib/cacheManager";
import {
  DEFAULT_BRAND_COLOR,
  ensureReadableOnWhite,
  getContrastTextRgb,
  hexToRgb,
  loadAgencyBrandingCore,
  normalizeHexColor,
  resolveAgencyBrandingFromRecords,
  scopedTemplateFallbackKey,
  syncSharedBrandingFields,
  tintRgb,
  type AgencyBranding,
  type RgbTuple,
} from "@/lib/pdf/agencyBrandingCore";

export {
  DEFAULT_BRAND_COLOR,
  ensureReadableOnWhite,
  getContrastTextRgb,
  hexToRgb,
  normalizeHexColor,
  resolveAgencyBrandingFromRecords,
  scopedTemplateFallbackKey,
  syncSharedBrandingFields,
  tintRgb,
  type AgencyBranding,
  type RgbTuple,
};

const memoryBrandingByAgency = new Map<string, AgencyBranding>();
let latestActiveAgencyBranding: AgencyBranding | null = null;

export function setCachedAgencyBranding(branding: AgencyBranding | null): void {
  if (!branding) return;
  if (branding.agencyId) {
    memoryBrandingByAgency.set(branding.agencyId, branding);
  }
  latestActiveAgencyBranding = branding;
}

export function getCachedAgencyBranding(agencyId?: string | null): AgencyBranding | null {
  if (agencyId && memoryBrandingByAgency.has(agencyId)) {
    return memoryBrandingByAgency.get(agencyId) ?? null;
  }
  if (
    latestActiveAgencyBranding &&
    (!agencyId || !latestActiveAgencyBranding.agencyId || latestActiveAgencyBranding.agencyId === agencyId)
  ) {
    return latestActiveAgencyBranding;
  }
  return null;
}

/**
 * Ensures any PDF generator call receives the agency's latest cached logo, address,
 * phone, email, and brand color if the caller's branding snapshot was missing them.
 */
export function enrichWithCachedBranding(branding: AgencyBranding): AgencyBranding {
  const cached = getCachedAgencyBranding(branding.agencyId);
  if (!cached) return branding;
  return {
    ...branding,
    agencyId: branding.agencyId ?? cached.agencyId,
    agencyName:
      branding.agencyName && branding.agencyName !== "Travel Agency"
        ? branding.agencyName
        : cached.agencyName || branding.agencyName,
    logo: branding.logo || cached.logo || null,
    email: branding.email || cached.email || "",
    phone: branding.phone || cached.phone || "",
    address: branding.address || cached.address || "",
    brandColor:
      branding.brandColor && branding.brandColor !== DEFAULT_BRAND_COLOR
        ? branding.brandColor
        : cached.brandColor || branding.brandColor,
  };
}

function getBrowserLocalFallbackStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

/**
 * Normalizes any uploaded image (PNG, JPEG, WEBP, SVG, GIF, AVIF, BMP, or URL)
 * to a compressed canvas PNG data URI in the browser so jsPDF always renders it.
 */
export async function normalizeLogoForPdf(
  logo: string | null | undefined
): Promise<string | null> {
  if (!logo || typeof logo !== "string") return null;
  const trimmed = logo.trim();
  if (!trimmed) return null;
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return trimmed;
  }

  return await new Promise<string | null>((resolve) => {
    let settled = false;
    const done = (result: string | null) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const timer = setTimeout(() => done(trimmed), 3500);
    const img = new Image();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      clearTimeout(timer);
      try {
        const srcW = img.naturalWidth || img.width || 200;
        const srcH = img.naturalHeight || img.height || 80;
        const maxDim = 600;
        const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
        const targetW = Math.max(1, Math.round(srcW * scale));
        const targetH = Math.max(1, Math.round(srcH * scale));
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          done(trimmed);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        done(canvas.toDataURL("image/png"));
      } catch {
        done(trimmed);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      done(trimmed);
    };
    img.src = trimmed;
  });
}

export async function fetchAgencyBranding(
  explicitAgencyId?: string | null,
  signupAgencyName?: string | null
): Promise<AgencyBranding> {
  const agencyId =
    explicitAgencyId !== undefined ? explicitAgencyId : await getAuthenticatedAgencyId();
  const storage = getBrowserLocalFallbackStorage();

  // Run loadAgencyTemplateCore so any pending local templates or legacy agency_logo
  // are migrated and enriched identically to InvoiceTemplateDesigner / BookingTemplateDesigner.
  let migratedInv: Record<string, any> | null = null;
  let migratedBkg: Record<string, any> | null = null;
  if (agencyId) {
    try {
      const [invRes, bkgRes] = await Promise.all([
        loadAgencyTemplateCore<Record<string, any>>("invoice_template", {
          client: supabase as any,
          agencyId,
          storage,
        }),
        loadAgencyTemplateCore<Record<string, any>>("booking_template", {
          client: supabase as any,
          agencyId,
          storage,
        }),
      ]);
      migratedInv = invRes.data ?? null;
      migratedBkg = bkgRes.data ?? null;
    } catch {
      // Fallback handled by loadAgencyBrandingCore below
    }
  }

  const branding = await loadAgencyBrandingCore({
    client: supabase as any,
    agencyId,
    signupAgencyName,
    localFallbackStorage: storage,
  });

  const fallbackMerged = resolveAgencyBrandingFromRecords({
    agencyId,
    invoiceTemplate: migratedInv,
    bookingTemplate: migratedBkg,
    signupAgencyName: branding.agencyName || signupAgencyName,
  });

  const rawLogo = branding.logo || fallbackMerged.logo || null;
  const normalizedLogo = await normalizeLogoForPdf(rawLogo);
  const resolved: AgencyBranding = {
    agencyId: branding.agencyId ?? agencyId ?? null,
    agencyName:
      branding.agencyName && branding.agencyName !== "Travel Agency"
        ? branding.agencyName
        : fallbackMerged.agencyName || branding.agencyName,
    logo: normalizedLogo,
    email: branding.email || fallbackMerged.email || "",
    phone: branding.phone || fallbackMerged.phone || "",
    address: branding.address || fallbackMerged.address || "",
    brandColor:
      branding.brandColor && branding.brandColor !== DEFAULT_BRAND_COLOR
        ? branding.brandColor
        : fallbackMerged.brandColor || branding.brandColor,
  };

  setCachedAgencyBranding(resolved);
  return resolved;
}

export function invalidateAgencyBrandingCache(): void {
  memoryBrandingByAgency.clear();
  latestActiveAgencyBranding = null;
  invalidateQueriesByPrefix("agency-branding");
}

export function formatBrandingContactParts(branding?: AgencyBranding | null): string[] {
  if (!branding) return [];
  return [branding.email, branding.phone, branding.address]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
}

export function brandingToReportAgencyInfo(branding: AgencyBranding) {
  return {
    name: branding.agencyName,
    email: branding.email || undefined,
    contact_email: branding.email || undefined,
    phone_number: branding.phone || undefined,
    address: branding.address || undefined,
    logo: branding.logo,
    brandColor: branding.brandColor,
  };
}

function getJsPdfImageFormat(dataUri: string): "PNG" | "JPEG" | "WEBP" | "GIF" | "BMP" | null {
  const lower = dataUri.slice(0, 48).toLowerCase();
  if (lower.startsWith("data:image/png")) return "PNG";
  if (lower.startsWith("data:image/jpeg") || lower.startsWith("data:image/jpg")) return "JPEG";
  if (lower.startsWith("data:image/webp")) return "WEBP";
  if (lower.startsWith("data:image/gif")) return "GIF";
  if (lower.startsWith("data:image/bmp")) return "BMP";
  return null;
}

export function drawBrandLogo(
  doc: jsPDF,
  logo: string | null | undefined,
  boxX: number,
  boxY: number,
  maxW: number,
  maxH: number,
  align: "left" | "center" | "right" = "left",
  options?: { backing?: "none" | "white-pill" }
): { rendered: boolean; width: number; height: number } {
  if (!logo || typeof logo !== "string") {
    return { rendered: false, width: 0, height: 0 };
  }
  const format = getJsPdfImageFormat(logo);
  if (!format) {
    return { rendered: false, width: 0, height: 0 };
  }

  try {
    const useBacking = options?.backing === "white-pill";
    const pad = useBacking ? 1.2 : 0;
    const innerMaxW = Math.max(4, maxW - pad * 2);
    const innerMaxH = Math.max(4, maxH - pad * 2);

    let drawW = innerMaxW;
    let drawH = innerMaxH;
    try {
      const props = doc.getImageProperties(logo);
      if (props?.width && props?.height) {
        const scale = Math.min(innerMaxW / props.width, innerMaxH / props.height);
        drawW = Math.max(1, props.width * scale);
        drawH = Math.max(1, props.height * scale);
      }
    } catch {
      drawW = Math.min(innerMaxW, innerMaxH * 1.6);
      drawH = innerMaxH;
    }

    const totalW = drawW + pad * 2;
    const totalH = drawH + pad * 2;

    let outerX = boxX;
    if (align === "center") {
      outerX = boxX + (maxW - totalW) / 2;
    } else if (align === "right") {
      outerX = boxX + (maxW - totalW);
    }
    const outerY = boxY + (maxH - totalH) / 2;

    if (useBacking) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(outerX, outerY, totalW, totalH, 1.8, 1.8, "F");
    }

    doc.addImage(logo, format, outerX + pad, outerY + pad, drawW, drawH);
    return { rendered: true, width: totalW, height: totalH };
  } catch (err) {
    console.warn("[AgencyBranding] Could not render logo in PDF:", err);
    return { rendered: false, width: 0, height: 0 };
  }
}

/**
 * Draws a crisp right-facing airplane silhouette in vector shapes so PDFs never
 * depend on missing Unicode glyphs in built-in jsPDF fonts.
 */
export function drawPlaneIcon(
  doc: jsPDF,
  cx: number,
  cy: number,
  size: number,
  rgb: RgbTuple
): void {
  const s = size / 10;
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);

  // Fuselage (sleek horizontal body)
  doc.roundedRect(cx - 4.2 * s, cy - 0.65 * s, 7.6 * s, 1.3 * s, 0.65 * s, 0.65 * s, "F");
  // Nose cone
  doc.triangle(
    cx + 3.2 * s,
    cy - 0.65 * s,
    cx + 5.0 * s,
    cy,
    cx + 3.2 * s,
    cy + 0.65 * s,
    "F"
  );
  // Swept upper & lower main wings
  doc.triangle(
    cx - 0.5 * s,
    cy - 0.4 * s,
    cx - 2.3 * s,
    cy - 4.2 * s,
    cx + 1.3 * s,
    cy - 0.4 * s,
    "F"
  );
  doc.triangle(
    cx - 0.5 * s,
    cy + 0.4 * s,
    cx - 2.3 * s,
    cy + 4.2 * s,
    cx + 1.3 * s,
    cy + 0.4 * s,
    "F"
  );
  // Tail stabilizers
  doc.triangle(
    cx - 3.2 * s,
    cy - 0.4 * s,
    cx - 4.8 * s,
    cy - 2.2 * s,
    cx - 2.2 * s,
    cy - 0.4 * s,
    "F"
  );
  doc.triangle(
    cx - 3.2 * s,
    cy + 0.4 * s,
    cx - 4.8 * s,
    cy + 2.2 * s,
    cx - 2.2 * s,
    cy + 0.4 * s,
    "F"
  );
}
