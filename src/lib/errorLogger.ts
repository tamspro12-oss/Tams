// Anonymous error logging system
interface ErrorLog {
  timestamp: string;
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  version: string;
  storageType: string;
}

const ERROR_LOG_KEY = 'travelpro_error_logs';
const MAX_LOGS = 50;

export class ErrorLogger {
  private static instance: ErrorLogger;

  private constructor() {
    this.setupGlobalErrorHandler();
  }

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  private setupGlobalErrorHandler() {
    window.addEventListener('error', (event) => {
      this.logError({
        message: event.message,
        stack: event.error?.stack,
        url: event.filename || window.location.href,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        url: window.location.href,
      });
    });
  }

  logError(error: {
    message: string;
    stack?: string;
    url: string;
  }) {
    try {
      const logs = this.getErrorLogs();
      
      const errorLog: ErrorLog = {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        url: error.url,
        userAgent: navigator.userAgent,
        version: localStorage.getItem('travelpro_app_version') || 'unknown',
        storageType: localStorage.getItem('travelpro_storage_config') || 'unknown',
      };

      logs.push(errorLog);

      // Keep only last MAX_LOGS entries
      if (logs.length > MAX_LOGS) {
        logs.splice(0, logs.length - MAX_LOGS);
      }

      localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to log error:', e);
    }
  }

  getErrorLogs(): ErrorLog[] {
    try {
      const stored = localStorage.getItem(ERROR_LOG_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  clearErrorLogs() {
    localStorage.removeItem(ERROR_LOG_KEY);
  }

  exportErrorLogs(): string {
    const logs = this.getErrorLogs();
    return JSON.stringify(logs, null, 2);
  }

  downloadErrorLogs() {
    const logs = this.exportErrorLogs();
    const blob = new Blob([logs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travelpro-errors-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const errorLogger = ErrorLogger.getInstance();
