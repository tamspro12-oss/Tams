import { useQuery } from "@tanstack/react-query";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";

export function useCurrentAgencyId() {
  return useQuery({
    queryKey: ["current-agency-id"],
    queryFn: async () => {
      const agencyId = await getAuthenticatedAgencyId();
      return agencyId;
    },
    staleTime: 5 * 60 * 1000,
  });
}
