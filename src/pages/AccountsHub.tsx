import React from "react";
import { useSearchParams } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Receipt, RotateCcw, BarChart3, Scale } from "lucide-react";

// Existing sub-modules (100% preserved)
import BankCashManager from "@/pages/BankCashManager";
import Expenses from "@/pages/Expenses";
import Refunds from "@/pages/Refunds";
import Reports from "@/pages/Reports";
import OpeningBalances from "@/pages/OpeningBalances";

type AccountsTab = "bank-cash" | "expenses" | "refunds" | "reports" | "opening-balances";

export default function AccountsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get("tab") as AccountsTab) || "bank-cash";

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val }, { replace: true });
  };

  return (
    <div className="space-y-4">
      <SeoHead
        title="Accounts & Financial Hub - TAMS Pro"
        description="Comprehensive accounting suite: cash flow, bank positions, daily operating expenses, customer refunds, financial reports, and opening balances."
        path="/app/accounts"
      />

      {/* Hub Top Navigation Tabs */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md pb-2 pt-1 border-b border-border/50">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto h-11 p-1 bg-muted/60 border">
            <TabsTrigger value="bank-cash" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <Wallet className="w-4 h-4 text-emerald-500" />
              Bank & Cash
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <Receipt className="w-4 h-4 text-red-500" />
              Expenses
            </TabsTrigger>
            <TabsTrigger value="refunds" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <RotateCcw className="w-4 h-4 text-amber-500" />
              Refunds
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              Financial Reports
            </TabsTrigger>
            <TabsTrigger value="opening-balances" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <Scale className="w-4 h-4 text-purple-500" />
              Opening Balances
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Active Tab View */}
      <div className="pt-1">
        {currentTab === "bank-cash" && <BankCashManager />}
        {currentTab === "expenses" && <Expenses />}
        {currentTab === "refunds" && <Refunds />}
        {currentTab === "reports" && <Reports />}
        {currentTab === "opening-balances" && <OpeningBalances />}
      </div>
    </div>
  );
}

