export interface ParsedSupabaseError {
  code: string;
  userMessage: string;
  isDuplicate: boolean;
  isPermissionDenied: boolean;
  isNetworkError: boolean;
}

const KNOWN_FRIENDLY_RPC_PATTERNS: Array<{ test: RegExp; message: string }> = [
  {
    test: /trial or license has expired|license has expired|license_expired/i,
    message:
      "Your trial or license has expired. Please renew your plan to create new entries. Viewing and exporting remain available.",
  },
  {
    test: /email not confirmed|email_not_confirmed/i,
    message: "Please confirm your email address first using the link sent to your inbox.",
  },
  {
    test: /invalid login credentials/i,
    message: "Incorrect email or password. Please check and try again.",
  },
  {
    test: /user already registered|already been registered|email.*already exists/i,
    message: "An account with this email already exists. Please log in or reset your password.",
  },
  {
    test: /rate limit|too many requests|over_email_send_rate_limit/i,
    message: "Too many attempts. Please wait a minute and try again.",
  },
  {
    test: /otp_expired|token has expired|email link is invalid or has expired/i,
    message: "This confirmation link has expired or was already used.",
  },
  {
    test: /jwt expired|invalid jwt|refresh_token_not_found|session.*expired|not authenticated/i,
    message: "Your session has expired. Please sign in again.",
  },
  {
    test: /amount paid cannot exceed total amount/i,
    message: "Amount paid cannot exceed the total amount.",
  },
  {
    test: /amount paid to vendor cannot exceed purchasing cost/i,
    message: "Amount paid to vendor cannot exceed the purchasing cost.",
  },
  {
    test: /select a vendor when amount paid to vendor/i,
    message: "Please select a vendor before entering an amount paid to vendor.",
  },
  {
    test: /vendor payment at booking requires the latest database update/i,
    message:
      "Vendor payment at booking requires the latest database update. Nothing was saved — please apply the latest migration and try again.",
  },
  {
    test: /amounts? cannot be negative/i,
    message: "Amounts cannot be negative.",
  },
  {
    test: /amount must be greater than zero|transfer amount must be greater than zero/i,
    message: "Amount must be greater than zero.",
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
    test: /booking invoice not found/i,
    message: "Selected booking invoice was not found for your agency.",
  },
  {
    test: /cash\/bank entry not found/i,
    message: "This cash or bank entry was already removed or not found.",
  },
  {
    test: /opening balance record not found/i,
    message: "This opening balance entry was not found.",
  },
  {
    test: /bank account not found/i,
    message: "This bank account was not found.",
  },
  {
    test: /valid custom/i,
    message: "Please enter a valid custom document number.",
  },
  {
    test: /you do not have permission|only the agency owner/i,
    message: "You do not have permission to perform this action.",
  },
  {
    test: /inactive or deactivated|sub-user account is inactive/i,
    message: "Your sub-user account has been deactivated. Contact your administrator.",
  },
  {
    test: /does not have an assigned agency/i,
    message: "No agency is assigned to your account. Please contact support.",
  },
  {
    test: /edit reason is required/i,
    message: "Please enter a reason for this edit.",
  },
  {
    test: /voided or refunded invoices cannot be edited/i,
    message: "Voided or refunded invoices cannot be edited.",
  },
  {
    test: /voided payment vouchers cannot be edited/i,
    message: "Voided payment vouchers cannot be edited.",
  },
  {
    test: /cannot change amount on a voucher linked to a voided invoice/i,
    message: "Cannot change the amount of a voucher linked to a voided invoice.",
  },
  {
    test: /payment voucher not found/i,
    message: "Selected payment voucher was not found for your agency.",
  },
  {
    test: /refund record not found/i,
    message: "Selected refund record was not found for your agency.",
  },
  {
    test: /audit history is append-only/i,
    message: "Audit history cannot be modified or deleted.",
  },
  {
    test: /could not find the function.*edit_(booking_invoice|payment_voucher|refund)_atomic/i,
    message: "The edit feature is waiting for the latest database update. Please apply the migration and try again.",
  },
];

export function extractRawErrorDetails(error: unknown): {
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
  const nested = (
    err.error && typeof err.error === "object"
      ? err.error
      : err.cause && typeof err.cause === "object"
        ? err.cause
        : {}
  ) as Record<string, unknown>;

  return {
    code: String(err.code || nested.code || "").trim(),
    message: String(err.message || nested.message || "").trim(),
    details: String(err.details || nested.details || "").trim(),
    hint: String(err.hint || nested.hint || "").trim(),
    status:
      typeof err.status === "number"
        ? err.status
        : typeof nested.status === "number"
          ? (nested.status as number)
          : undefined,
  };
}

export function isDuplicateKeyError(error: unknown): boolean {
  const { code, message } = extractRawErrorDetails(error);
  if (code === "23505") return true;
  const lower = message.toLowerCase();
  return (
    lower.includes("duplicate key value") ||
    lower.includes("already exists") ||
    lower.includes("unique constraint")
  );
}

export function isMissingFunctionError(error: unknown, fnName?: string): boolean {
  const { code, message, details, hint, status } = extractRawErrorDetails(error);
  const combined = `${message} ${details} ${hint}`.toLowerCase();
  const isNotFoundCode = code === "42883" || code === "PGRST202" || status === 404;
  const isMissingFnText =
    combined.includes("could not find the function") ||
    (combined.includes("function") && combined.includes("does not exist")) ||
    combined.includes("schema cache");

  if (!isNotFoundCode && !isMissingFnText) {
    return false;
  }

  if (fnName) {
    return combined.includes(fnName.toLowerCase()) || isNotFoundCode;
  }
  return true;
}

export function isMissingTableError(error: unknown, tableName?: string): boolean {
  const { code, message, details, hint, status } = extractRawErrorDetails(error);
  const combined = `${message} ${details} ${hint}`.toLowerCase();
  const isNotFoundCode = code === "42P01" || code === "PGRST205" || status === 404;
  const isMissingTableText =
    combined.includes("could not find the table") ||
    (combined.includes("relation") && combined.includes("does not exist"));

  if (!isNotFoundCode && !isMissingTableText) {
    return false;
  }

  if (tableName) {
    return combined.includes(tableName.toLowerCase()) || isNotFoundCode;
  }
  return true;
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
  if (lower.includes("accounts_agency_name") || lower.includes("agency_banks")) {
    return "A bank or account with this name already exists.";
  }
  if (lower.includes("pnr") || lower.includes("ticket_no") || lower.includes("passport")) {
    return "A record with this PNR, ticket, or passport number already exists.";
  }
  return "A record with this number or name already exists.";
}

export function parseFriendlyError(
  error: unknown,
  fallbackMessage = "Something went wrong. Please try again."
): ParsedSupabaseError {
  const { code, message, details, hint, status } = extractRawErrorDetails(error);
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
      userMessage: "Connection problem. Please check your internet and try again.",
      isDuplicate: false,
      isPermissionDenied: false,
      isNetworkError: true,
    };
  }

  if (code === "57014" || lower.includes("timeout") || lower.includes("timed out")) {
    return {
      code: code || "TIMEOUT",
      userMessage: "The request took too long. Please try again.",
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
        isPermissionDenied:
          known.message.toLowerCase().includes("permission") ||
          known.message.toLowerCase().includes("deactivated"),
        isNetworkError: false,
      };
    }
  }

  if (status === 429) {
    return {
      code: code || "429",
      userMessage: "Too many attempts. Please wait a minute and try again.",
      isDuplicate: false,
      isPermissionDenied: false,
      isNetworkError: false,
    };
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
      userMessage: "This record is linked to other entries and cannot be modified.",
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

  const looksTechnicalOrUnsafe =
    /sql|postgres|pg_|constraint|relation|column|schema|syntax error|pgrst|violates|row-level|function public\.|trigger|supabase|gotrue|edge function|at\s+https?:\/\/|\n\s+at\s+/i.test(
      message
    );

  const safeCustomMessage =
    message && !looksTechnicalOrUnsafe && message.length <= 160 ? message : fallbackMessage;

  return {
    code: code || "UNKNOWN",
    userMessage: safeCustomMessage,
    isDuplicate: false,
    isPermissionDenied: false,
    isNetworkError: false,
  };
}

/**
 * Converts any technical/Supabase error into a short, friendly message safe for end users.
 * Always logs technical details to console via `logAndFriendlyMessage` when handling failures.
 */
export function toFriendlyMessage(
  error: unknown,
  fallbackMessage = "Something went wrong. Please try again."
): string {
  return parseFriendlyError(error, fallbackMessage).userMessage;
}

export function logAndFriendlyMessage(
  contextLabel: string,
  error: unknown,
  fallbackMessage = "Something went wrong. Please try again."
): string {
  console.error(`[TAMS Error] ${contextLabel}:`, error);
  return toFriendlyMessage(error, fallbackMessage);
}
