import { ReactNode, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useQueryClient } from "@tanstack/react-query";
import { preloadEssentialData } from "@/lib/dataPreloader";

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

  // Only block on auth resolution — never on subscription query
  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect only when subscription is confirmed expired
  if (subscription && subscription.isExpired) {
    return <Navigate to="/subscription-expired" replace />;
  }

  return <>{children}</>;
};

