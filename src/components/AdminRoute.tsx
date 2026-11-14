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
 * Route protection wrapper restricting /admin and /app/admin routes strictly
 * to authenticated users holding `super_admin` in `public.user_roles`.
 */
export const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const isLoading = authLoading || adminLoading;

  useEffect(() => {
    if (!isLoading && user && !isAdmin) {
      toast.error("Unauthorized: Administrator access requires super_admin privileges", {
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
