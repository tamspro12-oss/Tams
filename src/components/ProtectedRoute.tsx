import { ReactNode, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useQueryClient } from "@tanstack/react-query";
import { preloadEssentialData } from "@/lib/dataPreloader";

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { data: subscription } = useSubscription();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user && !loading) {
      preloadEssentialData(queryClient);
    }
  }, [user, loading, queryClient]);

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin && subscription && subscription.isExpired) {
    return <Navigate to="/subscription-expired" replace />;
  }

  return <>{children}</>;
};
