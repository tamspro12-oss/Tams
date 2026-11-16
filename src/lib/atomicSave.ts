import { parseFriendlyError, isDuplicateKeyError } from "@/lib/friendlyError";

export const DEFAULT_SLOW_SAVE_WARNING_MS = 15_000;
export const DEFAULT_SAVE_TIMEOUT_MS = 30_000;

export class SaveTimeoutError extends Error {
  readonly timedOut = true;
  constructor(message = "Saving is taking too long and timed out. Please try again — your entered data is safe.") {
    super(message);
    this.name = "SaveTimeoutError";
  }
}

export class OfflineSaveError extends Error {
  readonly offline = true;
  constructor(message = "You appear to be offline. Nothing was saved — please check your internet and try again.") {
    super(message);
    this.name = "OfflineSaveError";
  }
}

export function createRequestId(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // RFC-4122 v4 fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Detects PostgREST / PostgreSQL errors caused by a new RPC or parameter
 * (such as `p_request_id` or newly added `save_*_atomic`) not yet existing
 * when the frontend ships ahead of `20261117_01_speed_and_search.sql`.
 */
export function isMissingRpcOrParamError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    const str = String(error || "").toLowerCase();
    return (
      str.includes("could not find the function") ||
      str.includes("schema cache") ||
      (str.includes("function") && str.includes("does not exist")) ||
      str.includes("pgrst202")
    );
  }
  const err = error as Record<string, unknown>;
  const code = String(err.code || "").toUpperCase();
  const status = Number(err.status || err.statusCode || 0);
  const combined = `${String(err.message || "")} ${String(err.details || "")} ${String(err.hint || "")}`.toLowerCase();

  if (code === "PGRST202" || code === "42883" || status === 404) {
    return true;
  }

  return (
    combined.includes("could not find the function") ||
    combined.includes("schema cache") ||
    (combined.includes("function") && combined.includes("does not exist")) ||
    (combined.includes("p_request_id") && combined.includes("does not exist")) ||
    (combined.includes("p_is_recurring") && combined.includes("does not exist"))
  );
}

export interface RunAtomicSaveOptions<T> {
  requestId?: string;
  isOnline?: () => boolean;
  isLocked?: () => boolean;
  setLocked?: (locked: boolean) => void;
  slowWarningMs?: number;
  timeoutMs?: number;
  fallbackErrorMessage?: string;
  execute: (requestId: string) => Promise<T>;
  onSlowWarning?: () => void;
  onSuccess?: (result: T, requestId: string) => void | Promise<void>;
  onError?: (friendlyMessage: string, info: { timedOut: boolean; offline: boolean; rawError: unknown; requestId: string }) => void;
}

export type RunAtomicSaveResult<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; errorMessage: string; timedOut: boolean; offline: boolean; skippedLocked?: boolean; requestId: string };

/**
 * Single unified save runner for every form:
 * - Prevents duplicate concurrent submits
 * - Checks online status before calling server
 * - Passes a stable client `requestId` for DB-side idempotency
 * - Triggers `onSlowWarning` at 15s ("Taking longer than usual...")
 * - Times out cleanly at 30s without freezing the UI or falsely marking saved
 * - Keeps entered form state intact on error/timeout so retrying is safe
 */
export async function runAtomicSave<T>(options: RunAtomicSaveOptions<T>): Promise<RunAtomicSaveResult<T>> {
  const requestId = options.requestId || createRequestId();
  const slowWarningMs = options.slowWarningMs ?? DEFAULT_SLOW_SAVE_WARNING_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_SAVE_TIMEOUT_MS;
  const fallbackMsg = options.fallbackErrorMessage || "Could not save changes. Please try again.";

  if (options.isLocked?.()) {
    return {
      ok: false,
      errorMessage: "",
      timedOut: false,
      offline: false,
      skippedLocked: true,
      requestId,
    };
  }

  const online =
    options.isOnline !== undefined
      ? options.isOnline()
      : typeof navigator === "undefined" || navigator.onLine !== false;

  if (!online) {
    const offlineErr = new OfflineSaveError();
    options.onError?.(offlineErr.message, {
      timedOut: false,
      offline: true,
      rawError: offlineErr,
      requestId,
    });
    return {
      ok: false,
      errorMessage: offlineErr.message,
      timedOut: false,
      offline: true,
      requestId,
    };
  }

  options.setLocked?.(true);

  let slowTimer: ReturnType<typeof setTimeout> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let settled = false;

  try {
    if (slowWarningMs > 0 && options.onSlowWarning) {
      slowTimer = setTimeout(() => {
        if (!settled) {
          try {
            options.onSlowWarning?.();
          } catch {
            // Never fail a save because a warning UI callback threw
          }
        }
      }, slowWarningMs);
    }

    const result = await new Promise<T>((resolve, reject) => {
      if (timeoutMs > 0) {
        timeoutTimer = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new SaveTimeoutError());
          }
        }, timeoutMs);
      }

      options
        .execute(requestId)
        .then((res) => {
          if (!settled) {
            settled = true;
            resolve(res);
          }
        })
        .catch((err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        });
    });

    if (slowTimer) clearTimeout(slowTimer);
    if (timeoutTimer) clearTimeout(timeoutTimer);

    await options.onSuccess?.(result, requestId);

    return { ok: true, data: result, requestId };
  } catch (error) {
    settled = true;
    if (slowTimer) clearTimeout(slowTimer);
    if (timeoutTimer) clearTimeout(timeoutTimer);

    const timedOut = error instanceof SaveTimeoutError || (error as any)?.timedOut === true;
    const friendlyMessage = timedOut
      ? "Saving timed out after 30 seconds. Your data is still in the form — you can tap Save to retry safely without duplicates."
      : parseFriendlyError(error, fallbackMsg).userMessage;

    options.onError?.(friendlyMessage, {
      timedOut,
      offline: false,
      rawError: error,
      requestId,
    });

    return {
      ok: false,
      errorMessage: friendlyMessage,
      timedOut,
      offline: false,
      requestId,
    };
  } finally {
    if (slowTimer) clearTimeout(slowTimer);
    if (timeoutTimer) clearTimeout(timeoutTimer);
    options.setLocked?.(false);
  }
}

export interface RpcFallbackClient {
  rpc: (fn: string, params?: Record<string, any>) => PromiseLike<{ data: any; error: any }>;
}

/**
 * Invokes a Supabase RPC with `p_request_id` (or new params) and, if the database
 * hasn't applied `20261117_01_speed_and_search.sql` yet, automatically retries
 * using `legacyParams` or `legacyFallback` without failing the user's save.
 * Also retries once on auto-mode duplicate sequence collision (SQLSTATE 23505).
 */
export async function rpcWithPreSqlFallback<T = any>(
  client: RpcFallbackClient,
  rpcName: string,
  paramsWithNewFields: Record<string, any>,
  options: {
    legacyParams?: Record<string, any>;
    legacyFallback?: () => Promise<T>;
    isAutoMode?: boolean;
  } = {}
): Promise<T> {
  const invoke = async (): Promise<T> => {
    const { data, error } = await client.rpc(rpcName, paramsWithNewFields);
    if (!error) return data as T;

    if (isMissingRpcOrParamError(error)) {
      if (options.legacyFallback) {
        return await options.legacyFallback();
      }
      if (options.legacyParams) {
        const { data: fbData, error: fbError } = await client.rpc(rpcName, options.legacyParams);
        if (fbError) throw fbError;
        return fbData as T;
      }
      const { p_request_id: _req, p_is_recurring: _rec, p_recurring_frequency: _rf, p_recurring_parent_id: _rp, ...stripped } =
        paramsWithNewFields;
      const { data: strippedData, error: strippedErr } = await client.rpc(rpcName, stripped);
      if (strippedErr) throw strippedErr;
      return strippedData as T;
    }

    throw error;
  };

  try {
    return await invoke();
  } catch (err) {
    if (options.isAutoMode && isDuplicateKeyError(err)) {
      return await invoke();
    }
    throw err;
  }
}

/**
 * Runs secondary side work (e.g. cache refreshes, notifications) strictly in the
 * background after closing the modal, never blocking or failing the primary save.
 */
export function runBackgroundTask(label: string, fn: () => Promise<unknown> | void): void {
  Promise.resolve()
    .then(() => fn())
    .catch((err) => {
      console.warn(`[TAMS Background] ${label}:`, err);
    });
}

