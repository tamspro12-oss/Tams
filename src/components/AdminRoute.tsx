import { ReactNode, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AdminGuardProps {
  children: ReactNode;
}

/**
 * Inner super_admin guard designed for use inside the persistent /app layout
 * so DashboardLayout's sidebar and header remain mounted while role status resolves.
 */
export const AdminOnlyGuard = ({ children }: AdminGuardProps) => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error("Unauthorized: Administrator access requires super_admin privileges", {
        id: "unauthorized-admin-access",
        duration: 4000,
      });
    }
  }, [adminLoading, isAdmin]);

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying administrator credentials...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
};

/**
 * Route protection wrapper restricting standalone admin routes strictly
 * to authenticated users holding `super_admin` in `public.user_roles`.
 */
export const AdminRoute = ({ children }: AdminGuardProps) => {
  return (
    <ProtectedRoute>
      <AdminOnlyGuard>{children}</AdminOnlyGuard>
    </ProtectedRoute>
  );
};
