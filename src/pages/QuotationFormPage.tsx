import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRightCircle,
  Download,
  Hash,
  Calendar,
  CalendarDays,
  Briefcase,
  Tag,
  User,
  Mail,
  Phone,
  FileText,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { format, addDays, parseISO } from "date-fns";
import { useQuotations, type Quotation, type QuotationInput, type QuotationItem } from "@/hooks/useQuotations";
import { useClients } from "@/hooks/useStorage";
import { useB2BAgents } from "@/hooks/useB2BAgents";
import { useAgency } from "@/hooks/useAgency";
import { downloadQuotationPdf } from "@/lib/quotationPdf";
import { cn } from "@/lib/utils";
import { LockedDateField } from "@/components/ui/LockedDateField";
import { UniversalPartySelect } from "@/components/parties/UniversalPartySelect";

type ServiceType = "client_booking" | "b2b" | "umrah" | "custom";
type Status = "draft" | "sent" | "accepted" | "rejected";

const SERVICE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: "client_booking", label: "Client Booking" },
  { value: "b2b", label: "B2B Service" },
  { value: "umrah", label: "Umrah Package" },
  { value: "custom", label: "Custom" },
];

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

export default function QuotationFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const location = useLocation();

  const { quotations = [], addQuotation, updateQuotation } = useQuotations();
  const { clients = [] } = useClients();
  const { agents: b2bAgents = [] } = useB2BAgents();
  const { data: agency } = useAgency();

  // Find most recent quotation number for hint
  const mostRecentQuotationNumber = useMemo(() => {
    if (!quotations || quotations.length === 0) return null;
    const sorted = [...quotations].sort(
      (a, b) => new Date(b.created_at || b.quotation_date).getTime() - new Date(a.created_at || a.quotation_date).getTime()
    );
    return sorted[0]?.quotation_number || null;
  }, [quotations]);

  // Form State
  const [quotationNumber, setQuotationNumber] = useState("");
  const [quotationDate, setQuotationDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [validUntil, setValidUntil] = useState(() => format(addDays(new Date(), 14), "yyyy-MM-dd"));
  const [serviceType, setServiceType] = useState<ServiceType>("client_booking");
  const [status, setStatus] = useState<Status>("draft");

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);

  const [currency, setCurrency] = useState("PKR");

  const [items, setItems] = useState<QuotationItem[]>([
    { description: "", qty: 1, unit_price: 0, amount: 0 },
  ]);

  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);

  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(
    "Quotation valid until the date mentioned above. Prices subject to availability at the time of confirmation."
  );

  const [convertedBookingId, setConvertedBookingId] = useState<string | null>(null);

  // Validation & Autocomplete State
  const [errors, setErrors] = useState<{
    quotationNumber?: string;
    clientName?: string;
    items?: string;
  }>({});
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field Refs for keyboard-first navigation
  const quotationNumberRef = useRef<HTMLInputElement>(null);
  const quotationDateRef = useRef<HTMLInputElement>(null);
  const validUntilRef = useRef<HTMLInputElement>(null);
  const clientNameRef = useRef<HTMLInputElement>(null);
  const clientEmailRef = useRef<HTMLInputElement>(null);
  const clientPhoneRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const firstItemDescRef = useRef<HTMLInputElement>(null);
  const lastItemUnitPriceRef = useRef<HTMLInputElement>(null);

  // Prefill or load existing quotation
  useEffect(() => {
    if (isEdit && quotations.length > 0) {
      const q = quotations.find((x) => x.id === id);
      if (q) {
        setQuotationNumber(q.quotation_number || "");
        setQuotationDate(q.quotation_date || format(new Date(), "yyyy-MM-dd"));
        setValidUntil(q.valid_until || "");
        setServiceType(q.service_type || "client_booking");
        setStatus(q.status || "draft");
        setClientName(q.client_name || "");
        setClientEmail(q.client_email || "");
        setClientPhone(q.client_phone || "");
        setClientId(q.client_id || null);
        setAgentId(q.agent_id || null);
        setTitle(q.title || "");
        setDescription(q.description || "");
        setCurrency(q.currency || "PKR");
        setItems(
          q.items && q.items.length > 0
            ? q.items
            : [{ description: "", qty: 1, unit_price: 0, amount: 0 }]
        );
        setDiscount(Number(q.discount) || 0);
        setTax(Number(q.tax) || 0);
        setNotes(q.notes || "");
        setTerms(q.terms || "");
        setConvertedBookingId(q.booking_id || q.converted_booking_id || null);
      } else {
        toast.error("Quotation not found");
        navigate("/app/leads-quotes?tab=quotations", { replace: true });
      }
    } else {
      const prefill = (location.state as { prefill?: Partial<QuotationInput> })?.prefill;
      if (prefill) {
        if (prefill.client_name) setClientName(prefill.client_name);
        if (prefill.client_phone) setClientPhone(prefill.client_phone);
        if (prefill.client_email) setClientEmail(prefill.client_email);
        if (prefill.service_type) setServiceType(prefill.service_type);
        if (prefill.title) setTitle(prefill.title);
        if (prefill.description) setDescription(prefill.description);
        if (prefill.currency) setCurrency(prefill.currency);
        if (prefill.notes) setNotes(prefill.notes);
        if (prefill.items && Array.isArray(prefill.items) && prefill.items.length > 0) {
          setItems(prefill.items);
        }
      }
    }
  }, [id, isEdit, quotations, navigate, location.state]);

  // Autofocus Quotation Number on open
  useEffect(() => {
    const timer = setTimeout(() => {
      quotationNumberRef.current?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  // Recalculate totals
  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
  }, [items]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - (Number(discount) || 0) + (Number(tax) || 0));
  }, [subtotal, discount, tax]);

  // Item row operations
  const updateItem = (index: number, patch: Partial<QuotationItem>) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, ...patch };
        updated.amount = (Number(updated.qty) || 0) * (Number(updated.unit_price) || 0);
        return updated;
      })
    );
  };

  const addItem = (focusNew: boolean = false) => {
    setItems((prev) => [...prev, { description: "", qty: 1, unit_price: 0, amount: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Check unique quotation number per agency
  const checkQuotationNumberUniqueness = (number: string): boolean => {
    const trimmed = number.trim();
    if (!trimmed) return true;
    const clash = quotations.find(
      (q) =>
        q.quotation_number.trim().toLowerCase() === trimmed.toLowerCase() &&
        q.id !== id
    );
    if (clash) {
      setErrors((prev) => ({
        ...prev,
        quotationNumber: "This quotation number already exists for your agency",
      }));
      return false;
    }
    setErrors((prev) => ({ ...prev, quotationNumber: undefined }));
    return true;
  };

  // Client suggestions
  const filteredClientSuggestions = useMemo(() => {
    if (!clientName.trim() || clientName.length < 2) return [];
    const term = clientName.toLowerCase();
    return clients
      .filter((c: any) => c.name?.toLowerCase().includes(term) || c.contact_number?.includes(term))
      .slice(0, 5);
  }, [clients, clientName]);

  const handleSelectClient = (c: any) => {
    setClientId(c.id);
    setClientName(c.name || "");
    if (c.email) setClientEmail(c.email);
    if (c.contact_number) setClientPhone(c.contact_number);
    setShowClientSuggestions(false);
  };

  // Valid Until quick chips
  const applyValidUntilChip = (days: number) => {
    const base = quotationDate ? parseISO(quotationDate) : new Date();
    setValidUntil(format(addDays(base, days), "yyyy-MM-dd"));
  };

  const hasUnsavedChanges = Boolean(
    quotationNumber.trim() || clientName.trim() || items.some((i) => i.description.trim())
  );

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges && !convertedBookingId) {
      const confirmLeave = window.confirm("You have unsaved changes. Discard and close?");
      if (!confirmLeave) return;
    }
    navigate("/app/leads-quotes?tab=quotations");
  }, [hasUnsavedChanges, convertedBookingId, navigate]);

  const validate = (): boolean => {
    const nextErrors: typeof errors = {};

    if (!quotationNumber.trim()) {
      nextErrors.quotationNumber = "Quotation # is required";
    } else {
      const unique = checkQuotationNumberUniqueness(quotationNumber);
      if (!unique) return false;
    }

    if (!clientName.trim()) {
      nextErrors.clientName = "Client Name is required";
    }

    const hasValidItem = items.some((i) => i.description.trim());
    if (!hasValidItem) {
      nextErrors.items = "Add at least one item with a description";
    }

    setErrors(nextErrors);

    if (nextErrors.quotationNumber) {
      quotationNumberRef.current?.focus();
      return false;
    }
    if (nextErrors.clientName) {
      clientNameRef.current?.focus();
      return false;
    }
    if (nextErrors.items) {
      firstItemDescRef.current?.focus();
      return false;
    }

    return true;
  };

  const buildPayload = (): QuotationInput => {
    const normalizedItems = items
      .filter((i) => i.description.trim())
      .map((i) => ({
        description: i.description.trim(),
        qty: Number(i.qty) || 1,
        unit_price: Number(i.unit_price) || 0,
        amount: (Number(i.qty) || 1) * (Number(i.unit_price) || 0),
      }));

    return {
      quotation_number: quotationNumber.trim(),
      quotation_date: quotationDate,
      valid_until: validUntil || null,
      service_type: serviceType,
      client_name: clientName.trim(),
      client_email: clientEmail.trim() || null,
      client_phone: clientPhone.trim() || null,
      client_id: clientId,
      agent_id: agentId,
      title: title.trim() || null,
      description: description.trim() || null,
      items: normalizedItems,
      subtotal,
      discount: Number(discount) || 0,
      tax: Number(tax) || 0,
      total,
      currency,
      status,
      notes: notes.trim() || null,
      terms: terms.trim() || null,
      source: "web-app",
      source_ref: null,
    };
  };

  const handleSave = async (andDownloadPdf: boolean = false) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("You are offline, not saved");
      return;
    }
    if (!validate()) return;

    setIsSubmitting(true);
    const payload = buildPayload();

    try {
      let savedQuote: any;
      if (isEdit && id) {
        savedQuote = await updateQuotation.mutateAsync({ id, ...payload });
        toast.success("Quotation updated successfully");
      } else {
        savedQuote = await addQuotation.mutateAsync(payload);
        toast.success("Quotation saved successfully");
      }

      if (andDownloadPdf) {
        const quoteForPdf: Quotation = {
          id: savedQuote?.id || id || "temp",
          agency_id: savedQuote?.agency_id || "",
          ...payload,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        downloadQuotationPdf(quoteForPdf, {
          agencyName: agency?.name,
          agencyEmail: agency?.contact_email || agency?.email,
          agencyPhone: agency?.phone_number,
        });
        toast.success("PDF generated & downloaded");
      }

      navigate("/app/leads-quotes?tab=quotations");
    } catch (e: any) {
      toast.error(`Could not save: ${e?.message || "Failed to save quotation"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert to Booking action
  const handleConvertToBooking = () => {
    navigate("/app/bookings?tab=clients", {
      state: {
        openAddClient: true,
        prefill: {
          name: clientName,
          contact_number: clientPhone,
          email: clientEmail,
          travel_type: serviceType === "umrah" ? "Umrah" : "Ticket",
          selling_price: total,
          notes: `Converted from Quotation #${quotationNumber}${title ? ` — ${title}` : ""}\nQuotation Total: ${currency} ${total.toLocaleString()}`,
          converted_from_quote_id: id,
        },
      },
    });
  };

  // Global Keyboard Shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Shift + Enter = Save & PDF
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Enter") {
      e.preventDefault();
      handleSave(true);
      return;
    }

    // Ctrl/Cmd + Enter = Save
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave(false);
      return;
    }

    // Esc = Close
    if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
      return;
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className="flex flex-col h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-4.25rem)] w-full max-w-7xl mx-auto overflow-hidden bg-background"
    >
      {/* 1. Global Header Bar: ONLY Back arrow + Title on left, and X (close icon) on far right */}
      <div className="h-11 md:h-12 px-3 sm:px-6 border-b border-border/70 flex items-center justify-between shrink-0 bg-background/95 backdrop-blur z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
            title="Go back (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-sm sm:text-base font-bold text-foreground truncate">
            {isEdit ? `Edit Quotation #${quotationNumber}` : "New Quotation"}
          </h1>
        </div>

        {/* Far Right: ONLY compact X (close/cancel) button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClose}
          aria-label="Cancel and close"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
          title="Cancel and close (Esc)"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Main Content: Scrollable flex layout with proper bottom padding */}
      <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 flex flex-col gap-3 min-w-0 pb-6">

        {/* 2. COMPACT 12-COLUMN DETAILS CARD (Rows 1 to 4 with explicit CSS Grid) */}
        <div
          className="bg-card rounded-2xl border border-border/70 shadow-sm p-3 sm:p-3.5 shrink-0 min-w-0"
          style={{ width: "100%", gap: "10px", display: "flex", flexDirection: "column" }}
        >
          {/* ROW 1 (3 Columns on SAME line): Quotation # * | Date * | Valid Until (with +7d, +14d, +30d buttons) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1.2fr",
              gap: "12px",
              width: "100%",
            }}
          >
            {/* Column 1: Quotation # * */}
            <div style={{ width: "100%", minWidth: 0 }}>
              <Label htmlFor="quote_num" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Quotation # <span className="text-destructive">*</span></span>
                {errors.quotationNumber && (
                  <span className="text-[10px] text-destructive truncate font-normal normal-case">{errors.quotationNumber}</span>
                )}
              </Label>
              <div className="relative" style={{ width: "100%", minWidth: 0 }}>
                <Hash className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="quote_num"
                  ref={quotationNumberRef}
                  tabIndex={1}
                  value={quotationNumber}
                  onChange={(e) => {
                    setQuotationNumber(e.target.value);
                    if (errors.quotationNumber) setErrors((prev) => ({ ...prev, quotationNumber: undefined }));
                  }}
                  onBlur={(e) => checkQuotationNumberUniqueness(e.target.value)}
                  placeholder="e.g. QT-2026-089"
                  className={cn(
                    "pl-9 h-8 sm:h-8.5 text-sm font-semibold rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none",
                    errors.quotationNumber && "border-destructive focus-visible:ring-destructive"
                  )}
                  style={{ width: "100%", minWidth: 0 }}
                />
              </div>
              {mostRecentQuotationNumber && !quotationNumber && (
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  Last used:{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setQuotationNumber(mostRecentQuotationNumber);
                      quotationDateRef.current?.focus();
                    }}
                    className="underline hover:text-foreground font-mono focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    {mostRecentQuotationNumber}
                  </button>
                </p>
              )}
            </div>

            {/* Column 2: Date * (Standardized Locked System Date) */}
            <div style={{ width: "100%", minWidth: 0 }}>
              <LockedDateField
                label="Date"
                value={quotationDate}
                onChange={setQuotationDate}
                required
              />
            </div>

            {/* Column 3: Valid Until (with +7d, +14d, +30d quick buttons in header) */}
            <div style={{ width: "100%", minWidth: 0 }}>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="valid_until" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Valid Until
                </Label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    tabIndex={4}
                    onClick={() => applyValidUntilChip(7)}
                    className="text-[10px] px-1.5 py-0.2 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    +7d
                  </button>
                  <button
                    type="button"
                    tabIndex={5}
                    onClick={() => applyValidUntilChip(14)}
                    className="text-[10px] px-1.5 py-0.2 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    +14d
                  </button>
                  <button
                    type="button"
                    tabIndex={6}
                    onClick={() => applyValidUntilChip(30)}
                    className="text-[10px] px-1.5 py-0.2 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    +30d
                  </button>
                </div>
              </div>
              <div className="relative" style={{ width: "100%", minWidth: 0 }}>
                <CalendarDays className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="valid_until"
                  ref={validUntilRef}
                  tabIndex={3}
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="pl-9 h-8 sm:h-8.5 text-sm rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                  style={{ width: "100%", minWidth: 0 }}
                />
              </div>
            </div>
          </div>

          {/* ROW 2 (2 Equal 50%/50% Columns on SAME line): Service Type * & Status */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "12px",
              width: "100%",
            }}
          >
            <div style={{ width: "100%", minWidth: 0 }}>
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                Service Type <span className="text-destructive">*</span>
              </Label>
              <Select value={serviceType} onValueChange={(v: ServiceType) => setServiceType(v)}>
                <SelectTrigger
                  tabIndex={7}
                  className="h-8 sm:h-8.5 text-xs rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                  style={{ width: "100%", minWidth: 0 }}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Briefcase className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-50 text-xs">
                  {SERVICE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div style={{ width: "100%", minWidth: 0 }}>
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                Status
              </Label>
              <Select value={status} onValueChange={(v: Status) => setStatus(v)}>
                <SelectTrigger
                  tabIndex={8}
                  className="h-8 sm:h-8.5 text-xs rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                  style={{ width: "100%", minWidth: 0 }}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-50 text-xs">
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ROW 3 (2 Equal 50%/50% Columns on SAME line): Client / Recipient Name * & Email Address */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "12px",
              width: "100%",
            }}
          >
            <div style={{ width: "100%", minWidth: 0, position: "relative" }}>
              <Label htmlFor="client_name" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Client / Recipient Name <span className="text-destructive">*</span></span>
                {errors.clientName && (
                  <span className="text-[10px] text-destructive truncate font-normal normal-case">{errors.clientName}</span>
                )}
              </Label>
              <div className="relative" style={{ width: "100%", minWidth: 0 }}>
                <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="client_name"
                  ref={clientNameRef}
                  tabIndex={9}
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    setShowClientSuggestions(true);
                    if (errors.clientName) setErrors((prev) => ({ ...prev, clientName: undefined }));
                  }}
                  onFocus={() => setShowClientSuggestions(true)}
                  placeholder="Client name (type to search)..."
                  className={cn(
                    "pl-9 h-8 sm:h-8.5 text-sm rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none",
                    errors.clientName && "border-destructive focus-visible:ring-destructive"
                  )}
                  style={{ width: "100%", minWidth: 0 }}
                />
              </div>

              {/* Autocomplete Suggestions */}
              {showClientSuggestions && filteredClientSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden text-xs">
                  <div className="p-1.5 bg-muted/50 border-b text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Matching Existing Clients
                  </div>
                  {filteredClientSuggestions.map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectClient(c)}
                      className="w-full text-left px-3 py-1.5 hover:bg-muted/70 flex items-center justify-between transition-colors border-b last:border-b-0 focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <div>
                        <p className="font-semibold text-foreground">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground">{c.contact_number || c.email || "No contact"}</p>
                      </div>
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Select</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ width: "100%", minWidth: 0 }}>
              <Label htmlFor="client_email" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                Email Address
              </Label>
              <div className="relative" style={{ width: "100%", minWidth: 0 }}>
                <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="client_email"
                  ref={clientEmailRef}
                  tabIndex={10}
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@example.com (for PDF sending)"
                  className="pl-9 h-8 sm:h-8.5 text-sm rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                  style={{ width: "100%", minWidth: 0 }}
                />
              </div>
            </div>
          </div>

          {/* ROW 4 (2 Equal 50%/50% Columns on SAME line): Phone Number & Quotation Title / Subject */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "12px",
              width: "100%",
            }}
          >
            <div style={{ width: "100%", minWidth: 0 }}>
              <Label htmlFor="client_phone" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                Phone Number
              </Label>
              <div className="relative" style={{ width: "100%", minWidth: 0 }}>
                <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="client_phone"
                  ref={clientPhoneRef}
                  tabIndex={11}
                  type="tel"
                  inputMode="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="pl-9 h-8 sm:h-8.5 text-sm rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                  style={{ width: "100%", minWidth: 0 }}
                />
              </div>
            </div>

            <div style={{ width: "100%", minWidth: 0 }}>
              <Label htmlFor="quote_title" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                Quotation Title / Subject
              </Label>
              <div className="relative" style={{ width: "100%", minWidth: 0 }}>
                <FileText className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="quote_title"
                  ref={titleRef}
                  tabIndex={12}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 14-Day Umrah Package / Executive Flight"
                  className="pl-9 h-8 sm:h-8.5 text-sm rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                  style={{ width: "100%", minWidth: 0 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2 ZONES: MIDDLE LINE ITEMS (~65% -> 8 cols) & RIGHT TOTALS/TERMS (~35% -> 4 cols) */}
        <div
          className="flex-1 min-h-0"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.8fr) minmax(0, 1.2fr)",
            gap: "12px",
            width: "100%",
          }}
        >
          {/* LEFT: Quotation Line Items Table */}
          <div className="flex flex-col min-h-0 bg-card rounded-2xl border border-border/70 overflow-hidden shadow-sm" style={{ minWidth: 0 }}>
            <div className="px-3 py-1.5 border-b bg-muted/30 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs uppercase tracking-wider text-foreground">Line Items</span>
                <span className="text-[11px] text-muted-foreground">({items.length} {items.length === 1 ? "line" : "lines"})</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addItem(true)}
                className="h-6 px-2 text-xs gap-1 font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
              >
                <Plus className="w-3 h-3" />
                <span>Add line</span>
              </Button>
            </div>

            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1 bg-muted/60 text-[11px] font-semibold text-muted-foreground border-b shrink-0">
              <div className="col-span-6">Description *</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Unit Price ({currency})</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>

            {/* Internal Scroll Rows Container */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {items.map((it, idx) => {
                const isLast = idx === items.length - 1;
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-1.5 sm:gap-2 items-center bg-muted/10 p-1.5 sm:p-0 rounded-lg sm:rounded-none border sm:border-0"
                  >
                    <div className="col-span-12 sm:col-span-6">
                      <Input
                        ref={idx === 0 ? firstItemDescRef : undefined}
                        placeholder="Item or service description..."
                        value={it.description}
                        onChange={(e) => updateItem(idx, { description: e.target.value })}
                        className="h-7 sm:h-8 text-sm rounded-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Input
                        type="number"
                        min="1"
                        inputMode="decimal"
                        placeholder="Qty"
                        value={it.qty}
                        onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })}
                        className="h-7 sm:h-8 text-sm rounded-md text-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Input
                        ref={isLast ? lastItemUnitPriceRef : undefined}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="Rate"
                        value={it.unit_price}
                        onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })}
                        onKeyDown={(e) => {
                          if (isLast && e.key === "Tab" && !e.shiftKey) {
                            e.preventDefault();
                            addItem(true);
                          }
                        }}
                        className="h-7 sm:h-8 text-sm rounded-md text-right font-mono focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-1 text-right text-xs font-bold font-mono truncate">
                      {(Number(it.qty || 0) * Number(it.unit_price || 0)).toLocaleString()}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={items.length <= 1}
                        onClick={() => removeItem(idx)}
                        className="h-6 w-6 text-muted-foreground hover:text-destructive rounded-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                        title="Delete line"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Totals Card, Notes & Terms */}
          <div className="flex flex-col justify-between gap-1.5 bg-card rounded-2xl border border-border/70 p-2.5 overflow-y-auto shadow-sm" style={{ minWidth: 0 }}>
            <div className="space-y-1.5">
              {/* Currency & Subtotal */}
              <div className="flex items-center justify-between pb-1 border-b">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Currency</span>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-6.5 w-20 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-50 text-xs">
                    <SelectItem value="PKR">PKR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="SAR">SAR</SelectItem>
                    <SelectItem value="AED">AED</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold font-mono">{currency} {subtotal.toLocaleString()}</span>
              </div>

              {/* Discount */}
              <div className="flex justify-between items-center gap-2 text-xs">
                <span className="text-muted-foreground">Discount (-)</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="h-6.5 w-24 text-right text-xs font-mono rounded focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                />
              </div>

              {/* Tax */}
              <div className="flex justify-between items-center gap-2 text-xs">
                <span className="text-muted-foreground">Tax / Fee (+)</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={tax}
                  onChange={(e) => setTax(Number(e.target.value))}
                  className="h-6.5 w-24 text-right text-xs font-mono rounded focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                />
              </div>

              {/* TOTAL (large bold) */}
              <div className="pt-1.5 border-t flex items-baseline justify-between bg-primary/5 p-1.5 rounded-xl border border-primary/20">
                <span className="font-bold text-[11px] uppercase tracking-wide text-foreground">TOTAL:</span>
                <span className="text-lg sm:text-xl font-black text-primary font-mono tracking-tight">
                  {currency} {total.toLocaleString()}
                </span>
              </div>

              {/* Notes */}
              <div className="space-y-0.5 pt-0.5">
                <Label htmlFor="notes" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Notes (Client facing)
                </Label>
                <Textarea
                  id="notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Included baggage, flight transit notes, payment terms..."
                  className="min-h-[38px] text-xs rounded-lg resize-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                />
              </div>

              {/* Terms */}
              <div className="space-y-0.5">
                <Label htmlFor="terms" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Terms & Conditions
                </Label>
                <Textarea
                  id="terms"
                  rows={2}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Terms of quotation..."
                  className="min-h-[38px] text-xs rounded-lg resize-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Bar: Always visible sticky/fixed footer */}
      <div
        className="shrink-0 bg-background/95 backdrop-blur-sm py-2.5 px-3 sm:px-4 border-t border-border/70 flex items-center justify-between gap-3 z-30 shadow-md"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="h-8.5 px-3.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Button>

        <div className="flex items-center gap-2">
          {isEdit && !convertedBookingId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleConvertToBooking}
              className="h-8.5 px-2.5 text-xs gap-1 text-primary hover:bg-primary/10 border-primary/40 font-semibold focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
            >
              <ArrowRightCircle className="w-3.5 h-3.5" />
              <span>Convert to Booking</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            tabIndex={13}
            onClick={() => handleSave(true)}
            disabled={isSubmitting}
            className="h-8.5 px-3.5 text-xs gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none font-medium"
            title="Save and download PDF (Ctrl+Shift+Enter)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save & PDF</span>
          </Button>

          <Button
            type="button"
            size="sm"
            tabIndex={14}
            onClick={() => handleSave(false)}
            disabled={isSubmitting}
            className="h-8.5 px-5 text-xs font-semibold shadow-sm gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
            title="Save Quotation (Ctrl+Enter)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? "Saving..." : isEdit ? "Update Quotation" : "Save Quotation"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
