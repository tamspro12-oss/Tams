import { toast } from "sonner";
import {
  createRequestId,
  runAtomicSave,
  type RunAtomicSaveResult,
} from "@/lib/atomicSave";

export interface RunUiAtomicSaveOptions<T> {
  requestIdRef?: { current: string };
  isLockedRef: { current: boolean };
  setIsSubmitting?: (value: boolean) => void;
  contextLabel: string;
  fallbackErrorMessage?: string;
  execute: (requestId: string) => Promise<T>;
  /** Called immediately on server success (close modal / toast here before background refresh). */
  onSuccess: (result: T, requestId: string) => void | Promise<void>;
  /** Optional custom error notifier (defaults to toast.error). */
  onErrorToast?: (friendlyMessage: string, info: { timedOut: boolean; offline: boolean }) => void;
  slowWarningMs?: number;
  timeoutMs?: number;
}

/**
 * UI convenience wrapper around `runAtomicSave` that displays friendly
 * 15s slow-save warnings, 30s timeout notices, offline notices, and never
 * shows raw SQL/technical text to users. Keeps `requestIdRef.current` stable
 * across retries on failure/timeout so duplicate rows cannot be created.
 */
export async function runUiAtomicSave<T>(
  options: RunUiAtomicSaveOptions<T>
): Promise<RunAtomicSaveResult<T>> {
  const reqId = options.requestIdRef?.current || createRequestId();
  if (options.requestIdRef) {
    options.requestIdRef.current = reqId;
  }

  let slowToastId: string | number | undefined;

  const res = await runAtomicSave<T>({
    requestId: reqId,
    slowWarningMs: options.slowWarningMs,
    timeoutMs: options.timeoutMs,
    fallbackErrorMessage: options.fallbackErrorMessage,
    isLocked: () => options.isLockedRef.current,
    setLocked: (locked) => {
      options.isLockedRef.current = locked;
      options.setIsSubmitting?.(locked);
    },
    execute: options.execute,
    onSlowWarning: () => {
      slowToastId = toast.loading("Taking longer than usual, please wait...", {
        duration: 16_000,
      });
    },
    onSuccess: async (data, completedReqId) => {
      if (slowToastId !== undefined) {
        toast.dismiss(slowToastId);
      }
      if (options.requestIdRef) {
        options.requestIdRef.current = createRequestId();
      }
      await options.onSuccess(data, completedReqId);
    },
    onError: (friendlyMessage, { rawError, timedOut, offline }) => {
      if (slowToastId !== undefined) {
        toast.dismiss(slowToastId);
      }
      console.error(`[TAMS Save Error] ${options.contextLabel}:`, rawError);
      if (options.onErrorToast) {
        options.onErrorToast(friendlyMessage, { timedOut: Boolean(timedOut), offline: Boolean(offline) });
      } else {
        toast.error(friendlyMessage);
      }
    },
  });

  if (slowToastId !== undefined) {
    toast.dismiss(slowToastId);
  }

  return res;
}
