/* global __APP_VERSION__, __APP_BUILD_ID__ */
// Version control and update management
const CURRENT_VERSION =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "3.7.0";
const CURRENT_BUILD_ID =
  typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "dev";

const VERSION_KEY = "travelpro_app_version";
const CHANGELOG_KEY = "travelpro_changelog";
const LAST_CHECK_KEY = "travelpro_last_version_check";

export interface VersionCheckResult {
  hasUpdate: boolean;
  latestVersion: string;
  latestBuildId?: string;
  currentVersion: string;
  currentBuildId?: string;
  builtAt?: string;
  checkFailed?: boolean;
}

export interface RemoteVersionManifest {
  version?: string;
  buildId?: string;
  builtAt?: string;
}

export const VERSION_CHANGELOG = {
  "3.7.0": [
    "Unified shared navigation config across desktop sidebar, mobile bottom bar, and mobile More menu",
    "Updated mobile More menu routes: Vendors & Airlines opens Parties (Vendors), Financial Reports opens Reports, and Sales & Expenses exposes Invoice, Voucher, Refund, and Expense sub-sections",
    "Removed legacy routes and unused pages for a cleaner, faster app",
    "Improved Check Update button to compare versions and force-reload cleanly",
  ],
  "3.6.0": [
    "Mobile-only Install App button on public pages, header, and mobile navigation for instant home-screen installation",
    "Automatic zero-config build update detection across every deployment without disturbing saved data or login sessions",
    "Full mobile responsiveness optimization across all screens (320px–767px)",
  ],
  "3.5.1": [
    "Refactored Dashboard to ultra-clean, high-contrast SaaS layout (Linear/Stripe standard)",
    "Top KPI Metric Cards: balanced 3-column row (Total Bookings, Clients Pending Payment, Vendors Pending Payment) with aggregated B2C + B2B totals",
    "Quick Action Buttons: 2-row x 3-column responsive grid with new Umrah Calculator trigger",
    "New full-width Notifications Center with unread count badge, category icons, timestamps, and direct operational actions",
  ],
  "3.5.0": [
    "Complete Settings Redesign: clean zero-scroll layout with 5 prominent top tabs (Account, Branding, Email Integration, Storage & Backup, User Manual)",
    "Global removal of WhatsApp Integration, Meta credentials, and WhatsApp Business Number fields",
    "Relocated Theme Changer to Global Top Header Bar alongside Notification Bell and Online indicator",
    "Automatic responsive views globally: defaults to desktop layout on desktop screens and mobile on phones",
    "Template auto-population: Agency Name, Phone, and Email automatically populated from signup profile across Invoice, Booking, and Reminder templates",
    "Unified Email Integration: clean sub-tabs for Email Configuration, Email Logs History, and Email Cleanup",
  ],
  "3.4.1": [
    "Compact single-bar control header for Umrah Package Calculator",
    "Streamlined Passengers and Service Charges row with Profit field removed",
    "Root-cause fix for multi-hotel combination bug (all Makkah & Madinah hotels stay visible and counted in totals)",
    "Direct 1-click Quotation creation from calculator into quotation form",
  ],
  "3.4.0": [
    "Action-Driven Dashboard: 5-button Quick Actions bar for instant bookings, payments, quotes, queries, and expenses",
    "Financials Above-the-Fold: Unified B2C + B2B aggregations with Net Profit KPI card and clean 3-column financial & payables grid",
    "Conditional Actionable Alerts: Smart slim banner for urgent items, hiding automatically when clear of alerts",
    "Consolidated Navbar Notification Bell: Real-time tabs for Departures (Tickets & Umrah), Name Updates, Active Queries, and Tasks",
    "Interactive Empty States: Direct inline \"+ Receive Payment\" and \"+ Pay Vendor\" buttons inside alerts and payables widgets",
  ],
  "3.3.1": [
    "Sidebar-proof Umrah Calculator redesign using container queries",
    "Fintech-style unified layout with soft tints and tabular figures",
    "Shared hotel grid aligning Makkah & Madinah columns with header",
    "Equal 5-card layout for tickets, visas, transport, ziyarat & food",
    "Streamlined summary strip with prominent Final Total",
  ],
  "3.3.0": [
    "Redesigned Queries & Quotes Hub with primary Quotations tab and segmented pill switcher",
    "Full-page keyboard-first New Quotation & Query creation forms with shortcuts (Tab, Ctrl+Enter, Esc)",
    "Manual free-text quotation numbering with per-agency uniqueness validation and last-used helper",
    "Integrated Date Preset filter (Today, Yesterday, Week, Month, Year, Custom Range) across lists and stats",
    "Instant Umrah Calculator package import and quotation-to-booking conversion",
  ],
  "3.2.1": [
    "Unified single-screen Umrah Package Calculator layout",
    "Keyboard-first data entry and shortcuts (Ctrl+S, Ctrl+Enter, Ctrl+Shift+R)",
    "Enhanced mobile app calculator layout with compact cost tiles",
    "Reset confirmation protection and high-contrast action buttons",
  ],
  "3.2.0": [
    "Professional update system with iOS PWA support",
    "Auto-sync and pull-to-refresh gestures with haptic feedback",
    "Enhanced mobile experience across all devices",
    "Manual update controls in Settings",
    "Improved performance and background data preloading",
  ],
  "3.1.1": [
    "Improved mobile UI with better spacing",
    "Enhanced calculator layout for mobile",
    "Fixed Settings/Storage button accessibility",
    "Added automatic version checking",
    "Improved safe area handling for all devices",
  ],
  "3.1.0": [
    "Added auto backup export feature",
    "Added error logging system",
    "Enhanced offline mode with conflict resolution",
    "Added storage quota management",
    "Improved session management",
    "Added WhatsApp sharing",
    "Fixed offline sync issues",
  ],
  "3.0.0": [
    "Added PWA support",
    "Added offline mode",
    "Added Google Drive backup option",
    "Added admin panel",
    "Added vendor management",
  ],
};

/**
 * Compare dotted semantic versions (e.g. "3.6.0" > "3.5.1").
 */
export function isNewerVersion(version1: string, version2: string): boolean {
  const v1Parts = version1.split(".").map((n) => parseInt(n, 10) || 0);
  const v2Parts = version2.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(v1Parts.length, v2Parts.length, 3);

  for (let i = 0; i < len; i++) {
    const a = v1Parts[i] ?? 0;
    const b = v2Parts[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }

  return false;
}

/**
 * Determine if the remote version manifest differs from the active production build.
 */
export function compareUpdateManifest(
  current: { version: string; buildId: string },
  remote: RemoteVersionManifest | null | undefined,
  options?: { manual?: boolean }
): boolean {
  if (!remote || typeof remote !== "object") return false;
  const isManual = Boolean(options?.manual);
  if (!isManual && (!current.buildId || current.buildId === "dev")) return false;

  const remoteBuildId =
    typeof remote.buildId === "string" ? remote.buildId.trim() : "";
  const remoteVersion =
    typeof remote.version === "string" ? remote.version.trim() : "";

  if (!remoteBuildId && !remoteVersion) return false;

  if (remoteVersion && isNewerVersion(remoteVersion, current.version)) {
    return true;
  }

  if (
    remoteBuildId &&
    remoteBuildId !== "dev" &&
    current.buildId &&
    current.buildId !== "dev" &&
    remoteBuildId !== current.buildId
  ) {
    return true;
  }

  if (isManual && remoteVersion && remoteVersion !== current.version) {
    return true;
  }

  return false;
}

function getSafeLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export class VersionManager {
  private static instance: VersionManager;

  private constructor() {
    this.checkVersion();
  }

  static getInstance(): VersionManager {
    if (!VersionManager.instance) {
      VersionManager.instance = new VersionManager();
    }
    return VersionManager.instance;
  }

  getCurrentVersion(): string {
    return CURRENT_VERSION;
  }

  getCurrentBuildId(): string {
    return CURRENT_BUILD_ID;
  }

  getStoredVersion(): string | null {
    return getSafeLocalStorage()?.getItem(VERSION_KEY) ?? null;
  }

  getChangelog(): typeof VERSION_CHANGELOG {
    return VERSION_CHANGELOG;
  }

  // Check if app version changed locally (non-destructive)
  checkVersion(): boolean {
    const storage = getSafeLocalStorage();
    if (!storage) return false;
    const storedVersion = this.getStoredVersion();

    if (!storedVersion || storedVersion !== CURRENT_VERSION) {
      this.updateVersion();
      return true;
    }

    return false;
  }

  private updateVersion() {
    const storage = getSafeLocalStorage();
    if (!storage) return;
    storage.setItem(VERSION_KEY, CURRENT_VERSION);
    storage.setItem(CHANGELOG_KEY, JSON.stringify(VERSION_CHANGELOG));
  }

  shouldShowUpdateNotification(): boolean {
    const storedVersion = this.getStoredVersion();
    return storedVersion !== null && storedVersion !== CURRENT_VERSION;
  }

  isNewerVersion(version1: string, version2: string): boolean {
    return isNewerVersion(version1, version2);
  }

  private static edgeApiFailed = false;

  private static isCapacitorNative(): boolean {
    if (typeof window === "undefined") return false;
    const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  }

  private async checkEdgeVersion(
    currentVersion: string,
    currentBuildId: string,
    options?: { manual?: boolean }
  ): Promise<VersionCheckResult> {
    const isManual = Boolean(options?.manual);
    if (!isManual && VersionManager.edgeApiFailed) {
      return {
        hasUpdate: false,
        latestVersion: currentVersion,
        latestBuildId: currentBuildId,
        currentVersion,
        currentBuildId,
        checkFailed: true,
      };
    }

    try {
      const env = (import.meta as { env?: Record<string, string | undefined> }).env;
      const supabaseUrl = env?.VITE_SUPABASE_URL;
      const publishableKey = env?.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !publishableKey) {
        return {
          hasUpdate: false,
          latestVersion: currentVersion,
          latestBuildId: currentBuildId,
          currentVersion,
          currentBuildId,
          checkFailed: true,
        };
      }

      const url = `${supabaseUrl}/functions/v1/app-version?t=${Date.now()}`;
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          apikey: publishableKey,
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (!response.ok) throw new Error("Version check failed");

      const data = await response.json();
      const latestVersion =
        typeof data?.version === "string" && data.version
          ? data.version.trim()
          : currentVersion;
      const hasUpdate =
        isNewerVersion(latestVersion, currentVersion) ||
        (isManual && latestVersion !== currentVersion);

      VersionManager.edgeApiFailed = false;
      getSafeLocalStorage()?.setItem(LAST_CHECK_KEY, new Date().toISOString());

      const result: VersionCheckResult = {
        hasUpdate,
        latestVersion,
        latestBuildId: latestVersion,
        currentVersion,
        currentBuildId,
        checkFailed: false,
      };

      if (hasUpdate && !isManual && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("tams:update-available", { detail: result })
        );
      }

      return result;
    } catch {
      VersionManager.edgeApiFailed = true;
      return {
        hasUpdate: false,
        latestVersion: currentVersion,
        latestBuildId: currentBuildId,
        currentVersion,
        currentBuildId,
        checkFailed: true,
      };
    }
  }

  // Check version against deployed /version.json manifest first, with edge fallback
  async checkVersionAPI(options?: { manual?: boolean }): Promise<VersionCheckResult> {
    const currentVersion = this.getCurrentVersion();
    const currentBuildId = this.getCurrentBuildId();
    const isManual = Boolean(options?.manual);

    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (response.ok) {
        const data = (await response.json()) as RemoteVersionManifest;
        const latestVersion =
          typeof data?.version === "string" && data.version
            ? data.version.trim()
            : currentVersion;
        const latestBuildId =
          typeof data?.buildId === "string" && data.buildId
            ? data.buildId.trim()
            : latestVersion;
        const hasUpdate = compareUpdateManifest(
          { version: currentVersion, buildId: currentBuildId },
          data,
          options
        );

        getSafeLocalStorage()?.setItem(LAST_CHECK_KEY, new Date().toISOString());

        const result: VersionCheckResult = {
          hasUpdate,
          latestVersion,
          latestBuildId,
          currentVersion,
          currentBuildId,
          builtAt: typeof data?.builtAt === "string" ? data.builtAt : undefined,
          checkFailed: false,
        };

        if (!hasUpdate && isManual && VersionManager.isCapacitorNative()) {
          const edgeResult = await this.checkEdgeVersion(
            currentVersion,
            currentBuildId,
            options
          );
          if (!edgeResult.checkFailed) {
            return edgeResult;
          }
        }

        if (hasUpdate && !isManual && typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("tams:update-available", { detail: result })
          );
        }

        return result;
      }
    } catch {
      // Fallback to edge function below
    }

    return this.checkEdgeVersion(currentVersion, currentBuildId, options);
  }

  checkForAppUpdate(options?: { manual?: boolean }): Promise<VersionCheckResult> {
    return this.checkVersionAPI(options);
  }

  getLastCheckTime(): Date | null {
    const timestamp = getSafeLocalStorage()?.getItem(LAST_CHECK_KEY);
    return timestamp ? new Date(timestamp) : null;
  }
}

export const versionManager = VersionManager.getInstance();
