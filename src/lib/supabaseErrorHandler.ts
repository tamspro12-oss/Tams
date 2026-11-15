import { toast } from "sonner";

export interface ParsedSupabaseError {
  code: string;
  userMessage: string;
  isDuplicate: boolean;
  isPermissionDenied: boolean;
  isNetworkError: boolean;
}

const KNOWN_FRIENDLY_RPC_PATTERNS: Array<{ test: RegExp; message: string }> = [
  {
    test: /amount paid cannot exceed total amount/i,
    message: "Amount paid cannot exceed the total amount.",
  },
  {
    test: /amounts? cannot be negative/i,
    message: "Amounts cannot be negative.",
  },
  {
    test: /client does not belong to your agency/i,
    message: "Selected client does not belong to your agency.",
  },
  {
    test: /vendor does not belong to your agency/i,
    message: "Selected vendor does not belong to your agency.",
  },
  {
    test: /party does not belong to your agency/i,
    message: "Selected party does not belong to your agency.",
  },
  {
    test: /source account does not belong to your agency/i,
    message: "Selected payment account does not belong to your agency.",
  },
  {
    test: /destination account does not belong to your agency/i,
    message: "Selected destination account does not belong to your agency.",
  },
  {
    test: /account does not belong to your agency/i,
    message: "Selected account does not belong to your agency.",
  },
  {
    test: /source and destination accounts must be different/i,
    message: "Source and destination accounts must be different.",
  },
  {
    test: /transfer amount must be greater than zero/i,
    message: "Transfer amount must be greater than zero.",
  },
  {
    test: /booking invoice not found/i,
    message: "Selected booking invoice was not found for your agency.",
  },
  {
    test: /valid custom/i,
    message: "Please enter a valid custom document number.",
  },
  {
    test: /you do not have permission/i,
    message: "You do not have permission to perform this action.",
  },
  {
    test: /inactive or deactivated/i,
    message: "Your sub-user account has been deactivated. Contact your administrator.",
  },
  {
    test: /not authenticated/i,
    message: "Your session has expired. Please sign in again.",
  },
  {
    test: /does not have an assigned agency/i,
    message: "No agency is assigned to your account. Please contact support.",
  },
];

function extractRawDetails(error: unknown): {
  code: string;
  message: string;
  details: string;
  hint: string;
  status?: number;
} {
  if (!error || typeof error !== "object") {
    return {
      code: "",
      message: typeof error === "string" ? error : "",
      details: "",
      hint: "",
    };
  }

  const err = error as Record<string, unknown>;
  const nested = (err.error && typeof err.error === "object"
    ? err.error
    : err.cause && typeof err.cause === "object"
      ? err.cause
      : {}) as Record<string, unknown>;

  return {
    code: String(err.code || nested.code || "").trim(),
    message: String(err.message || nested.message || "").trim(),
    details: String(err.details || nested.details || "").trim(),
    hint: String(err.hint || nested.hint || "").trim(),
    status: typeof err.status === "number" ? err.status : undefined,
  };
}

export function isDuplicateKeyError(error: unknown): boolean {
  const { code, message } = extractRawDetails(error);
  if (code === "23505") return true;
  const lower = message.toLowerCase();
  return (
    lower.includes("duplicate key value") ||
    lower.includes("already exists") ||
    lower.includes("unique constraint")
  );
}

function mapDuplicateMessage(combined: string): string {
  const lower = combined.toLowerCase();
  if (lower.includes("invoice_no") || lower.includes("invoice_number")) {
    return "This invoice number already exists. Please use Auto or choose another number.";
  }
  if (lower.includes("voucher_no") || lower.includes("voucher_number")) {
    return "This voucher number already exists. Please use Auto or choose another number.";
  }
  if (lower.includes("quotation_number")) {
    return "This quotation number already exists. Please try another number.";
  }
  if (lower.includes("refund_no") || lower.includes("record_no")) {
    return "This refund or void reference number already exists.";
  }
  if (lower.includes("reference_number") || lower.includes("expenses")) {
    return "This expense reference number already exists.";
  }
  if (lower.includes("reminder_no")) {
    return "This reminder number already exists.";
  }
  if (lower.includes("parties_agency_name")) {
    return "A client or vendor with this name already exists.";
  }
  if (lower.includes("party_code") || lower.includes("client_code") || lower.includes("vendor_code")) {
    return "This client or vendor code is already in use.";
  }
  if (lower.includes("accounts_agency_name")) {
    return "An account with this name already exists.";
  }
  if (lower.includes("pnr") || lower.includes("ticket_no") || lower.includes("passport")) {
    return "A record with this PNR, ticket, or passport number already exists.";
  }
  return "A record with this number or name already exists.";
}

export function parseSupabaseError(
  error: unknown,
  fallbackMessage = "Could not complete the request. Please try again."
): ParsedSupabaseError {
  const { code, message, details, hint, status } = extractRawDetails(error);
  const combined = `${code} ${message} ${details} ${hint}`.trim();
  const lower = combined.toLowerCase();

  if (
    (typeof navigator !== "undefined" && navigator.onLine === false) ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed") ||
    lower.includes("err_network") ||
    lower.includes("econnrefused") ||
    lower.includes("fetch failed")
  ) {
    return {
      code: code || "NETWORK_ERROR",
      userMessage: "Network connection issue. Please check your internet and try again.",
      isDuplicate: false,
      isPermissionDenied: false,
      isNetworkError: true,
    };
  }

  for (const known of KNOWN_FRIENDLY_RPC_PATTERNS) {
    if (known.test.test(combined)) {
      return {
        code: code || "VALIDATION_ERROR",
        userMessage: known.message,
        isDuplicate: false,
        isPermissionDenied: known.message.toLowerCase().includes("permission"),
        isNetworkError: false,
      };
    }
  }

  if (code === "23505" || lower.includes("duplicate key value") || lower.includes("unique constraint")) {
    return {
      code: "23505",
      userMessage: mapDuplicateMessage(combined),
      isDuplicate: true,
      isPermissionDenied: false,
      isNetworkError: false,
    };
  }

  if (code === "23503" || lower.includes("violates foreign key constraint")) {
    return {
      code: "23503",
      userMessage: "This record is linked to other entries or references a missing item.",
      isDuplicate: false,
      isPermissionDenied: false,
      isNetworkError: false,
    };
  }

  if (code === "23502" || lower.includes("violates not-null constraint")) {
    return {
      code: "23502",
      userMessage: "Please fill in all required fields before saving.",
      isDuplicate: false,
      isPermissionDenied: false,
      isNetworkError: false,
    };
  }

  if (
    code === "42501" ||
    status === 403 ||
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("403 forbidden")
  ) {
    return {
      code: "42501",
      userMessage: "You do not have permission to perform this action.",
      isDuplicate: false,
      isPermissionDenied: true,
      isNetworkError: false,
    };
  }

  if (code === "23514" || lower.includes("violates check constraint")) {
    return {
      code: "23514",
      userMessage: "One or more entered values are invalid. Please review and try again.",
      isDuplicate: false,
      isPermissionDenied: false,
      isNetworkError: false,
    };
  }

  if (code === "22P02" || code === "22007" || code === "22008") {
    return {
      code,
      userMessage: "Please enter valid numbers and dates.",
      isDuplicate: false,
      isPermissionDenied: false,
      isNetworkError: false,
    };
  }

  if (code === "PGRST116") {
    return {
      code,
      userMessage: "Record not found or already removed.",
      isDuplicate: false,
      isPermissionDenied: false,
      isNetworkError: false,
    };
  }

  // Never leak raw Postgres/SQL internals in UI toasts.
  const looksLikeRawDb =
    /sql|postgres|pg_|constraint|relation|column|schema|syntax error|pgrst|violates|row-level|function public\.|trigger/i.test(
      message
    );

  return {
    code: code || "UNKNOWN",
    userMessage: looksLikeRawDb || !message ? fallbackMessage : message,
    isDuplicate: false,
    isPermissionDenied: false,
    isNetworkError: false,
  };
}

export function handleSupabaseError(
  error: unknown,
  fallbackMessage = "Could not save changes. Please try again.",
  contextLabel = "Supabase operation failed"
): string {
  console.error(`[TAMS Error] ${contextLabel}:`, error);
  const parsed = parseSupabaseError(error, fallbackMessage);
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

