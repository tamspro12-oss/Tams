import type { jsPDF } from "jspdf";
import type { RgbTuple } from "@/lib/pdf/agencyBrandingCore";

export interface AirlineBrand {
  code: string;
  displayName: string;
  shortMark: string;
  subtitle?: string;
  primaryRgb: RgbTuple;
  accentRgb: RgbTuple;
  aliases: string[];
}

export const AIRLINE_LOGO_MAP: ReadonlyArray<AirlineBrand> = [
  {
    code: "PK",
    displayName: "PIA",
    shortMark: "PIA",
    subtitle: "Pakistan International",
    primaryRgb: [4, 106, 56],
    accentRgb: [198, 146, 20],
    aliases: ["pia", "pakistan international", "pakistan international airlines", "pk"],
  },
  {
    code: "SV",
    displayName: "SAUDIA",
    shortMark: "SAUDIA",
    subtitle: "Saudi Arabian Airlines",
    primaryRgb: [0, 102, 51],
    accentRgb: [180, 142, 46],
    aliases: ["saudia", "saudi", "saudi airlines", "saudi arabian airlines", "sv"],
  },
  {
    code: "EK",
    displayName: "Emirates",
    shortMark: "Emirates",
    subtitle: "Fly Better",
    primaryRgb: [215, 25, 32],
    accentRgb: [198, 156, 109],
    aliases: ["emirates", "ek"],
  },
  {
    code: "QR",
    displayName: "QATAR",
    shortMark: "QATAR",
    subtitle: "Qatar Airways",
    primaryRgb: [92, 6, 50],
    accentRgb: [141, 129, 123],
    aliases: ["qatar", "qatar airways", "qr"],
  },
  {
    code: "EY",
    displayName: "ETIHAD",
    shortMark: "ETIHAD",
    subtitle: "Etihad Airways",
    primaryRgb: [34, 34, 34],
    accentRgb: [189, 139, 19],
    aliases: ["etihad", "etihad airways", "ey"],
  },
  {
    code: "TK",
    displayName: "TURKISH",
    shortMark: "TURKISH",
    subtitle: "Turkish Airlines",
    primaryRgb: [200, 16, 46],
    accentRgb: [30, 41, 59],
    aliases: ["turkish", "turkish airlines", "tk"],
  },
  {
    code: "FZ",
    displayName: "flydubai",
    shortMark: "flydubai",
    primaryRgb: [0, 118, 192],
    accentRgb: [244, 121, 32],
    aliases: ["flydubai", "fly dubai", "fz"],
  },
  {
    code: "G9",
    displayName: "Air Arabia",
    shortMark: "AirArabia",
    primaryRgb: [210, 16, 52],
    accentRgb: [51, 65, 85],
    aliases: ["air arabia", "airarabia", "g9"],
  },
  {
    code: "PA",
    displayName: "airblue",
    shortMark: "airblue",
    primaryRgb: [0, 82, 155],
    accentRgb: [0, 153, 216],
    aliases: ["airblue", "air blue", "pa"],
  },
  {
    code: "ER",
    displayName: "SereneAir",
    shortMark: "SereneAir",
    primaryRgb: [0, 122, 135],
    accentRgb: [212, 175, 55],
    aliases: ["serene", "sereneair", "serene air", "er"],
  },
  {
    code: "PF",
    displayName: "AirSial",
    shortMark: "AirSial",
    primaryRgb: [0, 112, 60],
    accentRgb: [205, 164, 52],
    aliases: ["airsial", "air sial", "pf"],
  },
  {
    code: "9P",
    displayName: "Fly Jinnah",
    shortMark: "Fly Jinnah",
    primaryRgb: [216, 30, 5],
    accentRgb: [15, 23, 42],
    aliases: ["fly jinnah", "flyjinnah", "9p"],
  },
  {
    code: "XY",
    displayName: "flynas",
    shortMark: "flynas",
    primaryRgb: [0, 169, 157],
    accentRgb: [92, 45, 145],
    aliases: ["flynas", "fly nas", "xy"],
  },
  {
    code: "F3",
    displayName: "flyadeal",
    shortMark: "flyadeal",
    primaryRgb: [92, 36, 131],
    accentRgb: [164, 196, 0],
    aliases: ["flyadeal", "fly adeal", "f3"],
  },
  {
    code: "GF",
    displayName: "GULF AIR",
    shortMark: "GULF AIR",
    primaryRgb: [15, 32, 67],
    accentRgb: [176, 141, 87],
    aliases: ["gulf air", "gulfair", "gf"],
  },
  {
    code: "WY",
    displayName: "OMAN AIR",
    shortMark: "OMAN AIR",
    primaryRgb: [0, 136, 145],
    accentRgb: [179, 144, 67],
    aliases: ["oman air", "omanair", "wy"],
  },
  {
    code: "KU",
    displayName: "KUWAIT",
    shortMark: "KUWAIT",
    subtitle: "Kuwait Airways",
    primaryRgb: [0, 75, 147],
    accentRgb: [0, 159, 227],
    aliases: ["kuwait", "kuwait airways", "ku"],
  },
  {
    code: "J9",
    displayName: "Jazeera",
    shortMark: "Jazeera",
    subtitle: "Jazeera Airways",
    primaryRgb: [0, 94, 184],
    accentRgb: [214, 0, 110],
    aliases: ["jazeera", "jazeera airways", "j9"],
  },
  {
    code: "OV",
    displayName: "SalamAir",
    shortMark: "SalamAir",
    primaryRgb: [0, 138, 133],
    accentRgb: [100, 175, 32],
    aliases: ["salamair", "salam air", "ov"],
  },
  {
    code: "BA",
    displayName: "British Airways",
    shortMark: "BRITISH",
    subtitle: "British Airways",
    primaryRgb: [7, 90, 170],
    accentRgb: [235, 34, 38],
    aliases: ["british", "british airways", "ba"],
  },
  {
    code: "VS",
    displayName: "Virgin Atlantic",
    shortMark: "Virgin",
    subtitle: "Atlantic",
    primaryRgb: [225, 10, 45],
    accentRgb: [110, 20, 60],
    aliases: ["virgin", "virgin atlantic", "vs"],
  },
  {
    code: "LH",
    displayName: "Lufthansa",
    shortMark: "Lufthansa",
    primaryRgb: [5, 22, 77],
    accentRgb: [240, 168, 0],
    aliases: ["lufthansa", "lh"],
  },
  {
    code: "KL",
    displayName: "KLM",
    shortMark: "KLM",
    subtitle: "Royal Dutch Airlines",
    primaryRgb: [0, 145, 205],
    accentRgb: [0, 49, 69],
    aliases: ["klm", "royal dutch", "kl"],
  },
  {
    code: "AF",
    displayName: "AIR FRANCE",
    shortMark: "AIR FRANCE",
    primaryRgb: [0, 33, 87],
    accentRgb: [237, 41, 57],
    aliases: ["air france", "airfrance", "af"],
  },
  {
    code: "SQ",
    displayName: "Singapore",
    shortMark: "SINGAPORE",
    subtitle: "Singapore Airlines",
    primaryRgb: [29, 39, 88],
    accentRgb: [230, 165, 24],
    aliases: ["singapore", "singapore airlines", "sq"],
  },
  {
    code: "TG",
    displayName: "THAI",
    shortMark: "THAI",
    subtitle: "Thai Airways",
    primaryRgb: [75, 29, 112],
    accentRgb: [227, 175, 42],
    aliases: ["thai", "thai airways", "tg"],
  },
  {
    code: "MH",
    displayName: "Malaysia",
    shortMark: "malaysia",
    subtitle: "Malaysia Airlines",
    primaryRgb: [0, 68, 136],
    accentRgb: [210, 35, 42],
    aliases: ["malaysia", "malaysia airlines", "mh"],
  },
  {
    code: "UL",
    displayName: "SriLankan",
    shortMark: "SriLankan",
    subtitle: "Airlines",
    primaryRgb: [0, 75, 135],
    accentRgb: [224, 155, 0],
    aliases: ["srilankan", "sri lankan", "ul"],
  },
  {
    code: "CX",
    displayName: "Cathay Pacific",
    shortMark: "CATHAY",
    subtitle: "Cathay Pacific",
    primaryRgb: [0, 101, 100],
    accentRgb: [71, 85, 105],
    aliases: ["cathay", "cathay pacific", "cx"],
  },
];

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractFlightPrefixCode(flightNo?: string | null): string {
  const cleaned = (flightNo || "").trim().toUpperCase();
  const match = cleaned.match(/^([A-Z0-9]{2})\s*-?\s*\d/);
  return match ? match[1] : "";
}

/**
 * Matches an airline name or flight number prefix (e.g. "PIA", "PK-304",
 * "Emirates", "9P") against AIRLINE_LOGO_MAP without false substring hits.
 */
export function resolveAirlineBrand(
  airlineName?: string | null,
  flightNo?: string | null
): AirlineBrand | null {
  const rawName = (airlineName || "").trim().toLowerCase();
  const flightPrefix = extractFlightPrefixCode(flightNo);

  if (flightPrefix) {
    const byFlight = AIRLINE_LOGO_MAP.find((b) => b.code === flightPrefix);
    if (byFlight) return byFlight;
  }

  if (!rawName) return null;

  // 1. Exact IATA code or standalone token match (e.g. "PK", "EK 601", "PIA (PK)")
  const tokens = rawName
    .split(/[\s\-_/().,]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const brand of AIRLINE_LOGO_MAP) {
    const codeLower = brand.code.toLowerCase();
    if (rawName === codeLower || tokens.includes(codeLower)) {
      return brand;
    }
    const prefixFromName = extractFlightPrefixCode(rawName);
    if (prefixFromName && prefixFromName === brand.code) {
      return brand;
    }
  }

  // 2. Longer name/alias word-boundary match (prevents e.g. "caspian" matching "pia")
  for (const brand of AIRLINE_LOGO_MAP) {
    if (
      brand.aliases.some((alias) => {
        if (alias.length <= 2) return tokens.includes(alias);
        const pattern = new RegExp(
          `(?:^|[^a-z0-9])${escapeRegExp(alias)}(?:$|[^a-z0-9])`
        );
        return pattern.test(rawName);
      })
    ) {
      return brand;
    }
  }

  return null;
}

/**
 * Returns ONLY the airline name text for headers — never draws an airline logo box or badge.
 */
export function resolveAirlineDisplayName(
  airlineName?: string | null,
  flightNo?: string | null
): string {
  const trimmedName = (airlineName || "").trim();
  if (trimmedName) {
    return trimmedName;
  }
  const byFlight = resolveAirlineBrand(null, flightNo);
  return byFlight ? byFlight.displayName : "";
}

/**
 * Draws ONLY clean right-aligned bold airline name text on Air Ticket headers.
 * Never draws any airline logo card, badge, or emblem. Safely renders nothing if missing.
 */
export function drawAirlineHeaderLogo(
  doc: jsPDF,
  airlineName?: string | null,
  flightNo?: string | null,
  rightX = 196,
  topY = 6,
  maxW = 48,
  _maxH = 17
): void {
  const displayName = resolveAirlineDisplayName(airlineName, flightNo);
  if (!displayName) {
    return;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  const lines = doc.splitTextToSize(displayName.toUpperCase(), maxW).slice(0, 2);
  const startY = topY + (lines.length > 1 ? 5.5 : 8.5);
  doc.text(lines, rightX, startY, { align: "right" });
}
