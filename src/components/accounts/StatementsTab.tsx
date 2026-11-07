import React, { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText,
  Download,
  Printer,
  Share2,
  Calendar,
  Wallet,
  Building2,
  User,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import { useAccounts, useAgencyLedger, usePartyStatement, TransactionItem } from "@/hooks/useUnifiedTransactions";
import { useClients, useVendors } from "@/hooks/useStorage";
import { useB2BAgents } from "@/hooks/useB2BAgents";
import { useAgency } from "@/hooks/useAgency";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  const [copiedLink, setCopiedLink] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

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
  const { data: partyStatementData = [], isLoading: partyLoading } = usePartyStatement(
    isPartyScope ? selectedPartyId : null,
    { startDate: dateRange.start, endDate: dateRange.end }
  );

  // Fetch Account/Agency statement if scope is not party
  const accountFilterId =
    scopeType === "cash" ? cashAccount?.id : scopeType === "bank" ? selectedAccountId : undefined;

  const { data: agencyStatementData = [], isLoading: agencyLoading } = useAgencyLedger({
    startDate: dateRange.start,
    endDate: dateRange.end,
    accountId: accountFilterId,
  });

  // Selected Scope metadata
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
      if (partyType === "agent") pName = agents.find((a) => a.id === selectedPartyId)?.name || "Agent";
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

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // Export PDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("portrait", "mm", "a4");
      doc.setFontSize(18);
      doc.text(agency?.agency_name || "TAMS Pro Travel Agency", 14, 18);
      doc.setFontSize(12);
      doc.text(scopeMetadata.title, 14, 25);
      doc.setFontSize(9);
      doc.text(`Period: ${dateRange.start} to ${dateRange.end} | Generated: ${format(new Date(), "PPpp")}`, 14, 31);

      // Opening & Closing summary box
      doc.setFontSize(10);
      doc.text(
        `Opening Balance: PKR ${totals.opening.toLocaleString()}  |  Total In: PKR ${totals.totDebit.toLocaleString()}  |  Total Out: PKR ${totals.totCredit.toLocaleString()}  |  Closing: PKR ${totals.closing.toLocaleString()}`,
        14,
        38
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
        startY: 42,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      });

      doc.save(`Statement_${scopeType}_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("Statement PDF downloaded");
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
    }
  };

  // Copy statement summary link / text
  const handleShare = () => {
    const text = `Statement: ${scopeMetadata.title}\nPeriod: ${dateRange.start} to ${dateRange.end}\nOpening Balance: PKR ${totals.opening.toLocaleString()}\nTotal In: PKR ${totals.totDebit.toLocaleString()}\nTotal Out: PKR ${totals.totCredit.toLocaleString()}\nClosing Balance: PKR ${totals.closing.toLocaleString()}\nAgency: ${agency?.agency_name || "TAMS Pro"}`;
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    toast.success("Statement summary copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Scope & Date Range Selector Header */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="py-3 px-4 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Financial Statement Generator
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Select scope, date range, view opening/closing balances, export official PDF, or print.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-8 text-xs gap-1.5">
                <Download className="w-3.5 h-3.5 text-primary" />
                <span>Export PDF</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs gap-1.5">
                <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Print</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare} className="h-8 text-xs gap-1.5">
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-muted-foreground" />}
                <span>Share</span>
              </Button>
            </div>
          </div>

          {/* Scope Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
            {/* Scope Type */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Scope Type</Label>
              <Select value={scopeType} onValueChange={(val: any) => setScopeType(val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Choose Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All (Agency Consolidated)</SelectItem>
                  <SelectItem value="cash">Cash Account</SelectItem>
                  <SelectItem value="bank">A Specific Bank</SelectItem>
                  <SelectItem value="party">A Specific Party (Client/Agent/Vendor)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic Scope Selector: Specific Bank or Specific Party */}
            {scopeType === "bank" && (
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">Select Bank</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select Bank Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scopeType === "party" && (
              <div className="space-y-1 col-span-1 md:col-span-2 grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] font-semibold text-muted-foreground">Party Type</Label>
                  <Select value={partyType} onValueChange={(val: any) => setPartyType(val)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="agent">B2B Agent</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-muted-foreground">Select {partyType}</Label>
                  <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
                    <SelectTrigger className="h-8 text-xs">
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
                            {a.name}
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
                </div>
              </div>
            )}

            {/* Date Preset */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Date Range</Label>
              <Select value={datePreset} onValueChange={(val: any) => setDatePreset(val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Range if selected */}
            {datePreset === "custom" && (
              <div className="space-y-1 flex items-center gap-1.5 col-span-1 md:col-span-2">
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground">From</Label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground">To</Label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Official Statement Sheet / Document View */}
      <div ref={printAreaRef} className="print:m-0 print:p-0">
        <Card className="border-border shadow-sm overflow-hidden bg-card">
          {/* Statement Header */}
          <div className="p-6 border-b bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black tracking-tight text-foreground">
                  {agency?.agency_name || "TAMS Pro Travel Agency"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {agency?.address || "Head Office, Travel Plaza"} • Phone: {agency?.phone || "+92 300 0000000"}
                </p>
                <div className="mt-3">
                  <Badge variant="outline" className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 bg-background">
                    {scopeMetadata.title}
                  </Badge>
                  <p className="text-xs font-medium text-muted-foreground mt-1">
                    {scopeMetadata.subtitle}
                  </p>
                </div>
              </div>

              <div className="text-right sm:border-l sm:pl-6 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Statement Period</p>
                <p className="text-sm font-bold text-foreground">
                  {dateRange.start} <span className="text-muted-foreground font-normal">to</span> {dateRange.end}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Status: <span className="text-emerald-600 font-semibold">Active Verified</span>
                </p>
              </div>
            </div>

            {/* Opening Balance Card Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t">
              <div className="p-3 rounded-lg bg-background border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Opening Balance</p>
                <p className="text-sm sm:text-base font-bold text-foreground mt-0.5">
                  PKR {totals.opening.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background border">
                <p className="text-[10px] font-semibold text-emerald-600 uppercase">Total In / Charges</p>
                <p className="text-sm sm:text-base font-bold text-emerald-600 mt-0.5">
                  +PKR {totals.totDebit.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background border">
                <p className="text-[10px] font-semibold text-red-500 uppercase">Total Out / Payments</p>
                <p className="text-sm sm:text-base font-bold text-red-500 mt-0.5">
                  -PKR {totals.totCredit.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-[10px] font-bold text-primary uppercase">Closing Balance</p>
                <p className="text-sm sm:text-base font-black text-primary mt-0.5">
                  PKR {totals.closing.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Statement Entries Table */}
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Ref / PNR</th>
                  <th className="p-3 text-left">Description / Particulars</th>
                  <th className="p-3 text-left">Method / Account</th>
                  <th className="p-3 text-right">Debit (PKR)</th>
                  <th className="p-3 text-right">Credit (PKR)</th>
                  <th className="p-3 text-right">Running Balance (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {/* Opening balance indicator row */}
                <tr className="bg-muted/15 font-semibold text-muted-foreground">
                  <td className="p-3 font-mono">{dateRange.start}</td>
                  <td className="p-3">-</td>
                  <td className="p-3 italic">Opening Balance Brought Forward</td>
                  <td className="p-3">-</td>
                  <td className="p-3 text-right">-</td>
                  <td className="p-3 text-right">-</td>
                  <td className="p-3 text-right font-bold text-foreground">
                    PKR {totals.opening.toLocaleString()}
                  </td>
                </tr>

                {statementRows.length > 0 ? (
                  statementRows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono text-muted-foreground whitespace-nowrap">{r.date}</td>
                      <td className="p-3 font-mono font-bold text-primary whitespace-nowrap">{r.ref}</td>
                      <td className="p-3 font-medium text-foreground max-w-sm">{r.description}</td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">{r.methodOrAccount}</td>
                      <td className="p-3 text-right font-medium text-emerald-600 whitespace-nowrap">
                        {r.debit > 0 ? r.debit.toLocaleString() : "-"}
                      </td>
                      <td className="p-3 text-right font-medium text-red-500 whitespace-nowrap">
                        {r.credit > 0 ? r.credit.toLocaleString() : "-"}
                      </td>
                      <td className="p-3 text-right font-bold font-mono text-foreground whitespace-nowrap">
                        PKR {(r.runningBalance || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground italic">
                      No activity found in the selected period.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-muted/40 font-bold border-t">
                <tr>
                  <td colSpan={4} className="p-3 text-right text-xs uppercase text-muted-foreground">
                    Statement Totals & Net Movement:
                  </td>
                  <td className="p-3 text-right text-emerald-600 text-xs">
                    PKR {totals.totDebit.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-red-500 text-xs">
                    PKR {totals.totCredit.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-foreground text-sm font-black">
                    PKR {totals.closing.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </CardContent>

          {/* Statement Footer Note */}
          <div className="p-4 border-t bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-muted-foreground gap-2">
            <span>This is an official computer-generated statement from TAMS Pro single-ledger accounting.</span>
            <span>Page 1 of 1 • All figures in PKR</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
