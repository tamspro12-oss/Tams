import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("agency_id")
        .single();

      if (!profile?.agency_id) return null;

      const { data: agency } = await supabase
        .from("agencies")
        .select("subscription_plan, license_expiry, license_active, license_status, name")
        .eq("id", profile.agency_id)
        .single();

      if (!agency) return null;

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
      };
    },
  });
}
