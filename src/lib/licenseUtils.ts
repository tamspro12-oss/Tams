export const LICENSE_GRACE_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Mirrors server-side `agency_license_ok()` logic:
 * - Missing / NULL expiry never blocks
 * - Active until expiry + LICENSE_GRACE_DAYS (3 days)
 */
export function isLicenseExpiredWithGrace(
  licenseExpiry: string | Date | null | undefined,
  now: Date = new Date(),
  graceDays: number = LICENSE_GRACE_DAYS
): boolean {
  if (!licenseExpiry) return false;
  const expiryDate =
    licenseExpiry instanceof Date ? licenseExpiry : new Date(licenseExpiry);
  if (Number.isNaN(expiryDate.getTime())) return false;

  const graceCutoffMs = expiryDate.getTime() + graceDays * MS_PER_DAY;
  return now.getTime() > graceCutoffMs;
}

export function getDaysRemaining(
  licenseExpiry: string | Date | null | undefined,
  now: Date = new Date()
): number {
  if (!licenseExpiry) return 0;
  const expiryDate =
    licenseExpiry instanceof Date ? licenseExpiry : new Date(licenseExpiry);
  if (Number.isNaN(expiryDate.getTime())) return 0;

  return Math.ceil((expiryDate.getTime() - now.getTime()) / MS_PER_DAY);
}
