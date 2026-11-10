import { clearAllAgencyDataCache } from "./cacheManager";

// Session management with auto-timeout and single-device enforcement
const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour
const WARNING_TIME = 10 * 60 * 1000; // 10 minutes before timeout
const SESSION_KEY = 'travelpro_session';
const DEVICE_ID_KEY = 'travelpro_device_id';

export class SessionManager {
  private static instance: SessionManager;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private warningId: ReturnType<typeof setTimeout> | null = null;
  private onWarning: (() => void) | null = null;
  private onTimeout: (() => void) | null = null;
  private lastActivity: number = Date.now();
  private activityHandler: () => void;

  private constructor() {
    this.activityHandler = () => this.updateActivity();
    this.setupActivityListeners();
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // Generate unique device ID
  getDeviceId(): string {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  }

  // Start session tracking
  startSession(userId: string) {
    this.lastActivity = Date.now();
    const session = {
      userId,
      deviceId: this.getDeviceId(),
      startTime: Date.now(),
      lastActivity: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.resetTimeout();
  }

  // Update last activity time
  private updateActivity() {
    this.lastActivity = Date.now();
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      session.lastActivity = Date.now();
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    this.resetTimeout();
  }

  // Setup activity listeners
  private setupActivityListeners() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, this.activityHandler, true);
    });
  }

  // Clean up activity listeners to prevent memory leak
  private cleanupActivityListeners() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.removeEventListener(event, this.activityHandler, true);
    });
  }

  // Reset timeout timers
  private resetTimeout() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.warningId) clearTimeout(this.warningId);

    // Set warning timeout
    this.warningId = setTimeout(() => {
      if (this.onWarning) this.onWarning();
    }, SESSION_TIMEOUT - WARNING_TIME);

    // Set session timeout
    this.timeoutId = setTimeout(() => {
      if (this.onTimeout) this.onTimeout();
    }, SESSION_TIMEOUT);
  }

  // Set callbacks
  setOnWarning(callback: () => void) {
    this.onWarning = callback;
  }

  setOnTimeout(callback: () => void) {
    this.onTimeout = callback;
  }

  // End session and clear data
  endSession() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.warningId) clearTimeout(this.warningId);
    this.cleanupActivityListeners();
    localStorage.removeItem(SESSION_KEY);
    clearAllAgencyDataCache();
  }

  // Get current session
  getSession() {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    return sessionStr ? JSON.parse(sessionStr) : null;
  }

  // Check if session is active
  isSessionActive(): boolean {
    const session = this.getSession();
    if (!session) return false;
    
    const elapsed = Date.now() - session.lastActivity;
    return elapsed < SESSION_TIMEOUT;
  }

  // Get remaining time
  getRemainingTime(): number {
    const session = this.getSession();
    if (!session) return 0;
    
    const elapsed = Date.now() - session.lastActivity;
    return Math.max(0, SESSION_TIMEOUT - elapsed);
  }

  // Manually extend session (called on user activity)
  extendSession(): void {
    this.updateActivity();
  }
}

export const sessionManager = SessionManager.getInstance();
