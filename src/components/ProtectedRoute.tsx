import { ReactNode, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useQueryClient } from "@tanstack/react-query";
import { preloadEssentialData } from "@/lib/dataPreloader";
import { isMasterAdminEmail } from "@/lib/adminAuth";

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { data: subscription } = useSubscription();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user && !loading) {
      preloadEssentialData(queryClient);
    }
  }, [user, loading, queryClient]);

  // Clean loading UI instead of empty white screen
  if (loading) {
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

  // Master Admin (usmn4u@gmail.com) has unconditional Lifetime Access
  const isMaster = isMasterAdminEmail(user?.email);

  // Redirect only when subscription is confirmed expired for non-admin accounts
  if (!isMaster && subscription && subscription.isExpired) {
    return <Navigate to="/subscription-expired" replace />;
  }

  return <>{children}</>;
};

