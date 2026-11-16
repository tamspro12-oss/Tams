import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  PartyLedgerView,
  type PartyLedgerViewParty,
} from "@/components/parties/PartyLedgerView";

class LedgerDrawerErrorBoundary extends React.Component<
  { partyId: string; onClose: () => void; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { partyId: string; onClose: () => void; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[PartyLedgerDrawer] Failed to render ledger view:", error, info);
  }

  componentDidUpdate(prevProps: { partyId: string }) {
    if (prevProps.partyId !== this.props.partyId && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center space-y-3 border rounded-lg bg-card">
          <p className="text-sm font-semibold text-foreground">
            Could not open this party ledger right now.
          </p>
          <p className="text-xs text-muted-foreground">
            Please close and try again.
          </p>
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false })}
              className="h-8 text-xs cursor-pointer"
            >
              Try again
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={this.props.onClose}
              className="h-8 text-xs cursor-pointer"
            >
              Close
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
          <LedgerDrawerErrorBoundary partyId={party.id} onClose={onClose}>
            <PartyLedgerView
              party={party}
              onToggleActive={onToggleActive}
              isUpdatingStatus={isUpdatingStatus}
            />
          </LedgerDrawerErrorBoundary>
        )}
      </SheetContent>
    </Sheet>
  );
};
