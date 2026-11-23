import React, { useState, useMemo, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddPartyDialog } from "@/components/parties/AddPartyDialog";
import { useParties, Party } from "@/hooks/useParties";
import { generateBookingConfirmationPdf, generateBookingInvoicePdf, BookingPdfData } from "@/lib/pdf/bookingInvoicePdf";
import { useAgency } from "@/hooks/useAgency";
import { useAgencyBranding } from "@/hooks/useAgencyBranding";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { useQueryClient } from "@tanstack/react-query";
import { useAccounts } from "@/hooks/useUnifiedTransactions";
import {
  resolveAccountIdForPayment,
  refreshAffectedFinancialQueries,
} from "@/lib/accountingEngine";
import { LockedDateField, getTodayDateString } from "@/components/ui/LockedDateField";
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";
import { UniversalPartySelect } from "@/components/parties/UniversalPartySelect";
import { SearchableSelect, SearchableSelectItem } from "@/components/ui/SearchableSelect";
import { AgencyBankSelect } from "@/components/banks/AgencyBankSelect";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DocumentNumberControl } from "@/components/ui/DocumentNumberControl";
import {
  createRequestId,
  rpcWithPreSqlFallback,
  runBackgroundTask,
} from "@/lib/atomicSave";
import { runUiAtomicSave } from "@/lib/atomicSaveUi";
import {
  ServiceType,
  TripType,
  Passenger,
  ServiceDetailsState,
  createDefaultServiceDetails,
  createDefaultPassenger,
  validateServiceAndPassengers,
} from "@/lib/serviceDefinitions";
import {
  ServiceTypeSelect,
  TripTypeSelect,
  ZiyaratToggle,
  ServiceSpecificFields,
  PassengersSection,
} from "@/components/bookings/ServiceSpecificFields";
import {
  FileText,
  Plus,
  Lock,
  AlertTriangle,
} from "lucide-react";
import {
  hydrateInvoiceForEdit,
  evaluateInvoiceEdit,
  type InvoiceEditSnapshot,
} from "@/lib/documentEditHelpers";
import {
  parseVendorAmountPaid,
  validateBookingVendorPayment,
  shouldResolveBookingPaymentAccount,
} from "@/lib/bookingVendorPaymentHelpers";

export type { ServiceType, TripType };

interface BookingInvoiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editingInvoice?: any | null;
}

export const BookingInvoiceForm: React.FC<BookingInvoiceFormProps> = ({
  open,
  onOpenChange,
  onSuccess,
  editingInvoice,
}) => {
  const { parties } = useParties();
  const { data: agency } = useAgency();
  const { branding, getBrandingAsync } = useAgencyBranding();
  const { data: currentAgencyId } = useCurrentAgencyId();
  const { accounts = [] } = useAccounts();
  const queryClient = useQueryClient();

  // Read-only auto invoice number preview + optional manual override
  const [autoInvoiceNo, setAutoInvoiceNo] = useState<string>("Auto-assigned");
  const [isManualInvoiceNo, setIsManualInvoiceNo] = useState<boolean>(false);
  const [manualInvoiceNo, setManualInvoiceNo] = useState<string>("");
  const formRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef<boolean>(false);
  const requestIdRef = useRef<string>(createRequestId());

  // Top Row: Date, Service Type, Client, Vendor
  const [invoiceDate, setInvoiceDate] = useState<string>(
    () => getTodayDateString()
  );
  const [service, setService] = useState<ServiceType>("Ticket");
  const [partyId, setPartyId] = useState<string>("");
  const [vendorId, setVendorId] = useState<string>("");
  const [contactNumber, setContactNumber] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [selectedBank, setSelectedBank] = useState<string>("");

  // Quick Add Party Popups
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);

  // ==================== Service-Specific State ====================

  // A. Air Ticket
  const [serviceDetails, setServiceDetails] = useState<ServiceDetailsState>(() =>
    createDefaultServiceDetails()
  );
  const handleServiceDetailChange = <K extends keyof ServiceDetailsState>(
    field: K,
    value: ServiceDetailsState[K]
  ) => {
    setServiceDetails((prev) => ({ ...prev, [field]: value }));
  };
  const {
    tripType,
    origin,
    destination,
    flightDate,
    flightTime,
    airline,
    pnr,
    ticketNo,
    returnDate,
    returnTime,
    multicityLegs,
    ziyaratIncluded,
    umrahDepartureCity,
    umrahArrivalCity,
    umrahAirline,
    umrahFlightDate,
    umrahFlightTime,
    umrahReturnDate,
    umrahReturnTime,
    umrahTransport,
    makkahHotel,
    makkahNights,
    madinahHotel,
    madinahNights,
    visaCountry,
    visaType,
    visaValidity,
    insurancePlan,
    insuranceDuration,
    hotelName,
    hotelCity,
    hotelCheckIn,
    hotelCheckOut,
    hotelRoomType,
    generalDescription,
  } = serviceDetails;

  // ==================== Passengers (All Services) ====================
  const [passengers, setPassengers] = useState<Passenger[]>(() => [
    createDefaultPassenger(),
  ]);

  // ==================== Money Section ====================
  const [vendorPayable, setVendorPayable] = useState<string>("0");
  const [totalAmount, setTotalAmount] = useState<string>("0");
  const [amountPaid, setAmountPaid] = useState<string>("0");
  const [vendorAmountPaid, setVendorAmountPaid] = useState<string>("");
  const [remainingDueDate, setRemainingDueDate] = useState<string>(
    () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank">("cash");

  // Booking Remarks & Edit Audit Reason
  const [notes, setNotes] = useState<string>("");
  const [editReason, setEditReason] = useState<string>("");
  const [initialEditSnapshot, setInitialEditSnapshot] = useState<InvoiceEditSnapshot | null>(null);

  const isEditMode = Boolean(editingInvoice?.id);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hydrate form in Edit mode OR initialize clean defaults in Create mode
  useEffect(() => {
    async function fetchNextInvoiceNo() {
      try {
        const { data, error } = await supabase.rpc("preview_next_number", {
          p_counter_type: "invoice",
        });

        if (!error && data) {
          setAutoInvoiceNo(data);
          return;
        }
      } catch (err) {
        console.warn("Could not preview next invoice number:", err);
      }
      setAutoInvoiceNo("Auto-assigned");
    }

    if (!open) return;

    requestIdRef.current = createRequestId();

    if (editingInvoice?.id) {
      const hydrated = hydrateInvoiceForEdit(editingInvoice);
      setInvoiceDate(String(editingInvoice.invoice_date || getTodayDateString()).slice(0, 10));
      setService(hydrated.service);
      setPartyId(editingInvoice.party_id || "");
      setVendorId(editingInvoice.vendor_id || "");
      setContactNumber(editingInvoice.party?.phone || "");
      setEmail("");
      setSelectedBank("");
      setServiceDetails(hydrated.serviceDetails);
      setPassengers(hydrated.passengers);
      setVendorPayable(hydrated.vendorPayable);
      setTotalAmount(hydrated.totalAmount);
      setAmountPaid(String(Number(editingInvoice.paid_amount) || 0));
      setVendorAmountPaid("");
      setRemainingDueDate(hydrated.dueDate);
      setPaymentMode("cash");
      setNotes(hydrated.notes);
      setEditReason("");
      setInitialEditSnapshot(hydrated.initialSnapshot);
      setIsManualInvoiceNo(false);
      setManualInvoiceNo("");
      return;
    }

    setInvoiceDate(getTodayDateString());
    setService("Ticket");
    setPartyId("");
    setVendorId("");
    setContactNumber("");
    setEmail("");
    setSelectedBank("");
    setServiceDetails(createDefaultServiceDetails());
    setPassengers([createDefaultPassenger()]);
    setVendorPayable("0");
    setTotalAmount("0");
    setAmountPaid("0");
    setVendorAmountPaid("");
    setRemainingDueDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    setPaymentMode("cash");
    setNotes("");
    setEditReason("");
    setInitialEditSnapshot(null);
    setIsManualInvoiceNo(false);
    setManualInvoiceNo("");
    fetchNextInvoiceNo();
  }, [open, editingInvoice]);

  // Filter clients and vendors
  const clientsList = useMemo(
    () => parties.filter((p) => p.type === "client" || p.type === "both"),
    [parties]
  );
  const vendorsList = useMemo(
    () => parties.filter((p) => p.type === "vendor" || p.type === "both"),
    [parties]
  );

  const clientSelectItems: SearchableSelectItem[] = useMemo(() => {
    return clientsList.map((c) => ({
      id: c.id,
      label: c.name,
      sublabel: [c.code, c.phone].filter(Boolean).join(" • "),
      badge: c.type === "both" ? "Both" : undefined,
      searchText: `${c.name} ${c.code || ""} ${c.phone || ""} ${c.email || ""}`,
    }));
  }, [clientsList]);

  const vendorSelectItems: SearchableSelectItem[] = useMemo(() => {
    return vendorsList.map((v) => ({
      id: v.id,
      label: v.name,
      sublabel: [v.code, v.phone].filter(Boolean).join(" • "),
      badge: v.type === "both" ? "Both" : undefined,
      searchText: `${v.name} ${v.code || ""} ${v.phone || ""}`,
    }));
  }, [vendorsList]);

  const handleClientSelect = (id: string) => {
    setPartyId(id);
    const client = parties.find((p) => p.id === id);
    if (client) {
      if (client.phone) setContactNumber(client.phone);
      if (client.email) setEmail(client.email);
    }
  };

  // Money Calculations (NaN-safe)
  const rawClientAmt = Number.parseFloat(totalAmount);
  const rawVendorPay = Number.parseFloat(vendorPayable);
  const rawAmountPaid = Number.parseFloat(amountPaid);
  const clientAmtNum = Number.isFinite(rawClientAmt) ? rawClientAmt : 0;
  const vendorPayNum = Number.isFinite(rawVendorPay) ? rawVendorPay : 0;
  const amountPaidNum = Number.isFinite(rawAmountPaid) ? rawAmountPaid : 0;
  const vendorAmountPaidNum = parseVendorAmountPaid(vendorAmountPaid);
  const remainingAmountNum = Math.max(0, clientAmtNum - amountPaidNum);

  const vendorPaymentInlineError = useMemo(() => {
    if (isEditMode || vendorAmountPaidNum === 0) return null;
    const validation = validateBookingVendorPayment({
      vendorAmountPaid: vendorAmountPaidNum,
      purchasingCost: vendorPayNum,
      vendorId,
      paymentMode,
      selectedBank,
      clientAmountPaid: amountPaidNum,
    });
    if (!validation.ok && validation.code !== "missing_bank") {
      return validation.error;
    }
    return null;
  }, [
    isEditMode,
    vendorAmountPaidNum,
    vendorPayNum,
    vendorId,
    paymentMode,
    selectedBank,
    amountPaidNum,
  ]);

  const selectedParty = parties.find((p) => p.id === partyId);
  const existingPaidNum = Number(editingInvoice?.paid_amount) || 0;
  const effectiveRemainingNum = isEditMode
    ? Math.max(0, clientAmtNum - existingPaidNum)
    : remainingAmountNum;
  const invoiceAmountChanged = Boolean(
    isEditMode &&
      initialEditSnapshot &&
      (clientAmtNum !== initialEditSnapshot.clientAmount ||
        vendorPayNum !== initialEditSnapshot.vendorPayable)
  );
  const invoiceUnderPaidError =
    isEditMode && clientAmtNum > 0 && clientAmtNum < existingPaidNum;

  const buildNormalizedMoreDetails = () => ({
    ...(editingInvoice?.more_details && typeof editingInvoice.more_details === "object"
      ? editingInvoice.more_details
      : {}),
    remaining_due_date:
      (isEditMode ? effectiveRemainingNum : remainingAmountNum) > 0
        ? remainingDueDate || null
        : null,
    selected_bank: !isEditMode && paymentMode === "bank" ? selectedBank || null : editingInvoice?.more_details?.selected_bank || null,
    client_name: selectedParty?.name || passengers[0]?.name || editingInvoice?.more_details?.client_name || null,
    trip_type: service === "Ticket" ? tripType : null,
    origin: service === "Ticket" ? origin : null,
    destination: service === "Ticket" ? destination : null,
    flight_date: service === "Ticket" ? flightDate : null,
    flight_time: service === "Ticket" ? flightTime : null,
    return_date: service === "Ticket" ? returnDate : null,
    return_time: service === "Ticket" ? returnTime : null,
    multicity_legs: service === "Ticket" && tripType === "Multicity" ? multicityLegs : null,
    airline: service === "Ticket" ? airline : null,
    pnr: pnr || null,
    ticket_no: ticketNo || null,
    ziyarat_included: service === "Umrah" ? ziyaratIncluded : null,
    umrah_departure_city: service === "Umrah" ? umrahDepartureCity : null,
    umrah_arrival_city: service === "Umrah" ? umrahArrivalCity : null,
    umrah_airline: service === "Umrah" ? umrahAirline : null,
    umrah_flight_date: service === "Umrah" ? umrahFlightDate : null,
    umrah_flight_time: service === "Umrah" ? umrahFlightTime : null,
    umrah_return_date: service === "Umrah" ? umrahReturnDate : null,
    umrah_return_time: service === "Umrah" ? umrahReturnTime : null,
    umrah_transport: service === "Umrah" ? umrahTransport : null,
    makkah_hotel: service === "Umrah" ? makkahHotel : null,
    makkah_nights: service === "Umrah" ? makkahNights : null,
    madinah_hotel: service === "Umrah" ? madinahHotel : null,
    madinah_nights: service === "Umrah" ? madinahNights : null,
    visa_country: service === "Visa" ? visaCountry : null,
    visa_type: service === "Visa" ? visaType : null,
    visa_validity: service === "Visa" ? visaValidity : null,
    insurance_plan: service === "Insurance" ? insurancePlan : null,
    insurance_duration: service === "Insurance" ? insuranceDuration : null,
    hotel_name: service === "Hotel" ? hotelName : null,
    hotel_city: service === "Hotel" ? hotelCity : null,
    hotel_check_in: service === "Hotel" ? hotelCheckIn : null,
    hotel_check_out: service === "Hotel" ? hotelCheckOut : null,
    hotel_room_type: service === "Hotel" ? hotelRoomType : null,
    general_description: service === "Other" ? generalDescription : null,
  });

  // PDF Data generator helper
  const getPdfData = (invNo: string): BookingPdfData => ({
    invoiceNo: invNo,
    invoiceDate,
    service,
    clientName: selectedParty?.name || passengers[0]?.name || "Customer",
    clientPhone: contactNumber || selectedParty?.phone,
    clientAddress: selectedParty?.address || selectedParty?.city,
    pnr: pnr || undefined,
    ticketNo: ticketNo || passengers[0]?.ticketNo || undefined,
    passportNo: passengers[0]?.passport || undefined,
    passengers: passengers.filter((p) => p.name.trim()),
    moreDetails: buildNormalizedMoreDetails(),
    paymentStatus: editingInvoice?.payment_status,
    isVoid: editingInvoice?.is_void,
    clientAmount: clientAmtNum,
    paidAmount: isEditMode ? existingPaidNum : amountPaidNum,
    balanceDue: isEditMode ? effectiveRemainingNum : remainingAmountNum,
    currency: "PKR",
    notes: notes || undefined,
    isEdited: isEditMode ? true : undefined,
    lastEditedAt: isEditMode ? new Date().toISOString() : undefined,
    branding,
  });

  // Handle Save
  const handleSave = async (downloadConfirmation = false, downloadInvoice = false) => {
    if (isSubmittingRef.current || isSubmitting) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Network connection issue. You are offline, not saved.");
      return;
    }

    const serviceError = validateServiceAndPassengers(service, serviceDetails, passengers);
    if (serviceError) {
      toast.error(serviceError);
      return;
    }

    // Build composite notes summarizing service details
    const serviceDetailsSummary = [
      service === "Ticket"
        ? `[Air Ticket - ${tripType}] ${origin}->${destination} | Date: ${flightDate} ${flightTime} | PNR: ${pnr} | Airline: ${airline}`
        : null,
      service === "Umrah"
        ? `[Umrah Package] Route: ${umrahDepartureCity}->${umrahArrivalCity} | Dates: ${umrahFlightDate} to ${umrahReturnDate} | Transport: ${umrahTransport} | Makkah: ${makkahHotel} (${makkahNights}N) | Madinah: ${madinahHotel} (${madinahNights}N) | Ziyarat: ${ziyaratIncluded ? "Yes" : "No"}`
        : null,
      service === "Visa"
        ? `[Visa] Country: ${visaCountry} | Type: ${visaType} | Validity: ${visaValidity}`
        : null,
      service === "Hotel"
        ? `[Hotel] ${hotelName} (${hotelCity}) | In: ${hotelCheckIn} Out: ${hotelCheckOut} | Room: ${hotelRoomType}`
        : null,
      service === "Insurance"
        ? `[Insurance] ${insurancePlan} (${insuranceDuration} Days)`
        : null,
      service === "Other" && generalDescription ? `[Other Service] ${generalDescription}` : null,
      notes ? `Remarks: ${notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const agencyIdForRefresh = currentAgencyId || agency?.id;

    // EDIT MODE PATH (atomic ledger correction + audit trail)
    if (isEditMode && editingInvoice && initialEditSnapshot) {
      const evaluation = evaluateInvoiceEdit(
        initialEditSnapshot,
        {
          clientAmount: clientAmtNum,
          vendorPayable: vendorPayNum,
          dueDate: remainingDueDate,
          serviceDetails,
          passengers,
          notes,
        },
        existingPaidNum,
        editReason
      );

      if (evaluation.noChanges) {
        toast.info("No changes were made.");
        onOpenChange(false);
        return;
      }

      if (!evaluation.ok) {
        toast.error(evaluation.error || "Please review your changes.");
        return;
      }

      const nextMoreDetails = buildNormalizedMoreDetails();
      const changed = new Set(evaluation.changedFields);

      await runUiAtomicSave({
        requestIdRef,
        isLockedRef: isSubmittingRef,
        setIsSubmitting,
        contextLabel: "BookingInvoiceForm.handleEditSave",
        fallbackErrorMessage: "Failed to update booking invoice. Please try again.",
        execute: async (requestId) => {
          const { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
            "edit_booking_invoice_atomic",
            {
              p_invoice_id: editingInvoice.id,
              p_reason: editReason.trim(),
              p_client_amount: changed.has("client_amount") ? clientAmtNum : null,
              p_vendor_payable: changed.has("vendor_payable") ? vendorPayNum : null,
              p_due_date: changed.has("due_date") ? (remainingDueDate || editingInvoice.invoice_date) : null,
              p_pnr: changed.has("pnr") ? (pnr || "") : null,
              p_ticket_no: changed.has("ticket_no") ? (ticketNo || "") : null,
              p_passport_no: changed.has("passport_no") ? (passengers[0]?.passport || "") : null,
              p_passengers: changed.has("passengers") ? passengers : null,
              p_more_details: changed.has("more_details") || changed.has("due_date") ? nextMoreDetails : null,
              p_notes: changed.has("notes") || changed.has("more_details") ? (serviceDetailsSummary || "") : null,
              p_request_id: requestId,
            }
          );
          if (rpcErr) throw rpcErr;
          if (rpcData && rpcData.success === false) {
            throw new Error(rpcData.error || "Failed to update booking invoice");
          }
          return rpcData;
        },
        onSuccess: (rpcData) => {
          onOpenChange(false);
          toast.success(
            rpcData?.affected_ledger
              ? `Invoice ${editingInvoice.invoice_no} updated & ledger corrected`
              : `Invoice ${editingInvoice.invoice_no} updated`
          );

          runBackgroundTask("booking-invoice-post-edit", () => {
            refreshAffectedFinancialQueries(queryClient, "all", agencyIdForRefresh);
            if (onSuccess) onSuccess();
          });
        },
      });
      return;
    }

    // CREATE MODE PATH
    if (!partyId && !passengers[0]?.name.trim()) {
      toast.error("Please select a client or enter a passenger name");
      return;
    }

    if (vendorPayNum < 0 || amountPaidNum < 0) {
      toast.error("Amounts cannot be negative");
      return;
    }

    if (clientAmtNum <= 0) {
      toast.error("Total amount must be greater than zero");
      return;
    }

    if (amountPaidNum > clientAmtNum) {
      toast.error("Paid amount cannot exceed total client amount");
      return;
    }

    const vendorPaymentValidation = validateBookingVendorPayment({
      vendorAmountPaid: vendorAmountPaidNum,
      purchasingCost: vendorPayNum,
      vendorId,
      paymentMode,
      selectedBank,
      clientAmountPaid: amountPaidNum,
    });
    if (!vendorPaymentValidation.ok) {
      toast.error(
        vendorPaymentValidation.error || "Please check the vendor payment amount."
      );
      return;
    }

    if (isManualInvoiceNo) {
      const customNo = manualInvoiceNo.trim();
      if (!customNo) {
        toast.error("Please enter a custom invoice number or switch back to Auto");
        return;
      }
    }

    const resolvedAccountId = shouldResolveBookingPaymentAccount(
      amountPaidNum,
      vendorAmountPaidNum
    )
      ? resolveAccountIdForPayment(accounts, paymentMode, selectedBank)
      : null;

    const legacyParams = {
      p_invoice_no: isManualInvoiceNo ? manualInvoiceNo.trim() : null,
      p_service: service,
      p_party_id: partyId || null,
      p_vendor_id: vendorId && vendorId !== "none" ? vendorId : null,
      p_client_amount: clientAmtNum,
      p_vendor_payable: vendorPayNum,
      p_amount_paid: amountPaidNum,
      p_payment_mode: paymentMode,
      p_account_id: resolvedAccountId,
      p_invoice_date: invoiceDate,
      p_due_date: remainingAmountNum > 0 ? remainingDueDate || invoiceDate : invoiceDate,
      p_pnr: pnr || null,
      p_ticket_no: ticketNo || null,
      p_passport_no: passengers[0]?.passport || null,
      p_passengers: passengers,
      p_currency: "PKR",
      p_more_details: buildNormalizedMoreDetails(),
      p_notes: serviceDetailsSummary || null,
      p_is_manual: isManualInvoiceNo,
    };

    await runUiAtomicSave({
      requestIdRef,
      isLockedRef: isSubmittingRef,
      setIsSubmitting,
      contextLabel: "BookingInvoiceForm.handleSave",
      fallbackErrorMessage: "Failed to save booking invoice. Please try again.",
      execute: async (requestId) => {
        const rpcData = await rpcWithPreSqlFallback<any>(
          supabase as any,
          "save_booking_invoice",
          {
            ...legacyParams,
            p_request_id: requestId,
            p_vendor_amount_paid: vendorAmountPaidNum,
          },
          vendorAmountPaidNum > 0
            ? {
                isAutoMode: !isManualInvoiceNo,
                legacyFallback: async () => {
                  throw new Error(
                    "Vendor payment at booking requires the latest database update. Nothing was saved."
                  );
                },
              }
            : { legacyParams, isAutoMode: !isManualInvoiceNo }
        );
        if (rpcData && rpcData.success === false) {
          throw new Error(rpcData.error || "Failed to save booking invoice");
        }
        return rpcData;
      },
      onSuccess: (data) => {
        const assignedInvoiceNo =
          data?.invoice_no || (isManualInvoiceNo ? manualInvoiceNo.trim() : autoInvoiceNo);
        const confirmationSnapshot = downloadConfirmation ? getPdfData(assignedInvoiceNo) : null;
        const invoiceSnapshot = downloadInvoice ? getPdfData(assignedInvoiceNo) : null;

        // Close modal IMMEDIATELY after save confirmation
        onOpenChange(false);
        toast.success(
          data?.vendor_voucher_no
            ? `Booking Invoice ${assignedInvoiceNo} & Vendor Voucher ${data.vendor_voucher_no} saved`
            : `Booking Invoice ${assignedInvoiceNo} saved`
        );

        // Refresh only affected queries and generate optional PDFs in background
        runBackgroundTask("booking-invoice-post-save", async () => {
          refreshAffectedFinancialQueries(queryClient, "invoice", agencyIdForRefresh);
          if (confirmationSnapshot || invoiceSnapshot) {
            const latestBranding = await getBrandingAsync().catch(() => branding);
            if (confirmationSnapshot) {
              generateBookingConfirmationPdf({
                ...confirmationSnapshot,
                branding: latestBranding,
              });
            }
            if (invoiceSnapshot) {
              generateBookingInvoicePdf({
                ...invoiceSnapshot,
                branding: latestBranding,
              });
            }
          }
          if (onSuccess) onSuccess();
        });
      },
    });
  };

  const isDirty = useMemo(() => {
    if (isEditMode && initialEditSnapshot) {
      const ev = evaluateInvoiceEdit(
        initialEditSnapshot,
        {
          clientAmount: clientAmtNum,
          vendorPayable: vendorPayNum,
          dueDate: remainingDueDate,
          serviceDetails,
          passengers,
          notes,
        },
        existingPaidNum,
        editReason
      );
      return Boolean(editReason.trim() || !ev.noChanges);
    }
    return Boolean(
      partyId ||
        vendorId ||
        pnr.trim() ||
        ticketNo.trim() ||
        airline.trim() ||
        notes.trim() ||
        clientAmtNum > 0 ||
        vendorPayNum > 0 ||
        amountPaidNum > 0 ||
        vendorAmountPaidNum > 0 ||
        passengers.some((p) => p.name.trim() || (p.passport && p.passport.trim()))
    );
  }, [
    isEditMode,
    initialEditSnapshot,
    remainingDueDate,
    serviceDetails,
    existingPaidNum,
    editReason,
    partyId,
    vendorId,
    pnr,
    ticketNo,
    airline,
    notes,
    clientAmtNum,
    vendorPayNum,
    amountPaidNum,
    vendorAmountPaidNum,
    passengers,
  ]);

  useFormKeyboardNav({
    containerRef: formRef,
    enabled: open && !isAddClientOpen && !isAddVendorOpen,
    isDirty,
    onSave: () => handleSave(false, false),
    onCancel: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[96vw] max-w-6xl max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0 bg-background border rounded-xl shadow-2xl"
      >
        {/* HEADER: Title, Auto/Manual Invoice # badge, Close (X is standard from DialogContent) */}
        <div className="px-4 sm:px-5 pr-10 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
              {isEditMode ? "Edit Booking Invoice" : "New Booking Invoice"}
            </DialogTitle>
          </div>

          {isEditMode && editingInvoice ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
              <Lock className="w-3 h-3 text-amber-600 shrink-0" />
              <span>Invoice #: {editingInvoice.invoice_no}</span>
            </div>
          ) : (
            <DocumentNumberControl
              label="Invoice #:"
              docType="invoice"
              previewNumber={autoInvoiceNo}
              isManual={isManualInvoiceNo}
              manualValue={manualInvoiceNo}
              onManualModeChange={setIsManualInvoiceNo}
              onManualValueChange={setManualInvoiceNo}
              accentClassName="text-blue-600 dark:text-blue-400"
            />
          )}
        </div>

        {/* BODY + FOOTER wrapped in ref for keyboard navigation */}
        <div ref={formRef} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-5 py-3 space-y-2.5">
          {/* TOP ROW: Date (Locked), Service Type, Client, Vendor, + Trip Type / Ziyarat inline */}
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 items-start">
            {/* 1. Locked Transaction Date */}
            <LockedDateField
              label="Date"
              value={invoiceDate}
              lockedDate={isEditMode ? invoiceDate : undefined}
              onChange={isEditMode ? undefined : setInvoiceDate}
              helperText={
                isEditMode
                  ? "Original entry date is locked"
                  : "Locked to current system date for audit integrity"
              }
              required
            />

            {/* 2. Service Type (locked in Edit mode) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <span>Service Type <span className="text-red-500">*</span></span>
                {isEditMode && <Lock className="w-2.5 h-2.5 text-amber-600" />}
              </Label>
              <ServiceTypeSelect
                value={service}
                onChange={setService}
                disabled={isEditMode}
                className="h-8 text-xs"
              />
            </div>

            {/* 3. Client (locked in Edit mode, with + Quick Add in Create mode) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>Client <span className="text-red-500">*</span></span>
                  {isEditMode && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                </Label>
                {!isEditMode && (
                  <button
                    type="button"
                    data-quick-add-btn="true"
                    onClick={() => setIsAddClientOpen(true)}
                    className="text-[10px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-0.5 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    <Plus className="w-2.5 h-2.5" /> Quick Add
                  </button>
                )}
              </div>
              {isEditMode ? (
                <Input
                  value={
                    editingInvoice?.party?.name ||
                    editingInvoice?.client_name ||
                    selectedParty?.name ||
                    "Walk-in Client"
                  }
                  readOnly
                  tabIndex={-1}
                  className="h-8 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-not-allowed font-medium"
                />
              ) : (
                <div>
                  <SearchableSelect
                    value={partyId}
                    onChange={handleClientSelect}
                    items={clientSelectItems}
                    placeholder="Select Client"
                    searchPlaceholder="Search clients by name, code, phone..."
                    emptyText="No clients found"
                    required={!passengers[0]?.name.trim()}
                    requiredMessage="Please select a Client or enter a Passenger Name"
                    onQuickAdd={() => setIsAddClientOpen(true)}
                    quickAddLabel="Add New Client"
                  />
                </div>
              )}
            </div>

            {/* 4. Vendor (locked in Edit mode, with + Quick Add in Create mode) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>Vendor</span>
                  {isEditMode && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                </Label>
                {!isEditMode && (
                  <button
                    type="button"
                    data-quick-add-btn="true"
                    onClick={() => setIsAddVendorOpen(true)}
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-0.5 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <Plus className="w-2.5 h-2.5" /> Quick Add
                  </button>
                )}
              </div>
              {isEditMode ? (
                <Input
                  value={
                    editingInvoice?.vendor?.name ||
                    parties.find((p) => p.id === vendorId)?.name ||
                    "None"
                  }
                  readOnly
                  tabIndex={-1}
                  className="h-8 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-not-allowed font-medium"
                />
              ) : (
                <div>
                  <SearchableSelect
                    value={vendorId}
                    onChange={(val) => setVendorId(val)}
                    items={vendorSelectItems}
                    placeholder="Select Vendor"
                    searchPlaceholder="Search vendors by name, code, phone..."
                    emptyText="No vendors found"
                    allowClear
                    clearLabel="Clear Vendor (None)"
                    onQuickAdd={() => setIsAddVendorOpen(true)}
                    quickAddLabel="Add New Vendor"
                  />
                </div>
              )}
            </div>

            {/* Service-Specific Top Row Field */}
            {service === "Ticket" ? (
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Trip Type
                </Label>
                <TripTypeSelect
                  value={tripType}
                  onChange={(val) => handleServiceDetailChange("tripType", val)}
                  className="h-8 text-xs"
                />
              </div>
            ) : service === "Umrah" ? (
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Ziyarat
                </Label>
                <div className="mt-0.5">
                  <ZiyaratToggle
                    checked={ziyaratIncluded}
                    onCheckedChange={(val) =>
                      handleServiceDetailChange("ziyaratIncluded", val)
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* SERVICE-SPECIFIC FIELDS */}
          <ServiceSpecificFields
            service={service}
            details={serviceDetails}
            onDetailChange={handleServiceDetailChange}
            showInlineTripType={false}
            showInlineZiyarat={false}
            showIssuanceFields={true}
            containerClassName="space-y-1.5 pt-0.5"
          />

          {/* PASSENGERS: Inline, compact, no heading box */}
          <PassengersSection
            passengers={passengers}
            onChangePassengers={setPassengers}
            requireFirstPassenger={!partyId}
          />
          {/* MONEY: One single row */}
          <div className="pt-1 border-t space-y-1.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-2 items-end">
              {/* Purchasing Cost */}
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Purchasing Cost
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={vendorPayable}
                  onChange={(e) => setVendorPayable(e.target.value)}
                  placeholder="0"
                  className="h-8 text-xs font-mono text-right mt-0.5"
                />
              </div>

              {/* Total Amount * */}
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Total Amount <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0"
                  className="h-8 text-xs font-mono font-bold text-right mt-0.5"
                  required
                  data-required-positive="true"
                  data-required-message="Total amount must be greater than zero"
                />
              </div>

              {/* Amount Paid (locked in Edit mode — edited via Vouchers) */}
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>Amount Paid</span>
                  {isEditMode && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                </Label>
                {isEditMode ? (
                  <Input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={`PKR ${existingPaidNum.toLocaleString()}`}
                    title="Paid amount comes from linked payment vouchers. Edit payment vouchers to change paid amount."
                    className="h-8 text-xs font-mono font-bold text-teal-700 dark:text-teal-300 bg-slate-100 dark:bg-slate-800 text-right mt-0.5 cursor-not-allowed"
                  />
                ) : (
                  <Input
                    type="number"
                    min={0}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono font-bold text-teal-600 dark:text-teal-400 text-right mt-0.5"
                  />
                )}
              </div>

              {/* Remaining (auto) */}
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Remaining (auto)
                </Label>
                <Input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={`PKR ${(isEditMode ? effectiveRemainingNum : remainingAmountNum).toLocaleString()}`}
                  className="h-8 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 text-right mt-0.5 cursor-not-allowed"
                />
              </div>

              {/* Due Date */}
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Due Date
                </Label>
                <Input
                  type="date"
                  value={remainingDueDate}
                  onChange={(e) => setRemainingDueDate(e.target.value)}
                  className="h-8 text-xs mt-0.5"
                />
              </div>

              {/* Payment Mode (only on initial creation; existing payments live on Vouchers) */}
              {!isEditMode && (
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Payment Mode
                  </Label>
                  <Select value={paymentMode} onValueChange={(val: any) => setPaymentMode(val)}>
                    <SelectTrigger className="h-8 text-xs mt-0.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash in Hand</SelectItem>
                      <SelectItem value="bank">Bank Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Agency Bank Select inline when Bank is selected */}
              {!isEditMode && paymentMode === "bank" && (
                <div>
                  <AgencyBankSelect
                    value={selectedBank}
                    onChange={setSelectedBank}
                    label="Bank Account"
                    required={true}
                  />
                </div>
              )}

              {/* Amount Paid to Vendor (optional initial vendor CPV voucher on create) */}
              {!isEditMode && (
                <div>
                  <Label
                    htmlFor="booking-vendor-amount-paid"
                    className="text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Amount Paid to Vendor
                  </Label>
                  <Input
                    id="booking-vendor-amount-paid"
                    type="number"
                    min={0}
                    value={vendorAmountPaid}
                    onChange={(e) => setVendorAmountPaid(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono text-right mt-0.5"
                  />
                </div>
              )}
            </div>

            {!isEditMode && vendorPaymentInlineError && (
              <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-3 py-1.5 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{vendorPaymentInlineError}</span>
              </div>
            )}

            {invoiceUnderPaidError && (
              <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-3 py-1.5 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Total amount (PKR {clientAmtNum.toLocaleString()}) cannot be less than the amount already paid (PKR {existingPaidNum.toLocaleString()}).
                </span>
              </div>
            )}

            {!invoiceUnderPaidError && invoiceAmountChanged && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Amount changed — the previous accounting entries will be reversed and new corrected entries will be posted automatically, updating dues, profit, dashboard, and reports.
                </span>
              </div>
            )}
          </div>

          {/* NOTES: Single-line input labelled "Remarks" (grows if user types more) */}
          <div className="pt-1 border-t grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
            <div className={isEditMode ? "md:col-span-7" : "md:col-span-12"}>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Remarks
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Itinerary remarks, hotel room info, meal preferences, special requests..."
                className="w-full min-h-[32px] h-8 max-h-[80px] text-xs resize-y mt-0.5 py-1.5 leading-snug"
              />
            </div>

            {isEditMode && (
              <div className="md:col-span-5">
                <Label className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                  Reason for Edit <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Corrected ticket fare, added PNR, updated due date..."
                  required
                  data-required-message="Please enter a reason for this edit"
                  className="h-8 text-xs mt-0.5 border-amber-300 dark:border-amber-800 focus-visible:ring-amber-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* FOOTER: Only Cancel and Save */}
        <div className="px-4 md:px-5 py-2.5 border-t bg-gray-50 dark:bg-slate-900/60 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            tabIndex={-1}
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            data-save-button="true"
            disabled={isSubmitting}
            onClick={() => handleSave(false, false)}
            className="h-8 text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer w-full sm:w-auto min-w-[90px] focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1"
          >
            {isSubmitting ? "Saving..." : isEditMode ? "Save Changes" : "Save"}
          </Button>
        </div>
        </div>
      </DialogContent>

      {/* Quick Add Client Dialog */}
      <AddPartyDialog
        open={isAddClientOpen}
        onOpenChange={setIsAddClientOpen}
        initialType="client"
        lockType
        onSaved={(newParty) => {
          handleClientSelect(newParty.id);
        }}
      />

      {/* Quick Add Vendor Dialog */}
      <AddPartyDialog
        open={isAddVendorOpen}
        onOpenChange={setIsAddVendorOpen}
        initialType="vendor"
        lockType
        onSaved={(newParty) => {
          setVendorId(newParty.id);
        }}
      />
    </Dialog>
  );
};
