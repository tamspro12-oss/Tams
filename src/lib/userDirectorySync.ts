import { isMasterAdminEmail } from "@/lib/adminAuth";

export interface RegisteredUserRecord {
  id: string;
  email: string;
  full_name: string;
  role: string;
  agency_name: string;
  subscription_plan: string;
  license_expiry: string | null;
  license_status: string | null;
  created_at: string;
  agency_id: string;
  active_sessions: number;
}

const REGISTRY_STORAGE_KEY = "tams_registered_accounts_registry";

export const DEFAULT_KNOWN_ACCOUNTS: RegisteredUserRecord[] = [
  {
    id: "user-master-admin-usman",
    email: "usmn4u@gmail.com",
    full_name: "Muhammad Usman",
    role: "admin",
    agency_name: "Master Admin HQ",
    subscription_plan: "lifetime",
    license_expiry: "2099-12-31T23:59:59.000Z",
    license_status: "active",
    created_at: "2025-01-01T00:00:00.000Z",
    agency_id: "00000000-0000-0000-0000-000000000001",
    active_sessions: 1,
  },
  {
    id: "user-agency-tamspro12",
    email: "tamspro12@gmail.com",
    full_name: "TAMS Pro Administrator",
    role: "admin",
    agency_name: "TAMS Pro Global Operations",
    subscription_plan: "yearly",
    license_expiry: "2027-12-31T23:59:59.000Z",
    license_status: "active",
    created_at: "2025-02-01T00:00:00.000Z",
    agency_id: "00000000-0000-0000-0000-000000000002",
    active_sessions: 1,
  },
];

/**
 * Retrieves the local persistent registered accounts registry.
 * Guarantees that usmn4u@gmail.com and tamspro12@gmail.com are always seeded.
 */
export function getLocalRegisteredAccounts(): RegisteredUserRecord[] {
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    let parsed: RegisteredUserRecord[] = [];
    if (raw) {
      parsed = JSON.parse(raw);
    }

    if (!Array.isArray(parsed)) {
      parsed = [];
    }

    // Ensure default accounts exist
    const map = new Map<string, RegisteredUserRecord>();
    DEFAULT_KNOWN_ACCOUNTS.forEach((acc) => {
      map.set(acc.email.toLowerCase(), acc);
    });

    parsed.forEach((acc) => {
      if (acc && acc.email) {
        const key = acc.email.toLowerCase();
        // Master admin attributes are permanently locked to lifetime
        if (isMasterAdminEmail(acc.email)) {
          map.set(key, {
            ...acc,
            role: "admin",
            subscription_plan: "lifetime",
            license_status: "active",
            license_expiry: "2099-12-31T23:59:59.000Z",
          });
        } else {
          map.set(key, acc);
        }
      }
    });

    const result = Array.from(map.values());
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(result));
    return result;
  } catch (err) {
    console.warn("[userDirectorySync] Error loading local registry:", err);
    return DEFAULT_KNOWN_ACCOUNTS;
  }
}

/**
 * Records or updates a registered user account in local persistent storage.
 */
export function recordRegisteredAccount(account: Partial<RegisteredUserRecord> & { email: string }): void {
  try {
    const current = getLocalRegisteredAccounts();
    const emailKey = account.email.trim().toLowerCase();
    const map = new Map(current.map((u) => [u.email.toLowerCase(), u]));

    const existing = map.get(emailKey);
    const updated: RegisteredUserRecord = {
      id: account.id || existing?.id || `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      email: account.email.trim(),
      full_name: account.full_name || existing?.full_name || account.email.split("@")[0],
      role: isMasterAdminEmail(account.email) ? "admin" : (account.role || existing?.role || "user"),
      agency_name: account.agency_name || existing?.agency_name || "Primary Agency",
      subscription_plan: isMasterAdminEmail(account.email)
        ? "lifetime"
        : (account.subscription_plan || existing?.subscription_plan || "free"),
      license_expiry: isMasterAdminEmail(account.email)
        ? "2099-12-31T23:59:59.000Z"
        : (account.license_expiry ?? existing?.license_expiry ?? new Date(Date.now() + 14 * 86400000).toISOString()),
      license_status: isMasterAdminEmail(account.email)
        ? "active"
        : (account.license_status || existing?.license_status || "active"),
      created_at: account.created_at || existing?.created_at || new Date().toISOString(),
      agency_id: account.agency_id || existing?.agency_id || `agency-${Date.now()}`,
      active_sessions: account.active_sessions ?? existing?.active_sessions ?? 1,
    };

    map.set(emailKey, updated);
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(Array.from(map.values())));
  } catch (err) {
    console.warn("[userDirectorySync] Error recording registered account:", err);
  }
}

/**
 * Updates an account's subscription in local cache so UI updates immediately.
 */
export function updateCachedUserSubscription(
  userIdOrEmail: string,
  plan: string,
  durationDays: number = 30
): void {
  try {
    const current = getLocalRegisteredAccounts();
    const key = userIdOrEmail.trim().toLowerCase();

    const updated = current.map((user) => {
      if (user.id.toLowerCase() === key || user.email.toLowerCase() === key) {
        if (isMasterAdminEmail(user.email)) {
          return {
            ...user,
            subscription_plan: "lifetime",
            license_status: "active",
            license_expiry: "2099-12-31T23:59:59.000Z",
          };
        }

        const isLifetime = plan.toLowerCase() === "lifetime";
        const newExpiry = isLifetime
          ? "2099-12-31T23:59:59.000Z"
          : new Date(Date.now() + durationDays * 86400000).toISOString();

        return {
          ...user,
          subscription_plan: plan.toLowerCase(),
          license_status: "active",
          license_expiry: newExpiry,
        };
      }
      return user;
    });

    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[userDirectorySync] Error updating subscription:", err);
  }
}

/**
 * Merges database-fetched users with local registry accounts.
 * Ensures:
 * 1. tamspro12@gmail.com is ALWAYS displayed.
 * 2. usmn4u@gmail.com is ALWAYS displayed as Master Admin with Lifetime access.
 * 3. No duplicate rows.
 * 4. DB data updates the local registry.
 */
export function mergeUsersWithRegistry(dbUsers: RegisteredUserRecord[]): RegisteredUserRecord[] {
  const localRegistry = getLocalRegisteredAccounts();
  const resultMap = new Map<string, RegisteredUserRecord>();

  // 1. Seed with local registry
  localRegistry.forEach((user) => {
    resultMap.set(user.email.toLowerCase(), user);
  });

  // 2. Overlay with DB records
  (dbUsers || []).forEach((dbUser) => {
    if (!dbUser || !dbUser.email) return;
    const emailKey = dbUser.email.toLowerCase();
    const existing = resultMap.get(emailKey);

    const isMaster = isMasterAdminEmail(dbUser.email);
    const merged: RegisteredUserRecord = {
      id: dbUser.id || existing?.id || `usr-${emailKey}`,
      email: dbUser.email,
      full_name: dbUser.full_name || existing?.full_name || dbUser.email.split("@")[0],
      role: isMaster ? "admin" : (dbUser.role || existing?.role || "user"),
      agency_name: dbUser.agency_name || existing?.agency_name || "Primary Agency",
      subscription_plan: isMaster ? "lifetime" : (dbUser.subscription_plan || existing?.subscription_plan || "free"),
      license_expiry: isMaster
        ? "2099-12-31T23:59:59.000Z"
        : (dbUser.license_expiry ?? existing?.license_expiry ?? null),
      license_status: isMaster
        ? "active"
        : (dbUser.license_status || existing?.license_status || "active"),
      created_at: dbUser.created_at || existing?.created_at || new Date().toISOString(),
      agency_id: dbUser.agency_id || existing?.agency_id || "",
      active_sessions: dbUser.active_sessions ?? existing?.active_sessions ?? 1,
    };

    resultMap.set(emailKey, merged);
  });

  // 3. Guarantee Master Admin record
  const masterKey = "usmn4u@gmail.com";
  const currentMaster = resultMap.get(masterKey);
  resultMap.set(masterKey, {
    id: currentMaster?.id || "user-master-admin-usman",
    email: masterKey,
    full_name: currentMaster?.full_name || "Muhammad Usman (Master Admin)",
    role: "admin",
    agency_name: currentMaster?.agency_name || "Master Admin HQ",
    subscription_plan: "lifetime",
    license_expiry: "2099-12-31T23:59:59.000Z",
    license_status: "active",
    created_at: currentMaster?.created_at || "2025-01-01T00:00:00.000Z",
    agency_id: currentMaster?.agency_id || "00000000-0000-0000-0000-000000000001",
    active_sessions: 1,
  });

  // 4. Guarantee tamspro12@gmail.com record
  const tamsproKey = "tamspro12@gmail.com";
  if (!resultMap.has(tamsproKey)) {
    resultMap.set(tamsproKey, {
      id: "user-agency-tamspro12",
      email: tamsproKey,
      full_name: "TAMS Pro Administrator",
      role: "admin",
      agency_name: "TAMS Pro Global Operations",
      subscription_plan: "yearly",
      license_expiry: "2027-12-31T23:59:59.000Z",
      license_status: "active",
      created_at: "2025-02-01T00:00:00.000Z",
      agency_id: "00000000-0000-0000-0000-000000000002",
      active_sessions: 1,
    });
  }

  const finalUsers = Array.from(resultMap.values());
  // Save updated cache
  try {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(finalUsers));
  } catch (err) {
    // Ignore storage quota
  }

  return finalUsers;
}
