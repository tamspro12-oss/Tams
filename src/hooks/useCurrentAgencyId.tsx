import { useQuery } from "@tanstack/react-query";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";
import { useAuth } from "@/hooks/useAuth";

export function useCurrentAgencyId() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["current-agency-id", user?.id ?? "anonymous"],
    queryFn: async () => {
      if (!user) return null;
      return await getAuthenticatedAgencyId();
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });
}
