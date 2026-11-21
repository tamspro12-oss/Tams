import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves the active user's agency_id strictly from server-side tables
 * (`profiles`, `sub_users`, or `current_user_agency_id` RPC).
 * Uses local session (non-blocking) when userId is not supplied,
 * and never stores or trusts agency IDs in localStorage.
 */
export async function getAuthenticatedAgencyId(knownUserId?: string | null): Promise<string | null> {
  try {
    let userId = knownUserId ?? null;
    if (!userId) {
      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();

      if (sessionErr || !session?.user) {
        return null;
      }
      userId = session.user.id;
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profErr && profile?.agency_id) {
      return profile.agency_id;
    }

    const { data: subUser, error: subErr } = await supabase
      .from("sub_users")
      .select("agency_id")
      .eq("user_id", userId)
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
