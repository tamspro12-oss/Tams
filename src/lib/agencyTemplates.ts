import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";
import {
  type AgencyTemplateKey,
  type SimpleStorageLike,
} from "@/lib/templateStorageKeys";
import {
  type LoadTemplateResult,
  type SaveTemplateResult,
  loadAgencyTemplateCore,
  migrateAllLocalTemplatesCore,
  saveAgencyTemplateCore,
} from "@/lib/agencyTemplatesCore";
import { invalidateAgencyBrandingCache } from "@/lib/pdf/agencyBranding";
import { scopedTemplateFallbackKey } from "@/lib/pdf/agencyBrandingCore";

export type { AgencyTemplateKey, LoadTemplateResult, SaveTemplateResult };

function getBrowserStorage(): SimpleStorageLike | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore storage access restrictions
  }
  return null;
}

export async function loadAgencyTemplate<T = unknown>(
  key: AgencyTemplateKey,
  explicitAgencyId?: string | null
): Promise<LoadTemplateResult<T>> {
  const agencyId =
    explicitAgencyId !== undefined ? explicitAgencyId : await getAuthenticatedAgencyId();
  return loadAgencyTemplateCore<T>(key, {
    client: supabase as any,
    agencyId,
    storage: getBrowserStorage(),
  });
}

export async function saveAgencyTemplate<T = unknown>(
  key: AgencyTemplateKey,
  value: T,
  explicitAgencyId?: string | null
): Promise<SaveTemplateResult> {
  const agencyId =
    explicitAgencyId !== undefined ? explicitAgencyId : await getAuthenticatedAgencyId();
  const storage = getBrowserStorage();
  if (
    storage &&
    agencyId &&
    (key === "invoice_template" || key === "booking_template")
  ) {
    try {
      storage.setItem(scopedTemplateFallbackKey(agencyId, key), JSON.stringify(value));
    } catch (err) {
      console.warn("[AgencyTemplates] Failed to store scoped template backup:", err);
    }
  }
  const result = await saveAgencyTemplateCore<T>(key, value, {
    client: supabase as any,
    agencyId,
    storage,
  });
  if (result.ok && (key === "invoice_template" || key === "booking_template")) {
    invalidateAgencyBrandingCache();
  }
  return result;
}

export async function migrateAllLocalTemplatesToDb(explicitAgencyId?: string | null): Promise<void> {
  const storage = getBrowserStorage();
  if (!storage) return;
  const agencyId =
    explicitAgencyId !== undefined ? explicitAgencyId : await getAuthenticatedAgencyId();
  if (!agencyId) return;
  await migrateAllLocalTemplatesCore({
    client: supabase as any,
    agencyId,
    storage,
  });
}
