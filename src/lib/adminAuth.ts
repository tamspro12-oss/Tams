import { supabase } from "@/integrations/supabase/client";

/**
 * Verifies whether the specified (or currently logged-in) user holds the
 * `super_admin` role in `public.user_roles` via server-verified database checks.
 * Never trusts localStorage, client flags, or hardcoded email whitelists.
 */
export async function verifySuperAdminStatus(userId?: string | null): Promise<boolean> {
  try {
    let targetUserId = userId ?? null;
    if (!targetUserId) {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) return false;
      targetUserId = user.id;
    }

    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId)
      .eq("role", "super_admin" as any)
      .maybeSingle();

    if (!roleError && roleRow?.role === ("super_admin" as any)) {
      return true;
    }

    const { data: hasRoleResult, error: rpcError } = await (supabase as any).rpc("has_role", {
      _user_id: targetUserId,
      _role: "super_admin",
    });

    return !rpcError && hasRoleResult === true;
  } catch (err) {
    console.error("[adminAuth] Error verifying super_admin role:", err);
    return false;
  }
}

/**
 * Backwards-compatible alias delegating strictly to database `super_admin` verification.
 */
export async function verifyMasterAdminStatus(
  user?: { id?: string | null } | null
): Promise<boolean> {
  return verifySuperAdminStatus(user?.id);
}
