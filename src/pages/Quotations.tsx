import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  FileText,
  Download,
  Mail,
  Pencil,
  Trash2,
  Search,
  Banknote,
  Loader2,
  Eye,
  CheckCircle2,
  ArrowRightCircle,
  Clock,
  XCircle,
  X,
  FileCheck2,
} from "lucide-react";
import { format, parseISO, isPast } from "date-fns";
import { toast } from "sonner";
import { useQuotations, type Quotation } from "@/hooks/useQuotations";
import { useClients } from "@/hooks/useStorage";
import { useAgency } from "@/hooks/useAgency";
import { downloadQuotationPdf, quotationPdfBase64 } from "@/lib/quotationPdf";
import { sendEmail } from "@/lib/emailService";
import {
  DatePresetFilter,
  type DatePresetFilterValue,
} from "@/components/leads-quotes/DatePresetFilter";
import { isDateWithinPreset } from "@/lib/dateFilterUtils";
import { cn } from "@/lib/utils";

type ServiceType = "client_booking" | "b2b" | "umrah" | "custom";
type Status = "draft" | "sent" | "accepted" | "rejected";

const serviceLabels: Record<string, string> = {
  client_booking: "Client Booking",
  b2b: "B2B Service",
  umrah: "Umrah Package",
  custom: "Custom",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-muted-foreground/30",
  sent: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300",
  accepted: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-300",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-300",
  expired: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300",
};

export default function Quotations() {
  const navigate = useNavigate();
  const { quotations = [], isLoading, updateQuotation, deleteQuotation } = useQuotations();
  const { clients = [] } = useClients();
  const { data: agency } = useAgency();

  // Filters State
  const [search, setSearch] = useState("");
  const [filterService, setFilterService] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DatePresetFilterValue>({
    preset: "this_month",
  });

  // Action states
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [previewQ, setPreviewQ] = useState<Quotation | null>(null);

  // Keyboard shortcut 'N' for New Quotation
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "n" || e.key === "N") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        document.activeElement?.tagName !== "SELECT"
      ) {
        e.preventDefault();
        navigate("/app/leads-quotes/quotations/new");
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [navigate]);

  // Check if quotation is expired
  const isQuotationExpired = useCallback((q: Quotation): boolean => {
    if (q.status === "accepted" || q.status === "rejected") return false;
    if (q.status === "expired" as any) return true;
    if (!q.valid_until) return false;
    try {
      return isPast(parseISO(q.valid_until));
    } catch {
      return false;
    }
  }, []);

  // Filtered quotations (by date preset, search, service type, and status)
  const dateFilteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      const qDate = q.quotation_date || q.created_at;
      return isDateWithinPreset(
        qDate,
        dateFilter.preset,
        dateFilter.customFrom,
        dateFilter.customTo
      );
    });
  }, [quotations, dateFilter]);

  // Stats strip reflects date filter
  const stats = useMemo(() => {
    const list = dateFilteredQuotations;
    const totalCount = list.length;
    const totalValue = list.reduce((acc, q) => acc + Number(q.total || 0), 0);
    const acceptedList = list.filter((q) => q.status === "accepted");
    const acceptedCount = acceptedList.length;
    const acceptedValue = acceptedList.reduce((acc, q) => acc + Number(q.total || 0), 0);

    return { totalCount, totalValue, acceptedCount, acceptedValue };
  }, [dateFilteredQuotations]);

  // Status counts for quick chips (within date filtered set)
  const statusCounts = useMemo(() => {
    const counts = {
      all: dateFilteredQuotations.length,
      draft: 0,
      sent: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
    };

    dateFilteredQuotations.forEach((q) => {
      if (isQuotationExpired(q)) {
        counts.expired += 1;
      }
      if (q.status === "draft") counts.draft += 1;
      else if (q.status === "sent") counts.sent += 1;
      else if (q.status === "accepted") counts.accepted += 1;
      else if (q.status === "rejected") counts.rejected += 1;
    });

    return counts;
  }, [dateFilteredQuotations, isQuotationExpired]);

  // Full filtered list
  const filtered = useMemo(() => {
    return dateFilteredQuotations.filter((q) => {
      if (filterService !== "all" && q.service_type !== filterService) return false;

      if (filterStatus === "expired") {
        if (!isQuotationExpired(q)) return false;
      } else if (filterStatus !== "all" && q.status !== filterStatus) {
        return false;
      }

      if (search.trim()) {
        const s = search.toLowerCase();
        const matchNumber = q.quotation_number?.toLowerCase().includes(s);
        const matchClient = q.client_name?.toLowerCase().includes(s);
        const matchTitle = (q.title || "").toLowerCase().includes(s);
        const matchPhone = (q.client_phone || "").includes(s);
        if (!matchNumber && !matchClient && !matchTitle && !matchPhone) return false;
      }

      return true;
    });
  }, [dateFilteredQuotations, filterService, filterStatus, search, isQuotationExpired]);

  // Action handlers
  const handleDownload = (q: Quotation) => {
    downloadQuotationPdf(q, {
      agencyName: agency?.name,
      agencyEmail: agency?.contact_email || agency?.email,
      agencyPhone: agency?.phone_number,
    });
    toast.success("PDF downloaded");
  };

  const handleEmail = async (q: Quotation) => {
    if (!q.client_email) {
      toast.error("Client email missing", {
        description: "Edit this quotation to add the client's email address.",
      });
      return;
    }
    if (!agency?.email) {
      toast.error("Sender email not configured", {
        description: "Configure email sender in Settings > Agency Branding.",
      });
      return;
    }

    setSendingEmailId(q.id);
    try {
      const base64 = quotationPdfBase64(q, {
        agencyName: agency?.name,
        agencyEmail: agency?.contact_email || agency?.email,
        agencyPhone: agency?.phone_number,
      });
      const body = `
        <div style="font-family:Arial,sans-serif;color:#0a2540;">
          <h2>Quotation ${q.quotation_number}</h2>
          <p>Dear ${q.client_name},</p>
          <p>Please find attached your requested quotation for <strong>${serviceLabels[q.service_type] || q.service_type}</strong>${q.title ? ` — ${q.title}` : ""}.</p>
          <p><strong>Total Amount: ${q.currency} ${Number(q.total).toLocaleString()}</strong></p>
          ${q.valid_until ? `<p>Valid until: ${format(new Date(q.valid_until), "dd MMM yyyy")}</p>` : ""}
          <p>Best regards,<br/>${agency?.name || ""}</p>
        </div>`;

      const result = await sendEmail(
        { email: agency.email, password: "", contactEmail: agency.contact_email || undefined },
        {
          to: q.client_email,
          subject: `Quotation ${q.quotation_number} — ${agency?.name || "Quotation"}`,
          body,
          attachments: [{ name: `Quotation-${q.quotation_number}.pdf`, data: base64 }],
          emailType: "quotation",
          clientId: q.client_id || undefined,
        }
      );

      if (result.success) {
        toast.success("Quotation emailed successfully");
        if (q.status === "draft") {
          updateQuotation.mutate({ id: q.id, status: "sent" });
        }
      } else {
        toast.error("Email sending failed", { description: result.message });
      }
    } catch (e: any) {
      toast.error("Email failed", { description: e?.message || String(e) });
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleConvertToBooking = async (q: Quotation) => {
    try {
      if (q.status !== "accepted") {
        await updateQuotation.mutateAsync({ id: q.id, status: "accepted" });
      }
    } catch (e) {
      console.warn("Could not pre-mark quotation as accepted", e);
    }

    navigate("/app/bookings?tab=clients", {
      state: {
        openAddClient: true,
        prefill: {
          name: q.client_name,
          contact_number: q.client_phone || "",
          email: q.client_email || "",
          travel_type: q.service_type === "umrah" ? "Umrah" : "Ticket",
          selling_price: q.total,
          notes: `Converted from Quotation #${q.quotation_number}${q.title ? ` — ${q.title}` : ""}\nQuotation Total: ${q.currency} ${Number(q.total).toLocaleString()}`,
          converted_from_quote_id: q.id,
        },
      },
    });
  };

  // Helper to get booking reference badge
  const renderBookingReference = (q: Quotation) => {
    const bookingId = q.booking_id || q.converted_booking_id;
    if (!bookingId) return null;

    const matchedClient = clients.find((c: any) => c.id === bookingId);
    const refText = matchedClient?.serial_number
      ? `#BK-${matchedClient.serial_number}`
      : `Booked (#${bookingId.slice(0, 6).toUpperCase()})`;

    return (
      <Badge
        variant="outline"
        className="text-[10px] bg-green-50 text-green-700 border-green-300 dark:bg-green-950/60 dark:text-green-300 dark:border-green-800 gap-1 h-5 px-1.5 shrink-0"
        title={`Linked Booking: ${refText}`}
      >
        <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />
        <span className="font-semibold truncate max-w-[90px]">{refText}</span>
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-7.5rem)] md:h-[calc(100dvh-8rem)] w-full overflow-hidden">
      {/* Compact Top Row: Title Left, + New Quotation Right */}
      <div className="flex items-center justify-between pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground">Quotations</h2>
          <span className="text-xs text-muted-foreground font-medium">({filtered.length})</span>
        </div>
        <Button
          size="sm"
          onClick={() => navigate("/app/leads-quotes/quotations/new")}
          className="h-8 px-3 text-xs font-semibold gap-1.5 shadow-sm"
          title="Press N to create a new quotation"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Quotation</span>
          <kbd className="hidden sm:inline-block text-[10px] px-1 rounded bg-primary-foreground/20 text-primary-foreground font-mono">
            N
          </kbd>
        </Button>
      </div>

      {/* Stats Strip: Slim single-row strip (~64px) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-2 shrink-0">
        <div className="h-16 px-3.5 py-2 rounded-xl border border-border/70 bg-card/70 flex flex-col justify-center">
          <span className="text-[11px] text-muted-foreground font-medium">Total Quotations</span>
          <span className="text-lg md:text-xl font-black text-foreground">{stats.totalCount}</span>
        </div>

        <div className="h-16 px-3.5 py-2 rounded-xl border border-border/70 bg-card/70 flex flex-col justify-center">
          <span className="text-[11px] text-muted-foreground font-medium">Total Value</span>
          <span className="text-base md:text-lg font-black text-foreground truncate font-mono">
            PKR {stats.totalValue.toLocaleString()}
          </span>
        </div>

        <div className="h-16 px-3.5 py-2 rounded-xl border border-border/70 bg-card/70 flex flex-col justify-center">
          <span className="text-[11px] text-muted-foreground font-medium">Accepted</span>
          <span className="text-lg md:text-xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.acceptedCount}
          </span>
        </div>

        <div className="h-16 px-3.5 py-2 rounded-xl border border-border/70 bg-card/70 flex flex-col justify-center">
          <span className="text-[11px] text-muted-foreground font-medium">Accepted Value</span>
          <span className="text-base md:text-lg font-black text-emerald-600 dark:text-emerald-400 truncate font-mono">
            PKR {stats.acceptedValue.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Filter Row: ONE LINE (Search | DATE FILTER | All Services | All Status) */}
      <div className="flex flex-col sm:flex-row gap-2 mb-2 shrink-0">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-xs rounded-lg"
            placeholder="Search by quotation #, client, title, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-0">
          {/* Date Filter Dropdown with presets */}
          <DatePresetFilter
            value={dateFilter}
            onChange={setDateFilter}
            className="h-9 shrink-0"
          />

          {/* All Services */}
          <Select value={filterService} onValueChange={setFilterService}>
            <SelectTrigger className="h-9 w-36 text-xs rounded-lg shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-50 text-xs">
              <SelectItem value="all">All Services</SelectItem>
              <SelectItem value="client_booking">Client Booking</SelectItem>
              <SelectItem value="b2b">B2B Service</SelectItem>
              <SelectItem value="umrah">Umrah Package</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          {/* All Status Dropdown */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-32 text-xs rounded-lg shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-50 text-xs">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Status Chips Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 shrink-0 no-scrollbar">
        {[
          { key: "all", label: "All", count: statusCounts.all, activeColor: "bg-primary text-primary-foreground" },
          { key: "draft", label: "Draft", count: statusCounts.draft, activeColor: "bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900" },
          { key: "sent", label: "Sent", count: statusCounts.sent, activeColor: "bg-blue-600 text-white" },
          { key: "accepted", label: "Accepted", count: statusCounts.accepted, activeColor: "bg-emerald-600 text-white" },
          { key: "rejected", label: "Rejected", count: statusCounts.rejected, activeColor: "bg-destructive text-destructive-foreground" },
          { key: "expired", label: "Expired", count: statusCounts.expired, activeColor: "bg-amber-600 text-white" },
        ].map((chip) => {
          const isSelected = filterStatus === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilterStatus(chip.key)}
              className={cn(
                "h-7 px-2.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 border",
                isSelected
                  ? `${chip.activeColor} border-transparent shadow-sm font-semibold`
                  : "bg-background/80 hover:bg-muted text-muted-foreground border-border/80"
              )}
            >
              <span>{chip.label}</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full",
                  isSelected
                    ? "bg-black/20 text-current"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* TABLE / LIST CONTAINER: Fills remaining height, internal scroll only for rows */}
      <div className="flex-1 min-h-0 bg-card rounded-xl border border-border/70 overflow-hidden flex flex-col shadow-sm">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <p className="text-xs">Loading quotations...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-semibold text-foreground">No quotations found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {search || filterStatus !== "all" || filterService !== "all" || dateFilter.preset !== "this_month"
                ? "Try clearing your filters or date range to view quotations."
                : "Create your first professional quotation to send to your clients."}
            </p>
            <Button
              size="sm"
              onClick={() => navigate("/app/leads-quotes/quotations/new")}
              className="mt-3 h-8 text-xs font-semibold gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Quotation</span>
            </Button>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE VIEW (>= 1024px) */}
            <div className="hidden lg:block flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur z-10 border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Quotation #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3">Service Type</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.map((q) => {
                    const isExpired = isQuotationExpired(q);
                    const bookingId = q.booking_id || q.converted_booking_id;
                    return (
                      <tr key={q.id} className="hover:bg-muted/40 transition-colors group">
                        {/* Quotation # + Link booking */}
                        <td className="py-2.5 px-3 font-semibold font-mono text-foreground">
                          <div className="flex items-center gap-1.5">
                            <span>{q.quotation_number}</span>
                            {renderBookingReference(q)}
                          </div>
                          {q.title && <p className="text-[11px] font-normal text-muted-foreground truncate max-w-[180px]">{q.title}</p>}
                        </td>

                        {/* Date */}
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                          <div>{format(parseISO(q.quotation_date), "dd MMM yyyy")}</div>
                          {q.valid_until && (
                            <div className="text-[10px] text-muted-foreground/80">
                              Valid: {format(parseISO(q.valid_until), "dd MMM")}
                            </div>
                          )}
                        </td>

                        {/* Client */}
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-foreground truncate max-w-[170px]">{q.client_name}</div>
                          {q.client_phone && <div className="text-[11px] text-muted-foreground font-mono">{q.client_phone}</div>}
                        </td>

                        {/* Service Type */}
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-[10px] font-medium py-0 px-1.5 h-4.5">
                            {serviceLabels[q.service_type] || q.service_type}
                          </Badge>
                        </td>

                        {/* Total */}
                        <td className="py-2.5 px-3 text-right font-bold font-mono text-foreground whitespace-nowrap">
                          {q.currency} {Number(q.total).toLocaleString()}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {isExpired ? (
                            <Badge variant="outline" className={cn("text-[10px] font-semibold py-0 px-2 h-5", statusColors.expired)}>
                              Expired
                            </Badge>
                          ) : (
                            <Badge variant="outline" className={cn("text-[10px] font-semibold py-0 px-2 h-5 capitalize", statusColors[q.status])}>
                              {q.status}
                            </Badge>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {!bookingId && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConvertToBooking(q)}
                                className="h-7 text-[11px] px-2 gap-1 text-primary hover:bg-primary/10 border-primary/40 font-semibold"
                                title="Convert this quotation to a client booking"
                              >
                                <ArrowRightCircle className="w-3 h-3" />
                                <span>Convert</span>
                              </Button>
                            )}

                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setPreviewQ(q)}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="View Quotation Preview"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => navigate(`/app/leads-quotes/quotations/${q.id}/edit`)}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Edit Quotation"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDownload(q)}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Download PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEmail(q)}
                              disabled={sendingEmailId === q.id}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Send PDF Email"
                            >
                              {sendingEmailId === q.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Mail className="w-3.5 h-3.5" />
                              )}
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive/70 hover:text-destructive"
                                  title="Delete Quotation"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="z-[100]">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete quotation #{q.quotation_number}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete quotation #{q.quotation_number}. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteQuotation.mutate(q.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARD VIEW (< 1024px) */}
            <div className="lg:hidden flex-1 overflow-y-auto p-2.5 space-y-2">
              {filtered.map((q) => {
                const isExpired = isQuotationExpired(q);
                const bookingId = q.booking_id || q.converted_booking_id;
                return (
                  <div
                    key={q.id}
                    className="p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/20 transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm font-mono text-foreground">{q.quotation_number}</span>
                          {renderBookingReference(q)}
                          {isExpired ? (
                            <Badge variant="outline" className={cn("text-[9px] font-semibold py-0 px-1.5 h-4.5", statusColors.expired)}>
                              Expired
                            </Badge>
                          ) : (
                            <Badge variant="outline" className={cn("text-[9px] font-semibold py-0 px-1.5 h-4.5 capitalize", statusColors[q.status])}>
                              {q.status}
                            </Badge>
                          )}
                        </div>
                        <p className="font-semibold text-xs text-foreground mt-0.5 truncate">{q.client_name}</p>
                        {q.title && <p className="text-[11px] text-muted-foreground truncate">{q.title}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-muted-foreground block">Total</span>
                        <span className="font-black text-sm text-foreground font-mono">
                          {q.currency} {Number(q.total).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t">
                      <span>{format(parseISO(q.quotation_date), "dd MMM yyyy")}</span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                        {serviceLabels[q.service_type] || q.service_type}
                      </Badge>
                    </div>

                    {/* Action buttons on card */}
                    <div className="flex items-center justify-between pt-1.5 border-t gap-1">
                      {!bookingId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConvertToBooking(q)}
                          className="h-8 text-[11px] px-2 gap-1 text-primary hover:bg-primary/10 border-primary/40 font-semibold"
                        >
                          <ArrowRightCircle className="w-3.5 h-3.5" />
                          <span>Convert to Booking</span>
                        </Button>
                      ) : (
                        <div />
                      )}

                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setPreviewQ(q)}
                          className="h-8 w-8 text-muted-foreground"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => navigate(`/app/leads-quotes/quotations/${q.id}/edit`)}
                          className="h-8 w-8 text-muted-foreground"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDownload(q)}
                          className="h-8 w-8 text-muted-foreground"
                          title="PDF"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEmail(q)}
                          disabled={sendingEmailId === q.id}
                          className="h-8 w-8 text-muted-foreground"
                          title="Email"
                        >
                          {sendingEmailId === q.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Mail className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={Boolean(previewQ)} onOpenChange={(o) => !o && setPreviewQ(null)}>
        <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto z-[100] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Eye className="w-5 h-5 text-primary" />
              <span>Quotation Preview — {previewQ?.quotation_number}</span>
            </DialogTitle>
            <DialogDescription>
              Review line items and customer information.
            </DialogDescription>
          </DialogHeader>

          {previewQ && (
            <div className="space-y-3.5 text-xs">
              <div className="flex items-start justify-between pb-2 border-b">
                <div>
                  <p className="font-bold text-sm sm:text-base font-mono">{previewQ.quotation_number}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Date: {format(parseISO(previewQ.quotation_date), "dd MMM yyyy")}
                    {previewQ.valid_until ? ` • Valid until: ${format(parseISO(previewQ.valid_until), "dd MMM yyyy")}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className={cn("text-[10px] capitalize", statusColors[previewQ.status])}>
                    {previewQ.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {serviceLabels[previewQ.service_type] || previewQ.service_type}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-muted/20 p-2.5 rounded-lg border">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Recipient / Client</p>
                  <p className="font-bold text-foreground text-xs">{previewQ.client_name}</p>
                  {previewQ.client_phone && <p className="text-muted-foreground">{previewQ.client_phone}</p>}
                  {previewQ.client_email && <p className="text-muted-foreground">{previewQ.client_email}</p>}
                </div>
                {previewQ.title && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Subject / Package</p>
                    <p className="font-semibold text-foreground text-xs">{previewQ.title}</p>
                    {previewQ.description && <p className="text-muted-foreground line-clamp-2">{previewQ.description}</p>}
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-muted/60 text-[11px] font-semibold text-muted-foreground">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>
                {(previewQ.items || []).map((it, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-t text-xs">
                    <div className="col-span-6 break-words font-medium">{it.description || "-"}</div>
                    <div className="col-span-2 text-center font-mono">{it.qty}</div>
                    <div className="col-span-2 text-right font-mono">{Number(it.unit_price || 0).toLocaleString()}</div>
                    <div className="col-span-2 text-right font-bold font-mono">
                      {Number(it.amount || 0).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="ml-auto w-full sm:w-64 space-y-1 bg-muted/20 p-2.5 rounded-lg border">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">{previewQ.currency} {Number(previewQ.subtotal).toLocaleString()}</span>
                </div>
                {Number(previewQ.discount) > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                    <span>Discount</span>
                    <span className="font-mono">- {previewQ.currency} {Number(previewQ.discount).toLocaleString()}</span>
                  </div>
                )}
                {Number(previewQ.tax) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-mono">+ {previewQ.currency} {Number(previewQ.tax).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black pt-1.5 border-t text-primary">
                  <span>TOTAL:</span>
                  <span className="font-mono">{previewQ.currency} {Number(previewQ.total).toLocaleString()}</span>
                </div>
              </div>

              {previewQ.terms && (
                <div className="pt-1 text-[11px] text-muted-foreground">
                  <span className="font-semibold">Terms:</span> {previewQ.terms}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setPreviewQ(null)}>
              Close
            </Button>
            {previewQ && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const q = previewQ;
                    setPreviewQ(null);
                    handleDownload(q);
                  }}
                  className="gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const q = previewQ;
                    setPreviewQ(null);
                    handleEmail(q);
                  }}
                  disabled={!previewQ.client_email}
                  className="gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email to Client</span>
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
