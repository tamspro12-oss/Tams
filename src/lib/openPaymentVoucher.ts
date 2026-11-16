import { toast } from "sonner";
import {
  buildPaymentVoucherUrl,
  hasPaymentPermission,
  normalizeVoucherDirection,
  type OpenPaymentVoucherParams,
  type PaymentPermissionInput,
  type VoucherDirection,
} from "@/lib/paymentVoucherHelpers";

export interface OpenPaymentVoucherDependencies {
  openDialog?: (params: OpenPaymentVoucherParams) => void;
  navigate?: (url: string) => void;
  getPermissionState?: () => PaymentPermissionInput | null | undefined;
  notifyError?: (message: string) => void;
  resolvePartyDirection?: (partyId: string) => VoucherDirection | undefined;
}

type DialogOpenerFn = (params: OpenPaymentVoucherParams) => void;
type NavigatorFn = (url: string) => void;
type PermissionGetterFn = () => PaymentPermissionInput | null | undefined;
type PartyDirectionResolverFn = (partyId: string) => VoucherDirection | undefined;

let registeredDialogOpener: DialogOpenerFn | null = null;
let registeredNavigator: NavigatorFn | null = null;
let registeredPermissionGetter: PermissionGetterFn | null = null;
let registeredDirectionResolver: PartyDirectionResolverFn | null = null;

export function registerPaymentVoucherHost(handlers: {
  openDialog: DialogOpenerFn;
  navigate?: NavigatorFn;
  getPermissionState?: PermissionGetterFn;
  resolvePartyDirection?: PartyDirectionResolverFn;
}): () => void {
  registeredDialogOpener = handlers.openDialog;
  registeredNavigator = handlers.navigate || null;
  registeredPermissionGetter = handlers.getPermissionState || null;
  registeredDirectionResolver = handlers.resolvePartyDirection || null;

  return () => {
    if (registeredDialogOpener === handlers.openDialog) {
      registeredDialogOpener = null;
      registeredNavigator = null;
      registeredPermissionGetter = null;
      registeredDirectionResolver = null;
    }
  };
}

export type OpenPaymentVoucherOutcome =
  | { opened: true; mode: "dialog" | "navigation"; url?: string }
  | { opened: false; reason: "forbidden" | "unavailable" };

/**
 * Shared entrypoint used by every "New Payment" button in the app.
 * Opens the Payment Voucher dialog on top of the current screen when mounted,
 * or navigates to `/app/sales-expenses?tab=payment-vouchers&new=1&party=...&direction=...`.
 */
export function openPaymentVoucher(
  params: OpenPaymentVoucherParams = {},
  deps?: OpenPaymentVoucherDependencies
): OpenPaymentVoucherOutcome {
  const getPerm = deps?.getPermissionState ?? registeredPermissionGetter;
  const notifyErr = deps?.notifyError ?? ((msg: string) => toast.error(msg));
  const permState = getPerm ? getPerm() : null;

  if (permState && !permState.isLoading && !hasPaymentPermission(permState)) {
    notifyErr("You do not have permission to record payments.");
    return { opened: false, reason: "forbidden" };
  }

  const partyId = (params.partyId || "").trim() || undefined;
  const resolvedDirection =
    normalizeVoucherDirection(params.direction) ||
    (partyId && (deps?.resolvePartyDirection ?? registeredDirectionResolver)?.(partyId)) ||
    undefined;

  const payload: OpenPaymentVoucherParams = {
    ...params,
    partyId,
    direction: resolvedDirection,
  };

  const dialogOpener = deps?.openDialog ?? registeredDialogOpener;
  if (dialogOpener) {
    dialogOpener(payload);
    return { opened: true, mode: "dialog" };
  }

  const url = buildPaymentVoucherUrl(payload);
  const navigatorFn = deps?.navigate ?? registeredNavigator;
  if (navigatorFn) {
    navigatorFn(url);
    return { opened: true, mode: "navigation", url };
  }

  if (typeof window !== "undefined" && window.location) {
    window.location.assign(url);
    return { opened: true, mode: "navigation", url };
  }

  return { opened: false, reason: "unavailable" };
}

