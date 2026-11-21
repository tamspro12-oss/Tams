import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useIsAdmin = () => {
  const { user, loading: authLoading } = useAuth();

  const { data: isAdmin = false, isLoading } = useQuery({
    queryKey: ["is-super-admin", user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return false;
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "super_admin" as any)
          .maybeSingle();

        if (error) {
          console.error("[useIsAdmin] Role verification failed:", error);
          return false;
        }
        return data?.role === ("super_admin" as any);
      } catch (error) {
        console.error("[useIsAdmin] Role verification failed:", error);
        return false;
      }
    },
  });

  return {
    isAdmin,
    isMasterAdmin: isAdmin,
    loading: authLoading || (!!user?.id && isLoading),
  };
};
