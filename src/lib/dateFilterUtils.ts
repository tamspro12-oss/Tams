import {
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  isWithinInterval,
  parseISO,
  isValid,
} from "date-fns";
import { getKarachiTodayNoon, getKarachiYmd } from "@/lib/karachiTime";

export type DatePresetKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom"
  | "all";

export interface DatePresetFilterValue {
  preset: DatePresetKey;
  customFrom?: string;
  customTo?: string;
}

export const DATE_PRESETS: { key: DatePresetKey; label: string }[] = [
  { key: "this_month", label: "This Month" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "last_month", label: "Last Month" },
  { key: "this_year", label: "This Year" },
  { key: "custom", label: "Custom Range" },
  { key: "all", label: "All Time" },
];

export function getDateRangeForPreset(
  preset: DatePresetKey,
  customFrom?: string,
  customTo?: string,
  baseDate: Date = getKarachiTodayNoon()
): { start: Date; end: Date } | null {
  if (preset === "all") return null;

  const anchor = getKarachiTodayNoon(baseDate);

  switch (preset) {
    case "today":
      return { start: startOfDay(anchor), end: endOfDay(anchor) };
    case "yesterday": {
      const y = subDays(anchor, 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "this_week":
      return {
        start: startOfWeek(anchor, { weekStartsOn: 1 }),
        end: endOfWeek(anchor, { weekStartsOn: 1 }),
      };
    case "this_month":
      return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    case "last_month": {
      const lm = subMonths(anchor, 1);
      return { start: startOfMonth(lm), end: endOfMonth(lm) };
    }
    case "this_year":
      return { start: startOfYear(anchor), end: endOfYear(anchor) };
    case "custom": {
      if (!customFrom) return null;
      const s = startOfDay(parseDateSafe(customFrom) || parseISO(customFrom));
      const e = customTo
        ? endOfDay(parseDateSafe(customTo) || parseISO(customTo))
        : endOfDay(s);
      if (!isValid(s) || !isValid(e)) return null;
      return { start: s, end: e };
    }
    default:
      return null;
  }
}

export function parseDateSafe(rawDate: string | Date | null | undefined): Date | null {
  if (!rawDate) return null;
  if (rawDate instanceof Date) return isValid(rawDate) ? rawDate : null;

  if (typeof rawDate === "string") {
    const trimmed = rawDate.trim();
    // Plain YYYY-MM-DD dates stay on their calendar day (no UTC shift)
    const plainMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (plainMatch) {
      const year = parseInt(plainMatch[1], 10);
      const month = parseInt(plainMatch[2], 10) - 1;
      const day = parseInt(plainMatch[3], 10);
      const localNoon = new Date(year, month, day, 12, 0, 0);
      if (isValid(localNoon)) return localNoon;
    }

    // Full ISO timestamps (like Supabase created_at) convert to Asia/Karachi calendar day
    if (trimmed.includes("T") || trimmed.includes(" ")) {
      const karachiYmd = getKarachiYmd(trimmed);
      if (/^\d{4}-\d{2}-\d{2}$/.test(karachiYmd)) {
        const [y, m, d] = karachiYmd.split("-").map((n) => parseInt(n, 10));
        const karachiNoon = new Date(y, m - 1, d, 12, 0, 0);
        if (isValid(karachiNoon)) return karachiNoon;
      }
    }

    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const localNoon = new Date(year, month, day, 12, 0, 0);
      if (isValid(localNoon)) return localNoon;
    }

    const parsed = parseISO(trimmed);
    if (isValid(parsed)) return parsed;

    const fallback = new Date(trimmed);
    if (isValid(fallback)) return fallback;
  }

  return null;
}

export function isDateWithinPreset(
  rawDate: string | Date | null | undefined,
  preset: DatePresetKey,
  customFrom?: string,
  customTo?: string
): boolean {
  if (preset === "all") return true;
  if (!rawDate) return false;

  const date = parseDateSafe(rawDate);
  if (!date) return false;

  const range = getDateRangeForPreset(preset, customFrom, customTo);
  if (!range) return true;

  return isWithinInterval(date, range);
}
