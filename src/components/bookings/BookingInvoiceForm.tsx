import React, { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AddPartyDialog } from "@/components/parties/AddPartyDialog";
import { useParties, Party } from "@/hooks/useParties";
import { generateBookingConfirmationPdf, generateBookingInvoicePdf, BookingPdfData } from "@/lib/pdf/bookingInvoicePdf";
import { useAgency } from "@/hooks/useAgency";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { useQueryClient } from "@tanstack/react-query";
import { LockedDateField } from "@/components/ui/LockedDateField";
import { UniversalPartySelect } from "@/components/parties/UniversalPartySelect";
import { AgencyBankSelect } from "@/components/banks/AgencyBankSelect";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CopyValue } from "@/components/ui/CopyValue";
import { cleanPastedSearch } from "@/lib/searchUtils";
import {
  FileText,
  Plus,
  Trash2,
  TrendingUp,
  Lock,
} from "lucide-react";

export type ServiceType = "Ticket" | "Umrah" | "Visa" | "Insurance" | "Hotel" | "Other";
export type TripType = "One Way" | "Return" | "Multicity";

interface Passenger {
  name: string;
  passport?: string;
  ticketNo?: string;
  type?: "Adult" | "Child" | "Infant";
  gender?: "Male" | "Female" | "Other";
  dob?: string;
  nationality?: string;
}

interface FlightLeg {
  from: string;
  to: string;
  date: string;
  time: string;
  airline: string;
  pnr: string;
}

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

  // Read-only auto invoice number
  const [autoInvoiceNo, setAutoInvoiceNo] = useState<string>("INV-1001");

  // Top Row: Date, Service Type, Client, Vendor
  const [invoiceDate, setInvoiceDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [service, setService] = useState<ServiceType>("Ticket");
  const [partyId, setPartyId] = useState<string>("");
  const [vendorId, setVendorId] = useState<string>("");
  const [contactNumber, setContactNumber] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  // Quick Add Party Popups
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);

  // ==================== Service-Specific State ====================

  // A. Air Ticket
  const [tripType, setTripType] = useState<TripType>("One Way");
  const [origin, setOrigin] = useState("KHI");
  const [destination, setDestination] = useState("DXB");
  const [flightDate, setFlightDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [flightTime, setFlightTime] = useState("");
  const [airline, setAirline] = useState("");
  const [pnr, setPnr] = useState("");
  const [ticketNo, setTicketNo] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [multicityLegs, setMulticityLegs] = useState<FlightLeg[]>([
    { from: "", to: "", date: "", time: "", airline: "", pnr: "" },
  ]);

  // B. Umrah
  const [ziyaratIncluded, setZiyaratIncluded] = useState(true);
  const [umrahDepartureCity, setUmrahDepartureCity] = useState("Karachi");
  const [umrahArrivalCity, setUmrahArrivalCity] = useState("Jeddah");
  const [umrahAirline, setUmrahAirline] = useState("Saudia");
  const [umrahFlightDate, setUmrahFlightDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [umrahFlightTime, setUmrahFlightTime] = useState("");
  const [umrahReturnDate, setUmrahReturnDate] = useState("");
  const [umrahReturnTime, setUmrahReturnTime] = useState("");
  const [umrahTransport, setUmrahTransport] = useState("Shared Bus");
  const [makkahHotel, setMakkahHotel] = useState("");
  const [makkahNights, setMakkahNights] = useState("7");
  const [madinahHotel, setMadinahHotel] = useState("");
  const [madinahNights, setMadinahNights] = useState("7");

  // C. Other services (Visa, Hotel, Insurance, Other)
  const [visaCountry, setVisaCountry] = useState("Saudi Arabia");
  const [visaType, setVisaType] = useState("Tourist / E-Visa");
  const [visaValidity, setVisaValidity] = useState("30 Days");

  const [insurancePlan, setInsurancePlan] = useState("Standard Travel Care");
  const [insuranceDuration, setInsuranceDuration] = useState("30");

  const [hotelName, setHotelName] = useState("");
  const [hotelCity, setHotelCity] = useState("");
  const [hotelCheckIn, setHotelCheckIn] = useState(() => new Date().toISOString().slice(0, 10));
  const [hotelCheckOut, setHotelCheckOut] = useState("");
  const [hotelRoomType, setHotelRoomType] = useState("Standard Double");

  const [generalDescription, setGeneralDescription] = useState("");

  // ==================== Passengers (All Services) ====================
  const [passengers, setPassengers] = useState<Passenger[]>([
    { name: "", passport: "", type: "Adult", gender: "Male", dob: "", nationality: "Pakistani" },
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

  // Passenger Handlers
  const handleAddPassenger = () => {
    setPassengers((prev) => [
      ...prev,
      { name: "", passport: "", type: "Adult", gender: "Male", dob: "", nationality: "Pakistani" },
    ]);
  };

  const handleRemovePassenger = (index: number) => {
    if (passengers.length === 1) return;
    setPassengers((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePassengerChange = (index: number, field: keyof Passenger, value: string) => {
    setPassengers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Multicity Legs Handlers
  const handleAddMulticityLeg = () => {
    setMulticityLegs((prev) => [
      ...prev,
      { from: "", to: "", date: "", time: "", airline: "", pnr: "" },
    ]);
  };

  const handleRemoveMulticityLeg = (index: number) => {
    if (multicityLegs.length === 1) return;
    setMulticityLegs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLegChange = (index: number, field: keyof FlightLeg, value: string) => {
    setMulticityLegs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

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

    setIsSubmitting(true);
    const invoiceNo = autoInvoiceNo || `INV-${Date.now().toString().slice(-6)}`;

    try {
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

      // 1. Save Booking Invoice Record
      const { data, error } = await (supabase as any).rpc("save_booking_invoice", {
        p_invoice_no: invoiceNo,
        p_service: service,
        p_party_id: partyId || null,
        p_vendor_id: vendorId && vendorId !== "none" ? vendorId : null,
        p_client_amount: clientAmtNum,
        p_vendor_payable: vendorPayNum,
        p_invoice_date: invoiceDate,
        p_pnr: pnr || null,
        p_ticket_no: ticketNo || null,
        p_passport_no: passengers[0]?.passport || null,
        p_passengers: passengers,
        p_currency: "PKR",
        p_notes: serviceDetailsSummary || null,
      });

      if (error) {
        // Fallback: save to clients and invoices table
        const { data: newClient } = await (supabase as any)
          .from("clients")
          .insert({
            name: selectedParty?.name || passengers[0]?.name,
            contact_number: contactNumber || selectedParty?.phone,
            travel_type: service === "Ticket" ? "Ticket" : service === "Umrah" ? "Umrah" : "Other",
            selling_price: clientAmtNum,
            purchasing_price: vendorPayNum,
            amount_paid: amountPaidNum,
            payment_status: remainingAmountNum <= 0 ? "Paid" : amountPaidNum > 0 ? "Partial" : "Pending",
            pnr: pnr || null,
            passport_number: passengers[0]?.passport || null,
            flight_date: flightDate || invoiceDate,
          })
          .select("id")
          .maybeSingle();

        if (newClient?.id) {
          await (supabase as any).from("invoices").insert({
            invoice_number: invoiceNo,
            client_id: newClient.id,
            invoice_date: invoiceDate,
            amount: clientAmtNum,
            amount_paid: amountPaidNum,
            balance_due: remainingAmountNum,
            item_description: serviceDetailsSummary || service,
          });
        }
      }

      // 2. Automatically create linked payment entry if client paid any amount at booking
      if (amountPaidNum > 0) {
        try {
          await (supabase as any).rpc("record_payment", {
            p_direction: "in",
            p_amount: amountPaidNum,
            p_account_id: null,
            p_party_id: partyId || null,
            p_party_type: "client",
            p_date: invoiceDate,
            p_method: paymentMode,
            p_reference_no: `INV-PMT-${invoiceNo}`,
            p_notes: `Initial payment at booking for ${invoiceNo}`,
          });
        } catch (pmtErr) {
          console.warn("Could not post automatic payment entry via RPC:", pmtErr);
        }
      }

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-6xl max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0 bg-background border rounded-xl shadow-2xl">
        {/* HEADER: Title, Auto Invoice # badge, Close (X is standard from DialogContent) */}
        <div className="px-5 py-2.5 border-b flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-blue-600" />
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
              New Booking Invoice
            </DialogTitle>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Invoice #:</span>
            <CopyValue value={autoInvoiceNo} label="invoice number" className="text-blue-600 dark:text-blue-400" />
            <Badge variant="secondary" className="text-[9px] px-1 h-3.5 ml-0.5">
              Auto
            </Badge>
          </div>
        </div>

        {/* BODY: One flat form, tight grid, fits on one screen with light scroll if needed */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-2.5">
          {/* TOP ROW: Date, Service Type, Client, Vendor, + Trip Type / Ziyarat inline */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 items-end">
            {/* 1. Date (FIRST, default today, editable) */}
            <div>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="h-8 text-xs mt-0.5"
                required
              />
            </div>

            {/* 2. Service Type */}
            <div>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Service Type <span className="text-red-500">*</span>
              </Label>
              <Select value={service} onValueChange={(val: any) => setService(val)}>
                <SelectTrigger className="h-8 text-xs mt-0.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ticket">Air Ticket</SelectItem>
                  <SelectItem value="Umrah">Umrah Package</SelectItem>
                  <SelectItem value="Visa">Visa Services</SelectItem>
                  <SelectItem value="Hotel">Hotel Booking</SelectItem>
                  <SelectItem value="Insurance">Travel Insurance</SelectItem>
                  <SelectItem value="Other">Other Services</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 3. Client (with + Quick Add) */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Client <span className="text-red-500">*</span>
                </Label>
                <button
                  type="button"
                  onClick={() => setIsAddClientOpen(true)}
                  className="text-[10px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" /> Quick Add
                </button>
              </div>
              <Select value={partyId} onValueChange={handleClientSelect}>
                <SelectTrigger className="h-8 text-xs mt-0.5">
                  <SelectValue placeholder="Select Client" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {clientsList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.code ? `(${c.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 4. Vendor (with + Quick Add) */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Vendor
                </Label>
                <button
                  type="button"
                  onClick={() => setIsAddVendorOpen(true)}
                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" /> Quick Add
                </button>
              </div>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger className="h-8 text-xs mt-0.5">
                  <SelectValue placeholder="Direct / None" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="none">Direct / None</SelectItem>
                  {vendorsList.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Service-Specific Top Row Field */}
            {service === "Ticket" ? (
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Trip Type
                </Label>
                <Select value={tripType} onValueChange={(val: any) => setTripType(val)}>
                  <SelectTrigger className="h-8 text-xs mt-0.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="One Way">One Way</SelectItem>
                    <SelectItem value="Return">Return</SelectItem>
                    <SelectItem value="Multicity">Multicity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : service === "Umrah" ? (
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Ziyarat
                </Label>
                <div className="flex items-center justify-between h-8 px-2.5 bg-background border rounded-md mt-0.5">
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    {ziyaratIncluded ? "Included" : "Excluded"}
                  </span>
                  <Switch
                    checked={ziyaratIncluded}
                    onCheckedChange={setZiyaratIncluded}
                    className="scale-75 origin-right"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* SERVICE-SPECIFIC FIELDS */}
          {service === "Ticket" && (
            <div className="space-y-1.5 pt-0.5">
              {/* Row: Flight Date, Time, Sector (KHI -> DXB), Airline, PNR, Ticket No */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 items-end">
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Flight Date
                  </Label>
                  <Input
                    type="date"
                    value={flightDate}
                    onChange={(e) => setFlightDate(e.target.value)}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Flight Time
                  </Label>
                  <Input
                    type="time"
                    value={flightTime}
                    onChange={(e) => setFlightTime(e.target.value)}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Sector
                  </Label>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Input
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                      placeholder="KHI"
                      className="h-8 text-xs font-mono uppercase w-14 px-1.5 text-center"
                    />
                    <span className="text-xs text-muted-foreground">→</span>
                    <Input
                      value={destination}
                      onChange={(e) => setDestination(e.target.value.toUpperCase())}
                      placeholder="DXB"
                      className="h-8 text-xs font-mono uppercase flex-1 px-1.5 text-center"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Airline
                  </Label>
                  <Input
                    value={airline}
                    onChange={(e) => setAirline(e.target.value)}
                    placeholder="e.g. PIA / Emirates"
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    PNR
                  </Label>
                  <Input
                    value={pnr}
                    onChange={(e) => setPnr(e.target.value.toUpperCase())}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData("text");
                      if (pasted) {
                        e.preventDefault();
                        setPnr(cleanPastedSearch(pasted).toUpperCase());
                      }
                    }}
                    placeholder="PNR Code"
                    className="h-8 text-xs font-mono uppercase mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Ticket No
                  </Label>
                  <Input
                    value={ticketNo}
                    onChange={(e) => setTicketNo(e.target.value)}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData("text");
                      if (pasted) {
                        e.preventDefault();
                        setTicketNo(cleanPastedSearch(pasted));
                      }
                    }}
                    placeholder="214-89765432"
                    className="h-8 text-xs font-mono mt-0.5"
                  />
                </div>
              </div>

              {/* Show return date & time only for Return */}
              {tripType === "Return" && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end bg-blue-50/40 dark:bg-blue-950/20 p-2 rounded border border-blue-100 dark:border-blue-900/40">
                  <div>
                    <Label className="text-[11px] font-semibold text-blue-900 dark:text-blue-300">
                      Return Flight Date
                    </Label>
                    <Input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="h-8 text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-blue-900 dark:text-blue-300">
                      Return Flight Time
                    </Label>
                    <Input
                      type="time"
                      value={returnTime}
                      onChange={(e) => setReturnTime(e.target.value)}
                      className="h-8 text-xs mt-0.5"
                    />
                  </div>
                </div>
              )}

              {/* Extra sector rows only for Multicity */}
              {tripType === "Multicity" && (
                <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/40 p-2 rounded border">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Multicity Additional Sectors
                    </span>
                    <button
                      type="button"
                      onClick={handleAddMulticityLeg}
                      className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-2.5 h-2.5" /> Add Sector
                    </button>
                  </div>
                  {multicityLegs.map((leg, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-muted-foreground w-4 text-center">
                        #{idx + 2}
                      </span>
                      <Input
                        value={leg.from}
                        onChange={(e) => handleLegChange(idx, "from", e.target.value.toUpperCase())}
                        placeholder="From"
                        className="h-7 text-xs font-mono uppercase w-16"
                      />
                      <Input
                        value={leg.to}
                        onChange={(e) => handleLegChange(idx, "to", e.target.value.toUpperCase())}
                        placeholder="To"
                        className="h-7 text-xs font-mono uppercase w-16"
                      />
                      <Input
                        type="date"
                        value={leg.date}
                        onChange={(e) => handleLegChange(idx, "date", e.target.value)}
                        className="h-7 text-xs w-32"
                      />
                      <Input
                        value={leg.airline}
                        onChange={(e) => handleLegChange(idx, "airline", e.target.value)}
                        placeholder="Airline"
                        className="h-7 text-xs flex-1"
                      />
                      <Input
                        value={leg.pnr}
                        onChange={(e) => handleLegChange(idx, "pnr", e.target.value.toUpperCase())}
                        placeholder="PNR"
                        className="h-7 text-xs font-mono uppercase w-20"
                      />
                      {multicityLegs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMulticityLeg(idx)}
                          className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Umrah Package Fields: 2 compact rows */}
          {service === "Umrah" && (
            <div className="space-y-2 pt-0.5">
              {/* Row 1: Departure, Arrival, Airline, Flight Date, Flight Time, Return Date, Return Time, Transport */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 items-end">
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Departure City
                  </Label>
                  <Input
                    value={umrahDepartureCity}
                    onChange={(e) => setUmrahDepartureCity(e.target.value)}
                    placeholder="Karachi"
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Arrival City
                  </Label>
                  <Input
                    value={umrahArrivalCity}
                    onChange={(e) => setUmrahArrivalCity(e.target.value)}
                    placeholder="Jeddah"
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Airline
                  </Label>
                  <Input
                    value={umrahAirline}
                    onChange={(e) => setUmrahAirline(e.target.value)}
                    placeholder="Saudia"
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Flight Date
                  </Label>
                  <Input
                    type="date"
                    value={umrahFlightDate}
                    onChange={(e) => setUmrahFlightDate(e.target.value)}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Flight Time
                  </Label>
                  <Input
                    type="time"
                    value={umrahFlightTime}
                    onChange={(e) => setUmrahFlightTime(e.target.value)}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Return Date
                  </Label>
                  <Input
                    type="date"
                    value={umrahReturnDate}
                    onChange={(e) => setUmrahReturnDate(e.target.value)}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Return Time
                  </Label>
                  <Input
                    type="time"
                    value={umrahReturnTime}
                    onChange={(e) => setUmrahReturnTime(e.target.value)}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Transport
                  </Label>
                  <Select value={umrahTransport} onValueChange={setUmrahTransport}>
                    <SelectTrigger className="h-8 text-xs mt-0.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Shared Bus">Shared Bus</SelectItem>
                      <SelectItem value="Private Car / GMC">Private GMC</SelectItem>
                      <SelectItem value="Haramain High-Speed Train">Haramain Train</SelectItem>
                      <SelectItem value="Self Arranged">Self Arranged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Makkah Hotel, Nights, Madinah Hotel, Nights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Makkah Hotel
                  </Label>
                  <Input
                    value={makkahHotel}
                    onChange={(e) => setMakkahHotel(e.target.value)}
                    placeholder="e.g. Pullman Zamzam"
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Makkah Nights
                  </Label>
                  <Input
                    type="number"
                    value={makkahNights}
                    onChange={(e) => setMakkahNights(e.target.value)}
                    placeholder="7"
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Madinah Hotel
                  </Label>
                  <Input
                    value={madinahHotel}
                    onChange={(e) => setMadinahHotel(e.target.value)}
                    placeholder="e.g. Anwar Al Madinah"
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Madinah Nights
                  </Label>
                  <Input
                    type="number"
                    value={madinahNights}
                    onChange={(e) => setMadinahNights(e.target.value)}
                    placeholder="7"
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Visa Services: Country, Visa Type, Validity in one row */}
          {service === "Visa" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end pt-0.5">
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Country
                </Label>
                <Input
                  value={visaCountry}
                  onChange={(e) => setVisaCountry(e.target.value)}
                  placeholder="e.g. Saudi Arabia / UAE"
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Visa Type
                </Label>
                <Input
                  value={visaType}
                  onChange={(e) => setVisaType(e.target.value)}
                  placeholder="Tourist / E-Visa / 1 Year"
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Validity
                </Label>
                <Input
                  value={visaValidity}
                  onChange={(e) => setVisaValidity(e.target.value)}
                  placeholder="30 Days / 90 Days"
                  className="h-8 text-xs mt-0.5"
                />
              </div>
            </div>
          )}

          {/* Hotel Booking */}
          {service === "Hotel" && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end pt-0.5">
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Hotel Name
                </Label>
                <Input
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                  placeholder="Hotel Name"
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  City
                </Label>
                <Input
                  value={hotelCity}
                  onChange={(e) => setHotelCity(e.target.value)}
                  placeholder="City"
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Check-In
                </Label>
                <Input
                  type="date"
                  value={hotelCheckIn}
                  onChange={(e) => setHotelCheckIn(e.target.value)}
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Check-Out
                </Label>
                <Input
                  type="date"
                  value={hotelCheckOut}
                  onChange={(e) => setHotelCheckOut(e.target.value)}
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Room Type
                </Label>
                <Input
                  value={hotelRoomType}
                  onChange={(e) => setHotelRoomType(e.target.value)}
                  placeholder="Deluxe Double"
                  className="h-8 text-xs mt-0.5"
                />
              </div>
            </div>
          )}

          {/* Travel Insurance */}
          {service === "Insurance" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end pt-0.5">
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Insurance Provider / Plan
                </Label>
                <Input
                  value={insurancePlan}
                  onChange={(e) => setInsurancePlan(e.target.value)}
                  placeholder="EFU / Jubilee Travel Care"
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Duration (Days)
                </Label>
                <Input
                  value={insuranceDuration}
                  onChange={(e) => setInsuranceDuration(e.target.value)}
                  placeholder="30"
                  className="h-8 text-xs mt-0.5"
                />
              </div>
            </div>
          )}

          {/* Other Services */}
          {service === "Other" && (
            <div className="pt-0.5">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Service Description
              </Label>
              <Input
                value={generalDescription}
                onChange={(e) => setGeneralDescription(e.target.value)}
                placeholder="Describe custom service particulars..."
                className="h-8 text-xs mt-0.5"
              />
            </div>
          )}

          {/* PASSENGERS: Inline, compact, no heading box */}
          <div className="space-y-1 pt-1 border-t">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Passengers ({passengers.length})
              </span>
              <button
                type="button"
                onClick={handleAddPassenger}
                className="text-[10px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="w-2.5 h-2.5" /> Add Passenger
              </button>
            </div>

            <div className="space-y-1">
              {passengers.map((pax, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold text-slate-400 w-4 text-center">
                    #{idx + 1}
                  </span>
                  <Input
                    value={pax.name}
                    onChange={(e) => handlePassengerChange(idx, "name", e.target.value)}
                    placeholder="Passenger Name"
                    className="h-7 text-xs flex-1"
                  />
                  <Input
                    value={pax.passport || ""}
                    onChange={(e) => handlePassengerChange(idx, "passport", e.target.value.toUpperCase())}
                    placeholder="Passport #"
                    className="h-7 text-xs font-mono uppercase w-28"
                  />
                  <Select
                    value={pax.type || "Adult"}
                    onValueChange={(val: any) => handlePassengerChange(idx, "type", val)}
                  >
                    <SelectTrigger className="h-7 text-xs w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Adult">Adult</SelectItem>
                      <SelectItem value="Child">Child</SelectItem>
                      <SelectItem value="Infant">Infant</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={pax.gender || "Male"}
                    onValueChange={(val: any) => handlePassengerChange(idx, "gender", val)}
                  >
                    <SelectTrigger className="h-7 text-xs w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">M</SelectItem>
                      <SelectItem value="Female">F</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={pax.dob || ""}
                    onChange={(e) => handlePassengerChange(idx, "dob", e.target.value)}
                    className="h-7 text-xs w-32"
                  />
                  {passengers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePassenger(idx)}
                      className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

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
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting}
            onClick={() => handleSave(false, false)}
            className="h-8 text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer min-w-[90px]"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </div>

        {/* Quick Add Popups */}
        <AddPartyDialog
          open={isAddClientOpen}
          onOpenChange={setIsAddClientOpen}
          initialType="client"
          lockType={true}
          onSaved={(newParty: Party) => {
            setPartyId(newParty.id);
            if (newParty.phone) setContactNumber(newParty.phone);
            if (newParty.email) setEmail(newParty.email);
            toast.success(`Client ${newParty.name} added and selected`);
          }}
        />

        <AddPartyDialog
          open={isAddVendorOpen}
          onOpenChange={setIsAddVendorOpen}
          initialType="vendor"
          lockType={true}
          onSaved={(newParty: Party) => {
            setVendorId(newParty.id);
            toast.success(`Vendor ${newParty.name} added and selected`);
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
