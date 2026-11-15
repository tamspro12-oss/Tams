import {
  AGENCY_TEMPLATE_KEYS,
  type AgencyTemplateKey,
  type SimpleStorageLike,
  markTemplatePending,
  markTemplateSynced,
  templatePendingMarkerKey,
} from "@/lib/templateStorageKeys";
import { isMissingTableError, toFriendlyMessage } from "@/lib/friendlyError";

export interface TemplateDbClient {
  from(table: string): any;
}

export interface LoadTemplateResult<T> {
  data: T | null;
  source: "db" | "migrated" | "local_fallback" | "none";
  missingTable: boolean;
  errorMessage: string | null;
}

export interface SaveTemplateResult {
  ok: boolean;
  savedToDb: boolean;
  savedLocally: boolean;
  missingTable: boolean;
  errorMessage?: string;
}

function readLocalJson<T>(storage: SimpleStorageLike | null | undefined, key: string): T | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error("[AgencyTemplates] Failed to parse local template:", key, err);
    return null;
  }
}

function writeLocalJson(
  storage: SimpleStorageLike | null | undefined,
  key: string,
  value: unknown
): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("[AgencyTemplates] Failed to cache template locally:", key, err);
  }
}

function enrichInvoiceTemplateWithLegacyLogo<T>(
  key: AgencyTemplateKey,
  value: T | null,
  storage: SimpleStorageLike | null | undefined
): T | null {
  if (!storage || key !== "invoice_template") return value;
  const legacyLogo = storage.getItem("agency_logo");
  if (!legacyLogo) return value;

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (!record.logo) {
      return { ...record, logo: legacyLogo } as T;
    }
  }
  return value;
}

export async function loadAgencyTemplateCore<T = unknown>(
  key: AgencyTemplateKey,
  opts: {
    client: TemplateDbClient;
    agencyId: string | null | undefined;
    storage?: SimpleStorageLike | null;
  }
): Promise<LoadTemplateResult<T>> {
  const { client, agencyId, storage } = opts;
  const rawLocal = readLocalJson<T>(storage, key);
  const localValue = enrichInvoiceTemplateWithLegacyLogo(key, rawLocal, storage);

  if (!agencyId) {
    return {
      data: localValue,
      source: localValue !== null ? "local_fallback" : "none",
      missingTable: false,
      errorMessage: null,
    };
  }

  try {
    const isLocallyPending = Boolean(
      storage && storage.getItem(templatePendingMarkerKey(key)) === "1" && localValue !== null
    );

    if (isLocallyPending) {
      const pendingUpload = await client.from("agency_templates").upsert(
        {
          agency_id: agencyId,
          key,
          value: localValue,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "agency_id,key" }
      );
      if (!pendingUpload?.error && storage) {
        markTemplateSynced(storage, agencyId, key);
        return {
          data: localValue,
          source: "migrated",
          missingTable: false,
          errorMessage: null,
        };
      }
    }

    const { data: row, error } = await client
      .from("agency_templates")
      .select("value, updated_at")
      .eq("agency_id", agencyId)
      .eq("key", key)
      .maybeSingle();

    if (error) {
      const missingTable = isMissingTableError(error, "agency_templates");
      if (missingTable) {
        console.warn("[AgencyTemplates] agency_templates table not created yet; using localStorage.");
      } else {
        console.error("[AgencyTemplates] Could not load template from database:", key, error);
      }
      return {
        data: localValue,
        source: localValue !== null ? "local_fallback" : "none",
        missingTable,
        errorMessage: missingTable
          ? null
          : toFriendlyMessage(error, "Could not load template from server."),
      };
    }

    if (row && row.value !== null && row.value !== undefined) {
      const dbValue = row.value as T;
      writeLocalJson(storage, key, dbValue);
      if (storage) {
        markTemplateSynced(storage, agencyId, key);
      }
      return {
        data: dbValue,
        source: "db",
        missingTable: false,
        errorMessage: null,
      };
    }

    // DB has no template yet -> migrate localStorage value once if present.
    if (localValue !== null) {
      const { error: upsertErr } = await client.from("agency_templates").upsert(
        {
          agency_id: agencyId,
          key,
          value: localValue,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "agency_id,key" }
      );

      if (!upsertErr) {
        writeLocalJson(storage, key, localValue);
        if (storage) {
          markTemplateSynced(storage, agencyId, key);
        }
        return {
          data: localValue,
          source: "migrated",
          missingTable: false,
          errorMessage: null,
        };
      }

      console.error("[AgencyTemplates] Could not migrate local template to DB:", key, upsertErr);
      if (storage) {
        markTemplatePending(storage, key);
      }
      return {
        data: localValue,
        source: "local_fallback",
        missingTable: isMissingTableError(upsertErr, "agency_templates"),
        errorMessage: null,
      };
    }

    return {
      data: null,
      source: "none",
      missingTable: false,
      errorMessage: null,
    };
  } catch (err) {
    console.error("[AgencyTemplates] Unexpected load error:", key, err);
    return {
      data: localValue,
      source: localValue !== null ? "local_fallback" : "none",
      missingTable: isMissingTableError(err, "agency_templates"),
      errorMessage: toFriendlyMessage(err, "Could not load template from server."),
    };
  }
}

export async function saveAgencyTemplateCore<T = unknown>(
  key: AgencyTemplateKey,
  value: T,
  opts: {
    client: TemplateDbClient;
    agencyId: string | null | undefined;
    storage?: SimpleStorageLike | null;
  }
): Promise<SaveTemplateResult> {
  const { client, agencyId, storage } = opts;

  // Save local draft & mark un-synced before DB call so nothing is lost on failure/logout.
  writeLocalJson(storage, key, value);
  if (storage) {
    markTemplatePending(storage, key);
  }

  if (!agencyId) {
    return {
      ok: false,
      savedToDb: false,
      savedLocally: Boolean(storage),
      missingTable: false,
      errorMessage: "No active agency found. Please reload and try again.",
    };
  }

  try {
    const { error } = await client.from("agency_templates").upsert(
      {
        agency_id: agencyId,
        key,
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agency_id,key" }
    );

    if (!error) {
      if (storage) {
        markTemplateSynced(storage, agencyId, key);
      }
      return {
        ok: true,
        savedToDb: true,
        savedLocally: Boolean(storage),
        missingTable: false,
      };
    }

    if (isMissingTableError(error, "agency_templates")) {
      console.warn(
        "[AgencyTemplates] agency_templates table missing; kept pending draft in localStorage:",
        key
      );
      return {
        ok: true,
        savedToDb: false,
        savedLocally: Boolean(storage),
        missingTable: true,
      };
    }

    console.error("[AgencyTemplates] Failed to save template to DB:", key, error);
    return {
      ok: false,
      savedToDb: false,
      savedLocally: Boolean(storage),
      missingTable: false,
      errorMessage: toFriendlyMessage(
        error,
        "Could not save template to server. Kept a local copy — please try again."
      ),
    };
  } catch (err) {
    if (isMissingTableError(err, "agency_templates")) {
      return {
        ok: true,
        savedToDb: false,
        savedLocally: Boolean(storage),
        missingTable: true,
      };
    }
    console.error("[AgencyTemplates] Unexpected save error:", key, err);
    return {
      ok: false,
      savedToDb: false,
      savedLocally: Boolean(storage),
      missingTable: false,
      errorMessage: toFriendlyMessage(
        err,
        "Could not save template to server. Kept a local copy — please try again."
      ),
    };
  }
}

export async function migrateAllLocalTemplatesCore(opts: {
  client: TemplateDbClient;
  agencyId: string;
  storage: SimpleStorageLike;
}): Promise<void> {
  const { client, agencyId, storage } = opts;
  if (!agencyId) return;

  for (const key of AGENCY_TEMPLATE_KEYS) {
    const hasLocal = storage.getItem(key) !== null;
    if (hasLocal || key === "invoice_template") {
      await loadAgencyTemplateCore(key, { client, agencyId, storage });
    }
  }
}
