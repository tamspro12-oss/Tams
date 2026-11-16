import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useParties } from "@/hooks/useParties";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { registerPaymentVoucherHost } from "@/lib/openPaymentVoucher";
import {
  normalizeVoucherDirection,
  resolveDefaultDirectionForParty,
  type OpenPaymentVoucherParams,
  type PaymentPermissionInput,
  type VoucherDirection,
} from "@/lib/paymentVoucherHelpers";

const LazyPaymentVoucherForm = lazy(() =>
  import("@/components/vouchers/PaymentVoucherForm").then((m) => ({
    default: m.PaymentVoucherForm,
  }))
);

interface HostDialogState {
  open: boolean;
  hasOpenedOnce: boolean;
  params: OpenPaymentVoucherParams;
}

/**
 * Global host for the shared `openPaymentVoucher({ partyId, direction })` API.
 * Mounted once inside DashboardLayout so New Payment buttons anywhere in the app
 * open the Payment Voucher form directly on top of the current screen.
 */
export const PaymentVoucherHost: React.FC = () => {
  const navigate = useNavigate();
  const { parties } = useParties();
  const { isSubUser, isActive, permissions, isLoading: isLoadingPerms } = useUserPermissions();

  const [dialogState, setDialogState] = useState<HostDialogState>({
    open: false,
    hasOpenedOnce: false,
    params: {},
  });

  const permRef = useRef<PaymentPermissionInput>({
    isSubUser,
    isActive,
    permissions,
    isLoading: isLoadingPerms,
  });
  permRef.current = {
    isSubUser,
    isActive,
    permissions,
    isLoading: isLoadingPerms,
  };

  const partiesRef = useRef(parties);
  partiesRef.current = parties;

  const handleOpenDialog = useCallback((params: OpenPaymentVoucherParams) => {
    setDialogState({ open: true, hasOpenedOnce: true, params });
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setDialogState((prev) => ({
      ...prev,
      open,
    }));
  }, []);

  const resolvePartyDirection = useCallback((partyId: string): VoucherDirection | undefined => {
    const matched = partiesRef.current.find((p) => p.id === partyId);
    if (!matched) return undefined;
    return resolveDefaultDirectionForParty(matched);
  }, []);

  useEffect(() => {
    return registerPaymentVoucherHost({
      openDialog: handleOpenDialog,
      navigate: (url: string) => navigate(url),
      getPermissionState: () => permRef.current,
      resolvePartyDirection,
    });
  }, [handleOpenDialog, navigate, resolvePartyDirection]);

  // Warm the PaymentVoucherForm chunk during browser idle time so the first click opens immediately
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void import("@/components/vouchers/PaymentVoucherForm").catch(() => {});
    }, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  if (!dialogState.open && !dialogState.hasOpenedOnce) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <LazyPaymentVoucherForm
        open={dialogState.open}
        onOpenChange={handleOpenChange}
        onSuccess={dialogState.params.onSuccess}
        initialPartyId={dialogState.params.partyId || undefined}
        initialDirection={normalizeVoucherDirection(dialogState.params.direction)}
        initialInvoiceNo={dialogState.params.invoiceNo || undefined}
        initialAmount={dialogState.params.amount ?? undefined}
      />
    </Suspense>
  );
};
