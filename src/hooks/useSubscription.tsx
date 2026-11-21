import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAgency } from "@/hooks/useAgency";
import { getDaysRemaining, isLicenseExpiredWithGrace } from "@/lib/licenseUtils";

export function useSubscription() {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { data: agency, isLoading: agencyLoading } = useAgency();

  return useQuery({
    queryKey: [
      "subscription",
      user?.id ?? "anonymous",
      agency?.id ?? null,
      isAdmin,
      agency?.subscription_plan ?? null,
      agency?.license_expiry ?? null,
      agency?.license_status ?? null,
      agency?.license_active ?? null,
    ],
    enabled: !!user?.id && !adminLoading && (isAdmin || !agencyLoading),
    queryFn: async () => {
      if (!user?.id) return null;

      if (isAdmin) {
        return {
          isExpired: false,
          daysRemaining: 999999,
          plan: "lifetime",
          expiryDate: "2099-12-31T23:59:59.000Z",
          isActive: true,
          status: "active",
          agencyName: agency?.name || "Super Admin HQ",
          isLifetime: true,
        };
      }

      if (!agency) return null;

      const now = new Date();
      const isExpired = isLicenseExpiredWithGrace(agency.license_expiry, now);
      const daysRemaining = getDaysRemaining(agency.license_expiry, now);

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
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}
