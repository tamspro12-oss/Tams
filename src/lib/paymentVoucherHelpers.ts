export type VoucherDirection = "received" | "paid";

export interface PaymentPermissionInput {
  isSubUser: boolean;
  isActive?: boolean;
  permissions?: unknown;
  isLoading?: boolean;
}

export interface PartyLike {
  id: string;
  name: string;
  code?: string | null;
  type?: "client" | "vendor" | "both" | string;
  current_balance?: number | null;
  isLegacyRecord?: boolean;
}

export interface OpenPaymentVoucherParams {
  partyId?: string | null;
  direction?: VoucherDirection | "in" | "out" | null;
  invoiceNo?: string | null;
  amount?: number | null;
  onSuccess?: () => void;
}

export interface ResolvedVoucherOpenState {
  status: "ready" | "loading" | "not_found" | "forbidden";
  partyId: string;
  party: PartyLike | null;
  direction: VoucherDirection;
  friendlyMessage: string | null;
}

function moduleHasWrite(permissions: Record<string, any>, moduleName: string): boolean {
  const val = permissions[moduleName];
  if (typeof val === "boolean") return val;
  if (val && typeof val === "object") return val.write === true;
  return false;
}

/**
 * Checks whether the current user has permission to record payment vouchers.
 * Mirrors the server-side `save_payment_voucher_atomic` permission check while
 * also supporting an explicit `payments` permission key if configured.
 */
export function hasPaymentPermission(
  perm: PaymentPermissionInput | null | undefined,
  partyType?: "client" | "vendor" | "both" | string | null
): boolean {
  if (!perm) return true;
  if (!perm.isSubUser) return true;
  if (perm.isActive === false) return false;
  if (!perm.permissions || typeof perm.permissions !== "object" || Array.isArray(perm.permissions)) {
    return false;
  }

  const perms = perm.permissions as Record<string, any>;

  if ("payments" in perms) {
    return moduleHasWrite(perms, "payments");
  }

  if (partyType === "client") {
    return (
      moduleHasWrite(perms, "clients") ||
      moduleHasWrite(perms, "bookings") ||
      moduleHasWrite(perms, "invoices")
    );
  }

  if (partyType === "vendor") {
    return (
      moduleHasWrite(perms, "vendors") ||
      moduleHasWrite(perms, "bookings") ||
      moduleHasWrite(perms, "invoices")
    );
  }

  return (
    moduleHasWrite(perms, "bookings") ||
    moduleHasWrite(perms, "invoices") ||
    moduleHasWrite(perms, "clients") ||
    moduleHasWrite(perms, "vendors")
  );
}

export function normalizeVoucherDirection(
  raw?: string | null
): VoucherDirection | undefined {
  if (!raw) return undefined;
  const clean = raw.trim().toLowerCase();
  if (clean === "received" || clean === "in" || clean === "crv") return "received";
  if (clean === "paid" || clean === "out" || clean === "cpv") return "paid";
  return undefined;
}

export function resolveDefaultDirectionForParty(
  party: Pick<PartyLike, "type" | "current_balance"> | null | undefined,
  requestedDirection?: string | null
): VoucherDirection {
  const explicit = normalizeVoucherDirection(requestedDirection);
  if (explicit) return explicit;
  if (!party) return "received";
  if (party.type === "vendor") return "paid";
  if (party.type === "both" && Number(party.current_balance || 0) < 0) return "paid";
  return "received";
}

export function resolveVoucherOpenState(opts: {
  partyId?: string | null;
  direction?: string | null;
  parties: PartyLike[];
  isLoadingParties?: boolean;
  hasPermission?: boolean;
}): ResolvedVoucherOpenState {
  const requestedId = (opts.partyId || "").trim();
  const fallbackDirection = normalizeVoucherDirection(opts.direction) || "received";

  if (opts.hasPermission === false) {
    return {
      status: "forbidden",
      partyId: "",
      party: null,
      direction: fallbackDirection,
      friendlyMessage: "You do not have permission to record payments.",
    };
  }

  if (!requestedId) {
    return {
      status: "ready",
      partyId: "",
      party: null,
      direction: fallbackDirection,
      friendlyMessage: null,
    };
  }

  const matched = opts.parties.find((p) => p.id === requestedId) || null;
  if (matched) {
    return {
      status: "ready",
      partyId: matched.id,
      party: matched,
      direction: resolveDefaultDirectionForParty(matched, opts.direction),
      friendlyMessage: null,
    };
  }

  if (opts.isLoadingParties) {
    return {
      status: "loading",
      partyId: requestedId,
      party: null,
      direction: fallbackDirection,
      friendlyMessage: null,
    };
  }

  return {
    status: "not_found",
    partyId: "",
    party: null,
    direction: fallbackDirection,
    friendlyMessage:
      "We couldn't find that client or vendor in your agency. You can pick a party below.",
  };
}

export function buildPaymentVoucherUrl(params: OpenPaymentVoucherParams): string {
  const sp = new URLSearchParams();
  sp.set("tab", "payment-vouchers");
  sp.set("new", "1");

  const partyId = (params.partyId || "").trim();
  if (partyId) {
    sp.set("party", partyId);
  }

  const dir = normalizeVoucherDirection(params.direction);
  if (dir) {
    sp.set("direction", dir);
  }

  const inv = (params.invoiceNo || "").trim();
  if (inv) {
    sp.set("invoice", inv);
  }

  if (typeof params.amount === "number" && Number.isFinite(params.amount) && params.amount > 0) {
    sp.set("amount", String(params.amount));
  }

  return `/app/sales-expenses?${sp.toString()}`;
}

export interface ParsedVoucherUrlParams {
  shouldOpen: boolean;
  partyId: string;
  direction?: VoucherDirection;
  invoiceNo: string;
  amount?: number;
  hasTransientParams: boolean;
}

export function parsePaymentVoucherUrlParams(
  searchParams: URLSearchParams | string
): ParsedVoucherUrlParams {
  const sp =
    typeof searchParams === "string"
      ? new URLSearchParams(searchParams.startsWith("?") ? searchParams.slice(1) : searchParams)
      : searchParams;

  const tab = sp.get("tab");
  const isNew = sp.get("new") === "1" || sp.get("action") === "new";
  const partyId = (sp.get("party") || "").trim();
  const direction = normalizeVoucherDirection(sp.get("direction"));
  const invoiceNo = (sp.get("invoice") || "").trim();
  const rawAmt = Number.parseFloat(sp.get("amount") || "");
  const amount = Number.isFinite(rawAmt) && rawAmt > 0 ? rawAmt : undefined;

  const isVoucherTab = !tab || tab === "payment-vouchers";
  const shouldOpen = Boolean(isVoucherTab && isNew);
  const hasTransientParams = Boolean(
    sp.has("new") || sp.has("action") || sp.has("party") || sp.has("direction") || sp.has("invoice") || sp.has("amount")
  );

  return {
    shouldOpen,
    partyId,
    direction,
    invoiceNo,
    amount,
    hasTransientParams,
  };
}

export function clearPaymentVoucherUrlParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete("new");
  next.delete("action");
  next.delete("party");
  next.delete("direction");
  next.delete("invoice");
  next.delete("amount");
  return next;
}
