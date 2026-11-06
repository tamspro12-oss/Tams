import React, { useState, useMemo } from "react";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Plus,
  Search,
  Download,
  Printer,
  Share2,
  Copy,
  Edit,
  Trash2,
  MoreVertical,
  Building2,
  Plane,
  Sparkles,
  Calendar,
  User,
  ExternalLink,
  Ban,
} from "lucide-react";
import { useVouchers } from "@/hooks/useVouchers";
import { useAgency } from "@/hooks/useAgency";
import { CreateVoucherDialog } from "@/components/CreateVoucherDialog";
import {
  downloadVoucherPdf,
  printVoucherPdf,
  generateVoucherWhatsAppText,
} from "@/lib/voucherPdfGenerator";
import type { Voucher, VoucherType } from "@/types/voucher";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Vouchers() {
  const { vouchers, isLoading, addVoucher, updateVoucher, deleteVoucher, duplicateVoucher } =
    useVouchers();
  const { data: agency } = useAgency();

  const [activeTab, setActiveTab] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);

  const agencyOpts = useMemo(() => ({
    agencyName: agency?.name || "Travel Agency",
    agencyEmail: agency?.email || agency?.contact_email || "",
    agencyPhone: agency?.phone_number || agency?.contact_info || "",
    agencyAddress: "",
  }), [agency]);

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      // Type tab filter
      if (activeTab !== "All" && v.voucher_type !== activeTab) {
        return false;
      }

      // Status filter
      if (statusFilter !== "All" && v.status !== statusFilter) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = v.passenger_name?.toLowerCase().includes(q);
        const matchesNumber = v.voucher_number?.toLowerCase().includes(q);
        const matchesPassport = v.passenger_passport?.toLowerCase().includes(q);
        const matchesPnr = v.pnr?.toLowerCase().includes(q);
        const matchesHotel = (v.hotel_name || v.makkah_hotel || v.madinah_hotel || "")
          .toLowerCase()
          .includes(q);
        const matchesAirline = v.airline?.toLowerCase().includes(q);

        if (!matchesName && !matchesNumber && !matchesPassport && !matchesPnr && !matchesHotel && !matchesAirline) {
          return false;
        }
      }

      return true;
    });
  }, [vouchers, activeTab, statusFilter, searchQuery]);

  const handleShareWhatsApp = (v: Voucher) => {
    const text = generateVoucherWhatsAppText(v, agency?.name || "TAMS Pro");
    const phone = (v.contact_number || "").replace(/[^0-9]/g, "");
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleStatusChange = async (v: Voucher, newStatus: "Issued" | "Draft" | "Cancelled") => {
    try {
      await updateVoucher.mutateAsync({ id: v.id, status: newStatus });
    } catch (e) {
      // Handled in hook
    }
  };

  const getTypeIcon = (type: VoucherType) => {
    switch (type) {
      case "Umrah":
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case "Hotel":
        return <Building2 className="w-4 h-4 text-blue-500" />;
      case "Ticket":
        return <Plane className="w-4 h-4 text-emerald-500" />;
    }
  };

  const getTypeBadgeClass = (type: VoucherType) => {
    switch (type) {
      case "Umrah":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300/50";
      case "Hotel":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300/50";
      case "Ticket":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300/50";
    }
  };

  return (
    <div className="space-y-6">
      <SeoHead
        title="Vouchers & Itineraries - TAMS Pro"
        description="Issue, manage, and share branded Umrah, Hotel, and Flight vouchers for clients and B2B agents."
        path="/app/vouchers"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-primary" />
            Vouchers & Itineraries
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate branded Umrah, Hotel, and Airline tickets with 1-tap PDF & WhatsApp sharing.
          </p>
        </div>

        <Button
          onClick={() => {
            setEditingVoucher(null);
            setIsCreateOpen(true);
          }}
          className="h-10 px-4 font-semibold gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Voucher
        </Button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-card p-3 rounded-xl border shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vouchers (passenger, passport, PNR, voucher #, hotel)..."
            className="pl-9 h-10 text-xs sm:text-sm bg-muted/40"
          />
        </div>

        {/* Type Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:w-auto">
          <TabsList className="grid grid-cols-4 h-10">
            <TabsTrigger value="All" className="text-xs">
              All ({vouchers.length})
            </TabsTrigger>
            <TabsTrigger value="Umrah" className="text-xs">
              Umrah ({vouchers.filter((v) => v.voucher_type === "Umrah").length})
            </TabsTrigger>
            <TabsTrigger value="Hotel" className="text-xs">
              Hotel ({vouchers.filter((v) => v.voucher_type === "Hotel").length})
            </TabsTrigger>
            <TabsTrigger value="Ticket" className="text-xs">
              Ticket ({vouchers.filter((v) => v.voucher_type === "Ticket").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Status filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {(["All", "Issued", "Draft", "Cancelled"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Vouchers List / Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 rounded-xl border bg-card/60 animate-pulse p-4 space-y-3">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-6 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-8 bg-muted rounded w-full mt-4" />
            </div>
          ))}
        </div>
      ) : filteredVouchers.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No Vouchers Found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            {searchQuery || activeTab !== "All" || statusFilter !== "All"
              ? "No vouchers matched your current filters. Try resetting search."
              : "Create your first professional voucher for an Umrah package, hotel stay, or airline ticket."}
          </p>
          <Button
            onClick={() => {
              setSearchQuery("");
              setActiveTab("All");
              setStatusFilter("All");
              setIsCreateOpen(true);
            }}
            variant="outline"
            className="mt-4 gap-2 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Create First Voucher
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVouchers.map((v) => (
            <Card
              key={v.id}
              className="border shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between bg-card overflow-hidden"
            >
              <CardContent className="p-4 space-y-3">
                {/* Top header row: Number + Type + Status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border ${getTypeBadgeClass(
                        v.voucher_type
                      )}`}
                    >
                      {getTypeIcon(v.voucher_type)}
                      {v.voucher_number}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                      {v.voucher_type}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        v.status === "Issued"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : v.status === "Draft"
                          ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                      }`}
                    >
                      {v.status}
                    </span>

                    {/* Actions Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() => downloadVoucherPdf(v, agencyOpts)}
                          className="gap-2 text-xs"
                        >
                          <Download className="w-3.5 h-3.5 text-primary" />
                          Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => printVoucherPdf(v, agencyOpts)}
                          className="gap-2 text-xs"
                        >
                          <Printer className="w-3.5 h-3.5 text-blue-600" />
                          Print Voucher
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleShareWhatsApp(v)}
                          className="gap-2 text-xs"
                        >
                          <Share2 className="w-3.5 h-3.5 text-green-600" />
                          Share WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingVoucher(v);
                            setIsCreateOpen(true);
                          }}
                          className="gap-2 text-xs"
                        >
                          <Edit className="w-3.5 h-3.5 text-amber-600" />
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => duplicateVoucher.mutate(v)}
                          className="gap-2 text-xs"
                        >
                          <Copy className="w-3.5 h-3.5 text-purple-600" />
                          Duplicate
                        </DropdownMenuItem>
                        {v.status !== "Cancelled" && (
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(v, "Cancelled")}
                            className="gap-2 text-xs text-orange-600"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Mark Cancelled
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm(`Delete voucher ${v.voucher_number}?`)) {
                              deleteVoucher.mutate(v.id);
                            }
                          }}
                          className="gap-2 text-xs text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Lead Passenger & info */}
                <div>
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    {v.passenger_name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                    {v.passenger_passport && <span>Passport: {v.passenger_passport}</span>}
                    {v.contact_number && <span>Ph: {v.contact_number}</span>}
                    {v.b2b_agents?.agency_name && (
                      <span className="text-primary font-medium">
                        Agent: {v.b2b_agents.agency_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Service Details Snippet */}
                <div className="bg-muted/40 rounded-lg p-2.5 text-xs space-y-1 border">
                  {v.voucher_type === "Umrah" && (
                    <>
                      {v.package_name && (
                        <p className="font-semibold text-foreground truncate">{v.package_name}</p>
                      )}
                      {(v.makkah_hotel || v.hotel_name) && (
                        <p className="text-muted-foreground truncate">
                          🕋 {v.makkah_hotel || v.hotel_name}{" "}
                          {v.makkah_nights ? `(${v.makkah_nights}N)` : ""}
                        </p>
                      )}
                      {v.madinah_hotel && (
                        <p className="text-muted-foreground truncate">
                          🕌 {v.madinah_hotel} {v.madinah_nights ? `(${v.madinah_nights}N)` : ""}
                        </p>
                      )}
                      {v.transport_details && (
                        <p className="text-muted-foreground truncate text-[11px]">
                          🚗 {v.transport_details}
                        </p>
                      )}
                    </>
                  )}

                  {v.voucher_type === "Hotel" && (
                    <>
                      <p className="font-semibold text-foreground truncate">
                        🏨 {v.hotel_name || "Hotel"} {v.city ? `(${v.city})` : ""}
                      </p>
                      {v.check_in && v.check_out && (
                        <p className="text-muted-foreground">
                          📅 {v.check_in} → {v.check_out} ({v.nights || 0}N)
                        </p>
                      )}
                      {v.room_type && (
                        <p className="text-muted-foreground text-[11px]">
                          🛏️ {v.room_type} • {v.meal_plan || "Room Only"}
                        </p>
                      )}
                    </>
                  )}

                  {v.voucher_type === "Ticket" && (
                    <>
                      <p className="font-semibold text-foreground truncate">
                        ✈️ {v.airline || "Airline"} {v.flight_number || ""}
                      </p>
                      <p className="text-muted-foreground truncate">
                        Route: {v.sector || "N/A"}
                        {v.pnr ? ` • PNR: ${v.pnr}` : ""}
                      </p>
                      {v.departure_date && (
                        <p className="text-muted-foreground text-[11px]">
                          🕒 Dep: {format(new Date(v.departure_date), "dd MMM yyyy HH:mm")}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Footer metadata & quick buttons */}
                <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {v.created_at ? format(new Date(v.created_at), "dd MMM yyyy") : ""}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShareWhatsApp(v)}
                      className="h-7 px-2 text-[11px] gap-1 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950/20"
                    >
                      <Share2 className="w-3 h-3" />
                      WhatsApp
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => downloadVoucherPdf(v, agencyOpts)}
                      className="h-7 px-2.5 text-[11px] gap-1"
                    >
                      <Download className="w-3 h-3" />
                      PDF
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <CreateVoucherDialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) setEditingVoucher(null);
        }}
        voucherToEdit={editingVoucher}
        onSave={async (voucherData) => {
          if (editingVoucher) {
            await updateVoucher.mutateAsync(voucherData);
          } else {
            await addVoucher.mutateAsync(voucherData);
          }
        }}
      />
    </div>
  );
}

