import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Plus, Trash2, Calculator, Check, ArrowRightCircle, Download, Eye, Sparkles, Building2
} from "lucide-react";
import { toast } from "sonner";
import { format, addDays, parseISO } from "date-fns";
import { useQuotations, type Quotation, type QuotationInput, type QuotationItem } from "@/hooks/useQuotations";
import { useClients } from "@/hooks/useStorage";
import { useB2BAgents } from "@/hooks/useB2BAgents";
import { useAgency } from "@/hooks/useAgency";
import { downloadQuotationPdf } from "@/lib/quotationPdf";
import { cn } from "@/lib/utils";

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
  const [clientId, setClientId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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
      // Prefill from navigation state (e.g. from Umrah Calculator or Client Query)
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
    }, 100);
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

  // Umrah calculator result import
  const handleUseCalculatorResult = () => {
    try {
      const raw = localStorage.getItem("tams_latest_umrah_calc");
      if (!raw) {
        toast.info("No recent Umrah calculation found", {
          description: "Open the Umrah Calculator and click calculate first.",
        });
        return;
      }
      const data = JSON.parse(raw);
      const res = data?.result;
      if (!res || !res.totalPackageCost) {
        toast.info("No valid Umrah calculation data found");
        return;
      }

      const perPerson = Math.round(res.perPerson || 0);
      const passengers = Number(res.totalPassengers) || 1;
      const nights = res.nights || 14;

      setServiceType("umrah");
      setTitle(`Umrah Package — ${nights} Nights (${passengers} Pax)`);
      setDescription(
        `Custom Umrah package calculated for ${passengers} passenger(s). Per person rate: PKR ${perPerson.toLocaleString()}.`
      );
      setCurrency("PKR");
      setItems([
        {
          description: `Umrah Package (${nights} Nights, ${passengers} Pax)`,
          qty: passengers,
          unit_price: perPerson,
          amount: perPerson * passengers,
        },
      ]);

      toast.success("Imported calculation from Umrah Calculator!");
    } catch (e) {
      toast.error("Failed to read Umrah calculation");
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

  const hasUnsavedChanges = Boolean(
    quotationNumber.trim() || clientName.trim() || items.some((i) => i.description.trim())
  );

  const handleBack = useCallback(() => {
    if (hasUnsavedChanges && !convertedBookingId) {
      const confirmLeave = window.confirm("You have unsaved changes. Discard and go back?");
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
      toast.error(e?.message || "Failed to save quotation");
    } finally {
      setIsSubmitting(false);
    }
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

    // Esc = Back
    if (e.key === "Escape") {
      e.preventDefault();
      handleBack();
      return;
    }
  };

  // Enter advances to next field on single-line inputs
  const handleEnterAdvance = (nextRef: React.RefObject<HTMLElement | null>) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className="flex flex-col h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-4.25rem)] w-full max-w-7xl mx-auto overflow-hidden bg-background"
    >
      {/* Top Bar */}
      <div className="h-12 md:h-14 px-3 sm:px-6 border-b border-border/70 flex items-center justify-between shrink-0 bg-background/95 backdrop-blur z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
            title="Go back (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-baseline gap-2 truncate">
            <h1 className="text-base sm:text-lg font-bold text-foreground truncate">
              {isEdit ? `Edit Quotation #${quotationNumber}` : "New Quotation"}
            </h1>
            <span className="hidden xl:inline text-[11px] text-muted-foreground font-mono">
              Tab = next | Ctrl+Enter = Save | Ctrl+Shift+Enter = Save & PDF | Esc = Back
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Umrah calculator quick fill */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUseCalculatorResult}
            className="hidden sm:inline-flex h-8 px-2.5 text-xs gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            title="Fill quotation lines from latest Umrah calculation"
          >
            <Calculator className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Use Calculator Result</span>
          </Button>

          {isEdit && !convertedBookingId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleConvertToBooking}
              className="hidden md:inline-flex h-8 px-2.5 text-xs gap-1 text-primary hover:bg-primary/10 border-primary/40 font-semibold"
            >
              <ArrowRightCircle className="w-3.5 h-3.5" />
              <span>Convert to Booking</span>
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSave(true)}
            disabled={isSubmitting}
            className="hidden sm:inline-flex h-8 px-3 text-xs gap-1"
            title="Save and download PDF (Ctrl+Shift+Enter)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save & PDF</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleSave(false)}
            disabled={isSubmitting}
            className="h-8 px-3.5 text-xs font-semibold shadow-sm"
            title="Save Quotation (Ctrl+Enter)"
          >
            {isSubmitting ? "Saving..." : isEdit ? "Update Quotation" : "Save Quotation"}
          </Button>
        </div>
      </div>

      {/* Main Content: Desktop One Screen (No Page Scroll) */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden p-3 sm:p-4 flex flex-col gap-2.5">
        
        {/* TOP STRIP (one row): Quotation # * | Date * | Valid Until | Service Type * | Status */}
        <div className="grid grid-cols-12 gap-2.5 bg-muted/20 p-2.5 sm:p-3 rounded-xl border border-border/70 shrink-0">
          {/* Quotation # */}
          <div className="col-span-12 sm:col-span-3 space-y-1">
            <Label htmlFor="quote_num" className="text-xs font-semibold flex items-center justify-between">
              <span>Quotation # <span className="text-destructive">*</span></span>
              {errors.quotationNumber && (
                <span className="text-[10px] text-destructive truncate">{errors.quotationNumber}</span>
              )}
            </Label>
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
              onKeyDown={handleEnterAdvance(quotationDateRef)}
              placeholder="e.g. QT-2026-089"
              className={cn(
                "h-9 text-base sm:text-xs font-semibold rounded-lg",
                errors.quotationNumber && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {mostRecentQuotationNumber && !quotationNumber && (
              <p className="text-[10px] text-muted-foreground truncate">
                Last used:{" "}
                <button
                  type="button"
                  onClick={() => {
                    setQuotationNumber(mostRecentQuotationNumber);
                    quotationDateRef.current?.focus();
                  }}
                  className="underline hover:text-foreground font-mono"
                >
                  {mostRecentQuotationNumber}
                </button>
              </p>
            )}
          </div>

          {/* Date */}
          <div className="col-span-6 sm:col-span-2 space-y-1">
            <Label htmlFor="quote_date" className="text-xs font-semibold">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quote_date"
              ref={quotationDateRef}
              tabIndex={2}
              type="date"
              value={quotationDate}
              onChange={(e) => setQuotationDate(e.target.value)}
              onKeyDown={handleEnterAdvance(validUntilRef)}
              className="h-9 text-base sm:text-xs rounded-lg"
            />
          </div>

          {/* Valid Until + quick chips */}
          <div className="col-span-6 sm:col-span-3 space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="valid_until" className="text-xs font-semibold">
                Valid Until
              </Label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyValidUntilChip(7)}
                  className="text-[9px] px-1.5 py-0.2 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border"
                >
                  +7d
                </button>
                <button
                  type="button"
                  onClick={() => applyValidUntilChip(14)}
                  className="text-[9px] px-1.5 py-0.2 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border"
                >
                  +14d
                </button>
                <button
                  type="button"
                  onClick={() => applyValidUntilChip(30)}
                  className="text-[9px] px-1.5 py-0.2 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border"
                >
                  +30d
                </button>
              </div>
            </div>
            <Input
              id="valid_until"
              ref={validUntilRef}
              tabIndex={3}
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              onKeyDown={handleEnterAdvance(clientNameRef)}
              className="h-9 text-base sm:text-xs rounded-lg"
            />
          </div>

          {/* Service Type */}
          <div className="col-span-6 sm:col-span-2 space-y-1">
            <Label className="text-xs font-semibold">
              Service Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={serviceType}
              onValueChange={(v: ServiceType) => setServiceType(v)}
            >
              <SelectTrigger className="h-9 text-xs rounded-lg">
                <SelectValue />
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

          {/* Status */}
          <div className="col-span-6 sm:col-span-2 space-y-1">
            <Label className="text-xs font-semibold">Status</Label>
            <Select value={status} onValueChange={(v: Status) => setStatus(v)}>
              <SelectTrigger className="h-9 text-xs rounded-lg">
                <SelectValue />
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

        {/* CLIENT ROW: Client Name * | Email | Phone */}
        <div className="grid grid-cols-12 gap-2.5 bg-muted/20 p-2.5 sm:p-3 rounded-xl border border-border/70 shrink-0 relative">
          <div className="col-span-12 sm:col-span-5 space-y-1 relative">
            <Label htmlFor="client_name" className="text-xs font-semibold flex items-center justify-between">
              <span>Client / Recipient Name <span className="text-destructive">*</span></span>
              {errors.clientName && (
                <span className="text-[10px] text-destructive">{errors.clientName}</span>
              )}
            </Label>
            <Input
              id="client_name"
              ref={clientNameRef}
              tabIndex={4}
              value={clientName}
              onChange={(e) => {
                setClientName(e.target.value);
                setShowClientSuggestions(true);
                if (errors.clientName) setErrors((prev) => ({ ...prev, clientName: undefined }));
              }}
              onFocus={() => setShowClientSuggestions(true)}
              onKeyDown={handleEnterAdvance(clientEmailRef)}
              placeholder="Start typing client name to autocomplete..."
              className={cn(
                "h-9 text-base sm:text-xs rounded-lg",
                errors.clientName && "border-destructive focus-visible:ring-destructive"
              )}
            />

            {/* Client Autocomplete Suggestions Dropdown */}
            {showClientSuggestions && filteredClientSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden text-xs">
                <div className="p-1.5 bg-muted/50 border-b text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Suggested Existing Clients
                </div>
                {filteredClientSuggestions.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectClient(c)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/70 flex items-center justify-between transition-colors border-b last:border-b-0"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">{c.contact_number || c.email || "No contact"}</p>
                    </div>
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Select</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="col-span-12 sm:col-span-4 space-y-1">
            <Label htmlFor="client_email" className="text-xs font-semibold">
              Email Address
            </Label>
            <Input
              id="client_email"
              ref={clientEmailRef}
              tabIndex={5}
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              onKeyDown={handleEnterAdvance(clientPhoneRef)}
              placeholder="client@example.com (for direct PDF emailing)"
              className="h-9 text-base sm:text-xs rounded-lg"
            />
          </div>

          <div className="col-span-12 sm:col-span-3 space-y-1">
            <Label htmlFor="client_phone" className="text-xs font-semibold">
              Phone Number
            </Label>
            <Input
              id="client_phone"
              ref={clientPhoneRef}
              tabIndex={6}
              type="tel"
              inputMode="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              onKeyDown={handleEnterAdvance(firstItemDescRef)}
              placeholder="+92 300 1234567"
              className="h-9 text-base sm:text-xs rounded-lg"
            />
          </div>
        </div>

        {/* 2 ZONES SPLIT: MIDDLE ITEMS TABLE (~65%) & RIGHT TOTALS/TERMS (~35%) */}
        <div className="flex-1 min-h-0 grid grid-cols-12 gap-2.5">
          
          {/* MIDDLE: Quotation Items Table (~65% -> 8 cols) */}
          <div className="col-span-12 lg:col-span-8 flex flex-col min-h-0 bg-card rounded-xl border border-border/70 overflow-hidden">
            <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs uppercase tracking-wider text-foreground">Line Items</span>
                <span className="text-[11px] text-muted-foreground">({items.length} {items.length === 1 ? "line" : "lines"})</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addItem(true)}
                className="h-7 px-2.5 text-xs gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add line</span>
              </Button>
            </div>

            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1.5 bg-muted/60 text-[11px] font-semibold text-muted-foreground border-b shrink-0">
              <div className="col-span-6">Description *</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Unit Price ({currency})</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>

            {/* Rows container with internal scroll */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-2.5 space-y-2">
              {items.map((it, idx) => {
                const isLast = idx === items.length - 1;
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-1.5 sm:gap-2 items-center bg-muted/10 p-2 sm:p-0 rounded-lg sm:rounded-none border sm:border-0"
                  >
                    <div className="col-span-12 sm:col-span-6">
                      <Input
                        ref={idx === 0 ? firstItemDescRef : undefined}
                        placeholder="Item or service description..."
                        value={it.description}
                        onChange={(e) => updateItem(idx, { description: e.target.value })}
                        className="h-8 text-base sm:text-xs rounded-md"
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
                        className="h-8 text-base sm:text-xs rounded-md text-center"
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
                          // Tab on last field of last line automatically adds a new line
                          if (isLast && e.key === "Tab" && !e.shiftKey) {
                            e.preventDefault();
                            addItem(true);
                          }
                        }}
                        className="h-8 text-base sm:text-xs rounded-md text-right font-mono"
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
                        className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-md"
                        title="Delete line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Title / Description optional row inside table area */}
            <div className="p-2 border-t bg-muted/10 grid grid-cols-12 gap-2 shrink-0">
              <div className="col-span-12 sm:col-span-6">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Optional Subject/Title (e.g. 14-Day Executive Umrah Package)"
                  className="h-8 text-base sm:text-xs rounded-md"
                />
              </div>
              <div className="col-span-12 sm:col-span-6">
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional brief note/subtitle shown under quotation title..."
                  className="h-8 text-base sm:text-xs rounded-md"
                />
              </div>
            </div>
          </div>

          {/* RIGHT: Sticky Totals Card & Notes/Terms (~35% -> 4 cols) */}
          <div className="col-span-12 lg:col-span-4 flex flex-col justify-between gap-2 bg-card rounded-xl border border-border/70 p-3 overflow-y-auto">
            <div className="space-y-2.5">
              {/* Currency & Subtotal */}
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="text-xs font-semibold text-muted-foreground">Currency</span>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-7 w-24 text-xs font-semibold">
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
                  className="h-7 w-28 text-right text-xs font-mono rounded"
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
                  className="h-7 w-28 text-right text-xs font-mono rounded"
                />
              </div>

              {/* TOTAL (large bold) */}
              <div className="pt-2 border-t flex items-baseline justify-between bg-primary/5 p-2.5 rounded-lg border border-primary/20">
                <span className="font-bold text-sm text-foreground">TOTAL:</span>
                <span className="text-xl sm:text-2xl font-black text-primary font-mono tracking-tight">
                  {currency} {total.toLocaleString()}
                </span>
              </div>

              {/* Compact Notes */}
              <div className="space-y-1 pt-1">
                <Label htmlFor="notes" className="text-[11px] font-semibold text-muted-foreground">
                  Notes (Client facing)
                </Label>
                <Textarea
                  id="notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Included baggage, flight transit notes, payment deadlines..."
                  className="min-h-[46px] text-base sm:text-xs rounded-md resize-none"
                />
              </div>

              {/* Terms & Conditions */}
              <div className="space-y-1">
                <Label htmlFor="terms" className="text-[11px] font-semibold text-muted-foreground">
                  Terms & Conditions
                </Label>
                <Textarea
                  id="terms"
                  rows={2}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Terms of quotation..."
                  className="min-h-[46px] text-base sm:text-xs rounded-md resize-none"
                />
              </div>
            </div>

            {/* Mobile Bottom Bar Save */}
            <div className="lg:hidden sticky bottom-0 left-0 right-0 pt-3 pb-[env(safe-area-inset-bottom,0.75rem)] bg-background/95 backdrop-blur border-t mt-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Total Amount</p>
                <p className="font-bold text-base text-primary truncate">{currency} {total.toLocaleString()}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="min-h-[44px] px-3 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={isSubmitting}
                  className="min-h-[44px] px-4 text-xs font-semibold shadow-md"
                >
                  {isSubmitting ? "Saving..." : isEdit ? "Update" : "Save Quotation"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
