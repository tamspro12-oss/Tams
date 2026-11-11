import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { useParties, Party } from "@/hooks/useParties";
import {
  ExcelGrid,
  GridColumn,
  PageHeader,
  TotalsBar,
  StatusChip,
} from "@/components/design-system";
import { AddPartyDialog } from "@/components/parties/AddPartyDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  FileText,
  CreditCard,
  Send,
  Users,
  Phone,
  Mail,
  MapPin,
  Building,
  Wallet,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { CopyValue } from "@/components/ui/CopyValue";
import { cleanPastedSearch } from "@/lib/searchUtils";

export default function ClientsVendors() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { parties, updateParty } = useParties();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [partyToEdit, setPartyToEdit] = useState<Party | null>(null);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);

  // Filters from URL
  const urlType = searchParams.get("type") as "client" | "vendor" | "both" | "all" | null;
  const urlBalance = searchParams.get("balance") as "has_dues" | "zero" | "all" | null;

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "client" | "vendor" | "both">(urlType || "all");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "has_dues" | "zero">(urlBalance || "all");

  useEffect(() => {
    if (urlType) setTypeFilter(urlType);
    if (urlBalance) setBalanceFilter(urlBalance);
  }, [urlType, urlBalance]);

  // Filtered dataset
  const filteredParties = useMemo(() => {
    return parties.filter((p) => {
      // Type
      if (typeFilter !== "all" && p.type !== typeFilter && p.type !== "both") return false;

      // Balance
      if (balanceFilter === "has_dues") {
        if (typeFilter === "client" && p.current_balance <= 0) return false;
        if (typeFilter === "vendor" && p.current_balance >= 0) return false;
        if (p.current_balance === 0) return false;
      }
      if (balanceFilter === "zero" && p.current_balance !== 0) return false;

      // Search live-filters by party code, name, phone, email, city and address
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name ? p.name.toLowerCase().includes(q) : false;
        const matchesCode = p.code ? p.code.toLowerCase().includes(q) : false;
        const matchesPhone = p.phone ? p.phone.toLowerCase().includes(q) : false;
        const matchesEmail = p.email ? p.email.toLowerCase().includes(q) : false;
        const matchesCity = p.city ? p.city.toLowerCase().includes(q) : false;
        const matchesAddress = p.address ? p.address.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesCode && !matchesPhone && !matchesEmail && !matchesCity && !matchesAddress) {
          return false;
        }
      }

      return true;
    });
  }, [parties, typeFilter, balanceFilter, searchQuery]);

  // Aggregate Metrics: Client Dues (receivables) & Vendor Dues (payables)
  const clientDues = useMemo(() => {
    return parties
      .filter((p) => p.current_balance > 0)
      .reduce((sum, p) => sum + p.current_balance, 0);
  }, [parties]);

  const vendorDues = useMemo(() => {
    return parties
      .filter((p) => p.current_balance < 0)
      .reduce((sum, p) => sum + Math.abs(p.current_balance), 0);
  }, [parties]);

  // Condensed Grid Columns for Single-Screen Viewport Fit
  // Party Code | Name | Type | Current Balance | Actions
  const columns: GridColumn<Party>[] = [
    {
      key: "code",
      header: "Party Code",
      width: 120,
      render: (p) => (
        <CopyValue
          value={p.code || "—"}
          label="party code"
          className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200"
        />
      ),
    },
    {
      key: "name",
      header: "Name",
      minWidth: 180,
      render: (p) => (
        <CopyValue
          value={p.name}
          label="party name"
          className="font-semibold text-slate-900 dark:text-slate-100 block"
        />
      ),
    },
    {
      key: "type",
      header: "Type",
      width: 110,
      align: "center",
      render: (p) => {
        let tag = "Client";
        let color = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300";
        if (p.type === "vendor") {
          tag = "Vendor";
          color = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300";
        } else if (p.type === "both") {
          tag = "Both";
          color = "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300";
        }
        return (
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${color}`}>
            {tag}
          </span>
        );
      },
    },
    {
      key: "current_balance",
      header: "Current Balance",
      width: 160,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (p) => {
        const bal = p.current_balance;
        const isReceivable = bal > 0;
        const isPayable = bal < 0;
        const isZero = bal === 0;

        return (
          <div className="text-right">
            <span
              className={`font-mono text-xs font-bold ${
                isZero
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              PKR {Math.abs(bal).toLocaleString()}{" "}
              {isReceivable ? "DR" : isPayable ? "CR" : ""}
            </span>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      width: 160,
      align: "center",
      sortable: false,
      filterable: false,
      render: (p) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setPartyToEdit(p);
              setIsAddOpen(true);
            }}
            className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer"
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedParty(p);
            }}
            className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            View Ledger
          </Button>
        </div>
      ),
    },
  ];

  // Secondary Information Drawer (Accordion row details on click expand)
  const renderExpandedRow = (p: Party) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        {/* Contact Info */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> Contact Details
          </span>
          <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 w-16">Phone:</span>
              <CopyValue value={p.phone || "—"} label="phone" className="font-mono font-medium" />
            </div>
            {p.whatsapp && p.whatsapp !== p.phone && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-16">WhatsApp:</span>
                <CopyValue value={p.whatsapp} label="whatsapp" className="font-mono font-medium" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 w-16">Email:</span>
              <CopyValue value={p.email || "—"} label="email" />
            </div>
          </div>
        </div>

        {/* Location & Address */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Address & Location
          </span>
          <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 w-16">City:</span>
              <span className="font-medium">{p.city || "—"}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-500 w-16 shrink-0">Address:</span>
              <span className="font-medium">{p.address || "—"}</span>
            </div>
            {(p.cnic || p.ntn) && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-16">Tax / ID:</span>
                <span className="font-mono text-[11px]">{p.cnic || p.ntn}</span>
              </div>
            )}
          </div>
        </div>

        {/* Financial Terms & Metadata */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" /> Financial Balances
          </span>
          <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Opening Balance:</span>
              <span className="font-mono font-semibold">PKR {(p.opening_balance || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Credit Limit:</span>
              <span className="font-mono font-semibold">{(p.credit_limit || 0) > 0 ? `PKR ${(p.credit_limit || 0).toLocaleString()}` : "Unlimited"}</span>
            </div>
            {p.notes && (
              <div className="pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 italic">
                Notes: {p.notes}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <SeoHead
        title="Clients & Vendors - TAMS Pro"
        description="Unified master management for clients, suppliers, and combined agencies with automatic double-entry ledger integration."
        path="/app/clients-vendors"
      />

      {/* Page Header */}
      <PageHeader
        title="Clients & Vendors"
        subtitle="Manage all party accounts, balances, credit limits, and histories in one single source of truth."
        actions={
          <Button
            onClick={() => {
              setPartyToEdit(null);
              setIsAddOpen(true);
            }}
            size="sm"
            className="bg-[#0B192C] hover:bg-[#1E3E62] text-white gap-1.5 cursor-pointer text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add New Party
          </Button>
        }
      />

      {/* Top Totals Bar: Summary cards only (Client Dues, Vendor Dues, Total Parties). Excel and WhatsApp buttons removed */}
      <TotalsBar
        metrics={[
          {
            label: "Client Dues (Receivable)",
            value: clientDues,
            prefix: "PKR",
            highlight: "red",
          },
          {
            label: "Vendor Dues (Payable)",
            value: vendorDues,
            prefix: "PKR",
            highlight: "emerald",
          },
          {
            label: "Total Parties",
            value: parties.length,
            highlight: "neutral",
          },
        ]}
      />

      {/* Filter Row: Search bar, All Types, All Balances (All Cities removed) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (pasted) {
                e.preventDefault();
                setSearchQuery(cleanPastedSearch(pasted));
              }
            }}
            placeholder="Search party by code, name, phone, email, city, address..."
            className="pl-8 h-9 text-xs"
          />
        </div>

        <Select value={typeFilter} onValueChange={(val: any) => setTypeFilter(val)}>
          <SelectTrigger className="h-9 w-[120px] text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="client">Clients</SelectItem>
            <SelectItem value="vendor">Vendors</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>

        <Select value={balanceFilter} onValueChange={(val: any) => setBalanceFilter(val)}>
          <SelectTrigger className="h-9 w-[130px] text-xs">
            <SelectValue placeholder="Balance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Balances</SelectItem>
            <SelectItem value="has_dues">With Outstanding</SelectItem>
            <SelectItem value="zero">Zero Balance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Party List Table: Condensed Single-Screen Viewport with Expandable Details */}
      <ExcelGrid
        id="parties_master_grid"
        data={filteredParties}
        columns={columns}
        keyExtractor={(p) => p.id}
        renderExpandedRow={renderExpandedRow}
        title="Parties & Accounts Ledger"
        filename="TAMS_Parties_Master"
        hideColumnsButton={true}
        hideCopyButton={true}
        hideExportButton={true}
        emptyState={
          <div className="py-12 text-center space-y-3">
            <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No parties yet
            </p>
            <Button
              onClick={() => {
                setPartyToEdit(null);
                setIsAddOpen(true);
              }}
              size="sm"
              className="bg-[#0B192C] hover:bg-[#1E3E62] text-white text-xs gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add New Party
            </Button>
          </div>
        }
      />

      {/* Add / Edit Party Dialog */}
      <AddPartyDialog
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) setPartyToEdit(null);
        }}
        partyToEdit={partyToEdit}
        onSaved={() => {
          setSelectedParty(null);
          setPartyToEdit(null);
        }}
      />

      {/* Party Profile Drawer / Modal */}
      <Sheet open={Boolean(selectedParty)} onOpenChange={(open) => !open && setSelectedParty(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedParty && (
            <div className="space-y-4 pt-2">
              <SheetHeader>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    {selectedParty.code || "PARTY"}
                  </span>
                  <StatusChip status={selectedParty.type} label={selectedParty.type.toUpperCase()} size="sm" />
                </div>
                <SheetTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedParty.name}
                </SheetTitle>
              </SheetHeader>

              {/* Quick Net Position Card */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Current Net Balance
                </span>
                <div className="flex items-baseline justify-between">
                  <span
                    className={`text-2xl font-bold font-mono ${
                      selectedParty.current_balance > 0
                        ? "text-red-600 dark:text-red-400"
                        : selectedParty.current_balance < 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-700"
                    }`}
                  >
                    PKR {Math.abs(selectedParty.current_balance).toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {selectedParty.current_balance > 0
                      ? "Receivable (DR)"
                      : selectedParty.current_balance < 0
                      ? "Payable (CR)"
                      : "Settled"}
                  </span>
                </div>
              </div>

              {/* 3 Quick Action Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  className="text-xs bg-[#0B192C] text-white hover:bg-[#1E3E62] cursor-pointer"
                  onClick={() => {
                    toast.info("Opening Booking Invoice form...");
                  }}
                >
                  <FileText className="w-3 h-3 mr-1" />
                  New Invoice
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs cursor-pointer"
                  onClick={() => {
                    toast.info("Opening Payment Voucher form...");
                  }}
                >
                  <CreditCard className="w-3 h-3 mr-1" />
                  New Payment
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs text-emerald-700 border-emerald-200 cursor-pointer"
                  onClick={() => {
                    const text = `Dear ${selectedParty.name}, your current account balance with our agency is PKR ${Math.abs(selectedParty.current_balance).toLocaleString()} ${selectedParty.current_balance > 0 ? "due" : "advance"}.`;
                    window.open(`https://wa.me/${selectedParty.phone || ""}?text=${encodeURIComponent(text)}`, "_blank");
                  }}
                >
                  <Send className="w-3 h-3 mr-1" />
                  Statement
                </Button>
              </div>

              {/* Profile Tabs: Overview, Bookings, Payments, Statement */}
              <Tabs defaultValue="overview" className="w-full pt-2">
                <TabsList className="w-full grid grid-cols-4 h-9">
                  <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                  <TabsTrigger value="bookings" className="text-xs">Bookings</TabsTrigger>
                  <TabsTrigger value="payments" className="text-xs">Payments</TabsTrigger>
                  <TabsTrigger value="statement" className="text-xs">Statement</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-3 pt-3 text-xs">
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Phone</span>
                      <span className="font-semibold">{selectedParty.phone || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">City</span>
                      <span className="font-semibold">{selectedParty.city || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Credit Limit</span>
                      <span className="font-semibold">PKR {selectedParty.credit_limit.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Opening Balance</span>
                      <span className="font-semibold">PKR {selectedParty.opening_balance.toLocaleString()}</span>
                    </div>
                  </div>

                  {selectedParty.notes && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                      <span className="text-muted-foreground block text-[11px] mb-1">Remarks</span>
                      <p>{selectedParty.notes}</p>
                    </div>
                  )}

                  {/* Deactivate Option */}
                  <div className="pt-4 border-t flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Account Status</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        updateParty({
                          id: selectedParty.id,
                          updates: { active: !selectedParty.active },
                        });
                        setSelectedParty({ ...selectedParty, active: !selectedParty.active });
                      }}
                      className="text-xs h-8 text-red-600 hover:text-red-700 cursor-pointer"
                    >
                      {selectedParty.active ? "Deactivate Party" : "Activate Party"}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="bookings" className="py-6 text-center text-xs text-muted-foreground">
                  <p>All invoices linked to {selectedParty.name} appear in this ledger.</p>
                </TabsContent>

                <TabsContent value="payments" className="py-6 text-center text-xs text-muted-foreground">
                  <p>All receipts and vouchers allocated to {selectedParty.name}.</p>
                </TabsContent>

                <TabsContent value="statement" className="py-6 text-center text-xs text-muted-foreground">
                  <p>Live running debit, credit, and net balance statement.</p>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
