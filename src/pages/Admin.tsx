import { Shield, UserCircle2, Loader2, Users, FileText } from "lucide-react";
import { AdminUserManagement } from "@/components/AdminUserManagement";
import { AdminBlogManager } from "@/components/admin/AdminBlogManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";

export default function Admin() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get("tab") === "blogs" ? "blogs" : "users";

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

  const handleTabChange = (nextTab: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === "blogs") {
      nextParams.set("tab", "blogs");
    } else {
      nextParams.delete("tab");
    }
    setSearchParams(nextParams, { replace: true });
  };

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
              Manage users, subscriptions, blogs, and system settings
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
        <div className="flex items-center gap-2">
          <UserCircle2 className="h-5 w-5 text-primary" />
          <p className="text-sm font-medium text-primary">
            Super Admin Access: You can create user accounts, reset passwords, manage subscriptions, and publish blogs
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users &amp; Subscriptions
          </TabsTrigger>
          <TabsTrigger value="blogs" className="gap-2">
            <FileText className="h-4 w-4" />
            Blogs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <AdminUserManagement />
        </TabsContent>

        <TabsContent value="blogs">
          <AdminBlogManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
