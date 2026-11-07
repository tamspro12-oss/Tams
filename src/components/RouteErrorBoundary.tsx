import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  children: ReactNode;
  routeName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[Route Error in ${this.props.routeName || "route"}]:`, error, errorInfo);
  }

  private handleGoToDashboard = () => {
    window.location.href = "/app/dashboard";
  };

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
    } catch {
      // Ignore
    }
    window.location.href = "/app/dashboard";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-4 bg-card p-6 sm:p-8 rounded-xl border shadow-sm">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Unable to load {this.props.routeName || "this section"}
              </h2>
              <p className="text-xs text-muted-foreground">
                An unexpected error occurred while rendering this page. You can safely return to your dashboard or reload.
              </p>
            </div>
            {this.state.error && (
              <div className="p-2.5 bg-muted/60 rounded-md text-xs font-mono text-left overflow-auto max-h-24 text-destructive border">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <Button onClick={this.handleGoToDashboard} className="gap-2 h-9 text-xs font-semibold">
                <Home className="w-3.5 h-3.5" />
                Go to Dashboard
              </Button>
              <Button variant="outline" onClick={this.handleReload} className="gap-2 h-9 text-xs">
                <RefreshCw className="w-3.5 h-3.5" />
                Reload
              </Button>
              <Button variant="ghost" onClick={this.handleHardReset} className="h-9 text-xs">
                Clear Cache
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;
