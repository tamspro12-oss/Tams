export interface RegisteredUserRecord {
  id: string;
  email: string;
  full_name: string;
  role: string;
  agency_name: string;
  subscription_plan: string;
  license_expiry: string | null;
  license_status: string;
  created_at: string;
  agency_id: string;
  active_sessions?: number;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
}

/**
 * Deprecated localStorage directory sync removed for security and single-source-of-truth compliance.
 * Always use live Supabase RPC / Edge Functions (`admin_get_registered_users` / `manage-users`).
 */
export function getLocalRegisteredAccounts(): RegisteredUserRecord[] {
  try {
    localStorage.removeItem("tams_registered_accounts_registry");
  } catch {
    // ignore storage errors
  }
  return [];
}

export function recordRegisteredAccount(_account: Partial<RegisteredUserRecord> & { email: string }): void {
  // No-op: persisted strictly in Supabase Auth + profiles/agencies tables.
}

export function updateCachedUserSubscription(
  _userIdOrEmail: string,
  _plan: string,
  _durationDays: number = 30
): void {
  // No-op: subscription updates happen strictly via Supabase RPC / Edge Function.
}

export function mergeUsersWithRegistry(dbUsers: RegisteredUserRecord[]): RegisteredUserRecord[] {
  return Array.isArray(dbUsers) ? dbUsers : [];
}
