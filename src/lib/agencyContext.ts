import { supabase } from "@/integrations/supabase/client";

/**
 * Strict Multi-Tenant Agency Resolver
 * Safely resolves the active agency ID for the current authenticated user session.
 * Supports primary profile owner and sub_users, avoiding the Postgres `.single()`
 * cardinality violation error when multiple records match.
 */
export async function getAuthenticatedAgencyId(): Promise<string | null> {
  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      // Fallback to active session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) return null;
    }

    const currentUserId = user?.id || (await supabase.auth.getSession()).data.session?.user?.id;
    if (!currentUserId) return null;

    // 1. Check user profile for agency_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", currentUserId)
      .maybeSingle();

    if (profile?.agency_id) {
      localStorage.setItem("tams_agency_id", profile.agency_id);
      return profile.agency_id;
    }

    // 2. Fallback to sub_users table if user belongs to an agency as staff
    const { data: subUser } = await supabase
      .from("sub_users")
      .select("agency_id")
      .eq("user_id", currentUserId)
      .eq("is_active", true)
      .maybeSingle();

    if (subUser?.agency_id) {
      localStorage.setItem("tams_agency_id", subUser.agency_id);
      return subUser.agency_id;
    }

    // 3. Last fallback: RPC if available
    try {
      const { data: rpcAgencyId } = await supabase.rpc("current_user_agency_id");
      if (rpcAgencyId) {
        localStorage.setItem("tams_agency_id", rpcAgencyId);
        return rpcAgencyId;
      }
    } catch {
      // ignore RPC error
    }

    return null;
  } catch (err) {
    console.error("[getAuthenticatedAgencyId] Error resolving agency context:", err);
    return localStorage.getItem("tams_agency_id");
  }
}
