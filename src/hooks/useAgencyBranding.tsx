import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { useAgency } from "@/hooks/useAgency";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";
import {
  fetchAgencyBranding,
  resolveAgencyBrandingFromRecords,
  type AgencyBranding,
} from "@/lib/pdf/agencyBranding";

export function useAgencyBranding() {
  const { user } = useAuth();
  const { data: agencyId } = useCurrentAgencyId();
  const { data: agency } = useAgency();
  const queryClient = useQueryClient();

  const query = useQuery<AgencyBranding>({
    queryKey: ["agency-branding", user?.id ?? "anonymous", agencyId ?? null],
    queryFn: () => fetchAgencyBranding(agencyId, agency?.name),
    enabled: !!user?.id && !!agencyId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const branding = useMemo<AgencyBranding>(
    () =>
      query.data ??
      resolveAgencyBrandingFromRecords({
        agencyId: agencyId ?? null,
        signupAgencyName: agency?.name,
      }),
    [query.data, agencyId, agency?.name]
  );

  const getBrandingAsync = useCallback(async (): Promise<AgencyBranding> => {
    if (query.data) return query.data;
    const resolvedAgencyId = agencyId ?? (await getAuthenticatedAgencyId(user?.id));
    if (!resolvedAgencyId) {
      return resolveAgencyBrandingFromRecords({
        agencyId: null,
        signupAgencyName: agency?.name,
      });
    }
    try {
      return await queryClient.fetchQuery({
        queryKey: ["agency-branding", user?.id ?? "anonymous", resolvedAgencyId],
        queryFn: () => fetchAgencyBranding(resolvedAgencyId, agency?.name),
        staleTime: 5 * 60 * 1000,
      });
    } catch {
      return resolveAgencyBrandingFromRecords({
        agencyId: resolvedAgencyId,
        signupAgencyName: agency?.name,
      });
    }
  }, [query.data, agencyId, user?.id, agency?.name, queryClient]);

  return {
    branding,
    isLoading: query.isLoading,
    refetch: query.refetch,
    getBrandingAsync,
  };
}

