import { supabase } from "@/integrations/supabase/client";

/**
 * Master Admin Email Whitelist
 * Only this account possesses platform-level administrator privileges,
 * user management, system settings, and administrative controls.
 */
export const MASTER_ADMIN_EMAIL = "usmn4u@gmail.com";

/**
 * Synchronous client-side check whether an email matches the Master Admin.
 */
export function isMasterAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
}

/**
 * Asynchronously checks if a user is the Master Admin via:
 * 1. Email whitelisting (usmn4u@gmail.com)
 * 2. Database super admin flag / RPC is_master_admin check
 */
export async function verifyMasterAdminStatus(user?: { id?: string; email?: string | null } | null): Promise<boolean> {
  if (!user) return false;

  // Direct email whitelisting check
  if (isMasterAdminEmail(user.email)) {
    return true;
  }

  // Database fallback check for super-admin role
  if (user.id) {
    try {
      const { data, error } = await (supabase as any).rpc("is_master_admin", {
        _user_id: user.id,
      });
      if (!error && typeof data === "boolean") {
        return data;
      }

      // Fallback check against profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_super_admin")
        .eq("id", user.id)
        .maybeSingle();

      if ((profile as any)?.is_super_admin === true) {
        return true;
      }
    } catch (err) {
      console.warn("[adminAuth] Verification check error:", err);
    }
  }

  return false;
}
