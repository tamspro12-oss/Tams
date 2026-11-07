import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Robust error boundary for public marketing pages.
 * Catches any client-side rendering error, logs it to console with full context,
 * and presents an elegant fallback UI consistent with the quiet luxury design.
 */
export class PublicErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log real errors to console as strictly required
    console.error(
      `[TAMS Pro Public Page Error - ${this.props.pageName || "Marketing Route"}]:`,
      error,
      errorInfo
    );
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4 py-16 bg-background">
          <div className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md shadow-xl">
            <div className="w-14 h-14 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Unable to display {this.props.pageName || "this section"}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                An unexpected interface issue occurred. Our monitoring team has been notified.
                Please refresh the page or return to the homepage.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-muted/60 rounded-lg text-xs font-mono text-left overflow-x-auto max-h-24 text-destructive border border-destructive/20">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                variant="outline"
                onClick={this.handleReload}
                className="gap-2 h-10 text-xs font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Page
              </Button>
              <Button
                onClick={this.handleGoHome}
                className="gap-2 h-10 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Home className="w-3.5 h-3.5" />
                Return to Homepage
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PublicErrorBoundary;
