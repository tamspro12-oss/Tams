import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";
import { verifySuperAdminStatus } from "@/lib/adminAuth";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";

export function useSubscription() {
  const { data: cachedAgencyId } = useCurrentAgencyId();

  return useQuery({
    queryKey: ["subscription", cachedAgencyId ?? "anonymous"],
    queryFn: async () => {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) return null;

      const isSuperAdmin = await verifySuperAdminStatus(user.id);
      const agencyId = cachedAgencyId || (await getAuthenticatedAgencyId());

      if (isSuperAdmin) {
        let agencyName = "Super Admin HQ";
        if (agencyId) {
          const { data: agency } = await supabase
            .from("agencies")
            .select("name")
            .eq("id", agencyId)
            .maybeSingle();
          if (agency?.name) agencyName = agency.name;
        }

        return {
          isExpired: false,
          daysRemaining: 999999,
          plan: "lifetime",
          expiryDate: "2099-12-31T23:59:59.000Z",
          isActive: true,
          status: "active",
          agencyName,
          isLifetime: true,
        };
      }

      if (!agencyId) return null;

      const { data: agency, error } = await supabase
        .from("agencies")
        .select("subscription_plan, license_expiry, license_active, license_status, name")
        .eq("id", agencyId)
        .maybeSingle();

      if (error || !agency) return null;

      const now = new Date();
      const expiryDate = agency.license_expiry ? new Date(agency.license_expiry) : null;
      const isExpired = expiryDate ? expiryDate < now : false;

      const daysRemaining = expiryDate
        ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        isExpired,
        daysRemaining,
        plan: agency.subscription_plan,
        expiryDate: agency.license_expiry,
        isActive: agency.license_active,
        status: agency.license_status,
        agencyName: agency.name,
        isLifetime: agency.subscription_plan === "lifetime",
      };
    },
    staleTime: 60 * 1000,
  });
}
