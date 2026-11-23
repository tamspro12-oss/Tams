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
import {
  scopedTemplateFallbackKey,
  syncSharedBrandingFields,
} from "@/lib/pdf/agencyBrandingCore";

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
  const isBrandingKey = key === "invoice_template" || key === "booking_template";

  if (storage && agencyId && isBrandingKey) {
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

  // Automatically sync shared branding fields (logo, address, agencyName, phone, email, themeColor)
  // between invoice_template and booking_template so updating Invoice also updates Booking (and vice versa).
  if (
    result.ok &&
    isBrandingKey &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const companionKey: "invoice_template" | "booking_template" =
      key === "invoice_template" ? "booking_template" : "invoice_template";
    try {
      const existingCompanion = await loadAgencyTemplateCore<Record<string, any>>(
        companionKey,
        {
          client: supabase as any,
          agencyId,
          storage,
        }
      );
      const syncedCompanion = syncSharedBrandingFields(
        value as Record<string, any>,
        existingCompanion.data,
        companionKey
      );
      if (storage && agencyId) {
        try {
          storage.setItem(
            scopedTemplateFallbackKey(agencyId, companionKey),
            JSON.stringify(syncedCompanion)
          );
        } catch {
          // Ignore quota errors
        }
      }
      await saveAgencyTemplateCore(companionKey, syncedCompanion, {
        client: supabase as any,
        agencyId,
        storage,
      });
    } catch (syncErr) {
      console.warn("[AgencyTemplates] Companion branding template sync warning:", syncErr);
    }
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
