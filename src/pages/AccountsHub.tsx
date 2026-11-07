import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Scale,
  FileText,
  Wallet,
  Receipt,
  RotateCcw,
  BarChart3,
  Plus,
} from "lucide-react";

// Modern Ledger & Statements Modules
import { AgencyLedgerTab } from "@/components/accounts/AgencyLedgerTab";
import { StatementsTab } from "@/components/accounts/StatementsTab";
import { AddEntryModal } from "@/components/accounts/AddEntryModal";

// Existing sub-modules (100% preserved)
import BankCashManager from "@/pages/BankCashManager";
import Expenses from "@/pages/Expenses";
import Refunds from "@/pages/Refunds";
import Reports from "@/pages/Reports";
import OpeningBalances from "@/pages/OpeningBalances";

// Party Modals for 1-click opening from ledger
import { DirectBookingDetailModal } from "@/components/bookings/DirectBookingDetailModal";
import { AgentDetailModal } from "@/components/bookings/AgentDetailModal";
import { useClients } from "@/hooks/useStorage";
import { useB2BAgents, B2BAgent } from "@/hooks/useB2BAgents";

type AccountsTab =
  | "ledger"
  | "statements"
  | "bank-cash"
  | "expenses"
  | "refunds"
  | "reports"
  | "opening-balances";

export default function AccountsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Ledger is FIRST and the DEFAULT tab
  const currentTab = (searchParams.get("tab") as AccountsTab) || "ledger";

  // Persistent Add Entry Modal
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);

  // Party Card Modal states (opens on clicking party in ledger)
  const [selectedClientForModal, setSelectedClientForModal] = useState<any | null>(null);
  const [selectedAgentForModal, setSelectedAgentForModal] = useState<B2BAgent | null>(null);

  const { clients } = useClients();
  const { agents } = useB2BAgents();

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val }, { replace: true });
  };

  const handleOpenPartyCard = (partyId: string, partyType: "client" | "agent" | "vendor") => {
    if (partyType === "client") {
      const foundClient = clients.find((c) => c.id === partyId);
      if (foundClient) {
        setSelectedClientForModal(foundClient);
      }
    } else if (partyType === "agent") {
      const foundAgent = agents.find((a) => a.id === partyId);
      if (foundAgent) {
        setSelectedAgentForModal(foundAgent);
      }
    } else if (partyType === "vendor") {
      // Navigate to vendor page or tab
      window.location.href = `/app/vendors/${partyId}`;
    }
  };

  return (
    <div className="space-y-4">
      <SeoHead
        title="Accounts & Financial Hub - TAMS Pro"
        description="Comprehensive accounting suite: agency-wide master ledger, financial statements, cash & bank positions, daily operating expenses, customer refunds, reports, and opening balances."
        path="/app/accounts"
      />

      {/* Hub Top Navigation Tabs + Add Entry Button (Visible on EVERY tab) */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md pb-2 pt-1 border-b border-border/50">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          {/* Canonical 7 Tabs in exact requested order */}
          <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full overflow-x-auto">
            <TabsList className="w-full justify-start overflow-x-auto h-11 p-1 bg-muted/60 border">
              {/* 1. Ledger (DEFAULT) */}
              <TabsTrigger value="ledger" className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer">
                <Scale className="w-4 h-4 text-purple-600" />
                Ledger
              </TabsTrigger>

              {/* 2. Statements */}
              <TabsTrigger value="statements" className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer">
                <FileText className="w-4 h-4 text-blue-600" />
                Statements
              </TabsTrigger>

              {/* 3. Bank & Cash */}
              <TabsTrigger value="bank-cash" className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer">
                <Wallet className="w-4 h-4 text-emerald-500" />
                Bank & Cash
              </TabsTrigger>

              {/* 4. Expenses */}
              <TabsTrigger value="expenses" className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer">
                <Receipt className="w-4 h-4 text-red-500" />
                Expenses
              </TabsTrigger>

              {/* 5. Refunds */}
              <TabsTrigger value="refunds" className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer">
                <RotateCcw className="w-4 h-4 text-amber-500" />
                Refunds
              </TabsTrigger>

              {/* 6. Financial Reports */}
              <TabsTrigger value="reports" className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                Financial Reports
              </TabsTrigger>

              {/* 7. Opening Balances */}
              <TabsTrigger value="opening-balances" className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer">
                <Scale className="w-4 h-4 text-purple-500" />
                Opening Balances
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Add Entry Button: Always visible on EVERY tab */}
          <div className="shrink-0 flex items-center justify-end sm:justify-start">
            <Button
              onClick={() => setShowAddEntryModal(true)}
              className="h-10 px-4 gap-1.5 bg-primary text-primary-foreground font-bold text-xs sm:text-sm shadow-sm hover:opacity-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Entry</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Active Tab View */}
      <div className="pt-1">
        {currentTab === "ledger" && (
          <AgencyLedgerTab
            onOpenAddEntry={() => setShowAddEntryModal(true)}
            onOpenPartyCard={handleOpenPartyCard}
          />
        )}
        {currentTab === "statements" && <StatementsTab />}
        {currentTab === "bank-cash" && <BankCashManager />}
        {currentTab === "expenses" && <Expenses />}
        {currentTab === "refunds" && <Refunds />}
        {currentTab === "reports" && <Reports />}
        {currentTab === "opening-balances" && <OpeningBalances />}
      </div>

      {/* Global Add Entry Modal (Compact keyboard-friendly form) */}
      <AddEntryModal
        open={showAddEntryModal}
        onOpenChange={setShowAddEntryModal}
      />

      {/* Direct Booking Modal (opened from ledger) */}
      {selectedClientForModal && (
        <DirectBookingDetailModal
          client={selectedClientForModal}
          open={!!selectedClientForModal}
          onOpenChange={(open) => !open && setSelectedClientForModal(null)}
          onEdit={() => {}}
        />
      )}

      {/* Agent Detail Modal (opened from ledger) */}
      {selectedAgentForModal && (
        <AgentDetailModal
          agent={selectedAgentForModal}
          open={!!selectedAgentForModal}
          onOpenChange={(open) => !open && setSelectedAgentForModal(null)}
          onAddBookingForAgent={() => {}}
        />
      )}
    </div>
  );
}
