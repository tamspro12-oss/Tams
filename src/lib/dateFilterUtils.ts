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

export function isDateWithinPreset(
  rawDate: string | Date | null | undefined,
  preset: DatePresetKey,
  customFrom?: string,
  customTo?: string
): boolean {
  if (preset === "all") return true;
  if (!rawDate) return false;

  const date = typeof rawDate === "string" ? parseISO(rawDate) : rawDate;
  if (!isValid(date)) return false;

  const range = getDateRangeForPreset(preset, customFrom, customTo);
  if (!range) return true;

  return isWithinInterval(date, range);
}
