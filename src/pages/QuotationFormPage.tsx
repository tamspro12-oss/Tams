import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRightCircle,
  Download,
  FileText,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  useQuotations,
  type Quotation,
  type QuotationInput,
  type QuotationItem,
} from "@/hooks/useQuotations";
import { useParties, type Party } from "@/hooks/useParties";
import { useAgency } from "@/hooks/useAgency";
import { downloadQuotationPdf } from "@/lib/quotationPdf";
import { cn } from "@/lib/utils";
import {
  LockedDateField,
  getTodayDateString,
} from "@/components/ui/LockedDateField";
import {
  DocumentNumberControl,
} from "@/components/ui/DocumentNumberControl";
import { createRequestId, runBackgroundTask } from "@/lib/atomicSave";
import { runUiAtomicSave } from "@/lib/atomicSaveUi";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { refreshAffectedFinancialQueries } from "@/lib/accountingEngine";
import {
  SearchableSelect,
  type SearchableSelectItem,
} from "@/components/ui/SearchableSelect";
import { AddPartyDialog } from "@/components/parties/AddPartyDialog";
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";
import {
  type ServiceType,
  type Passenger,
  type ServiceDetailsState,
  createDefaultServiceDetails,
  createDefaultPassenger,
  normalizeServiceType,
  getServiceDisplayLabel,
  buildServiceTitle,
  buildServiceSummaryLines,
  validateServiceAndPassengers,
} from "@/lib/serviceDefinitions";
import {
  ServiceTypeSelect,
  ServiceSpecificFields,
  PassengersSection,
} from "@/components/bookings/ServiceSpecificFields";

type Status = "draft" | "sent" | "accepted" | "rejected";

const STATUS_OPTIONS: ReadonlyArray<{ value: Status; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

const CURRENCY_OPTIONS = ["PKR", "SAR", "USD", "EUR", "GBP", "AED"] as const;

const DEFAULT_NOTES =
  "Quotation valid until the date mentioned above. Prices subject to availability at the time of confirmation.";

const CUSTOM_RECIPIENT_ID = "__custom_recipient__";

export default function QuotationFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const location = useLocation();

  const { quotations = [], addQuotation, updateQuotation } = useQuotations();
  const { parties = [] } = useParties();
  const { data: agency } = useAgency();

  const formContainerRef = useRef<HTMLFormElement>(null);
  const itemsSectionRef = useRef<HTMLDivElement>(null);
  const loadedRecordIdRef = useRef<string | null>(null);
  const prefillAppliedRef = useRef(false);

  // Header fields
  const [quotationNumber, setQuotationNumber] = useState("Auto-assigned");
  const [isManualQuotationNo, setIsManualQuotationNo] = useState(false);
  const [manualQuotationNo, setManualQuotationNo] = useState("");
  const isSubmittingRef = useRef(false);
  const requestIdRef = useRef<string>(createRequestId());
  const queryClient = useQueryClient();
  const { data: userAgencyId } = useCurrentAgencyId();
  const [quotationDate, setQuotationDate] = useState(() => getTodayDateString());
  const [validUntil, setValidUntil] = useState(() =>
    format(addDays(new Date(), 14), "yyyy-MM-dd")
  );
  const [status, setStatus] = useState<Status>("draft");
  const [serviceType, setServiceType] = useState<ServiceType>("Ticket");

  // Client / Recipient fields (same searchable client integration as Booking Invoice)
  const [partyId, setPartyId] = useState<string>("");
  const [clientName, setClientName] = useState<string>("");
  const [clientPhone, setClientPhone] = useState<string>("");
  const [legacyClientEmail, setLegacyClientEmail] = useState<string | null>(null);
  const [legacyAgentId, setLegacyAgentId] = useState<string | null>(null);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);

  // Shared Service-Specific fields + Passengers (Air Ticket)
  const [serviceDetails, setServiceDetails] = useState<ServiceDetailsState>(() =>
    createDefaultServiceDetails()
  );
  const [passengers, setPassengers] = useState<Passenger[]>(() => [
    createDefaultPassenger(),
  ]);

  // Line items
  const [items, setItems] = useState<QuotationItem[]>([
    { description: "", qty: 1, unit_price: 0, amount: 0 },
  ]);

  // Totals & Notes (two columns)
  const [currency, setCurrency] = useState("PKR");
  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const [notes, setNotes] = useState(DEFAULT_NOTES);

  const [convertedBookingId, setConvertedBookingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const clientsList = useMemo(
    () => parties.filter((p) => p.type === "client" || p.type === "both"),
    [parties]
  );

  const clientSelectItems: SearchableSelectItem[] = useMemo(() => {
    const baseItems: SearchableSelectItem[] = clientsList.map((c) => ({
      id: c.id,
      label: c.name,
      sublabel: [c.code, c.phone].filter(Boolean).join(" · "),
      badge: c.type === "both" ? "Both" : undefined,
      searchText: `${c.name} ${c.code || ""} ${c.phone || ""} ${c.email || ""}`,
    }));
    if (!partyId && clientName.trim()) {
      return [
        {
          id: CUSTOM_RECIPIENT_ID,
          label: clientName.trim(),
          sublabel: clientPhone || "Recipient",
          badge: "Prefilled",
          searchText: `${clientName} ${clientPhone}`,
        },
        ...baseItems,
      ];
    }
    return baseItems;
  }, [clientsList, partyId, clientName, clientPhone]);

  // Preview next auto-generated quotation number for new quotations
  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    async function fetchPreviewNumber() {
      try {
        const { data, error } = await supabase.rpc("preview_next_number", {
          p_counter_type: "quotation",
        });
        if (!cancelled && !error && data) {
          setQuotationNumber(String(data));
          return;
        }
      } catch (err) {
        console.warn("Could not preview next quotation number:", err);
      }
      if (!cancelled) {
        setQuotationNumber("Auto-assigned");
      }
    }
    setQuotationDate(getTodayDateString());
    fetchPreviewNumber();
    return () => {
      cancelled = true;
    };
  }, [isEdit]);

  // Load existing quotation for edit OR incoming prefill (Queries / Umrah Calculator)
  useEffect(() => {
    if (isEdit) {
      if (!quotations.length || loadedRecordIdRef.current === id) return;
      const q = quotations.find((x) => x.id === id);
      if (!q) {
        toast.error("Quotation not found");
        navigate("/app/leads-quotes?tab=quotations", { replace: true });
        return;
      }
      loadedRecordIdRef.current = id || null;

      setQuotationNumber(q.quotation_number || "");
      setQuotationDate(getTodayDateString());
      setValidUntil(q.valid_until || "");
      setStatus((q.status as Status) || "draft");
      setServiceType(normalizeServiceType(q.service_type));

      const matchedClient =
        parties.find((p) => p.id === q.client_id) ||
        parties.find(
          (p) =>
            (p.type === "client" || p.type === "both") &&
            p.name.trim().toLowerCase() === (q.client_name || "").trim().toLowerCase()
        );
      setPartyId(matchedClient?.id || q.client_id || "");
      setClientName(q.client_name || matchedClient?.name || "");
      setClientPhone(q.client_phone || matchedClient?.phone || "");
      setLegacyClientEmail(q.client_email || null);
      setLegacyAgentId(q.agent_id || null);

      const savedRef = q.source_ref && typeof q.source_ref === "object" ? q.source_ref : null;
      if (savedRef?.serviceDetails) {
        setServiceDetails({
          ...createDefaultServiceDetails(),
          ...savedRef.serviceDetails,
        });
      }
      if (Array.isArray(savedRef?.passengers) && savedRef.passengers.length > 0) {
        setPassengers(savedRef.passengers);
      }

      setCurrency(q.currency || "PKR");
      setItems(
        q.items && q.items.length > 0
          ? q.items
          : [{ description: q.title || "", qty: 1, unit_price: Number(q.total) || 0, amount: Number(q.total) || 0 }]
      );
      setDiscount(Number(q.discount) || 0);
      setTax(Number(q.tax) || 0);
      const combinedNotes = [q.notes, q.terms].filter(Boolean).join("\n\n");
      setNotes(combinedNotes);
      setConvertedBookingId(q.booking_id || q.converted_booking_id || null);
      setIsDirty(false);
    } else if (!prefillAppliedRef.current) {
      prefillAppliedRef.current = true;
      const prefill = (location.state as { prefill?: Partial<QuotationInput> })?.prefill;
      if (prefill) {
        if (prefill.service_type) {
          setServiceType(normalizeServiceType(prefill.service_type));
        }
        if (prefill.client_name) {
          setClientName(prefill.client_name);
        }
        if (prefill.client_phone) {
          setClientPhone(prefill.client_phone);
        }
        if (prefill.currency) setCurrency(prefill.currency);
        if (prefill.notes) setNotes(prefill.notes);
        if (prefill.items && Array.isArray(prefill.items) && prefill.items.length > 0) {
          setItems(prefill.items);
        }
        setIsDirty(true);
      }
    }
  }, [id, isEdit, quotations, parties, navigate, location.state]);

  // Match prefilled client name to party once parties load
  useEffect(() => {
    if (!isEdit && !partyId && clientName.trim() && clientsList.length > 0) {
      const normalized = clientName.trim().toLowerCase();
      const matched = clientsList.find((c) => c.name.trim().toLowerCase() === normalized);
      if (matched) {
        setPartyId(matched.id);
        if (!clientPhone && matched.phone) {
          setClientPhone(matched.phone);
        }
      }
    }
  }, [isEdit, partyId, clientName, clientPhone, clientsList]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const handleServiceDetailChange = useCallback(
    <K extends keyof ServiceDetailsState>(field: K, value: ServiceDetailsState[K]) => {
      setServiceDetails((prev) => ({ ...prev, [field]: value }));
      setIsDirty(true);
    },
    []
  );

  const handleServiceTypeChange = useCallback((nextService: ServiceType) => {
    setServiceType(nextService);
    setIsDirty(true);
  }, []);

  const handleClientSelect = useCallback(
    (selectedId: string) => {
      if (selectedId === CUSTOM_RECIPIENT_ID) return;
      const matched = clientsList.find((c) => c.id === selectedId);
      setPartyId(selectedId);
      if (matched) {
        setClientName(matched.name);
        setClientPhone(matched.phone || "");
      }
      setIsDirty(true);
    },
    [clientsList]
  );

  const handleQuickClientSaved = useCallback((newParty: Party) => {
    setPartyId(newParty.id);
    setClientName(newParty.name);
    setClientPhone(newParty.phone || "");
    setIsDirty(true);
  }, []);

  // Financial Calculations (preserved identically)
  const subtotal = useMemo(() => {
    return items.reduce(
      (acc, it) => acc + (Number(it.qty) || 0) * (Number(it.unit_price) || 0),
      0
    );
  }, [items]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - (Number(discount) || 0) + (Number(tax) || 0));
  }, [subtotal, discount, tax]);

  // Line Item handlers
  const handleItemChange = (
    idx: number,
    field: keyof QuotationItem,
    val: string | number
  ) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [field]: val };
        updated.amount = (Number(updated.qty) || 0) * (Number(updated.unit_price) || 0);
        return updated;
      })
    );
    setIsDirty(true);
  };

  const focusNewItemRef = useRef(false);

  useEffect(() => {
    if (!focusNewItemRef.current) return;
    focusNewItemRef.current = false;
    const targetIdx = items.length - 1;
    const descInput = itemsSectionRef.current?.querySelector<HTMLInputElement>(
      `[data-repeatable-row="${targetIdx}"] input[data-line-field="description"]`
    );
    descInput?.focus();
  }, [items.length]);

  const handleAddItem = () => {
    focusNewItemRef.current = true;
    setItems((prev) => [
      ...prev,
      { description: "", qty: 1, unit_price: 0, amount: 0 },
    ]);
    setIsDirty(true);
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const validate = (): boolean => {
    if (!clientName.trim()) {
      toast.error("Please select a Client");
      const clientTrigger = formContainerRef.current?.querySelector<HTMLElement>(
        '[data-client-select="true"]'
      );
      clientTrigger?.focus();
      return false;
    }

    if (validUntil && quotationDate && validUntil < quotationDate) {
      toast.error("Valid Until date cannot be earlier than Quotation Date");
      return false;
    }

    const nonEmptyItems = items.filter((i) => i.description.trim());
    if (nonEmptyItems.length === 0) {
      toast.error("Please add at least one line item description");
      const firstDesc = itemsSectionRef.current?.querySelector<HTMLInputElement>(
        '[data-repeatable-row="0"] input[data-line-field="description"]'
      );
      firstDesc?.focus();
      return false;
    }

    if (nonEmptyItems.some((i) => !Number.isFinite(Number(i.qty)) || Number(i.qty) <= 0 || !Number.isFinite(Number(i.unit_price)) || Number(i.unit_price) < 0)) {
      toast.error("Line item quantities must be positive and prices cannot be negative");
      return false;
    }

    const safeDiscount = Number(discount) || 0;
    const safeTax = Number(tax) || 0;
    if (safeDiscount < 0 || safeTax < 0) {
      toast.error("Discount and tax cannot be negative");
      return false;
    }

    const serviceError = validateServiceAndPassengers(
      serviceType,
      serviceDetails,
      serviceType === "Ticket" ? passengers : []
    );
    if (serviceError) {
      toast.error(serviceError);
      return false;
    }

    return true;
  };

  const buildPayload = (): QuotationInput => {
    const normalizedItems = items
      .filter((i) => i.description.trim())
      .map((i) => ({
        description: i.description.trim(),
        qty: Math.max(1, Number(i.qty) || 1),
        unit_price: Math.max(0, Number(i.unit_price) || 0),
        amount: Math.max(1, Number(i.qty) || 1) * Math.max(0, Number(i.unit_price) || 0),
      }));

    const derivedTitle = buildServiceTitle(serviceType, serviceDetails);
    const derivedSummary = buildServiceSummaryLines(
      serviceType,
      serviceDetails,
      serviceType === "Ticket" ? passengers : undefined
    ).join(" · ");

    return {
      // Leave quotation_number blank on Auto create so DB assigns atomic formatted number
      quotation_number: isEdit
        ? quotationNumber.trim()
        : isManualQuotationNo
          ? manualQuotationNo.trim()
          : "",
      quotation_date: quotationDate,
      valid_until: validUntil || null,
      service_type: serviceType,
      client_name: clientName.trim(),
      client_email: isEdit ? legacyClientEmail : null,
      client_phone: clientPhone.trim() || null,
      client_id: partyId || null,
      agent_id: isEdit ? legacyAgentId : null,
      title: derivedTitle,
      description: derivedSummary || null,
      items: normalizedItems,
      subtotal,
      discount: Math.max(0, Number(discount) || 0),
      tax: Math.max(0, Number(tax) || 0),
      total,
      currency,
      status,
      notes: notes.trim() || null,
      terms: null,
      source: "web-app",
      source_ref: {
        version: 2,
        serviceDetails,
        passengers: serviceType === "Ticket" ? passengers : [],
      },
    };
  };

  const handleSave = async (andDownloadPdf = false) => {
    if (isSubmittingRef.current || isSubmitting) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Network connection issue. You are offline, not saved.");
      return;
    }
    if (!validate()) return;

    if (!isEdit && isManualQuotationNo && !manualQuotationNo.trim()) {
      toast.error("Please enter a custom quotation number or switch back to Auto");
      return;
    }

    const payload = buildPayload();

    await runUiAtomicSave<any>({
      requestIdRef,
      isLockedRef: isSubmittingRef,
      setIsSubmitting,
      contextLabel: "QuotationFormPage.handleSave",
      fallbackErrorMessage: "Failed to save quotation. Please try again.",
      execute: async (requestId) => {
        if (isEdit && id) {
          return await updateQuotation.mutateAsync({ id, requestId, ...payload });
        }
        return await addQuotation.mutateAsync({
          ...payload,
          isManual: isManualQuotationNo,
          requestId,
        });
      },
      onSuccess: (savedQuote) => {
        setIsDirty(false);
        navigate("/app/leads-quotes?tab=quotations");

        runBackgroundTask("QuotationFormPage.pdfAndRefresh", () => {
          if (andDownloadPdf) {
            try {
              const quoteForPdf: Quotation = {
                id: savedQuote?.id || id || "temp",
                agency_id: savedQuote?.agency_id || "",
                ...payload,
                quotation_number: savedQuote?.quotation_number || quotationNumber,
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
            } catch (pdfErr) {
              console.warn("Quotation PDF error:", pdfErr);
            }
          }
          refreshAffectedFinancialQueries(queryClient, "all", userAgencyId);
        });
      },
      onErrorToast: (friendlyMessage, { timedOut, offline }) => {
        if (timedOut || offline) {
          toast.error(friendlyMessage);
        }
      },
    });
  };

  const handleCancel = useCallback(() => {
    if (
      isDirty &&
      !window.confirm("You have unsaved changes in this quotation. Discard and go back?")
    ) {
      return;
    }
    navigate("/app/leads-quotes?tab=quotations");
  }, [isDirty, navigate]);

  const handleConvertToBooking = () => {
    navigate("/app/bookings?tab=clients", {
      state: {
        openAddClient: true,
        prefill: {
          name: clientName,
          contact_number: clientPhone,
          travel_type: serviceType === "Umrah" ? "Umrah" : serviceType,
          selling_price: total,
          notes: `Converted from Quotation #${quotationNumber} — ${buildServiceTitle(
            serviceType,
            serviceDetails
          )}\nQuotation Total: ${currency} ${total.toLocaleString()}`,
          converted_from_quote_id: id,
        },
      },
    });
  };

  useFormKeyboardNav({
    containerRef: formContainerRef,
    enabled: !isAddClientOpen,
    autoFocusFirst: true,
    onSave: () => handleSave(false),
    onCancel: handleCancel,
  });

  const derivedHeading = useMemo(
    () => buildServiceTitle(serviceType, serviceDetails),
    [serviceType, serviceDetails]
  );

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-5 py-4 space-y-4">
      {/* Compact Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            tabIndex={-1}
            onClick={handleCancel}
            className="h-8 w-8 p-0 shrink-0"
            title="Back (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="w-4 h-4 text-teal-600 shrink-0" />
              <h1 className="text-lg font-bold tracking-tight truncate">
                {isEdit ? `Edit Quotation #${quotationNumber}` : "New Quotation"}
              </h1>
              <span className="text-xs font-medium text-muted-foreground truncate">
                · {derivedHeading}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEdit && !convertedBookingId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              tabIndex={-1}
              onClick={handleConvertToBooking}
              className="h-8 text-xs gap-1.5"
            >
              <ArrowRightCircle className="w-3.5 h-3.5 text-emerald-600" />
              Convert to Booking
            </Button>
          )}
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Enter = next · Ctrl+S = save · Esc = back
          </span>
        </div>
      </div>

      {/* Single Clean Form Surface */}
      <form
        ref={formContainerRef}
        onSubmit={(e) => {
          e.preventDefault();
          handleSave(false);
        }}
        className="bg-card border rounded-xl p-4 sm:p-5 shadow-xs space-y-5"
      >
        {/* 1. HEADER FIELDS */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
            {/* Quotation # (Auto with optional Manual Override on create) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Quotation #
              </Label>
              <DocumentNumberControl
                label=""
                docType="quotation"
                previewNumber={quotationNumber}
                isManual={isManualQuotationNo}
                manualValue={manualQuotationNo}
                onManualModeChange={setIsManualQuotationNo}
                onManualValueChange={setManualQuotationNo}
                allowManualOverride={!isEdit}
                readOnly={isEdit}
                accentClassName="text-blue-600 dark:text-blue-400"
                className="h-8 justify-between bg-muted/60"
              />
            </div>

            {/* Date (Shared Locked Date component, skipped) */}
            <div>
              <LockedDateField
                label="Date"
                value={quotationDate}
              />
            </div>

            {/* Service Type (Same shared component & list as Booking Invoice) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Service Type <span className="text-red-500">*</span>
              </Label>
              <ServiceTypeSelect
                value={serviceType}
                onChange={handleServiceTypeChange}
                className="h-8 text-xs font-medium bg-background focus-visible:ring-2 focus-visible:ring-teal-500"
              />
            </div>

            {/* Client / Recipient Name (Same shared SearchableSelect + Quick Add as Booking Invoice) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Client / Recipient Name <span className="text-red-500">*</span>
                </Label>
                <button
                  type="button"
                  data-quick-add-btn="true"
                  onClick={() => setIsAddClientOpen(true)}
                  className="text-[10px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-0.5 cursor-pointer rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  <Plus className="w-2.5 h-2.5" /> Quick Add
                </button>
              </div>
              <SearchableSelect
                value={partyId || (clientName.trim() ? CUSTOM_RECIPIENT_ID : "")}
                onChange={handleClientSelect}
                items={clientSelectItems}
                placeholder="Select Client"
                searchPlaceholder="Search clients by name, code, phone..."
                emptyText="No clients found"
                allowClear={false}
                required={!clientName.trim()}
                requiredMessage="Please select a Client or Recipient"
                onQuickAdd={() => setIsAddClientOpen(true)}
                quickAddLabel="Add New Client"
                triggerProps={{ "data-client-select": "true" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
            {/* Phone Number (Auto-filled on client select, remains editable) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Phone Number
              </Label>
              <Input
                type="tel"
                value={clientPhone}
                onChange={(e) => {
                  setClientPhone(e.target.value);
                  markDirty();
                }}
                placeholder="e.g. +92 300 1234567"
                className="h-8 text-xs bg-background focus-visible:ring-2 focus-visible:ring-teal-500"
              />
            </div>

            {/* Valid Until (+7 / +15 / +30 quick chips) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Valid Until
                </Label>
                <div className="flex items-center gap-1">
                  {[7, 15, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      tabIndex={-1}
                      onClick={() => {
                        setValidUntil(format(addDays(new Date(), days), "yyyy-MM-dd"));
                        markDirty();
                      }}
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
                    >
                      +{days}d
                    </button>
                  ))}
                </div>
              </div>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => {
                  setValidUntil(e.target.value);
                  markDirty();
                }}
                className="h-8 text-xs bg-background focus-visible:ring-2 focus-visible:ring-teal-500"
              />
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Status
              </Label>
              <Select
                value={status}
                onValueChange={(val) => {
                  setStatus(val as Status);
                  markDirty();
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-background focus-visible:ring-2 focus-visible:ring-teal-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* 2. SERVICE-SPECIFIC FIELDS (Shared with Booking Invoice) */}
        <div className="pt-3 border-t space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {getServiceDisplayLabel(serviceType)} Details
            </h2>
          </div>

          <ServiceSpecificFields
            service={serviceType}
            details={serviceDetails}
            onDetailChange={handleServiceDetailChange}
            showInlineTripType={true}
            showInlineZiyarat={true}
            showIssuanceFields={false}
            containerClassName="space-y-3"
          />

          {serviceType === "Ticket" && (
            <PassengersSection
              passengers={passengers}
              onChangePassengers={(updater) => {
                setPassengers(updater);
                setIsDirty(true);
              }}
              requireFirstPassenger={false}
            />
          )}
        </div>

        {/* 3. LINE ITEMS */}
        <div
          ref={itemsSectionRef}
          className="pt-3 border-t space-y-2.5"
          data-repeatable-group="line-items"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Line Items
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Enter = next field · Ctrl+Enter = add line
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b text-[11px] font-semibold text-muted-foreground">
                  <th className="py-1.5 px-1.5 text-center w-8">#</th>
                  <th className="py-1.5 px-1.5 text-left min-w-[220px]">Description</th>
                  <th className="py-1.5 px-1.5 text-right w-20">Qty</th>
                  <th className="py-1.5 px-1.5 text-right w-32">Unit Price</th>
                  <th className="py-1.5 px-1.5 text-right w-32">Amount</th>
                  <th className="py-1.5 px-1 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item, idx) => (
                  <tr key={idx} data-repeatable-row={idx}>
                    <td className="py-1.5 px-1.5 text-center font-mono text-[11px] text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="py-1.5 px-1.5">
                      <Input
                        data-line-field="description"
                        value={item.description}
                        onChange={(e) =>
                          handleItemChange(idx, "description", e.target.value)
                        }
                        placeholder="Service item description..."
                        data-required={
                          idx === 0 && items.every((i) => !i.description.trim())
                            ? "true"
                            : undefined
                        }
                        data-required-message="Please enter at least one line item description"
                        className="h-8 text-xs bg-background focus-visible:ring-2 focus-visible:ring-teal-500"
                      />
                    </td>
                    <td className="py-1.5 px-1.5">
                      <Input
                        type="number"
                        min={1}
                        step="1"
                        value={item.qty}
                        onChange={(e) =>
                          handleItemChange(idx, "qty", Number(e.target.value) || 0)
                        }
                        className="h-8 text-xs font-mono text-right bg-background focus-visible:ring-2 focus-visible:ring-teal-500"
                      />
                    </td>
                    <td className="py-1.5 px-1.5">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={item.unit_price || ""}
                        onChange={(e) =>
                          handleItemChange(
                            idx,
                            "unit_price",
                            Number(e.target.value) || 0
                          )
                        }
                        placeholder="0"
                        className="h-8 text-xs font-mono text-right bg-background focus-visible:ring-2 focus-visible:ring-teal-500"
                      />
                    </td>
                    <td className="py-1.5 px-1.5">
                      <Input
                        value={((Number(item.qty) || 0) * (Number(item.unit_price) || 0)).toLocaleString()}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        className="h-8 text-xs font-mono text-right bg-muted/50 text-foreground cursor-default"
                      />
                    </td>
                    <td className="py-1.5 px-1 text-center">
                      {items.length > 1 && (
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-muted-foreground hover:text-red-500 cursor-pointer rounded"
                          aria-label={`Remove line ${idx + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <button
              type="button"
              data-add-row-btn="true"
              onClick={handleAddItem}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-1 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add line
            </button>
          </div>
        </div>

        {/* 4. TOTALS & NOTES (TWO COLUMNS) */}
        <div className="pt-3 border-t grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* Right Column visually on desktop, ordered before Notes in keyboard flow */}
          <div
            data-nav-order="1"
            className="md:col-span-5 md:order-2 bg-muted/30 rounded-lg border p-3.5 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Currency
              </Label>
              <Select
                value={currency}
                onValueChange={(val) => {
                  setCurrency(val);
                  markDirty();
                }}
              >
                <SelectTrigger className="h-8 w-28 text-xs font-mono bg-background focus-visible:ring-2 focus-visible:ring-teal-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((curr) => (
                    <SelectItem key={curr} value={curr}>
                      {curr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-3 text-xs pt-1 border-t">
              <span className="text-muted-foreground font-medium">Subtotal</span>
              <span className="font-mono font-semibold text-foreground">
                {currency} {subtotal.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs font-medium text-muted-foreground">
                Discount (−)
              </Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={discount || ""}
                onChange={(e) => {
                  setDiscount(Math.max(0, Number(e.target.value) || 0));
                  markDirty();
                }}
                placeholder="0"
                className="h-8 w-36 text-xs font-mono text-right bg-background focus-visible:ring-2 focus-visible:ring-teal-500"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs font-medium text-muted-foreground">
                Tax / Fee (+)
              </Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={tax || ""}
                onChange={(e) => {
                  setTax(Math.max(0, Number(e.target.value) || 0));
                  markDirty();
                }}
                placeholder="0"
                className="h-8 w-36 text-xs font-mono text-right bg-background focus-visible:ring-2 focus-visible:ring-teal-500"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t">
              <span className="text-sm font-bold text-foreground">Total</span>
              <span className="text-base font-extrabold font-mono text-teal-700 dark:text-teal-400">
                {currency} {total.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Left Column: Notes / Terms */}
          <div
            data-nav-order="2"
            className="md:col-span-7 md:order-1 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Notes / Terms
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Enter = new line · Ctrl+Enter = Save
              </span>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                markDirty();
              }}
              rows={6}
              placeholder="Terms, inclusions, validity remarks, cancellation rules..."
              className={cn(
                "text-xs resize-y bg-background focus-visible:ring-2 focus-visible:ring-teal-500",
                "min-h-[146px]"
              )}
            />
          </div>
        </div>

        {/* 5. ACTION BUTTONS */}
        <div
          data-nav-order="3"
          className="pt-3 border-t flex flex-wrap items-center justify-end gap-2.5"
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="h-9 px-4 text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-nav-skip="true"
            onClick={() => handleSave(true)}
            disabled={isSubmitting}
            className="h-9 px-4 text-xs font-semibold gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Save & PDF
          </Button>
          <Button
            type="submit"
            size="sm"
            data-save-button="true"
            disabled={isSubmitting}
            className="h-9 px-5 text-xs font-semibold bg-[#0B192C] hover:bg-[#1E3E62] text-white gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <Save className="w-3.5 h-3.5" />
            {isSubmitting ? "Saving..." : "Save Quotation"}
          </Button>
        </div>
      </form>

      {/* Quick Add Client Dialog (same shared modal as Booking Invoice) */}
      <AddPartyDialog
        open={isAddClientOpen}
        onOpenChange={setIsAddClientOpen}
        initialType="client"
        lockType={true}
        onSaved={handleQuickClientSaved}
      />
    </div>
  );
}
