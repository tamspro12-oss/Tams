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
  baseDate: Date = new Date()
): { start: Date; end: Date } | null {
  if (preset === "all") return null;

  switch (preset) {
    case "today":
      return { start: startOfDay(baseDate), end: endOfDay(baseDate) };
    case "yesterday": {
      const y = subDays(baseDate, 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "this_week":
      return {
        start: startOfWeek(baseDate, { weekStartsOn: 1 }),
        end: endOfWeek(baseDate, { weekStartsOn: 1 }),
      };
    case "this_month":
      return { start: startOfMonth(baseDate), end: endOfMonth(baseDate) };
    case "last_month": {
      const lm = subMonths(baseDate, 1);
      return { start: startOfMonth(lm), end: endOfMonth(lm) };
    }
    case "this_year":
      return { start: startOfYear(baseDate), end: endOfYear(baseDate) };
    case "custom": {
      if (!customFrom) return null;
      const s = startOfDay(parseISO(customFrom));
      const e = customTo ? endOfDay(parseISO(customTo)) : endOfDay(s);
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
    // If it starts with YYYY-MM-DD (e.g. "2026-11-12" or "2026-11-12T..."), parse year, month, day explicitly
    const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      // Set to noon local time to completely prevent timezone boundary shifts
      const localNoon = new Date(year, month, day, 12, 0, 0);
      if (isValid(localNoon)) return localNoon;
    }

    const parsed = parseISO(rawDate);
    if (isValid(parsed)) return parsed;

    const fallback = new Date(rawDate);
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
