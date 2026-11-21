import { useQuery } from "@tanstack/react-query";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";
import { useAuth } from "@/hooks/useAuth";

export function useCurrentAgencyId() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["current-agency-id", user?.id ?? "anonymous"],
    queryFn: async () => {
      if (!user?.id) return null;
      return await getAuthenticatedAgencyId(user.id);
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}
