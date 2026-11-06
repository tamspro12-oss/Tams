import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCurrentAgencyId() {
  return useQuery({
    queryKey: ["current-agency-id"],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("agency_id")
        .single();

      const agencyId = profile?.agency_id || null;
      
      // Cache agency_id for offline operations
      if (agencyId) {
        localStorage.setItem('tams_agency_id', agencyId);
      }
      
      return agencyId;
    },
    staleTime: Infinity, // Agency ID doesn't change during session
  });
}
