import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  PartyLedgerView,
  type PartyLedgerViewParty,
} from "@/components/parties/PartyLedgerView";

interface PartyLedgerDrawerProps {
  party: PartyLedgerViewParty | null;
  onClose: () => void;
  onToggleActive?: (party: PartyLedgerViewParty) => Promise<void> | void;
  isUpdatingStatus?: boolean;
}

export const PartyLedgerDrawer: React.FC<PartyLedgerDrawerProps> = ({
  party,
  onClose,
  onToggleActive,
  isUpdatingStatus = false,
}) => {
  return (
    <Sheet open={Boolean(party)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto p-4 sm:p-6">
        <SheetHeader className="sr-only">
          <SheetTitle>{party ? `${party.name} Ledger` : "Party Ledger"}</SheetTitle>
          <SheetDescription>
            Unified party ledger showing running balance, transactions, and statement options.
          </SheetDescription>
        </SheetHeader>
        {party && (
          <PartyLedgerView
            party={party}
            onToggleActive={onToggleActive}
            isUpdatingStatus={isUpdatingStatus}
          />
        )}
      </SheetContent>
    </Sheet>
  );
};

