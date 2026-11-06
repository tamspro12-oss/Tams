// Version control and update management
const CURRENT_VERSION = '3.4.1';
const VERSION_KEY = 'travelpro_app_version';
const CHANGELOG_KEY = 'travelpro_changelog';
const LAST_CHECK_KEY = 'travelpro_last_version_check';

export const VERSION_CHANGELOG = {
  '3.4.1': [
    'Compact single-bar control header for Umrah Package Calculator',
    'Streamlined Passengers and Service Charges row with Profit field removed',
    'Root-cause fix for multi-hotel combination bug (all Makkah & Madinah hotels stay visible and counted in totals)',
    'Direct 1-click Quotation creation from calculator into quotation form'
  ],
  '3.4.0': [
    'Action-Driven Dashboard: 5-button Quick Actions bar for instant bookings, payments, quotes, queries, and expenses',
    'Financials Above-the-Fold: Unified B2C + B2B aggregations with Net Profit KPI card and clean 3-column financial & payables grid',
    'Conditional Actionable Alerts: Smart slim banner for urgent items, hiding automatically when clear of alerts',
    'Consolidated Navbar Notification Bell: Real-time tabs for Departures (Tickets & Umrah), Name Updates, Active Queries, and Tasks',
    'Interactive Empty States: Direct inline "+ Receive Payment" and "+ Pay Vendor" buttons inside alerts and payables widgets'
  ],
  '3.3.1': [
    'Sidebar-proof Umrah Calculator redesign using container queries',
    'Fintech-style unified layout with soft tints and tabular figures',
    'Shared hotel grid aligning Makkah & Madinah columns with header',
    'Equal 5-card layout for tickets, visas, transport, ziyarat & food',
    'Streamlined summary strip with prominent Final Total'
  ],
  '3.3.0': [
    'Redesigned Queries & Quotes Hub with primary Quotations tab and segmented pill switcher',
    'Full-page keyboard-first New Quotation & Query creation forms with shortcuts (Tab, Ctrl+Enter, Esc)',
    'Manual free-text quotation numbering with per-agency uniqueness validation and last-used helper',
    'Integrated Date Preset filter (Today, Yesterday, Week, Month, Year, Custom Range) across lists and stats',
    'Instant Umrah Calculator package import and seamless quotation-to-booking conversion'
  ],
  '3.2.1': [
    'Unified single-screen Umrah Package Calculator layout',
    'Keyboard-first data entry and shortcuts (Ctrl+S, Ctrl+Enter, Ctrl+Shift+R)',
    'Enhanced mobile app calculator layout with compact cost tiles',
    'Reset confirmation protection and high-contrast action buttons'
  ],
  '3.2.0': [
    'Professional update system with iOS PWA support',
    'Auto-sync and pull-to-refresh gestures with haptic feedback',
    'Enhanced mobile experience across all devices',
    'Manual update controls in Settings',
    'Improved performance and background data preloading'
  ],
  '3.1.1': [
    'Improved mobile UI with better spacing',
    'Enhanced calculator layout for mobile',
    'Fixed Settings/Storage button accessibility',
    'Added automatic version checking',
    'Improved safe area handling for all devices'
  ],
  '3.1.0': [
    'Added auto backup export feature',
    'Added error logging system',
    'Enhanced offline mode with conflict resolution',
    'Added storage quota management',
    'Improved session management',
    'Added WhatsApp sharing',
    'Fixed offline sync issues'
  ],
  '3.0.0': [
    'Added PWA support',
    'Added offline mode',
    'Added Google Drive backup option',
    'Added admin panel',
    'Added vendor management'
  ]
};

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

  getStoredVersion(): string | null {
    return localStorage.getItem(VERSION_KEY);
  }

  getChangelog(): typeof VERSION_CHANGELOG {
    return VERSION_CHANGELOG;
  }

  // Check if app was updated
  checkVersion(): boolean {
    const storedVersion = this.getStoredVersion();
    
    if (!storedVersion || storedVersion !== CURRENT_VERSION) {
      this.updateVersion();
      return true; // New version detected
    }
    
    return false; // Same version
  }

  private updateVersion() {
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    localStorage.setItem(CHANGELOG_KEY, JSON.stringify(VERSION_CHANGELOG));
  }

  // Show update notification
  shouldShowUpdateNotification(): boolean {
    const storedVersion = this.getStoredVersion();
    return storedVersion !== null && storedVersion !== CURRENT_VERSION;
  }

  // Get version comparison
  isNewerVersion(version1: string, version2: string): boolean {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      if (v1Parts[i] > v2Parts[i]) return true;
      if (v1Parts[i] < v2Parts[i]) return false;
    }
    
    return false;
  }

  // Check version against backend API (session-scoped circuit breaker)
  private static apiFailed = false;
  async checkVersionAPI(): Promise<{ hasUpdate: boolean; latestVersion: string; currentVersion: string }> {
    const currentVersion = this.getCurrentVersion();
    if (VersionManager.apiFailed) {
      return { hasUpdate: false, latestVersion: currentVersion, currentVersion };
    }
    try {
      // Cache-busting via query string instead of Cache-Control request header,
      // which would trigger a CORS preflight the edge function doesn't allow.
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app-version?t=${Date.now()}`;
      const response = await fetch(url, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        }
      });

      if (!response.ok) throw new Error('Version check failed');

      const data = await response.json();
      const hasUpdate = this.isNewerVersion(data.version, currentVersion);
      localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());

      return { hasUpdate, latestVersion: data.version, currentVersion };
    } catch (error) {
      VersionManager.apiFailed = true;
      return { hasUpdate: false, latestVersion: currentVersion, currentVersion };
    }
  }

  getLastCheckTime(): Date | null {
    const timestamp = localStorage.getItem(LAST_CHECK_KEY);
    return timestamp ? new Date(timestamp) : null;
  }
}

export const versionManager = VersionManager.getInstance();
