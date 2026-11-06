import React, { useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { FileText, MessageSquare } from "lucide-react";
import { useQuotations } from "@/hooks/useQuotations";
import { useQueries } from "@/hooks/useStorage";
import { cn } from "@/lib/utils";

import Quotations from "@/pages/Quotations";
import Queries from "@/pages/Queries";

type LeadsQuotesTab = "quotations" | "queries";

export default function LeadsQuotesHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const currentTab: LeadsQuotesTab = rawTab === "queries" ? "queries" : "quotations";

  const { quotations = [] } = useQuotations();
  const { queries = [] } = useQueries();

  // If no tab param, set ?tab=quotations by default without polluting history
  useEffect(() => {
    if (!rawTab) {
      setSearchParams({ tab: "quotations" }, { replace: true });
    }
  }, [rawTab, setSearchParams]);

  const handleTabChange = useCallback(
    (val: LeadsQuotesTab) => {
      setSearchParams({ tab: val }, { replace: true });
    },
    [setSearchParams]
  );

  // Keyboard shortcuts: Ctrl/Cmd + 1 = Quotations, Ctrl/Cmd + 2 = Queries
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "1" || e.key === "2")) {
        e.preventDefault();
        if (e.key === "1") handleTabChange("quotations");
        if (e.key === "2") handleTabChange("queries");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTabChange]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden space-y-2">
      <SeoHead
        title="Queries & Quotations Hub - TAMS Pro"
        description="Manage customer travel inquiries, lead follow-ups, and professional cost quotations."
        path="/app/leads-quotes"
      />

      {/* Pill Switcher / Segmented Control (Height 40px / h-10) */}
      <div className="shrink-0 flex items-center justify-between gap-2 pb-1 border-b border-border/50">
        <div className="w-full sm:w-auto p-1 bg-muted/60 dark:bg-muted/40 border border-border/70 rounded-xl h-10 flex items-center gap-1 shadow-inner">
          {/* Tab 1: Quotations (First and Default) */}
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === "quotations"}
            onClick={() => handleTabChange("quotations")}
            className={cn(
              "flex-1 sm:flex-initial h-8 px-3 sm:px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-150 select-none",
              currentTab === "quotations"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
            title="Quotations (Ctrl/Cmd+1)"
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Quotations</span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors",
                currentTab === "quotations"
                  ? "bg-primary-foreground/20 text-primary-foreground font-bold"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {quotations.length}
            </span>
          </button>

          {/* Tab 2: Client Queries & Leads */}
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === "queries"}
            onClick={() => handleTabChange("queries")}
            className={cn(
              "flex-1 sm:flex-initial h-8 px-3 sm:px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-150 select-none",
              currentTab === "queries"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
            title="Client Queries & Leads (Ctrl/Cmd+2)"
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Client Queries & Leads</span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors",
                currentTab === "queries"
                  ? "bg-primary-foreground/20 text-primary-foreground font-bold"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {queries.length}
            </span>
          </button>
        </div>

        {/* Shortcut Hint on Desktop */}
        <div className="hidden md:flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
          <span>Ctrl+1: Quotes</span>
          <span>•</span>
          <span>Ctrl+2: Queries</span>
          <span>•</span>
          <span>N: New</span>
        </div>
      </div>

      {/* Active Tab View */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {currentTab === "quotations" && <Quotations />}
        {currentTab === "queries" && <Queries />}
      </div>
    </div>
  );
}
