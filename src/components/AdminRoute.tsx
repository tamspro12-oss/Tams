import { ReactNode, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * Route protection wrapper restricting access strictly to Master Admin (usmn4u@gmail.com).
 * If any other user attempts to access, redirects immediately to /app/dashboard
 * with an unauthorized access warning toast.
 */
export const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const isLoading = authLoading || adminLoading;

  useEffect(() => {
    if (!isLoading && user && !isAdmin) {
      toast.error("Unauthorized: Full administrator privileges are restricted exclusively to usmn4u@gmail.com", {
        id: "unauthorized-admin-access",
        duration: 4000,
      });
    }
  }, [isLoading, user, isAdmin]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying administrator credentials...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
};

