import { Shield, UserCircle2, Loader2 } from "lucide-react";
import { AdminUserManagement } from "@/components/AdminUserManagement";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";

export default function Admin() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Unauthorized: Administrator access requires super_admin privileges", {
        id: "unauthorized-admin-page",
      });
      navigate("/app/dashboard", { replace: true });
    }
  }, [isAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground mt-1">
              Manage users, subscriptions, and system settings
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
        <div className="flex items-center gap-2">
          <UserCircle2 className="h-5 w-5 text-primary" />
          <p className="text-sm font-medium text-primary">
            Super Admin Access: You can create user accounts, reset passwords, and manage subscriptions
          </p>
        </div>
      </div>

      <AdminUserManagement />
    </div>
  );
}
