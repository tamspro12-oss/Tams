import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useUserPermissions() {
  const { user } = useAuth();

  const { data: subUserData, isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("sub_users")
        .select("permissions, is_active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user permissions:", error);
        return null;
      }

      return data;
    },
    enabled: !!user,
  });

  const isSubUser = !!subUserData;
  const isActive = subUserData?.is_active ?? true;
  const permissions = subUserData?.permissions;

  const hasModuleAccess = (module: string): boolean => {
    if (!isSubUser || !isActive) return true; // Main ID has full access
    if (!permissions) return false;

    const modulePerms = permissions[module];
    if (typeof modulePerms === "boolean") return modulePerms;
    if (typeof modulePerms === "object") return modulePerms.read === true;
    return false;
  };

  const hasActionPermission = (module: string, action: "read" | "write" | "delete"): boolean => {
    if (!isSubUser || !isActive) return true; // Main ID has full access
    if (!permissions) return false;

    const modulePerms = permissions[module];
    if (typeof modulePerms === "boolean") return modulePerms;
    if (typeof modulePerms === "object") return modulePerms[action] === true;
    return false;
  };

  return {
    isSubUser,
    isActive,
    permissions,
    hasModuleAccess,
    hasActionPermission,
    isLoading,
  };
}
