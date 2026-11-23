export const DEFAULT_BRAND_COLOR = "#1e40af";

export interface AgencyBranding {
  agencyId: string | null;
  agencyName: string;
  logo: string | null;
  email: string;
  phone: string;
  address: string;
  brandColor: string;
}

export type RgbTuple = [number, number, number];

export interface BrandingDbClient {
  from(table: string): any;
}

function cleanStr(val: unknown): string {
  return typeof val === "string" ? val.trim() : "";
}

function cleanLogo(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed.startsWith("data:image/")) return null;
  return trimmed;
}

export function normalizeHexColor(
  value?: string | null,
  fallback: string = DEFAULT_BRAND_COLOR
): string {
  const raw = cleanStr(value);
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.toLowerCase();
  }
  const shortMatch = raw.match(/^#([0-9a-fA-F]{3})$/);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

export function hexToRgb(hex?: string | null): RgbTuple {
  const normalized = normalizeHexColor(hex);
  const int = parseInt(normalized.slice(1), 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export function tintRgb(rgb: RgbTuple, whiteMix = 0.9): RgbTuple {
  const ratio = Math.min(1, Math.max(0, whiteMix));
  return [
    Math.round(rgb[0] + (255 - rgb[0]) * ratio),
    Math.round(rgb[1] + (255 - rgb[1]) * ratio),
    Math.round(rgb[2] + (255 - rgb[2]) * ratio),
  ];
}

export function darkenRgb(rgb: RgbTuple, factor = 0.25): RgbTuple {
  const keep = Math.min(1, Math.max(0, 1 - factor));
  return [
    Math.round(rgb[0] * keep),
    Math.round(rgb[1] * keep),
    Math.round(rgb[2] * keep),
  ];
}

function relativeLuminance([r, g, b]: RgbTuple): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastTextRgb(bgRgb: RgbTuple): RgbTuple {
  return relativeLuminance(bgRgb) > 0.45 ? [15, 23, 42] : [255, 255, 255];
}

export function ensureReadableOnWhite(rgb: RgbTuple): RgbTuple {
  let current: RgbTuple = [...rgb] as RgbTuple;
  let attempts = 0;
  while (relativeLuminance(current) > 0.32 && attempts < 6) {
    current = darkenRgb(current, 0.22);
    attempts += 1;
  }
  return current;
}

function parseTimestamp(record?: Record<string, any> | null): number {
  if (!record) return 0;
  const raw = record.updatedAt || record.updated_at;
  if (typeof raw !== "string" || !raw.trim()) return 0;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : 0;
}

/**
 * Resolves agency branding strictly from Settings > Branding (`invoice_template` /
 * `booking_template`) with signup `agencies.name` fallback ONLY for agencyName.
 * Email, phone, address, logo, and brandColor NEVER fall back to user or signup fields.
 */
export function resolveAgencyBrandingFromRecords(params: {
  agencyId?: string | null;
  invoiceTemplate?: Record<string, any> | null;
  bookingTemplate?: Record<string, any> | null;
  signupAgencyName?: string | null;
}): AgencyBranding {
  const inv =
    params.invoiceTemplate && typeof params.invoiceTemplate === "object"
      ? params.invoiceTemplate
      : null;
  const bkg =
    params.bookingTemplate && typeof params.bookingTemplate === "object"
      ? params.bookingTemplate
      : null;

  const invTs = parseTimestamp(inv);
  const bkgTs = parseTimestamp(bkg);
  const useBookingFirst = bkg !== null && bkgTs > invTs;

  const primary = useBookingFirst ? bkg : inv;
  const secondary = useBookingFirst ? inv : bkg;

  const agencyName =
    cleanStr(primary?.agencyName) ||
    cleanStr(secondary?.agencyName) ||
    cleanStr(params.signupAgencyName) ||
    "Travel Agency";

  const logo = cleanLogo(primary?.logo) || cleanLogo(secondary?.logo) || null;
  const email = cleanStr(primary?.email) || cleanStr(secondary?.email);
  const phone = cleanStr(primary?.phone) || cleanStr(secondary?.phone);
  const address = cleanStr(primary?.address) || cleanStr(secondary?.address);
  const brandColor = normalizeHexColor(
    cleanStr(primary?.themeColor) || cleanStr(secondary?.themeColor) || DEFAULT_BRAND_COLOR
  );

  return {
    agencyId: params.agencyId ?? null,
    agencyName,
    logo,
    email,
    phone,
    address,
    brandColor,
  };
}

/**
 * Loads agency branding directly from Supabase scoped by `agency_id`.
 * Never reads unscoped localStorage so multiple agencies on the same device stay isolated.
 */
export async function loadAgencyBrandingCore(opts: {
  client: BrandingDbClient;
  agencyId: string | null | undefined;
  signupAgencyName?: string | null;
}): Promise<AgencyBranding> {
  const { client, agencyId } = opts;
  let signupName = cleanStr(opts.signupAgencyName);

  if (!agencyId) {
    return resolveAgencyBrandingFromRecords({
      agencyId: null,
      signupAgencyName: signupName || null,
    });
  }

  let invoiceTemplate: Record<string, any> | null = null;
  let bookingTemplate: Record<string, any> | null = null;

  try {
    const { data: rows, error } = await client
      .from("agency_templates")
      .select("key, value, updated_at")
      .eq("agency_id", agencyId)
      .in("key", ["invoice_template", "booking_template"]);

    if (!error && Array.isArray(rows)) {
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const val =
          row.value && typeof row.value === "object" && !Array.isArray(row.value)
            ? { ...row.value, updated_at: row.updated_at }
            : null;
        if (!val) continue;
        if (row.key === "invoice_template") {
          invoiceTemplate = val;
        } else if (row.key === "booking_template") {
          bookingTemplate = val;
        }
      }
    }
  } catch (err) {
    console.warn("[AgencyBranding] Failed to load agency_templates:", err);
  }

  if (!signupName) {
    try {
      const { data: agencyRow, error: agencyErr } = await client
        .from("agencies")
        .select("id, name")
        .eq("id", agencyId)
        .maybeSingle();

      if (!agencyErr && agencyRow?.name) {
        signupName = cleanStr(agencyRow.name);
      }
    } catch (err) {
      console.warn("[AgencyBranding] Failed to load fallback agency name:", err);
    }
  }

  return resolveAgencyBrandingFromRecords({
    agencyId,
    invoiceTemplate,
    bookingTemplate,
    signupAgencyName: signupName || null,
  });
}

