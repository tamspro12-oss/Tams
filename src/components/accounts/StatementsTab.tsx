import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { useAccounts, useAgencyLedger, usePartyStatement } from "@/hooks/useUnifiedTransactions";
import { useClients, useVendors } from "@/hooks/useStorage";
import { useB2BAgents } from "@/hooks/useB2BAgents";
import { useAgency } from "@/hooks/useAgency";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface StatementsTabProps {
  initialScope?: "all" | "cash" | "bank" | "party";
  initialPartyId?: string;
}

export function StatementsTab({ initialScope = "all", initialPartyId }: StatementsTabProps) {
  const [scopeType, setScopeType] = useState<"all" | "cash" | "bank" | "party">(initialScope);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [partyType, setPartyType] = useState<"client" | "agent" | "vendor">("client");
  const [selectedPartyId, setSelectedPartyId] = useState<string>(initialPartyId || "");
  const [datePreset, setDatePreset] = useState<"this_month" | "last_month" | "this_year" | "custom">("this_month");
  const [customStart, setCustomStart] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd] = useState<string>(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const { accounts, cashAccount, bankAccounts } = useAccounts();
  const { clients } = useClients();
  const { agents } = useB2BAgents();
  const { vendors } = useVendors();
  const { data: agency } = useAgency();

  // Set default bank or party if available
  React.useEffect(() => {
    if (!selectedAccountId && bankAccounts.length > 0) {
      setSelectedAccountId(bankAccounts[0].id);
    }
    if (!selectedPartyId && clients.length > 0 && partyType === "client") {
      setSelectedPartyId(clients[0].id);
    }
  }, [bankAccounts, selectedAccountId, clients, selectedPartyId, partyType]);

  // Date Range
  const dateRange = useMemo(() => {
    const now = new Date();
    if (datePreset === "this_month") {
      return {
        start: format(startOfMonth(now), "yyyy-MM-dd"),
        end: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    }
    if (datePreset === "last_month") {
      const lm = subMonths(now, 1);
      return {
        start: format(startOfMonth(lm), "yyyy-MM-dd"),
        end: format(endOfMonth(lm), "yyyy-MM-dd"),
      };
    }
    if (datePreset === "this_year") {
      return {
        start: `${now.getFullYear()}-01-01`,
        end: `${now.getFullYear()}-12-31`,
      };
    }
    return { start: customStart, end: customEnd };
  }, [datePreset, customStart, customEnd]);

  // Fetch Party Statement if scope is party
  const isPartyScope = scopeType === "party";
  const { data: partyStatementData = [] } = usePartyStatement(
    isPartyScope ? selectedPartyId : null,
    { startDate: dateRange.start, endDate: dateRange.end }
  );

  // Fetch Account/Agency statement if scope is not party
  const accountFilterId =
    scopeType === "cash" ? cashAccount?.id : scopeType === "bank" ? selectedAccountId : undefined;

  const { data: agencyStatementData = [] } = useAgencyLedger({
    startDate: dateRange.start,
    endDate: dateRange.end,
    accountId: accountFilterId,
  });

  // Selected Scope metadata (used for official PDF export)
  const scopeMetadata = useMemo(() => {
    if (scopeType === "all") {
      return {
        title: "Consolidated Agency Statement",
        subtitle: "All cash, bank accounts, and customer transactions",
      };
    }
    if (scopeType === "cash") {
      return {
        title: "Cash Account Statement",
        subtitle: cashAccount?.name || "Main Cash Account",
      };
    }
    if (scopeType === "bank") {
      const b = bankAccounts.find((x) => x.id === selectedAccountId);
      return {
        title: `Bank Account Statement — ${b?.name || "Bank"}`,
        subtitle: `Account Title: ${agency?.agency_name || "Agency"}`,
      };
    }
    if (scopeType === "party") {
      let pName = "Party";
      if (partyType === "client") pName = clients.find((c) => c.id === selectedPartyId)?.name || "Client";
      if (partyType === "agent") pName = agents.find((a) => a.id === selectedPartyId)?.agent_name || (agents.find((a) => a.id === selectedPartyId) as any)?.name || "Agent";
      if (partyType === "vendor") pName = vendors.find((v) => v.id === selectedPartyId)?.name || "Vendor";
      return {
        title: `${partyType.toUpperCase()} Statement — ${pName}`,
        subtitle: `Party ID: ${selectedPartyId?.slice(0, 8)}`,
      };
    }
    return { title: "Financial Statement", subtitle: "" };
  }, [scopeType, cashAccount, bankAccounts, selectedAccountId, selectedPartyId, partyType, clients, agents, vendors, agency]);

  // Unified Rows for the statement
  const statementRows = useMemo(() => {
    if (isPartyScope) {
      return partyStatementData.map((row) => ({
        id: row.id,
        date: row.date,
        ref: row.booking_ref || row.reference_no || "-",
        description: row.notes || row.type.toUpperCase(),
        methodOrAccount: row.account_name || row.method || "-",
        debit: row.debit,
        credit: row.credit,
        runningBalance: row.running_balance,
      }));
    } else {
      return agencyStatementData.map((row) => ({
        id: row.id,
        date: row.date,
        ref: row.booking_ref || row.reference_no || "-",
        description: `${row.party_name ? `${row.party_name}: ` : ""}${row.notes || row.type.toUpperCase()}`,
        methodOrAccount: row.account_name || row.method || "-",
        debit: row.debit,
        credit: row.credit,
        runningBalance: row.running_balance,
      }));
    }
  }, [isPartyScope, partyStatementData, agencyStatementData]);

  // Statement totals
  const totals = useMemo(() => {
    let totDebit = 0;
    let totCredit = 0;
    statementRows.forEach((r) => {
      totDebit += Number(r.debit) || 0;
      totCredit += Number(r.credit) || 0;
    });
    const opening = statementRows.length > 0 ? (statementRows[0].runningBalance || 0) - (statementRows[0].debit - statementRows[0].credit) : 0;
    const closing = statementRows.length > 0 ? (statementRows[statementRows.length - 1].runningBalance || 0) : opening;
    return {
      opening,
      totDebit,
      totCredit,
      net: totDebit - totCredit,
      closing,
    };
  }, [statementRows]);

  // Export PDF with full official header preserved
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("portrait", "mm", "a4");
      doc.setFontSize(18);
      doc.text(agency?.agency_name || "TAMS Pro Travel Agency", 14, 18);
      doc.setFontSize(9);
      const contactInfo = [
        agency?.address || "Head Office, Travel Plaza",
        agency?.phone ? `Phone: ${agency?.phone}` : "",
      ].filter(Boolean).join(" • ");
      doc.text(contactInfo, 14, 24);
      doc.setFontSize(11);
      doc.text(scopeMetadata.title, 14, 30);
      doc.setFontSize(9);
      doc.text(`Period: ${dateRange.start} to ${dateRange.end} | Generated: ${format(new Date(), "PPpp")}`, 14, 36);

      // Opening & Closing summary box
      doc.setFontSize(10);
      doc.text(
        `Opening Balance: PKR ${totals.opening.toLocaleString()}  |  Total In: PKR ${totals.totDebit.toLocaleString()}  |  Total Out: PKR ${totals.totCredit.toLocaleString()}  |  Closing: PKR ${totals.closing.toLocaleString()}`,
        14,
        42
      );

      const tableData = statementRows.map((r) => [
        r.date,
        r.ref,
        r.description,
        r.methodOrAccount,
        r.debit > 0 ? `PKR ${r.debit.toLocaleString()}` : "-",
        r.credit > 0 ? `PKR ${r.credit.toLocaleString()}` : "-",
        `PKR ${(r.runningBalance || 0).toLocaleString()}`,
      ]);

      autoTable(doc, {
        head: [["Date", "Ref/PNR", "Description", "Method/Account", "Debit", "Credit", "Balance"]],
        body: tableData,
        startY: 46,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      });

      doc.save(`Statement_${scopeType}_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("Statement PDF downloaded");
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Merged Single Section for Statement Generator, Summary & Table */}
      <Card className="border-border/80 shadow-xs overflow-hidden bg-card">
        {/* 1. Compact Single-Line Toolbar: [ Scope Type ▾ ] [ Dynamic Scope ▾ ] [ Date Range ▾ ] ........ [ Export PDF ] */}
        <div className="p-2.5 sm:p-3 border-b bg-muted/15">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 flex-1 min-w-0">
              {/* Scope Type */}
              <Select value={scopeType} onValueChange={(val: any) => setScopeType(val)}>
                <SelectTrigger className="h-8 text-xs w-full sm:w-44">
                  <SelectValue placeholder="Scope Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All (Agency Consolidated)</SelectItem>
                  <SelectItem value="cash">Cash Account</SelectItem>
                  <SelectItem value="bank">A Specific Bank</SelectItem>
                  <SelectItem value="party">A Specific Party</SelectItem>
                </SelectContent>
              </Select>

              {/* Dynamic Scope Selector: Specific Bank */}
              {scopeType === "bank" && (
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="h-8 text-xs w-full sm:w-40">
                    <SelectValue placeholder="Select Bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Dynamic Scope Selector: Party Type & Party */}
              {scopeType === "party" && (
                <>
                  <Select value={partyType} onValueChange={(val: any) => setPartyType(val)}>
                    <SelectTrigger className="h-8 text-xs w-full sm:w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="agent">B2B Agent</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
                    <SelectTrigger className="h-8 text-xs w-full sm:w-44">
                      <SelectValue placeholder="Choose Party" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {partyType === "client" &&
                        clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} {c.pnr ? `(${c.pnr})` : ""}
                          </SelectItem>
                        ))}
                      {partyType === "agent" &&
                        agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.agent_name || (a as any).name || a.business_name || "Agent"}
                          </SelectItem>
                        ))}
                      {partyType === "vendor" &&
                        vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              {/* Date Preset */}
              <Select value={datePreset} onValueChange={(val: any) => setDatePreset(val)}>
                <SelectTrigger className="h-8 text-xs w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {/* Custom Date Inputs if selected */}
              {datePreset === "custom" && (
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-8 text-xs w-32"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-8 text-xs w-32"
                  />
                </div>
              )}
            </div>

            {/* Right: Export PDF */}
            <div className="flex items-center justify-end shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="h-8 text-xs gap-1.5 font-semibold text-primary hover:text-primary px-3"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 2. Simplified Statement Header (Agency name & Statement Period) */}
        <div className="py-2.5 px-3 sm:px-4 border-b bg-muted/5 flex items-center justify-between gap-3">
          <h2 className="text-sm sm:text-base font-bold text-foreground">
            {agency?.agency_name || "TAMS Pro Travel Agency"}
          </h2>
          <div className="text-right text-xs">
            <span className="text-muted-foreground mr-1.5">Period:</span>
            <span className="font-semibold text-foreground font-mono">
              {dateRange.start} <span className="text-muted-foreground font-normal">to</span> {dateRange.end}
            </span>
          </div>
        </div>

        {/* 3. Compact 4 Summary Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 p-2.5 sm:p-3 border-b bg-background">
          <div className="p-2 sm:p-2.5 rounded-md bg-muted/30 border border-border/70">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Opening Balance</p>
            <p className="text-xs sm:text-sm font-bold text-foreground mt-0.5 font-mono">
              PKR {totals.opening.toLocaleString()}
            </p>
          </div>
          <div className="p-2 sm:p-2.5 rounded-md bg-emerald-500/5 border border-emerald-500/20">
            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Total In</p>
            <p className="text-xs sm:text-sm font-bold text-emerald-600 mt-0.5 font-mono">
              +PKR {totals.totDebit.toLocaleString()}
            </p>
          </div>
          <div className="p-2 sm:p-2.5 rounded-md bg-red-500/5 border border-red-500/20">
            <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide">Total Out</p>
            <p className="text-xs sm:text-sm font-bold text-red-500 mt-0.5 font-mono">
              -PKR {totals.totCredit.toLocaleString()}
            </p>
          </div>
          <div className="p-2 sm:p-2.5 rounded-md bg-primary/5 border border-primary/25">
            <p className="text-[10px] font-bold text-primary uppercase tracking-wide">Closing Balance</p>
            <p className="text-xs sm:text-sm font-black text-primary mt-0.5 font-mono">
              PKR {totals.closing.toLocaleString()}
            </p>
          </div>
        </div>

        {/* 4. Compact Statement Table */}
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
              <tr>
                <th className="py-2 px-3 text-left">Date</th>
                <th className="py-2 px-3 text-left">Ref / PNR</th>
                <th className="py-2 px-3 text-left">Description / Particulars</th>
                <th className="py-2 px-3 text-left">Method / Account</th>
                <th className="py-2 px-3 text-right">Debit (PKR)</th>
                <th className="py-2 px-3 text-right">Credit (PKR)</th>
                <th className="py-2 px-3 text-right">Running Balance (PKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {/* Opening balance indicator row */}
              <tr className="bg-muted/15 font-semibold text-muted-foreground">
                <td className="py-2 px-3 font-mono">{dateRange.start}</td>
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3 italic">Opening Balance Brought Forward</td>
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3 text-right">-</td>
                <td className="py-2 px-3 text-right">-</td>
                <td className="py-2 px-3 text-right font-bold text-foreground">
                  PKR {totals.opening.toLocaleString()}
                </td>
              </tr>

              {statementRows.length > 0 ? (
                statementRows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-3 font-mono text-muted-foreground whitespace-nowrap">{r.date}</td>
                    <td className="py-2 px-3 font-mono font-bold text-primary whitespace-nowrap">{r.ref}</td>
                    <td className="py-2 px-3 font-medium text-foreground max-w-sm">{r.description}</td>
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{r.methodOrAccount}</td>
                    <td className="py-2 px-3 text-right font-medium text-emerald-600 whitespace-nowrap">
                      {r.debit > 0 ? r.debit.toLocaleString() : "-"}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-red-500 whitespace-nowrap">
                      {r.credit > 0 ? r.credit.toLocaleString() : "-"}
                    </td>
                    <td className="py-2 px-3 text-right font-bold font-mono text-foreground whitespace-nowrap">
                      PKR {(r.runningBalance || 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 px-3 text-center text-muted-foreground italic">
                    No activity found in the selected period.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-muted/40 font-bold border-t">
              <tr>
                <td colSpan={4} className="py-2 px-3 text-right text-xs uppercase text-muted-foreground">
                  Statement Totals & Net Movement:
                </td>
                <td className="py-2 px-3 text-right text-emerald-600 text-xs">
                  PKR {totals.totDebit.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right text-red-500 text-xs">
                  PKR {totals.totCredit.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right text-foreground text-sm font-black">
                  PKR {totals.closing.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>

        {/* Statement Footer Note */}
        <div className="py-2.5 px-3 sm:px-4 border-t bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-muted-foreground gap-2">
          <span>This is an official computer-generated statement from TAMS Pro single-ledger accounting.</span>
          <span>Page 1 of 1 • All figures in PKR</span>
        </div>
      </Card>
    </div>
  );
}
