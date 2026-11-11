import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";

// NOTE: email_password and license_key are intentionally NOT selected here.
// They are no longer readable by app users directly (column-level revoke).
// SMTP status is exposed as a boolean flag only.
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

export function useAgency() {
  return useQuery({
    queryKey: ["agency"],
    queryFn: async () => {
      const agencyId = await getAuthenticatedAgencyId();
      if (!agencyId) return null;

      const { data, error } = await supabase
        .from("agencies")
        .select(AGENCY_COLUMNS)
        .eq("id", agencyId)
        .maybeSingle();

      if (error || !data) return null;

      let smtpConfigured = false;
      try {
        const { data: res } = await supabase.rpc("agency_smtp_configured");
        smtpConfigured = !!res;
      } catch {
        // ignore RPC error
      }

      return { ...(data as any), smtp_configured: smtpConfigured } as any;
    },
    staleTime: 5 * 60 * 1000,
  });
}
