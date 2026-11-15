import { toast } from "sonner";
import {
  type ParsedSupabaseError,
  isDuplicateKeyError,
  parseFriendlyError,
  toFriendlyMessage,
} from "@/lib/friendlyError";

export type { ParsedSupabaseError };
export { isDuplicateKeyError, toFriendlyMessage };

export function parseSupabaseError(
  error: unknown,
  fallbackMessage = "Could not complete the request. Please try again."
): ParsedSupabaseError {
  return parseFriendlyError(error, fallbackMessage);
}

export function handleSupabaseError(
  error: unknown,
  fallbackMessage = "Could not save changes. Please try again.",
  contextLabel = "Supabase operation failed"
): string {
  console.error(`[TAMS Error] ${contextLabel}:`, error);
  const parsed = parseFriendlyError(error, fallbackMessage);
  toast.error(parsed.userMessage);
  return parsed.userMessage;
}

/**
 * Runs an operation and, if Auto numbering is active and Postgres returns 23505
 * (e.g., concurrent counter race against a manually inserted row), retries once
 * so the database assigns the next unused number automatically.
 */
export async function withDuplicateRetry<T>(
  operation: () => Promise<T>,
  options: {
    isAutoMode?: boolean;
    onRetry?: () => Promise<void> | void;
  } = {}
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (options.isAutoMode && isDuplicateKeyError(error)) {
      console.warn("[TAMS Auto-Retry] Duplicate number collision on auto save, retrying once...");
      if (options.onRetry) {
        await options.onRetry();
      }
      return await operation();
    }
    throw error;
  }
}
