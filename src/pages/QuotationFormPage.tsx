import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Pencil,
  Plus,
  Save,
  Users,
  X,
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
import { useAgencyBranding } from "@/hooks/useAgencyBranding";
import { downloadQuotationPdf } from "@/lib/quotationPdf";
import {
  LockedDateField,
  getTodayDateString,
} from "@/components/ui/LockedDateField";
import { DocumentNumberControl } from "@/components/ui/DocumentNumberControl";
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
import { loadAgencyTemplate } from "@/lib/agencyTemplates";
import {
  type ServiceType,
  type TripType,
  type Passenger,
  type ServiceDetailsState,
  PASSENGER_TYPE_OPTIONS,
  GENDER_OPTIONS,
  createDefaultServiceDetails,
  createDefaultPassenger,
  normalizeServiceType,
  getServiceDisplayLabel,
  buildServiceTitle,
  buildServiceSummaryLines,
  buildCompactServiceKeyDetail,
  validateServiceAndPassengers,
} from "@/lib/serviceDefinitions";
import {
  ServiceTypeSelect,
  TripTypeSelect,
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

interface UmrahHotelPresetEntry {
  name: string;
  sharingType: "Quint" | "Quad" | "Triple" | "Double" | "Sharing";
  rateMode: "sharing" | "room";
  rate: string;
  nights: string;
}

interface UmrahPresetPackage {
  id: string;
  name: string;
  makkahHotels: UmrahHotelPresetEntry[];
  madinahHotels: UmrahHotelPresetEntry[];
  visaFee?: string;
  transport?: string;
  ziyarat?: string;
  food?: string;
  fixedPricePkr?: number;
  customSummary?: string;
}

const OCCUPANCY_DIVISORS: Record<string, number> = {
  Quint: 5,
  Quad: 4,
  Triple: 3,
  Double: 2,
  Sharing: 1,
};

const DEFAULT_UMRAH_PRESETS: UmrahPresetPackage[] = [
  {
    id: "package1",
    name: "Package 1 (Standard)",
    makkahHotels: [
      {
        name: "Standard Hotel Makkah",
        sharingType: "Sharing",
        rateMode: "sharing",
        rate: "150",
        nights: "12",
      },
    ],
    madinahHotels: [
      {
        name: "Standard Hotel Madinah",
        sharingType: "Sharing",
        rateMode: "sharing",
        rate: "120",
        nights: "8",
      },
    ],
    visaFee: "0",
    transport: "0",
    ziyarat: "0",
    food: "0",
  },
  {
    id: "package2",
    name: "Package 2 (3-Star)",
    makkahHotels: [
      {
        name: "3-Star Hotel Makkah",
        sharingType: "Sharing",
        rateMode: "sharing",
        rate: "250",
        nights: "12",
      },
    ],
    madinahHotels: [
      {
        name: "3-Star Hotel Madinah",
        sharingType: "Sharing",
        rateMode: "sharing",
        rate: "200",
        nights: "8",
      },
    ],
    visaFee: "0",
    transport: "0",
    ziyarat: "0",
    food: "0",
  },
  {
    id: "package3",
    name: "Package 3 (4-Star)",
    makkahHotels: [
      {
        name: "4-Star Hotel Makkah",
        sharingType: "Sharing",
        rateMode: "sharing",
        rate: "450",
        nights: "12",
      },
    ],
    madinahHotels: [
      {
        name: "4-Star Hotel Madinah",
        sharingType: "Sharing",
        rateMode: "sharing",
        rate: "380",
        nights: "8",
      },
    ],
    visaFee: "0",
    transport: "0",
    ziyarat: "0",
    food: "0",
  },
  {
    id: "package4",
    name: "Package 4 (5-Star)",
    makkahHotels: [
      {
        name: "5-Star Hotel Makkah",
        sharingType: "Sharing",
        rateMode: "sharing",
        rate: "800",
        nights: "12",
      },
    ],
    madinahHotels: [
      {
        name: "5-Star Hotel Madinah",
        sharingType: "Sharing",
        rateMode: "sharing",
        rate: "650",
        nights: "8",
      },
    ],
    visaFee: "0",
    transport: "0",
    ziyarat: "0",
    food: "0",
  },
];

function computeUmrahPresetSummaryAndPrice(
  preset: UmrahPresetPackage,
  currency: string,
  sarToPkrRate = 77.5
): {
  price: number;
  summary: string;
  makkahHotel: string;
  makkahNights: string;
  madinahHotel: string;
  madinahNights: string;
} {
  const makkahFirst = preset.makkahHotels?.[0];
  const madinahFirst = preset.madinahHotels?.[0];

  const makkahNightsNum = (preset.makkahHotels || []).reduce(
    (acc, h) => acc + (parseFloat(h.nights) || 0),
    0
  );
  const madinahNightsNum = (preset.madinahHotels || []).reduce(
    (acc, h) => acc + (parseFloat(h.nights) || 0),
    0
  );
  const totalNights = makkahNightsNum + madinahNightsNum;

  const calcHotelSar = (list: UmrahHotelPresetEntry[] = []) =>
    list.reduce((sum, h) => {
      const rate = parseFloat(h.rate) || 0;
      const nights = parseFloat(h.nights) || 0;
      const div = h.rateMode === "room" ? OCCUPANCY_DIVISORS[h.sharingType] || 1 : 1;
      return sum + (rate / div) * nights;
    }, 0);

  const totalSar =
    calcHotelSar(preset.makkahHotels) +
    calcHotelSar(preset.madinahHotels) +
    (parseFloat(preset.visaFee || "0") || 0) +
    (parseFloat(preset.transport || "0") || 0) +
    (parseFloat(preset.ziyarat || "0") || 0) +
    (parseFloat(preset.food || "0") || 0);

  const computedPrice =
    typeof preset.fixedPricePkr === "number" && preset.fixedPricePkr > 0
      ? currency === "SAR"
        ? Math.round(preset.fixedPricePkr / (sarToPkrRate || 77.5))
        : Math.round(preset.fixedPricePkr)
      : currency === "SAR"
        ? Math.round(totalSar)
        : Math.round(totalSar * (sarToPkrRate || 77.5));

  const makkahHotelName = makkahFirst?.name || "Standard Hotel Makkah";
  const madinahHotelName = madinahFirst?.name || "Standard Hotel Madinah";
  const sharingLabel = makkahFirst?.sharingType || "Sharing";

  const summary =
    preset.customSummary ||
    `${totalNights} Nights · Makkah: ${makkahHotelName} (${makkahNightsNum}N, ${sharingLabel}) · Madinah: ${madinahHotelName} (${madinahNightsNum}N, ${
      madinahFirst?.sharingType || sharingLabel
    }) · Route: Karachi → Jeddah · Shared Bus · Ziyarat Included`;

  return {
    price: computedPrice,
    summary,
    makkahHotel: makkahHotelName,
    makkahNights: String(makkahNightsNum || 12),
    madinahHotel: madinahHotelName,
    madinahNights: String(madinahNightsNum || 8),
  };
}

export interface QuotationServiceLine {
  id: string;
  serviceType: ServiceType;
  details: ServiceDetailsState;
  amount: string;
}

function makeServiceId(): string {
  return `srv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createServiceLine(
  serviceType: ServiceType = "Ticket",
  overrides?: Partial<QuotationServiceLine>
): QuotationServiceLine {
  const defaultDetails = createDefaultServiceDetails();
  return {
    id: makeServiceId(),
    serviceType,
    details: overrides?.details
      ? { ...defaultDetails, ...overrides.details }
      : defaultDetails,
    amount: overrides?.amount !== undefined ? overrides.amount : "",
  };
}

export default function QuotationFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const location = useLocation();

  const { quotations = [], addQuotation, updateQuotation } = useQuotations();
  const { parties = [] } = useParties();
  const { getBrandingAsync } = useAgencyBranding();

  const formContainerRef = useRef<HTMLFormElement>(null);
  const servicesListRef = useRef<HTMLDivElement>(null);
  const paxListRef = useRef<HTMLDivElement>(null);
  const loadedRecordIdRef = useRef<string | null>(null);
  const prefillAppliedRef = useRef(false);

  // Header & Row 1 / Row 2 fields
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

  // Client / Recipient fields
  const [partyId, setPartyId] = useState<string>("");
  const [clientName, setClientName] = useState<string>("");
  const [clientPhone, setClientPhone] = useState<string>("");
  const [legacyClientEmail, setLegacyClientEmail] = useState<string | null>(null);
  const [legacyAgentId, setLegacyAgentId] = useState<string | null>(null);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);

  // Multi-Service lines + active expanded service ID
  const [services, setServices] = useState<QuotationServiceLine[]>(() => {
    const initial = createServiceLine("Ticket");
    return [initial];
  });
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(() => null);

  // Ensure expandedServiceId points to the first service initially
  useEffect(() => {
    if (expandedServiceId === null && services.length === 1) {
      setExpandedServiceId(services[0].id);
    }
  }, [expandedServiceId, services]);

  // Custom Umrah presets from agency templates + session draft
  const [customUmrahPresets, setCustomUmrahPresets] = useState<UmrahPresetPackage[]>([]);
  const [sarToPkrRate, setSarToPkrRate] = useState<number>(77.5);
  const [draftUmrahPreset, setDraftUmrahPreset] = useState<UmrahPresetPackage | null>(null);

  useEffect(() => {
    let active = true;
    void loadAgencyTemplate<UmrahPresetPackage[]>("umrah_custom_presets", userAgencyId).then(
      (res) => {
        if (!active) return;
        if (Array.isArray(res.data)) {
          setCustomUmrahPresets(res.data);
        }
      }
    );
    try {
      const rawDraft = sessionStorage.getItem("umrah_calculator_draft");
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft);
        const rate = parseFloat(parsed?.sarToPkrRate);
        if (Number.isFinite(rate) && rate > 0) {
          setSarToPkrRate(rate);
        }
        if (parsed?.result?.finalTotal > 0) {
          const mHotels = Array.isArray(parsed.hotels)
            ? parsed.hotels.filter((h: any) => h.city === "makkah")
            : [];
          const mdHotels = Array.isArray(parsed.hotels)
            ? parsed.hotels.filter((h: any) => h.city === "madinah")
            : [];
          const nights = parsed.result.nights || 14;
          const paxCount = parsed.result.totalPassengers || 1;
          const perPerson = Math.round(parsed.result.perPerson || parsed.result.finalTotal);
          setDraftUmrahPreset({
            id: "calculator_latest",
            name: `Calculator Package (${nights}N · ${paxCount} Pax)`,
            makkahHotels: mHotels.length
              ? mHotels
              : [
                  {
                    name: "Makkah Hotel",
                    sharingType: "Sharing",
                    rateMode: "sharing",
                    rate: "0",
                    nights: String(Math.round(nights / 2)),
                  },
                ],
            madinahHotels: mdHotels.length
              ? mdHotels
              : [
                  {
                    name: "Madinah Hotel",
                    sharingType: "Sharing",
                    rateMode: "sharing",
                    rate: "0",
                    nights: String(nights - Math.round(nights / 2)),
                  },
                ],
            fixedPricePkr: Math.round(parsed.result.finalTotal),
            customSummary: `${nights} Nights · ${paxCount} Pax (Per Person: PKR ${perPerson.toLocaleString()}) · Makkah: ${
              mHotels[0]?.name || "Makkah Hotel"
            } (${mHotels[0]?.nights || 0}N) · Madinah: ${
              mdHotels[0]?.name || "Madinah Hotel"
            } (${mdHotels[0]?.nights || 0}N)`,
          });
        }
      }
    } catch {
      // Ignore draft parse errors
    }
    return () => {
      active = false;
    };
  }, [userAgencyId]);

  const allUmrahPackages = useMemo(() => {
    const list: UmrahPresetPackage[] = [...DEFAULT_UMRAH_PRESETS, ...customUmrahPresets];
    if (draftUmrahPreset) {
      list.unshift(draftUmrahPreset);
    }
    return list;
  }, [customUmrahPresets, draftUmrahPreset]);

  // Shared Passengers across the whole quotation
  const [passengers, setPassengers] = useState<Passenger[]>(() => [
    createDefaultPassenger(),
  ]);

  // Bottom Row: Notes/Terms + Currency + Grand Total
  const [currency, setCurrency] = useState("PKR");
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
      setQuotationDate(q.quotation_date || getTodayDateString());
      setValidUntil(q.valid_until || "");
      setStatus((q.status as Status) || "draft");

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

      // Hydrate multi-service array OR backward-compatible single service
      if (Array.isArray(savedRef?.services) && savedRef.services.length > 0) {
        const hydratedServices: QuotationServiceLine[] = savedRef.services.map(
          (srv: any) => {
            const sType = normalizeServiceType(srv.service_type || srv.serviceType || q.service_type);
            const mergedDetails: ServiceDetailsState = {
              ...createDefaultServiceDetails(),
              ...(srv.serviceDetails || srv.details || {}),
            };
            return {
              id: srv.id || makeServiceId(),
              serviceType: sType,
              details: mergedDetails,
              amount: String(Number(srv.amount ?? 0)),
            };
          }
        );
        setServices(hydratedServices);
        // If only 1 service, keep it expanded; if multiple, collapse previous and expand last or keep collapsed summary
        setExpandedServiceId(hydratedServices[0]?.id || null);
      } else {
        // Legacy single-service quotation
        const legacyType = normalizeServiceType(q.service_type);
        const baseDetails: ServiceDetailsState = {
          ...createDefaultServiceDetails(),
          ...(savedRef?.serviceDetails || {}),
        };
        if (!savedRef?.serviceDetails) {
          const fallbackDesc =
            q.description ||
            q.items?.map((i) => i.description).filter(Boolean).join("; ") ||
            q.title ||
            "";
          if (legacyType === "Other") {
            baseDetails.otherServiceName = q.title || "Custom Service";
            baseDetails.generalDescription = fallbackDesc;
          } else if (legacyType === "Umrah") {
            baseDetails.umrahPackageName = q.title || "Umrah Package";
            baseDetails.umrahPackageSummary =
              fallbackDesc || baseDetails.umrahPackageSummary;
          }
        }
        const legacyTotal =
          Number(q.total) ||
          (Array.isArray(q.items)
            ? q.items.reduce(
                (acc, it) =>
                  acc +
                  (Number(it.amount) ||
                    (Number(it.qty) || 1) * (Number(it.unit_price) || 0)),
                0
              )
            : 0);
        const singleLine: QuotationServiceLine = {
          id: makeServiceId(),
          serviceType: legacyType,
          details: baseDetails,
          amount: String(legacyTotal),
        };
        setServices([singleLine]);
        setExpandedServiceId(singleLine.id);
      }

      if (Array.isArray(savedRef?.passengers) && savedRef.passengers.length > 0) {
        setPassengers(savedRef.passengers);
      } else {
        setPassengers([createDefaultPassenger()]);
      }

      setCurrency(q.currency || "PKR");
      const combinedNotes = [q.notes, q.terms].filter(Boolean).join("\n\n");
      setNotes(combinedNotes);
      setConvertedBookingId(q.booking_id || q.converted_booking_id || null);
      setIsDirty(false);
    } else if (!prefillAppliedRef.current) {
      prefillAppliedRef.current = true;
      const prefill = (location.state as { prefill?: Partial<QuotationInput> })?.prefill;
      if (prefill) {
        if (prefill.client_name) setClientName(prefill.client_name);
        if (prefill.client_phone) setClientPhone(prefill.client_phone);
        if (prefill.currency) setCurrency(prefill.currency);
        if (prefill.notes) setNotes(prefill.notes);

        const prefillType = prefill.service_type
          ? normalizeServiceType(prefill.service_type)
          : "Ticket";
        const prefillAmount =
          Array.isArray(prefill.items) && prefill.items.length > 0
            ? prefill.items.reduce(
                (sum, it) =>
                  sum +
                  (Number(it.amount) ||
                    (Number(it.qty) || 1) * (Number(it.unit_price) || 0)),
                0
              )
            : Number(prefill.total) || 0;

        const nextLine = createServiceLine(prefillType);
        if (prefillType === "Umrah") {
          if (prefill.title) {
            nextLine.details.umrahPackageId = "calculator_latest";
            nextLine.details.umrahPackageName = prefill.title;
          }
          if (prefill.description) {
            nextLine.details.umrahPackageSummary = prefill.description;
          }
        } else if (prefillType === "Other") {
          nextLine.details.otherServiceName = prefill.title || "";
          nextLine.details.generalDescription =
            prefill.description ||
            prefill.items?.[0]?.description ||
            "";
        }
        if (prefillAmount > 0) {
          nextLine.amount = String(prefillAmount);
        }
        setServices([nextLine]);
        setExpandedServiceId(nextLine.id);
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

  // Service Line Handlers
  const handleServiceTypeChange = useCallback(
    (serviceId: string, nextType: ServiceType) => {
      setServices((prev) =>
        prev.map((srv) =>
          srv.id === serviceId
            ? {
                ...srv,
                serviceType: nextType,
              }
            : srv
        )
      );
      setIsDirty(true);
    },
    []
  );

  const handleServiceDetailChange = useCallback(
    <K extends keyof ServiceDetailsState>(
      serviceId: string,
      field: K,
      value: ServiceDetailsState[K]
    ) => {
      setServices((prev) =>
        prev.map((srv) =>
          srv.id === serviceId
            ? { ...srv, details: { ...srv.details, [field]: value } }
            : srv
        )
      );
      setIsDirty(true);
    },
    []
  );

  const handleUmrahPackageChange = useCallback(
    (serviceId: string, packageId: string) => {
      const pkg = allUmrahPackages.find((p) => p.id === packageId);
      if (!pkg) return;
      const info = computeUmrahPresetSummaryAndPrice(pkg, currency, sarToPkrRate);
      setServices((prev) =>
        prev.map((srv) => {
          if (srv.id !== serviceId) return srv;
          return {
            ...srv,
            details: {
              ...srv.details,
              umrahPackageId: pkg.id,
              umrahPackageName: pkg.name,
              umrahPackageSummary: info.summary,
              umrahPackagePrice: info.price,
              makkahHotel: info.makkahHotel,
              makkahNights: info.makkahNights,
              madinahHotel: info.madinahHotel,
              madinahNights: info.madinahNights,
            },
            amount: String(info.price),
          };
        })
      );
      setIsDirty(true);
    },
    [allUmrahPackages, currency, sarToPkrRate]
  );

  const handleServiceAmountChange = useCallback((serviceId: string, rawAmount: string) => {
    setServices((prev) =>
      prev.map((srv) => (srv.id === serviceId ? { ...srv, amount: rawAmount } : srv))
    );
    setIsDirty(true);
  }, []);

  const focusNewServiceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!focusNewServiceRef.current) return;
    const targetId = focusNewServiceRef.current;
    focusNewServiceRef.current = null;
    const rowEl = servicesListRef.current?.querySelector<HTMLElement>(
      `[data-service-id="${targetId}"]`
    );
    if (rowEl) {
      rowEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const firstFocusable = rowEl.querySelector<HTMLElement>(
        'button[role="combobox"], input'
      );
      firstFocusable?.focus();
    }
  }, [services.length]);

  const handleAddService = useCallback(() => {
    const newLine = createServiceLine("Ticket");
    focusNewServiceRef.current = newLine.id;
    setServices((prev) => [...prev, newLine]);
    // Collapse all previous services and expand the newly added service
    setExpandedServiceId(newLine.id);
    setIsDirty(true);
  }, []);

  const handleRemoveService = useCallback(
    (serviceId: string, index: number) => {
      if (index === 0 || services.length <= 1) return;
      setServices((prev) => {
        const next = prev.filter((s) => s.id !== serviceId);
        if (expandedServiceId === serviceId) {
          setExpandedServiceId(next[next.length - 1]?.id || null);
        }
        return next;
      });
      setIsDirty(true);
    },
    [expandedServiceId, services.length]
  );

  // Passenger Handlers
  const focusNewPaxRef = useRef(false);

  useEffect(() => {
    if (!focusNewPaxRef.current) return;
    focusNewPaxRef.current = false;
    const targetIdx = passengers.length - 1;
    const nameInput = paxListRef.current?.querySelector<HTMLInputElement>(
      `[data-pax-row="${targetIdx}"] input[data-pax-field="name"]`
    );
    if (nameInput) {
      nameInput.scrollIntoView({ block: "nearest" });
      nameInput.focus();
    }
  }, [passengers.length]);

  const handlePassengerChange = useCallback(
    (index: number, field: keyof Passenger, value: string) => {
      setPassengers((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
      setIsDirty(true);
    },
    []
  );

  const handleAddPassenger = useCallback(() => {
    focusNewPaxRef.current = true;
    setPassengers((prev) => [...prev, createDefaultPassenger()]);
    setIsDirty(true);
  }, []);

  const handleRemovePassenger = useCallback(
    (index: number) => {
      if (passengers.length <= 1) return;
      setPassengers((prev) => prev.filter((_, i) => i !== index));
      setIsDirty(true);
    },
    [passengers.length]
  );

  // Grand Total = automatic sum of all service Amounts (read-only, updates live)
  const grandTotal = useMemo(() => {
    return services.reduce((sum, srv) => {
      const val = Number(srv.amount);
      return sum + (Number.isFinite(val) && val > 0 ? val : 0);
    }, 0);
  }, [services]);

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

    for (let i = 0; i < services.length; i += 1) {
      const srv = services[i];
      const rawAmt = String(srv.amount ?? "").trim();
      const numAmt = Number(rawAmt);
      if (!rawAmt || !Number.isFinite(numAmt) || numAmt < 0) {
        toast.error(
          `Service #${i + 1} (${getServiceDisplayLabel(srv.serviceType)}): Please enter a valid Amount`
        );
        setExpandedServiceId(srv.id);
        setTimeout(() => {
          const amtInput = servicesListRef.current?.querySelector<HTMLInputElement>(
            `[data-service-id="${srv.id}"] input[data-service-amount="true"]`
          );
          amtInput?.focus();
        }, 20);
        return false;
      }

      const srvErr = validateServiceAndPassengers(
        srv.serviceType,
        srv.details,
        i === 0 ? passengers : []
      );
      if (srvErr) {
        toast.error(
          services.length > 1 ? `Service #${i + 1}: ${srvErr}` : srvErr
        );
        setExpandedServiceId(srv.id);
        return false;
      }
    }

    return true;
  };

  const buildPayload = (): QuotationInput => {
    const primaryService = services[0];
    const normalizedItems: QuotationItem[] = services.map((srv) => {
      const amt = Math.max(0, Number(srv.amount) || 0);
      const typeLabel = getServiceDisplayLabel(srv.serviceType);
      const keyDetail = buildCompactServiceKeyDetail(srv.serviceType, srv.details);
      return {
        description: keyDetail ? `${typeLabel} — ${keyDetail}` : typeLabel,
        qty: 1,
        unit_price: amt,
        amount: amt,
        service_type: srv.serviceType,
        type_label: typeLabel,
        details_summary: keyDetail,
      } as QuotationItem;
    });

    const serviceTitles = services.map((srv) =>
      buildServiceTitle(srv.serviceType, srv.details)
    );
    const derivedTitle = serviceTitles.join(" + ");

    const serviceSummaries = services.map((srv, idx) => {
      const label = getServiceDisplayLabel(srv.serviceType);
      const detail = buildCompactServiceKeyDetail(srv.serviceType, srv.details);
      return services.length > 1
        ? `${idx + 1}. ${label}${detail ? `: ${detail}` : ""}`
        : detail || buildServiceSummaryLines(srv.serviceType, srv.details).join(" · ");
    });
    const derivedSummary = serviceSummaries.filter(Boolean).join(" | ");

    return {
      quotation_number: isEdit
        ? quotationNumber.trim()
        : isManualQuotationNo
          ? manualQuotationNo.trim()
          : "",
      quotation_date: quotationDate,
      valid_until: validUntil || null,
      service_type: primaryService?.serviceType || "Ticket",
      client_name: clientName.trim(),
      client_email: isEdit ? legacyClientEmail : null,
      client_phone: clientPhone.trim() || null,
      client_id: partyId || null,
      agent_id: isEdit ? legacyAgentId : null,
      title: derivedTitle,
      description: derivedSummary || null,
      items: normalizedItems,
      subtotal: grandTotal,
      discount: 0,
      tax: 0,
      total: grandTotal,
      currency,
      status,
      notes: notes.trim() || null,
      terms: null,
      source: "web-app",
      source_ref: {
        version: 3,
        services: services.map((srv) => ({
          id: srv.id,
          service_type: srv.serviceType,
          serviceDetails: srv.details,
          amount: Math.max(0, Number(srv.amount) || 0),
          title: buildServiceTitle(srv.serviceType, srv.details),
          summary: buildCompactServiceKeyDetail(srv.serviceType, srv.details),
        })),
        serviceDetails: primaryService?.details || createDefaultServiceDetails(),
        passengers,
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

        runBackgroundTask("QuotationFormPage.pdfAndRefresh", async () => {
          if (andDownloadPdf) {
            try {
              const latestBranding = await getBrandingAsync();
              const quoteForPdf: Quotation = {
                id: savedQuote?.id || id || "temp",
                agency_id: savedQuote?.agency_id || "",
                ...payload,
                quotation_number: savedQuote?.quotation_number || quotationNumber,
                created_by: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              downloadQuotationPdf(quoteForPdf, { branding: latestBranding });
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
    const primary = services[0];
    const pType = primary?.serviceType || "Ticket";
    const summaryTitles = services
      .map((s) => buildServiceTitle(s.serviceType, s.details))
      .join(" + ");
    navigate("/app/sales-expenses?tab=booking-invoice&new=1", {
      state: {
        openAddClient: true,
        prefill: {
          name: clientName,
          contact_number: clientPhone,
          travel_type: pType === "Umrah" ? "Umrah" : pType,
          selling_price: grandTotal,
          notes: `Converted from Quotation #${quotationNumber} — ${summaryTitles}\nQuotation Total: ${currency} ${grandTotal.toLocaleString()}`,
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

  const derivedHeading = useMemo(() => {
    if (services.length === 1) {
      return buildServiceTitle(services[0].serviceType, services[0].details);
    }
    return `${services.length} Services (${services
      .map((s) => getServiceDisplayLabel(s.serviceType))
      .join(" + ")})`;
  }, [services]);

  return (
    <form
      ref={formContainerRef}
      onSubmit={(e) => {
        e.preventDefault();
        handleSave(false);
      }}
      className="max-w-7xl mx-auto -my-2 lg:-my-3 px-1 sm:px-2 py-1.5 flex flex-col gap-2 lg:max-h-[calc(100dvh-5.25rem)] lg:overflow-hidden"
    >
      {/* HEADER ROW: Back arrow + title "New Quotation" + subtitle on left | [Cancel] [Save & PDF] [Save Quotation] on right */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            tabIndex={-1}
            onClick={handleCancel}
            className="h-7 w-7 p-0 shrink-0"
            title="Back (Esc)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>
          <div className="min-w-0 flex items-baseline gap-1.5 flex-wrap">
            <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0 self-center" />
            <h1 className="text-sm sm:text-base font-bold tracking-tight truncate">
              {isEdit ? `Edit Quotation #${quotationNumber}` : "New Quotation"}
            </h1>
            <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[340px]">
              · {derivedHeading}
            </span>
          </div>
        </div>

        <div
          data-nav-order="99"
          className="flex items-center gap-1.5 shrink-0"
        >
          {isEdit && !convertedBookingId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              tabIndex={-1}
              onClick={handleConvertToBooking}
              className="h-7 px-2.5 text-xs gap-1"
            >
              <ArrowRightCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Convert to Booking</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            tabIndex={-1}
            onClick={handleCancel}
            disabled={isSubmitting}
            className="h-7 px-2.5 text-xs cursor-pointer"
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
            className="h-7 px-2.5 text-xs font-semibold gap-1 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            Save & PDF
          </Button>
          <Button
            type="submit"
            size="sm"
            data-save-button="true"
            disabled={isSubmitting}
            className="h-7 px-3 text-xs font-semibold bg-[#0B192C] hover:bg-[#1E3E62] text-white gap-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <Save className="w-3 h-3" />
            {isSubmitting ? "Saving..." : "Save Quotation"}
          </Button>
        </div>
      </div>

      {/* MAIN FORM CARD: Fits on one laptop screen (1366x768+) with no page scroll */}
      <div className="bg-card border rounded-xl p-2.5 sm:p-3 shadow-2xs flex flex-col gap-2 min-h-0">
        {/* ROW 1: Quotation # | Date (locked) | Client (with Quick Add) | Phone Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-end shrink-0">
          {/* Quotation # */}
          <div className="lg:col-span-2 space-y-0.5">
            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
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
              className="h-7 justify-between bg-muted/60 text-xs"
            />
          </div>

          {/* Date (locked) */}
          <div className="lg:col-span-2">
            <LockedDateField
              label="Date"
              value={quotationDate}
              className="space-y-0.5 [&_label]:text-[10px] [&_input]:h-7"
            />
          </div>

          {/* Client (with Quick Add) */}
          <div className="lg:col-span-5 space-y-0.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                Client <span className="text-red-500">*</span>
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
              requiredMessage="Please select a Client"
              onQuickAdd={() => setIsAddClientOpen(true)}
              quickAddLabel="Add New Client"
              className="h-7 text-xs"
              triggerProps={{ "data-client-select": "true" }}
            />
          </div>

          {/* Phone Number */}
          <div className="lg:col-span-3 space-y-0.5">
            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
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
              className="h-7 text-xs bg-background focus-visible:ring-2 focus-visible:ring-teal-500"
            />
          </div>
        </div>

        {/* ROW 2: Valid Until (+7d +15d +30d) | Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end shrink-0">
          {/* Valid Until */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
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
                    className="text-[10px] font-medium px-1.5 py-0 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
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
              className="h-7 text-xs bg-background focus-visible:ring-2 focus-visible:ring-teal-500"
            />
          </div>

          {/* Status */}
          <div className="space-y-0.5">
            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
              Status
            </Label>
            <Select
              value={status}
              onValueChange={(val) => {
                setStatus(val as Status);
                markDirty();
              }}
            >
              <SelectTrigger className="h-7 text-xs bg-background focus-visible:ring-2 focus-visible:ring-teal-500">
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

        {/* SERVICES SECTION (the main part) */}
        <div className="pt-1.5 border-t flex flex-col gap-1.5 min-h-0">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Services ({services.length})
              </h2>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                · Click any collapsed service to expand & edit
              </span>
            </div>
          </div>

          {/* Fixed max-height scrollable services list */}
          <div
            ref={servicesListRef}
            className="max-h-[168px] overflow-y-auto space-y-1.5 pr-0.5"
          >
            {services.map((srv, idx) => {
              const isExpanded =
                services.length === 1 || expandedServiceId === srv.id;
              const keyDetail = buildCompactServiceKeyDetail(
                srv.serviceType,
                srv.details
              );
              const amtNum = Number(srv.amount) || 0;

              if (!isExpanded) {
                return (
                  <div
                    key={srv.id}
                    data-service-id={srv.id}
                    onClick={() => setExpandedServiceId(srv.id)}
                    className="h-8 px-2.5 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors flex items-center justify-between gap-2 text-xs cursor-pointer group"
                    title="Click to expand and edit service"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[10px] font-mono font-bold text-muted-foreground shrink-0">
                        #{idx + 1}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-semibold h-5 px-1.5 shrink-0 bg-background"
                      >
                        {getServiceDisplayLabel(srv.serviceType)}
                      </Badge>
                      <span className="text-xs text-foreground truncate">
                        {keyDetail || "No details entered"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-xs text-teal-700 dark:text-teal-400">
                        {currency} {amtNum.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedServiceId(srv.id);
                        }}
                        className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-[10px]"
                        title="Expand / Edit service"
                      >
                        <Pencil className="w-3 h-3" />
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {idx > 0 && (
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveService(srv.id, idx);
                          }}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 cursor-pointer"
                          aria-label={`Remove service ${idx + 1}`}
                          title="Remove service"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={srv.id}
                  data-service-id={srv.id}
                  className="rounded-lg border border-teal-500/30 bg-slate-50/70 dark:bg-slate-900/40 p-2 space-y-1.5"
                >
                  {/* ONE COMPACT LINE: Service Type dropdown | detail fields | Amount | remove (x) */}
                  <div className="flex flex-wrap lg:flex-nowrap items-end gap-1.5">
                    {/* Service Type Dropdown */}
                    <div className="w-36 shrink-0 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                          #{idx + 1} Service Type
                        </Label>
                        {services.length > 1 && (
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setExpandedServiceId(null)}
                            className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center"
                            title="Collapse service row"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <ServiceTypeSelect
                        value={srv.serviceType}
                        onChange={(val) => handleServiceTypeChange(srv.id, val)}
                        className="h-7 text-xs font-medium bg-background"
                      />
                    </div>

                    {/* DETAIL FIELDS BY SERVICE TYPE (1-Line Compact) */}
                    <div className="flex-1 min-w-0">
                      {/* 1. Air Ticket: Trip Type | Flight Date | Flight Time | Sector (KHI to DXB) | Airline */}
                      {srv.serviceType === "Ticket" && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 items-end">
                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Trip Type
                            </Label>
                            <TripTypeSelect
                              value={srv.details.tripType}
                              onChange={(val: TripType) =>
                                handleServiceDetailChange(srv.id, "tripType", val)
                              }
                              className="h-7 text-xs bg-background"
                            />
                          </div>

                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Flight Date
                            </Label>
                            <Input
                              type="date"
                              value={srv.details.flightDate}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "flightDate",
                                  e.target.value
                                )
                              }
                              className="h-7 text-xs px-1.5 bg-background"
                            />
                          </div>

                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Flight Time
                            </Label>
                            <Input
                              type="time"
                              value={srv.details.flightTime}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "flightTime",
                                  e.target.value
                                )
                              }
                              className="h-7 text-xs px-1.5 bg-background"
                            />
                          </div>

                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Sector (KHI to DXB)
                            </Label>
                            <div className="flex items-center gap-1">
                              <Input
                                value={srv.details.origin}
                                onChange={(e) =>
                                  handleServiceDetailChange(
                                    srv.id,
                                    "origin",
                                    e.target.value.toUpperCase()
                                  )
                                }
                                placeholder="KHI"
                                className="h-7 text-xs uppercase px-1 text-center font-mono bg-background"
                              />
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                to
                              </span>
                              <Input
                                value={srv.details.destination}
                                onChange={(e) =>
                                  handleServiceDetailChange(
                                    srv.id,
                                    "destination",
                                    e.target.value.toUpperCase()
                                  )
                                }
                                placeholder="DXB"
                                className="h-7 text-xs uppercase px-1 text-center font-mono bg-background"
                              />
                            </div>
                          </div>

                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Airline
                            </Label>
                            <Input
                              value={srv.details.airline}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "airline",
                                  e.target.value
                                )
                              }
                              placeholder="PIA / Emirates"
                              className="h-7 text-xs bg-background"
                            />
                          </div>
                        </div>
                      )}

                      {/* 2. Visa: Country | Visa Type | Duration | Processing time */}
                      {srv.serviceType === "Visa" && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 items-end">
                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Country
                            </Label>
                            <Input
                              value={srv.details.visaCountry}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "visaCountry",
                                  e.target.value
                                )
                              }
                              placeholder="Saudi Arabia / UAE"
                              className="h-7 text-xs bg-background"
                            />
                          </div>

                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Visa Type
                            </Label>
                            <Input
                              value={srv.details.visaType}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "visaType",
                                  e.target.value
                                )
                              }
                              placeholder="Tourist / E-Visa"
                              className="h-7 text-xs bg-background"
                            />
                          </div>

                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Duration
                            </Label>
                            <Input
                              value={srv.details.visaValidity}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "visaValidity",
                                  e.target.value
                                )
                              }
                              placeholder="30 Days"
                              className="h-7 text-xs bg-background"
                            />
                          </div>

                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Processing time
                            </Label>
                            <Input
                              value={srv.details.visaProcessingTime || ""}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "visaProcessingTime",
                                  e.target.value
                                )
                              }
                              placeholder="3-5 Days"
                              className="h-7 text-xs bg-background"
                            />
                          </div>
                        </div>
                      )}

                      {/* 3. Hotel Booking: City | Hotel | Check-in | Check-out | Rooms */}
                      {srv.serviceType === "Hotel" && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 items-end">
                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              City
                            </Label>
                            <Input
                              value={srv.details.hotelCity}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "hotelCity",
                                  e.target.value
                                )
                              }
                              placeholder="City"
                              className="h-7 text-xs bg-background"
                            />
                          </div>

                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Hotel
                            </Label>
                            <Input
                              value={srv.details.hotelName}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "hotelName",
                                  e.target.value
                                )
                              }
                              placeholder="Hotel Name"
                              className="h-7 text-xs bg-background"
                            />
                          </div>

                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Check-in
                            </Label>
                            <Input
                              type="date"
                              value={srv.details.hotelCheckIn}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "hotelCheckIn",
                                  e.target.value
                                )
                              }
                              className="h-7 text-xs px-1.5 bg-background"
                            />
                          </div>

                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Check-out
                            </Label>
                            <Input
                              type="date"
                              value={srv.details.hotelCheckOut}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "hotelCheckOut",
                                  e.target.value
                                )
                              }
                              className="h-7 text-xs px-1.5 bg-background"
                            />
                          </div>

                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Rooms
                            </Label>
                            <Input
                              value={srv.details.hotelRoomType}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "hotelRoomType",
                                  e.target.value
                                )
                              }
                              placeholder="1 Room / Double"
                              className="h-7 text-xs bg-background"
                            />
                          </div>
                        </div>
                      )}

                      {/* 4. Travel Insurance: Destination | Plan | Start date | End date */}
                      {srv.serviceType === "Insurance" && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 items-end">
                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Destination
                            </Label>
                            <Input
                              value={srv.details.insuranceDestination || ""}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "insuranceDestination",
                                  e.target.value
                                )
                              }
                              placeholder="Schengen / Worldwide"
                              className="h-7 text-xs bg-background"
                            />
                          </div>

                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Plan
                            </Label>
                            <Input
                              value={srv.details.insurancePlan}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "insurancePlan",
                                  e.target.value
                                )
                              }
                              placeholder="Standard Travel Care"
                              className="h-7 text-xs bg-background"
                            />
                          </div>

                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Start date
                            </Label>
                            <Input
                              type="date"
                              value={srv.details.insuranceStartDate || ""}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "insuranceStartDate",
                                  e.target.value
                                )
                              }
                              className="h-7 text-xs px-1.5 bg-background"
                            />
                          </div>

                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              End date
                            </Label>
                            <Input
                              type="date"
                              value={srv.details.insuranceEndDate || ""}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "insuranceEndDate",
                                  e.target.value
                                )
                              }
                              className="h-7 text-xs px-1.5 bg-background"
                            />
                          </div>
                        </div>
                      )}

                      {/* 5. Other Services: Service name | Details */}
                      {srv.serviceType === "Other" && (
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-end">
                          <div className="sm:col-span-4 space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Service name
                            </Label>
                            <Input
                              value={srv.details.otherServiceName || ""}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "otherServiceName",
                                  e.target.value
                                )
                              }
                              placeholder="e.g. Transport / Ziyarat"
                              className="h-7 text-xs bg-background"
                            />
                          </div>

                          <div className="sm:col-span-8 space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Details
                            </Label>
                            <Input
                              value={srv.details.generalDescription}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "generalDescription",
                                  e.target.value
                                )
                              }
                              placeholder="Service particulars & details..."
                              className="h-7 text-xs bg-background"
                            />
                          </div>
                        </div>
                      )}

                      {/* 6. Umrah: Makkah Hotel | Madinah Hotel | Airline | Ziyarat box */}
                      {srv.serviceType === "Umrah" && (
                        <div className="grid grid-cols-2 sm:grid-cols-12 gap-1.5 items-end">
                          <div className="sm:col-span-4 space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Makkah Hotel
                            </Label>
                            <Input
                              value={srv.details.makkahHotel}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "makkahHotel",
                                  e.target.value
                                )
                              }
                              placeholder="e.g. Pullman Zamzam Makkah"
                              className="h-7 text-xs bg-background"
                            />
                          </div>

                          <div className="sm:col-span-4 space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Madinah Hotel
                            </Label>
                            <Input
                              value={srv.details.madinahHotel}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "madinahHotel",
                                  e.target.value
                                )
                              }
                              placeholder="e.g. Anwar Al Madinah"
                              className="h-7 text-xs bg-background"
                            />
                          </div>

                          <div className="sm:col-span-2 space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Airline
                            </Label>
                            <Input
                              value={srv.details.umrahAirline}
                              onChange={(e) =>
                                handleServiceDetailChange(
                                  srv.id,
                                  "umrahAirline",
                                  e.target.value
                                )
                              }
                              placeholder="Saudia / PIA"
                              className="h-7 text-xs bg-background"
                            />
                          </div>

                          <div className="sm:col-span-2 space-y-0.5">
                            <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Ziyarat
                            </Label>
                            <label className="h-7 px-2 rounded-md border bg-background flex items-center gap-1.5 cursor-pointer select-none hover:bg-muted/40 transition-colors">
                              <input
                                type="checkbox"
                                checked={Boolean(srv.details.ziyaratIncluded)}
                                onChange={(e) =>
                                  handleServiceDetailChange(
                                    srv.id,
                                    "ziyaratIncluded",
                                    e.target.checked
                                  )
                                }
                                className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600"
                              />
                              <span className="text-[11px] font-medium text-foreground truncate">
                                {srv.details.ziyaratIncluded ? "Included" : "No"}
                              </span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Amount (Required Number) + Remove (x) */}
                    <div className="w-32 shrink-0 space-y-0.5">
                      <Label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 block">
                        Amount ({currency}) <span className="text-red-500">*</span>
                      </Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          required
                          data-service-amount="true"
                          data-required="true"
                          data-required-message="Please enter a service Amount"
                          value={srv.amount}
                          onChange={(e) =>
                            handleServiceAmountChange(srv.id, e.target.value)
                          }
                          placeholder="0"
                          className="h-7 text-xs font-mono font-semibold text-right bg-background focus-visible:ring-2 focus-visible:ring-teal-500"
                        />
                        {idx > 0 && (
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => handleRemoveService(srv.id, idx)}
                            className="h-7 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0 cursor-pointer"
                            aria-label={`Remove service ${idx + 1}`}
                            title="Remove service"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* "+ Add Service" button below the list */}
          <div className="shrink-0">
            <button
              type="button"
              data-add-row-btn="true"
              onClick={handleAddService}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-teal-50 dark:hover:bg-teal-950/30 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Service
            </button>
          </div>
        </div>

        {/* PASSENGERS SECTION: Shared by the whole quotation, 1 compact line + small scrollable area */}
        <div
          ref={paxListRef}
          className="pt-1.5 border-t flex flex-col gap-1 shrink-0"
          data-repeatable-group="passengers"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Passengers ({passengers.length})
              </span>
            </div>
            <button
              type="button"
              data-add-passenger-btn="true"
              onClick={handleAddPassenger}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-teal-50 dark:hover:bg-teal-950/30 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Passenger
            </button>
          </div>

          {/* Small scrollable passenger area */}
          <div className="max-h-[72px] overflow-y-auto space-y-1 pr-0.5">
            {passengers.map((pax, idx) => (
              <div
                key={idx}
                data-pax-row={idx}
                className="flex flex-wrap sm:flex-nowrap items-center gap-1.5"
              >
                <span className="text-[10px] font-mono font-bold text-slate-400 w-4 text-center shrink-0">
                  #{idx + 1}
                </span>
                <Input
                  data-pax-field="name"
                  value={pax.name}
                  onChange={(e) =>
                    handlePassengerChange(idx, "name", e.target.value)
                  }
                  placeholder="Name"
                  className="h-7 text-xs flex-1 min-w-[140px] bg-background"
                />
                <Input
                  data-pax-field="passport"
                  maxLength={20}
                  value={pax.passport || ""}
                  onChange={(e) =>
                    handlePassengerChange(
                      idx,
                      "passport",
                      e.target.value.toUpperCase()
                    )
                  }
                  placeholder="Passport #"
                  className="h-7 text-xs w-28 uppercase font-mono bg-background"
                />
                <Select
                  value={pax.type || "Adult"}
                  onValueChange={(val) => handlePassengerChange(idx, "type", val)}
                >
                  <SelectTrigger className="h-7 text-[11px] w-20 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PASSENGER_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={pax.gender || "Male"}
                  onValueChange={(val) =>
                    handlePassengerChange(idx, "gender", val)
                  }
                >
                  <SelectTrigger className="h-7 text-[11px] w-16 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  min="1900-01-01"
                  max={getTodayDateString()}
                  title="Date of Birth"
                  value={pax.dob || ""}
                  onChange={(e) =>
                    handlePassengerChange(idx, "dob", e.target.value)
                  }
                  data-pax-last-field="true"
                  className="h-7 text-xs w-32 bg-background px-1.5"
                />
                {passengers.length > 1 && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleRemovePassenger(idx)}
                    className="p-1 text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                    aria-label={`Remove Passenger ${idx + 1}`}
                    title="Remove passenger"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* BOTTOM ROW (ONE line): Notes/Terms (single-line textarea, expandable) on left | Currency + Grand Total on right */}
        <div className="pt-1.5 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          {/* Left: Notes/Terms (single-line textarea, expandable) */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 shrink-0">
              Notes / Terms
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                markDirty();
              }}
              rows={1}
              placeholder="Terms, inclusions, validity remarks, cancellation rules..."
              className="h-8 min-h-[32px] max-h-20 py-1.5 px-2.5 text-xs resize-y bg-background focus-visible:ring-2 focus-visible:ring-teal-500 flex-1"
            />
          </div>

          {/* Right: Currency + Grand Total */}
          <div className="flex items-center justify-end gap-2.5 shrink-0 bg-muted/40 border rounded-lg px-2.5 py-1">
            <div className="flex items-center gap-1.5">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Currency
              </Label>
              <Select
                value={currency}
                onValueChange={(val) => {
                  setCurrency(val);
                  markDirty();
                }}
              >
                <SelectTrigger className="h-7 w-20 text-xs font-mono bg-background focus-visible:ring-2 focus-visible:ring-teal-500">
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

            <div className="h-4 w-px bg-border" />

            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Grand Total
              </span>
              <span
                data-grand-total="true"
                className="text-sm sm:text-base font-extrabold font-mono text-teal-700 dark:text-teal-400"
              >
                {currency} {grandTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Client Dialog */}
      <AddPartyDialog
        open={isAddClientOpen}
        onOpenChange={setIsAddClientOpen}
        initialType="client"
        lockType={true}
        onSaved={handleQuickClientSaved}
      />
    </form>
  );
}
