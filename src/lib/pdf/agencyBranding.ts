import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";
import { invalidateQueriesByPrefix } from "@/lib/cacheManager";
import {
  DEFAULT_BRAND_COLOR,
  ensureReadableOnWhite,
  getContrastTextRgb,
  hexToRgb,
  loadAgencyBrandingCore,
  normalizeHexColor,
  resolveAgencyBrandingFromRecords,
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
  tintRgb,
  type AgencyBranding,
  type RgbTuple,
};

export async function fetchAgencyBranding(
  explicitAgencyId?: string | null,
  signupAgencyName?: string | null
): Promise<AgencyBranding> {
  const agencyId =
    explicitAgencyId !== undefined ? explicitAgencyId : await getAuthenticatedAgencyId();
  return loadAgencyBrandingCore({
    client: supabase as any,
    agencyId,
    signupAgencyName,
  });
}

export function invalidateAgencyBrandingCache(): void {
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

function getJsPdfImageFormat(dataUri: string): "PNG" | "JPEG" | "WEBP" | null {
  const lower = dataUri.slice(0, 40).toLowerCase();
  if (lower.startsWith("data:image/png")) return "PNG";
  if (lower.startsWith("data:image/jpeg") || lower.startsWith("data:image/jpg")) return "JPEG";
  if (lower.startsWith("data:image/webp")) return "WEBP";
  return null;
}

export function drawBrandLogo(
  doc: jsPDF,
  logo: string | null | undefined,
  boxX: number,
  boxY: number,
  maxW: number,
  maxH: number,
  align: "left" | "center" | "right" = "left"
): { rendered: boolean; width: number; height: number } {
  if (!logo || typeof logo !== "string") {
    return { rendered: false, width: 0, height: 0 };
  }
  const format = getJsPdfImageFormat(logo);
  if (!format) {
    return { rendered: false, width: 0, height: 0 };
  }

  try {
    let drawW = maxW;
    let drawH = maxH;
    try {
      const props = doc.getImageProperties(logo);
      if (props?.width && props?.height) {
        const scale = Math.min(maxW / props.width, maxH / props.height);
        drawW = Math.max(1, props.width * scale);
        drawH = Math.max(1, props.height * scale);
      }
    } catch {
      drawW = Math.min(maxW, maxH * 1.6);
      drawH = maxH;
    }

    let x = boxX;
    if (align === "center") {
      x = boxX + (maxW - drawW) / 2;
    } else if (align === "right") {
      x = boxX + (maxW - drawW);
    }
    const y = boxY + (maxH - drawH) / 2;

    doc.addImage(logo, format, x, y, drawW, drawH);
    return { rendered: true, width: drawW, height: drawH };
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
