import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Shield, UserCircle2, Loader2, Users, FileText, LayoutTemplate, Mail } from "lucide-react";
import { toast } from "sonner";
import { AdminUserManagement } from "@/components/AdminUserManagement";
import { AdminBlogManager } from "@/components/admin/AdminBlogManager";
import { AdminSiteContentManager } from "@/components/admin/AdminSiteContentManager";
import { AdminSystemEmailManager } from "@/components/admin/AdminSystemEmailManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAdmin } from "@/hooks/useIsAdmin";

type AdminTab = "users" | "blogs" | "site-content" | "system-email";

function parseAdminTab(raw: string | null): AdminTab {
  if (raw === "blogs") return "blogs";
  if (raw === "site-content") return "site-content";
  if (raw === "system-email") return "system-email";
  return "users";
}

export default function Admin() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = parseAdminTab(searchParams.get("tab"));

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
    if (
      nextTab === "blogs" ||
      nextTab === "site-content" ||
      nextTab === "system-email"
    ) {
      nextParams.set("tab", nextTab);
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
            <h1 className="text-2xl md:text-3xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground mt-1">
              Manage users, subscriptions, blog articles, public site content, and system email
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
        <div className="flex items-center gap-2">
          <UserCircle2 className="h-5 w-5 text-primary" />
          <p className="text-sm font-medium text-primary">
            Super Admin Access: Manage agency accounts, publish blog posts, update landing &amp; pricing copy, and monitor System Email
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-2 sm:grid-cols-4 h-auto gap-1 p-1">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            <span>Users &amp; Plans</span>
          </TabsTrigger>
          <TabsTrigger value="blogs" className="gap-2">
            <FileText className="h-4 w-4" />
            <span>Blogs</span>
          </TabsTrigger>
          <TabsTrigger value="site-content" className="gap-2">
            <LayoutTemplate className="h-4 w-4" />
            <span>Landing &amp; Pricing</span>
          </TabsTrigger>
          <TabsTrigger value="system-email" className="gap-2">
            <Mail className="h-4 w-4" />
            <span>System Email</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <AdminUserManagement />
        </TabsContent>

        <TabsContent value="blogs">
          <AdminBlogManager />
        </TabsContent>

        <TabsContent value="site-content">
          <AdminSiteContentManager />
        </TabsContent>

        <TabsContent value="system-email">
          <AdminSystemEmailManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
