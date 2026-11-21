import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";

// NOTE: email_password and license_key are intentionally NOT selected here.
// They are no longer readable by app users directly (column-level revoke).
const AGENCY_COLUMNS = [
  "id",
  "agency_no",
  "agency_code",
  "name",
  "contact_info",
  "license_status",
  "license_expiry",
  "license_active",
  "created_at",
  "phone_number",
  "email",
  "contact_email",
  "subscription_plan",
  "max_storage_bytes",
  "email_cleanup_enabled",
  "email_cleanup_frequency",
  "email_cleanup_keep_days",
].join(", ");

export async function fetchAgencySmtpConfigured(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("agency_smtp_configured");
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

export function useAgency() {
  const { user } = useAuth();
  const { data: agencyId } = useCurrentAgencyId();

  return useQuery({
    queryKey: ["agency", user?.id ?? "anonymous", agencyId ?? null],
    queryFn: async () => {
      if (!agencyId) return null;

      const { data, error } = await supabase
        .from("agencies")
        .select(AGENCY_COLUMNS)
        .eq("id", agencyId)
        .maybeSingle();

      if (error || !data) return null;
      return data as any;
    },
    enabled: !!user?.id && !!agencyId,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export function useAgencySmtpConfigured(enabled: boolean = true) {
  const { user } = useAuth();
  const { data: agencyId } = useCurrentAgencyId();

  return useQuery({
    queryKey: ["agency-smtp-configured", agencyId ?? "anonymous"],
    queryFn: fetchAgencySmtpConfigured,
    enabled: enabled && !!user?.id && !!agencyId,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}
