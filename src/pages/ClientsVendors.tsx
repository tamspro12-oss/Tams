import React, { useState, useMemo } from "react";
import { SeoHead } from "@/components/SeoHead";
import { useParties, Party } from "@/hooks/useParties";
import {
  ExcelGrid,
  GridColumn,
  PageHeader,
  TotalsBar,
  StatusChip,
  EmptyState,
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
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  RotateCcw,
  Send,
  Building2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";

export default function ClientsVendors() {
  const { parties, isLoading, updateParty } = useParties();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "client" | "vendor" | "both">("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "has_dues" | "zero">("all");

  // Unique cities list for filter
  const cities = useMemo(() => {
    const set = new Set<string>();
    parties.forEach((p) => {
      if (p.city) set.add(p.city);
    });
    return Array.from(set).sort();
  }, [parties]);

  // Filtered dataset
  const filteredParties = useMemo(() => {
    return parties.filter((p) => {
      // Type
      if (typeFilter !== "all" && p.type !== typeFilter) return false;

      // City
      if (cityFilter !== "all" && p.city !== cityFilter) return false;

      // Balance
      if (balanceFilter === "has_dues" && p.current_balance === 0) return false;
      if (balanceFilter === "zero" && p.current_balance !== 0) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesCode = p.code ? p.code.toLowerCase().includes(q) : false;
        const matchesPhone = p.phone ? p.phone.includes(q) : false;
        if (!matchesName && !matchesCode && !matchesPhone) return false;
      }

      return true;
    });
  }, [parties, typeFilter, cityFilter, balanceFilter, searchQuery]);

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

  // Grid Columns definition
  const columns: GridColumn<Party>[] = [
    {
      key: "code",
      header: "Code",
      width: 100,
      minWidth: 90,
      render: (p) => (
        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
          {p.code || "—"}
        </span>
      ),
    },
    {
      key: "name",
      header: "Party Name",
      minWidth: 160,
      render: (p) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100 hover:text-teal-600 block">
            {p.name}
          </span>
          {p.city && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" /> {p.city}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      width: 110,
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
      key: "phone",
      header: "Contact",
      width: 130,
      render: (p) => (
        <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
          {p.phone || p.whatsapp || "—"}
        </span>
      ),
    },
    {
      key: "credit_limit",
      header: "Credit Limit",
      width: 120,
      isNumeric: true,
      align: "right",
      render: (p) => (
        <span className="font-mono text-xs">
          {p.credit_limit > 0 ? p.credit_limit.toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "current_balance",
      header: "Net Balance",
      width: 140,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (p) => {
        const bal = p.current_balance;
        const isReceivable = bal > 0;
        const isPayable = bal < 0;
        const isExceeded = p.credit_limit > 0 && bal > p.credit_limit;

        return (
          <div className="text-right">
            <span
              className={`font-mono text-xs font-bold ${
                isReceivable
                  ? "text-red-600 dark:text-red-400"
                  : isPayable
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-600"
              }`}
            >
              {Math.abs(bal).toLocaleString()} {isReceivable ? "DR" : isPayable ? "CR" : ""}
            </span>
            {isExceeded && (
              <span className="block text-[9px] font-bold text-red-500 uppercase tracking-tight">
                Limit Exceeded
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "active",
      header: "Status",
      width: 90,
      align: "center",
      render: (p) => (
        <StatusChip
          status={p.active ? "active" : "inactive"}
          label={p.active ? "Active" : "Inactive"}
          size="sm"
        />
      ),
    },
  ];

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
            onClick={() => setIsAddOpen(true)}
            size="sm"
            className="bg-[#0B192C] hover:bg-[#1E3E62] text-white gap-1.5 cursor-pointer text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add New Party
          </Button>
        }
      />

      {/* Top Totals Bar */}
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
        onExportExcel={() => toast.success("Exporting party statement...")}
        onShareWhatsApp={() => toast.info("Opening WhatsApp share...")}
      />

      {/* Filter Row */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search party by name, code, phone..."
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

        {cities.length > 0 && (
          <Select value={cityFilter} onValueChange={(val) => setCityFilter(val)}>
            <SelectTrigger className="h-9 w-[120px] text-xs">
              <SelectValue placeholder="City" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

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

      {/* Main Excel-like Grid */}
      <ExcelGrid
        id="parties_master_grid"
        data={filteredParties}
        columns={columns}
        keyExtractor={(p) => p.id}
        onRowClick={(p) => setSelectedParty(p)}
        title="Parties & Accounts Ledger"
        filename="TAMS_Parties_Master"
        emptyState={
          <EmptyState
            type={parties.length > 0 ? "filtered" : "empty"}
            actionLabel="Add First Party"
            onAction={() => setIsAddOpen(true)}
          />
        }
        renderMobileCard={(p) => (
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  {p.name}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {p.code || "—"} • {p.phone || "No phone"}
                </span>
              </div>
              <StatusChip status={p.type} label={p.type.toUpperCase()} size="sm" />
            </div>
            <div className="flex justify-between items-center pt-2 border-t text-xs">
              <span className="text-muted-foreground">Net Balance:</span>
              <span
                className={`font-mono font-bold ${
                  p.current_balance > 0
                    ? "text-red-600"
                    : p.current_balance < 0
                    ? "text-emerald-600"
                    : "text-slate-600"
                }`}
              >
                PKR {Math.abs(p.current_balance).toLocaleString()}{" "}
                {p.current_balance > 0 ? "DR" : p.current_balance < 0 ? "CR" : ""}
              </span>
            </div>
          </div>
        )}
      />

      {/* Add Party Dialog */}
      <AddPartyDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSaved={() => setSelectedParty(null)}
      />

      {/* Party Profile Drawer / Modal (G5 Profile Requirements) */}
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

                  {/* Deactivate Option (Never hard-delete) */}
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
                      className="text-xs h-8 text-red-600 hover:text-red-700"
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

