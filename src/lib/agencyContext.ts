import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves the active user's agency_id strictly from server-side tables
 * (`profiles`, `sub_users`, or `current_user_agency_id` RPC).
 * Never stores or trusts `agency_id` in localStorage.
 */
export async function getAuthenticatedAgencyId(): Promise<string | null> {
  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return null;
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profErr && profile?.agency_id) {
      return profile.agency_id;
    }

    const { data: subUser, error: subErr } = await supabase
      .from("sub_users")
      .select("agency_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!subErr && subUser?.agency_id) {
      return subUser.agency_id;
    }

    const { data: rpcAgencyId, error: rpcErr } = await supabase.rpc("current_user_agency_id");
    if (!rpcErr && rpcAgencyId) {
      return rpcAgencyId as string;
    }

    return null;
  } catch (err) {
    console.error("[getAuthenticatedAgencyId] Error resolving agency context:", err);
    return null;
  }
}
