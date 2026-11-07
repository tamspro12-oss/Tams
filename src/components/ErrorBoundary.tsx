import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[TAMS ErrorBoundary caught error]:", error, errorInfo);
    // Dismiss splash screen if it's still in the DOM
    const splash = document.getElementById("tams-splash");
    if (splash) splash.remove();
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleHardReset = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }
    } catch {
      // Ignore storage/cache clear errors
    }
    window.location.href = "/login";
  };

  private handleGoToDashboard = () => {
    window.location.href = "/app/dashboard";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-6 bg-card p-8 rounded-xl border shadow-lg">
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">
                The application encountered an unexpected error while loading.
              </p>
            </div>
            {this.state.error && (
              <div className="p-3 bg-muted rounded-md text-xs font-mono text-left overflow-auto max-h-32 text-destructive">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={this.handleGoToDashboard} className="gap-2">
                Go to Dashboard
              </Button>
              <Button onClick={this.handleReload} variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </Button>
              <Button variant="ghost" onClick={this.handleHardReset}>
                Clear Cache & Restart
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

