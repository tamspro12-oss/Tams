export const KARACHI_TIMEZONE = "Asia/Karachi";

/**
 * Returns YYYY-MM-DD in Asia/Karachi timezone (UTC+5).
 * Ensures "Today" and "This Month" boundaries stay consistent across client & SQL karachi_today().
 */
export function getKarachiYmd(input: Date | string = new Date()): string {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : "";
    }
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: KARACHI_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(parsed);
  }

  if (Number.isNaN(input.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KARACHI_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(input);
}

/**
 * Returns a Date representing Asia/Karachi's current calendar date at 12:00 local time
 * (safe for date-fns startOfDay/startOfMonth/endOfMonth regardless of browser OS timezone).
 */
export function getKarachiTodayNoon(baseDate: Date = new Date()): Date {
  const ymd = getKarachiYmd(baseDate);
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return baseDate;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

