import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      const { data: profile } = await supabase
        .from("profiles")
        .select("agency_id")
        .single();

      if (!profile?.agency_id) return null;

      const { data } = await supabase
        .from("agencies")
        .select(AGENCY_COLUMNS)
        .eq("id", profile.agency_id)
        .single();

      if (!data) return null;

      const { data: smtpConfigured } = await supabase.rpc("agency_smtp_configured");

      return { ...(data as any), smtp_configured: !!smtpConfigured } as any;
    },
  });
}
