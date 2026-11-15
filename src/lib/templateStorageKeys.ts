export const AGENCY_TEMPLATE_KEYS = [
  "invoice_template",
  "booking_template",
  "reminder_templates",
  "umrah_custom_presets",
] as const;

export type AgencyTemplateKey = (typeof AGENCY_TEMPLATE_KEYS)[number];

export const LEGACY_TEMPLATE_STORAGE_KEYS = [
  ...AGENCY_TEMPLATE_KEYS,
  "agency_logo",
] as const;

export const TEMPLATE_SYNC_PREFIX = "tams_template_synced:";
export const TEMPLATE_PENDING_PREFIX = "tams_template_pending:";

export interface SimpleStorageLike {
  length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function isTemplateStorageKey(key: string): boolean {
  return (LEGACY_TEMPLATE_STORAGE_KEYS as readonly string[]).includes(key);
}

export function templateSyncedMarkerKey(agencyId: string, key: string): string {
  return `${TEMPLATE_SYNC_PREFIX}${agencyId}:${key}`;
}

export function templatePendingMarkerKey(key: string): string {
  return `${TEMPLATE_PENDING_PREFIX}${key}`;
}

export function hasAnySyncedMarkerForKey(storage: SimpleStorageLike, key: string): boolean {
  const suffix = `:${key}`;
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(TEMPLATE_SYNC_PREFIX) && k.endsWith(suffix)) {
      if (storage.getItem(k) === "1") {
        return true;
      }
    }
  }
  return false;
}

export function markTemplatePending(storage: SimpleStorageLike, key: string): void {
  try {
    storage.setItem(templatePendingMarkerKey(key), "1");
    // Clear previous synced markers for this key until the new version is uploaded.
    const suffix = `:${key}`;
    const toRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(TEMPLATE_SYNC_PREFIX) && k.endsWith(suffix)) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => storage.removeItem(k));
  } catch {
    // Ignore storage quota / privacy errors
  }
}

export function markTemplateSynced(
  storage: SimpleStorageLike,
  agencyId: string,
  key: string
): void {
  try {
    storage.removeItem(templatePendingMarkerKey(key));
    storage.setItem(templateSyncedMarkerKey(agencyId, key), "1");
  } catch {
    // Ignore storage quota / privacy errors
  }
}

/**
 * Logout/cache cleanup must NEVER erase templates or pending flags that have not
 * yet been uploaded to `agency_templates`.
 */
export function shouldPreserveStorageKeyOnClear(
  key: string,
  storage: SimpleStorageLike,
  preservedUiPrefKeys: ReadonlySet<string>
): boolean {
  if (!key) return false;
  if (preservedUiPrefKeys.has(key) || key.startsWith("sb-")) {
    return true;
  }

  if (key.startsWith(TEMPLATE_PENDING_PREFIX)) {
    const baseKey = key.slice(TEMPLATE_PENDING_PREFIX.length);
    return storage.getItem(key) === "1" && storage.getItem(baseKey) !== null;
  }

  if (key.startsWith(TEMPLATE_SYNC_PREFIX)) {
    return true;
  }

  if (isTemplateStorageKey(key)) {
    const rawValue = storage.getItem(key);
    if (rawValue === null || rawValue === "") {
      return false;
    }
    const explicitlyPending = storage.getItem(templatePendingMarkerKey(key)) === "1";
    const syncedAlready = hasAnySyncedMarkerForKey(storage, key);
    return explicitlyPending || !syncedAlready;
  }

  return false;
}
