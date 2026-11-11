import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";
import { isMasterAdminEmail } from "@/lib/adminAuth";

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      // Check if logged in user is Master Admin (usmn4u@gmail.com)
      const { data: { user } } = await supabase.auth.getUser();
      const isMaster = isMasterAdminEmail(user?.email);

      const agencyId = await getAuthenticatedAgencyId();
      
      // Master Admin always has unconditional Lifetime Access
      if (isMaster) {
        let agencyName = "Master Admin HQ";
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
        isLifetime: false,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
