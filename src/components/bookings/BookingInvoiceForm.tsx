import React, { useState, useMemo, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AddPartyDialog } from "@/components/parties/AddPartyDialog";
import { useParties, Party } from "@/hooks/useParties";
import { generateBookingConfirmationPdf, generateBookingInvoicePdf, BookingPdfData } from "@/lib/pdf/bookingInvoicePdf";
import { useAgency } from "@/hooks/useAgency";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { useQueryClient } from "@tanstack/react-query";
import { useAccounts } from "@/hooks/useUnifiedTransactions";
import {
  resolveAccountIdForPayment,
  invalidateAllFinancialQueries,
} from "@/lib/accountingEngine";
import { LockedDateField, getTodayDateString } from "@/components/ui/LockedDateField";
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";
import { UniversalPartySelect } from "@/components/parties/UniversalPartySelect";
import { SearchableSelect, SearchableSelectItem } from "@/components/ui/SearchableSelect";
import { AgencyBankSelect } from "@/components/banks/AgencyBankSelect";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CopyValue } from "@/components/ui/CopyValue";
import {
  ServiceType,
  TripType,
  Passenger,
  ServiceDetailsState,
  createDefaultServiceDetails,
  createDefaultPassenger,
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
  TrendingUp,
  Lock,
} from "lucide-react";

export type { ServiceType, TripType };

interface BookingInvoiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const BookingInvoiceForm: React.FC<BookingInvoiceFormProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { parties } = useParties();
  const { data: agency } = useAgency();
  const { data: currentAgencyId } = useCurrentAgencyId();
  const { accounts = [] } = useAccounts();
  const queryClient = useQueryClient();

  // Read-only auto invoice number
  const [autoInvoiceNo, setAutoInvoiceNo] = useState<string>("INV-1001");
  const formRef = useRef<HTMLDivElement>(null);

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
  const [remainingDueDate, setRemainingDueDate] = useState<string>(
    () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank">("cash");

  // Booking Remarks
  const [notes, setNotes] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute Auto Next Invoice Number on Open
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
      const code = agency?.agency_code || "A00001";
      setAutoInvoiceNo(`INV-${code}-00000001`);
    }

    if (open) {
      setInvoiceDate(getTodayDateString());
      fetchNextInvoiceNo();
    }
  }, [open, agency?.agency_code]);

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

  // Money Calculations
  const clientAmtNum = parseFloat(totalAmount) || 0;
  const vendorPayNum = parseFloat(vendorPayable) || 0;
  const amountPaidNum = parseFloat(amountPaid) || 0;
  const remainingAmountNum = Math.max(0, clientAmtNum - amountPaidNum);
  const liveProfit = clientAmtNum - vendorPayNum;

  const selectedParty = parties.find((p) => p.id === partyId);

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
    clientAmount: clientAmtNum,
    paidAmount: amountPaidNum,
    balanceDue: remainingAmountNum,
    currency: "PKR",
    notes: notes || undefined,
    agency: {
      name: agency?.name,
      phone: agency?.contact_info,
    },
  });

  // Handle Save
  const handleSave = async (downloadConfirmation = false, downloadInvoice = false) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("You are offline, not saved");
      return;
    }

    if (!partyId && !passengers[0]?.name.trim()) {
      toast.error("Please select a client or enter a passenger name");
      return;
    }

    if (clientAmtNum <= 0) {
      toast.error("Total amount must be greater than zero");
      return;
    }

    if (amountPaidNum > clientAmtNum) {
      toast.error("Could not save: Paid amount cannot exceed total client amount");
      return;
    }

    if (amountPaidNum > 0 && paymentMode === "bank" && !selectedBank) {
      toast.error("Please select an agency bank account for bank payment");
      return;
    }

    setIsSubmitting(true);
    const invoiceNo = autoInvoiceNo || `INV-${Date.now().toString().slice(-6)}`;

    try {
      const resolvedAccountId =
        amountPaidNum > 0
          ? resolveAccountIdForPayment(accounts, paymentMode, selectedBank)
          : null;

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

      // Single atomic RPC saves booking invoice, ledger entries, initial payment voucher & account transaction together
      const { data, error } = await (supabase as any).rpc("save_booking_invoice", {
        p_invoice_no: invoiceNo,
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
        p_more_details: {
          remaining_due_date: remainingAmountNum > 0 ? remainingDueDate || null : null,
          selected_bank: paymentMode === "bank" ? selectedBank || null : null,
          client_name: selectedParty?.name || passengers[0]?.name || null,
          trip_type: service === "Ticket" ? tripType : null,
          origin: service === "Ticket" ? origin : null,
          destination: service === "Ticket" ? destination : null,
          airline: service === "Ticket" ? airline : null,
        },
        p_notes: serviceDetailsSummary || null,
      });

      if (error) {
        throw new Error(error.message || "Database rejected booking invoice save");
      }
      if (data && data.success === false) {
        throw new Error(data.error || "Failed to save booking invoice");
      }

      await invalidateAllFinancialQueries(queryClient, currentAgencyId || agency?.id);

      const assignedInvoiceNo = data?.invoice_no || invoiceNo;
      toast.success("Booking Invoice created successfully");

      if (downloadConfirmation) {
        generateBookingConfirmationPdf(getPdfData(assignedInvoiceNo));
      }
      if (downloadInvoice) {
        generateBookingInvoicePdf(getPdfData(assignedInvoiceNo));
      }

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(`Could not save: ${err.message || "Failed to save booking invoice"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDirty = useMemo(() => {
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
        passengers.some((p) => p.name.trim() || (p.passport && p.passport.trim()))
    );
  }, [partyId, vendorId, pnr, ticketNo, airline, notes, clientAmtNum, vendorPayNum, amountPaidNum, passengers]);

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
        {/* HEADER: Title, Auto Invoice # badge, Close (X is standard from DialogContent) */}
        <div className="px-5 py-2.5 border-b flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-blue-600" />
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
              New Booking Invoice
            </DialogTitle>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border text-xs font-mono font-bold text-slate-700 dark:text-slate-200" data-nav-skip="true">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Invoice #:</span>
            <CopyValue value={autoInvoiceNo} label="invoice number" className="text-blue-600 dark:text-blue-400" />
            <Badge variant="secondary" className="text-[9px] px-1 h-3.5 ml-0.5">
              Auto
            </Badge>
          </div>
        </div>

        {/* BODY + FOOTER wrapped in ref for keyboard navigation */}
        <div ref={formRef} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-2.5">
          {/* TOP ROW: Date (Locked), Service Type, Client, Vendor, + Trip Type / Ziyarat inline */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 items-start">
            {/* 1. Locked Transaction Date */}
            <LockedDateField
              label="Date"
              value={invoiceDate}
              onChange={setInvoiceDate}
              required
            />

            {/* 2. Service Type */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Service Type <span className="text-red-500">*</span>
              </Label>
              <ServiceTypeSelect
                value={service}
                onChange={setService}
                className="h-8 text-xs"
              />
            </div>

            {/* 3. Client (with + Quick Add) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Client <span className="text-red-500">*</span>
                </Label>
                <button
                  type="button"
                  data-quick-add-btn="true"
                  onClick={() => setIsAddClientOpen(true)}
                  className="text-[10px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-0.5 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  <Plus className="w-2.5 h-2.5" /> Quick Add
                </button>
              </div>
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
            </div>

            {/* 4. Vendor (with + Quick Add) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Vendor
                </Label>
                <button
                  type="button"
                  data-quick-add-btn="true"
                  onClick={() => setIsAddVendorOpen(true)}
                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-0.5 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Plus className="w-2.5 h-2.5" /> Quick Add
                </button>
              </div>
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
          {/* MONEY: One single row with Profit Preview badge */}
          <div className="pt-1 border-t space-y-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 items-end">
              {/* Purchasing Cost */}
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Purchasing Cost
                </Label>
                <Input
                  type="number"
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
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0"
                  className="h-8 text-xs font-mono font-bold text-right mt-0.5"
                  required
                  data-required-positive="true"
                  data-required-message="Total amount must be greater than zero"
                />
              </div>

              {/* Amount Paid */}
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Amount Paid
                </Label>
                <Input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0"
                  className="h-8 text-xs font-mono font-bold text-teal-600 dark:text-teal-400 text-right mt-0.5"
                />
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
                  value={`PKR ${remainingAmountNum.toLocaleString()}`}
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

              {/* Payment Mode */}
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

              {/* Agency Bank Select inline when Bank is selected */}
              {paymentMode === "bank" && (
                <div>
                  <AgencyBankSelect
                    value={selectedBank}
                    onChange={setSelectedBank}
                    label="Bank Account"
                    required={true}
                  />
                </div>
              )}

              {/* Profit Preview Badge */}
              <div className="flex flex-col justify-end">
                <div className="h-8 px-2 flex items-center justify-between rounded bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-[11px]">
                  <span className="text-[10px] text-teal-800 dark:text-teal-300 flex items-center gap-0.5 font-medium">
                    <TrendingUp className="w-3 h-3" /> Profit:
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      liveProfit >= 0
                        ? "text-teal-700 dark:text-teal-300"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {liveProfit.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* NOTES: Single-line input labelled "Remarks" (grows if user types more) */}
          <div className="pt-1 border-t">
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
        </div>

        {/* FOOTER: Only Cancel and Save */}
        <div className="px-5 py-2.5 border-t bg-gray-50 dark:bg-slate-900/60 flex items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            tabIndex={-1}
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            data-save-button="true"
            disabled={isSubmitting}
            onClick={() => handleSave(false, false)}
            className="h-8 text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer min-w-[90px] focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1"
          >
            {isSubmitting ? "Saving..." : "Save"}
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
