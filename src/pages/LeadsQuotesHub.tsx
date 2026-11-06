import React from "react";
import { useSearchParams } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, FileText } from "lucide-react";

// Existing sub-modules (100% preserved)
import Queries from "@/pages/Queries";
import Quotations from "@/pages/Quotations";

type LeadsQuotesTab = "queries" | "quotations";

export default function LeadsQuotesHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get("tab") as LeadsQuotesTab) || "queries";

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val }, { replace: true });
  };

  return (
    <div className="space-y-4">
      <SeoHead
        title="Queries & Quotations Hub - TAMS Pro"
        description="Manage customer travel inquiries, lead follow-ups, and professional cost quotations."
        path="/app/leads-quotes"
      />

      {/* Hub Top Navigation Tabs */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md pb-2 pt-1 border-b border-border/50">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto h-11 p-1 bg-muted/60 border">
            <TabsTrigger value="queries" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              Client Queries & Leads
            </TabsTrigger>
            <TabsTrigger value="quotations" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <FileText className="w-4 h-4 text-emerald-500" />
              Quotations & Estimates
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Active Tab View */}
      <div className="pt-1">
        {currentTab === "queries" && <Queries />}
        {currentTab === "quotations" && <Quotations />}
      </div>
    </div>
  );
}

