import React, { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText,
  FileCheck,
  Plus,
  Trash2,
  TrendingUp,
  Plane,
  Building,
  Shield,
  FileSpreadsheet,
  Compass,
  UserPlus,
  Calendar,
  Lock,
  Layers,
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

  // Row 1: Primary Service & Client/Vendor
  const [service, setService] = useState<ServiceType>("Ticket");
  const [partyId, setPartyId] = useState<string>("");
  const [vendorId, setVendorId] = useState<string>("");
  const [contactNumber, setContactNumber] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );

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
  const [ziyaratIncluded, setZiyaratIncluded] = useState(true);

  // C. Other services (Visa, Insurance, Hotel, Other)
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

  // Booking Notes
  const [notes, setNotes] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute Auto Next Invoice Number on Open
  useEffect(() => {
    async function fetchNextInvoiceNo() {
      try {
        const { data } = await (supabase as any)
          .from("invoices")
          .select("invoice_number")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.invoice_number) {
          const match = data.invoice_number.match(/(\d+)/);
          if (match) {
            const nextVal = parseInt(match[1], 10) + 1;
            setAutoInvoiceNo(`INV-${nextVal}`);
            return;
          }
        }
        // Fallback default
        setAutoInvoiceNo(`INV-${Math.floor(1000 + Math.random() * 9000)}`);
      } catch {
        setAutoInvoiceNo(`INV-${Math.floor(1000 + Math.random() * 9000)}`);
      }
    }

    if (open) {
      fetchNextInvoiceNo();
    }
  }, [open]);

  // Filter clients and vendors from parties
  const clientsList = useMemo(
    () => parties.filter((p) => p.type === "client" || p.type === "both"),
    [parties]
  );
  const vendorsList = useMemo(
    () => parties.filter((p) => p.type === "vendor" || p.type === "both"),
    [parties]
  );

  // Sync phone/email when client is selected
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

  // PDF Data generator
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
    if (!partyId && !passengers[0]?.name.trim()) {
      toast.error("Please select a client or enter a passenger name");
      return;
    }

    if (clientAmtNum <= 0) {
      toast.error("Total amount must be greater than zero");
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
        p_vendor_id: vendorId || null,
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

      toast.success("Booking Invoice created successfully");

      // PDF downloads
      const pdfData = getPdfData(invoiceNo);
      if (downloadConfirmation) {
        generateBookingConfirmationPdf(pdfData);
      }
      if (downloadInvoice) {
        generateBookingInvoicePdf(pdfData);
      }

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to save booking invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh] flex flex-col overflow-hidden p-0 gap-0 bg-background border rounded-xl shadow-2xl">
        {/* 1. Header with Locked Auto Invoice Number & PDF Buttons */}
        <div className="px-6 py-3 border-b flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                New Booking Invoice
              </DialogTitle>
            </div>

            {/* Read-Only Auto Invoice Number */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-md border text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Invoice #:</span>
              <span className="text-blue-600 dark:text-blue-400">{autoInvoiceNo}</span>
              <Badge variant="secondary" className="text-[9px] px-1 h-4 ml-1">
                Auto
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => generateBookingConfirmationPdf(getPdfData(autoInvoiceNo))}
              className="text-xs h-8 gap-1.5 font-medium cursor-pointer"
            >
              <FileCheck className="w-3.5 h-3.5 text-teal-600" />
              Confirmation PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => generateBookingInvoicePdf(getPdfData(autoInvoiceNo))}
              className="text-xs h-8 gap-1.5 font-medium cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Invoice PDF
            </Button>
          </div>
        </div>

        {/* 2. Flexible Form Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          {/* Row 1: Equal Columns (Service Type, Client + Quick Add, Vendor + Quick Add, Contact Number, Email) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Row 1: Primary Service & Parties
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 w-full items-end">
              {/* Service Type */}
              <div>
                <Label className="text-xs font-semibold">
                  Service Type <span className="text-red-500">*</span>
                </Label>
                <Select value={service} onValueChange={(val: any) => setService(val)}>
                  <SelectTrigger className="h-9 text-xs mt-1">
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

              {/* Client with + Quick Add */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Client (Party) <span className="text-red-500">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={() => setIsAddClientOpen(true)}
                    className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Quick Add
                  </button>
                </div>
                <Select value={partyId} onValueChange={handleClientSelect}>
                  <SelectTrigger className="h-9 text-xs mt-1">
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

              {/* Vendor with + Quick Add */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Vendor (Supplier)</Label>
                  <button
                    type="button"
                    onClick={() => setIsAddVendorOpen(true)}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Quick Add
                  </button>
                </div>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger className="h-9 text-xs mt-1">
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

              {/* Contact Number */}
              <div>
                <Label className="text-xs font-semibold">Contact Number</Label>
                <Input
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. 0300-1234567"
                  className="h-9 text-xs mt-1"
                />
              </div>

              {/* Email */}
              <div>
                <Label className="text-xs font-semibold">Email Address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="h-9 text-xs mt-1"
                />
              </div>
            </div>
          </div>

          {/* ==================== DYNAMIC SERVICE SECTION ==================== */}

          {/* A. Air Ticket Details */}
          {service === "Ticket" && (
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Plane className="w-4 h-4 text-blue-600" />
                  Air Ticket Flight Details
                </span>

                {/* Trip Type Segmented */}
                <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-lg border text-xs">
                  {(["One Way", "Return", "Multicity"] as TripType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTripType(t)}
                      className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                        tripType === t
                          ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Flight Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 w-full items-end">
                <div>
                  <Label className="text-xs font-semibold">Flight Date</Label>
                  <Input
                    type="date"
                    value={flightDate}
                    onChange={(e) => setFlightDate(e.target.value)}
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Flight Time</Label>
                  <Input
                    type="time"
                    value={flightTime}
                    onChange={(e) => setFlightTime(e.target.value)}
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Destination (Sector)</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <Input
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                      placeholder="Origin (KHI)"
                      className="h-9 text-xs font-mono uppercase w-20"
                    />
                    <span className="text-xs text-muted-foreground">→</span>
                    <Input
                      value={destination}
                      onChange={(e) => setDestination(e.target.value.toUpperCase())}
                      placeholder="Dest (DXB)"
                      className="h-9 text-xs font-mono uppercase flex-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Airline</Label>
                  <Input
                    value={airline}
                    onChange={(e) => setAirline(e.target.value)}
                    placeholder="e.g. Emirates / PIA"
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">PNR Code</Label>
                  <Input
                    value={pnr}
                    onChange={(e) => setPnr(e.target.value.toUpperCase())}
                    placeholder="PNR (e.g. ABC123)"
                    className="h-9 text-xs font-mono uppercase mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Ticket Number</Label>
                  <Input
                    value={ticketNo}
                    onChange={(e) => setTicketNo(e.target.value)}
                    placeholder="e.g. 214-89765432"
                    className="h-9 text-xs font-mono mt-1"
                  />
                </div>
              </div>

              {/* If Return Trip */}
              {tripType === "Return" && (
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900/40 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-blue-900 dark:text-blue-300">
                      Return Flight Date
                    </Label>
                    <Input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-blue-900 dark:text-blue-300">
                      Return Flight Time
                    </Label>
                    <Input
                      type="time"
                      value={returnTime}
                      onChange={(e) => setReturnTime(e.target.value)}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                </div>
              )}

              {/* If Multicity Trip */}
              {tripType === "Multicity" && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Additional Flight Legs</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAddMulticityLeg}
                      className="h-7 text-xs text-blue-600 gap-1 px-2"
                    >
                      <Plus className="w-3 h-3" /> Add Leg
                    </Button>
                  </div>

                  {multicityLegs.map((leg, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-background p-2 rounded-lg border">
                      <span className="text-xs font-bold text-muted-foreground w-6 text-center">
                        #{idx + 2}
                      </span>
                      <Input
                        value={leg.from}
                        onChange={(e) => handleLegChange(idx, "from", e.target.value.toUpperCase())}
                        placeholder="From"
                        className="h-8 text-xs font-mono uppercase w-20"
                      />
                      <Input
                        value={leg.to}
                        onChange={(e) => handleLegChange(idx, "to", e.target.value.toUpperCase())}
                        placeholder="To"
                        className="h-8 text-xs font-mono uppercase w-20"
                      />
                      <Input
                        type="date"
                        value={leg.date}
                        onChange={(e) => handleLegChange(idx, "date", e.target.value)}
                        className="h-8 text-xs flex-1"
                      />
                      <Input
                        value={leg.airline}
                        onChange={(e) => handleLegChange(idx, "airline", e.target.value)}
                        placeholder="Airline"
                        className="h-8 text-xs w-28"
                      />
                      <Input
                        value={leg.pnr}
                        onChange={(e) => handleLegChange(idx, "pnr", e.target.value.toUpperCase())}
                        placeholder="Leg PNR"
                        className="h-8 text-xs font-mono uppercase w-24"
                      />
                      {multicityLegs.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMulticityLeg(idx)}
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* B. Umrah Details */}
          {service === "Umrah" && (
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-teal-600" />
                  Umrah Package Details
                </span>

                {/* Ziyarat Included Toggle */}
                <div className="flex items-center gap-2 bg-teal-50 dark:bg-teal-950/40 px-3 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800">
                  <Label className="text-xs font-bold text-teal-900 dark:text-teal-200 cursor-pointer">
                    Ziyarat Included
                  </Label>
                  <Switch
                    checked={ziyaratIncluded}
                    onCheckedChange={setZiyaratIncluded}
                  />
                </div>
              </div>

              {/* Flights & Transport */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 w-full items-end">
                <div>
                  <Label className="text-xs font-semibold">Departure City</Label>
                  <Input
                    value={umrahDepartureCity}
                    onChange={(e) => setUmrahDepartureCity(e.target.value)}
                    placeholder="e.g. Karachi"
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Arrival City</Label>
                  <Input
                    value={umrahArrivalCity}
                    onChange={(e) => setUmrahArrivalCity(e.target.value)}
                    placeholder="e.g. Jeddah"
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Airline</Label>
                  <Input
                    value={umrahAirline}
                    onChange={(e) => setUmrahAirline(e.target.value)}
                    placeholder="e.g. Saudia"
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Flight Date/Time</Label>
                  <div className="flex gap-1 mt-1">
                    <Input
                      type="date"
                      value={umrahFlightDate}
                      onChange={(e) => setUmrahFlightDate(e.target.value)}
                      className="h-9 text-xs flex-1"
                    />
                    <Input
                      type="time"
                      value={umrahFlightTime}
                      onChange={(e) => setUmrahFlightTime(e.target.value)}
                      className="h-9 text-xs w-20"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Return Date/Time</Label>
                  <div className="flex gap-1 mt-1">
                    <Input
                      type="date"
                      value={umrahReturnDate}
                      onChange={(e) => setUmrahReturnDate(e.target.value)}
                      className="h-9 text-xs flex-1"
                    />
                    <Input
                      type="time"
                      value={umrahReturnTime}
                      onChange={(e) => setUmrahReturnTime(e.target.value)}
                      className="h-9 text-xs w-20"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Transport</Label>
                  <Select value={umrahTransport} onValueChange={setUmrahTransport}>
                    <SelectTrigger className="h-9 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Shared Bus">Shared Bus</SelectItem>
                      <SelectItem value="Private Car / GMC">Private Car / GMC</SelectItem>
                      <SelectItem value="Haramain High-Speed Train">Haramain Train</SelectItem>
                      <SelectItem value="Self Arranged">Self Arranged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Hotels: Makkah & Madinah */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 w-full items-end pt-2 border-t">
                <div className="md:col-span-1">
                  <Label className="text-xs font-semibold">Makkah Hotel Name</Label>
                  <Input
                    value={makkahHotel}
                    onChange={(e) => setMakkahHotel(e.target.value)}
                    placeholder="e.g. Pullman Zamzam Makkah"
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Makkah Nights</Label>
                  <Input
                    type="number"
                    value={makkahNights}
                    onChange={(e) => setMakkahNights(e.target.value)}
                    placeholder="7"
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div className="md:col-span-1">
                  <Label className="text-xs font-semibold">Madinah Hotel Name</Label>
                  <Input
                    value={madinahHotel}
                    onChange={(e) => setMadinahHotel(e.target.value)}
                    placeholder="e.g. Anwar Al Madinah Movenpick"
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Madinah Nights</Label>
                  <Input
                    type="number"
                    value={madinahNights}
                    onChange={(e) => setMadinahNights(e.target.value)}
                    placeholder="7"
                    className="h-9 text-xs mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* C. Other Services (Visa, Hotel, Insurance, Other) */}
          {service !== "Ticket" && service !== "Umrah" && (
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-600" />
                {service} Service Information
              </span>

              {service === "Visa" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                  <div>
                    <Label className="text-xs font-semibold">Country</Label>
                    <Input
                      value={visaCountry}
                      onChange={(e) => setVisaCountry(e.target.value)}
                      placeholder="e.g. Saudi Arabia / UAE"
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Visa Type</Label>
                    <Input
                      value={visaType}
                      onChange={(e) => setVisaType(e.target.value)}
                      placeholder="e.g. Tourist / 1 Year Multiple"
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Validity / Duration</Label>
                    <Input
                      value={visaValidity}
                      onChange={(e) => setVisaValidity(e.target.value)}
                      placeholder="e.g. 30 Days / 90 Days"
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                </div>
              )}

              {service === "Hotel" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 w-full">
                  <div>
                    <Label className="text-xs font-semibold">Hotel Name</Label>
                    <Input
                      value={hotelName}
                      onChange={(e) => setHotelName(e.target.value)}
                      placeholder="Hotel Name"
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">City</Label>
                    <Input
                      value={hotelCity}
                      onChange={(e) => setHotelCity(e.target.value)}
                      placeholder="City"
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Check-In</Label>
                    <Input
                      type="date"
                      value={hotelCheckIn}
                      onChange={(e) => setHotelCheckIn(e.target.value)}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Check-Out</Label>
                    <Input
                      type="date"
                      value={hotelCheckOut}
                      onChange={(e) => setHotelCheckOut(e.target.value)}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Room Type</Label>
                    <Input
                      value={hotelRoomType}
                      onChange={(e) => setHotelRoomType(e.target.value)}
                      placeholder="e.g. Deluxe Double"
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                </div>
              )}

              {service === "Insurance" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                  <div>
                    <Label className="text-xs font-semibold">Insurance Plan / Provider</Label>
                    <Input
                      value={insurancePlan}
                      onChange={(e) => setInsurancePlan(e.target.value)}
                      placeholder="e.g. EFU / Jubilee Travel Insurance"
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Duration (Days)</Label>
                    <Input
                      value={insuranceDuration}
                      onChange={(e) => setInsuranceDuration(e.target.value)}
                      placeholder="e.g. 30"
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                </div>
              )}

              {service === "Other" && (
                <div>
                  <Label className="text-xs font-semibold">Service Description / Particulars</Label>
                  <Input
                    value={generalDescription}
                    onChange={(e) => setGeneralDescription(e.target.value)}
                    placeholder="Describe custom travel or concierge service..."
                    className="h-9 text-xs mt-1"
                  />
                </div>
              )}
            </div>
          )}

          {/* ==================== PASSENGERS TABLE (ALL SERVICES) ==================== */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Passengers ({passengers.length})
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddPassenger}
                className="text-xs h-7 text-teal-600 dark:text-teal-400 gap-1 px-2.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Passenger
              </Button>
            </div>

            <div className="space-y-2.5">
              {passengers.map((pax, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2 bg-background p-2.5 rounded-lg border items-center"
                >
                  <span className="md:col-span-1 text-xs font-mono font-bold text-slate-400 text-center">
                    #{idx + 1}
                  </span>

                  {/* Name */}
                  <div className="md:col-span-3">
                    <Input
                      value={pax.name}
                      onChange={(e) => handlePassengerChange(idx, "name", e.target.value)}
                      placeholder="Full Name as on Passport"
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Passport */}
                  <div className="md:col-span-2">
                    <Input
                      value={pax.passport || ""}
                      onChange={(e) =>
                        handlePassengerChange(idx, "passport", e.target.value.toUpperCase())
                      }
                      placeholder="Passport #"
                      className="h-8 text-xs font-mono uppercase"
                    />
                  </div>

                  {/* Category */}
                  <div className="md:col-span-2">
                    <Select
                      value={pax.type || "Adult"}
                      onValueChange={(val: any) => handlePassengerChange(idx, "type", val)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Adult">Adult</SelectItem>
                        <SelectItem value="Child">Child</SelectItem>
                        <SelectItem value="Infant">Infant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Gender */}
                  <div className="md:col-span-1">
                    <Select
                      value={pax.gender || "Male"}
                      onValueChange={(val: any) => handlePassengerChange(idx, "gender", val)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">M</SelectItem>
                        <SelectItem value="Female">F</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date of Birth */}
                  <div className="md:col-span-2">
                    <Input
                      type="date"
                      value={pax.dob || ""}
                      onChange={(e) => handlePassengerChange(idx, "dob", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Remove Button */}
                  <div className="md:col-span-1 flex justify-center">
                    {passengers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemovePassenger(idx)}
                        className="h-8 w-8 text-slate-400 hover:text-red-500 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ==================== MONEY SECTION (ONE CLEAN ROW, EQUAL COLUMNS) ==================== */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Financials & Settlement Breakdown
              </span>

              {/* Profit Preview */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800">
                <span className="text-xs font-semibold text-teal-800 dark:text-teal-300 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Profit Preview:
                </span>
                <span
                  className={`text-sm font-bold font-mono ${
                    liveProfit >= 0
                      ? "text-teal-700 dark:text-teal-300"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  PKR {liveProfit.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Money Row: Equal 6 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 w-full items-end">
              {/* Purchasing Cost (Vendor Payable) */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Purchasing Cost (PKR)
                </Label>
                <Input
                  type="number"
                  value={vendorPayable}
                  onChange={(e) => setVendorPayable(e.target.value)}
                  placeholder="0"
                  className="h-9 text-xs font-mono text-right mt-1"
                />
              </div>

              {/* Total Amount (Client Pays) */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Total Amount (PKR) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0"
                  className="h-9 text-xs font-mono font-bold text-right mt-1"
                  required
                />
              </div>

              {/* Amount Paid by Client */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Amount Paid (PKR)
                </Label>
                <Input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0"
                  className="h-9 text-xs font-mono font-bold text-teal-600 dark:text-teal-400 text-right mt-1"
                />
              </div>

              {/* Remaining Amount (Auto-Calculated, Read-Only) */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Remaining Amount (PKR)
                </Label>
                <Input
                  type="text"
                  readOnly
                  value={`PKR ${remainingAmountNum.toLocaleString()}`}
                  className="h-9 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 text-right mt-1 cursor-not-allowed"
                />
              </div>

              {/* Remaining Payment Due Date */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Remaining Due Date
                </Label>
                <Input
                  type="date"
                  value={remainingDueDate}
                  onChange={(e) => setRemainingDueDate(e.target.value)}
                  className="h-9 text-xs mt-1"
                />
              </div>

              {/* Payment Mode */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Payment Mode
                </Label>
                <Select value={paymentMode} onValueChange={(val: any) => setPaymentMode(val)}>
                  <SelectTrigger className="h-9 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash in Hand</SelectItem>
                    <SelectItem value="bank">Bank Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ==================== BOOKING NOTES & REMARKS ==================== */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Booking Notes & Remarks
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Itinerary remarks, hotel room info, meal preferences, special passenger requests..."
              className="w-full min-h-[75px] max-h-[120px] text-xs resize-none"
            />
          </div>
        </div>

        {/* 3. Pinned Bottom Footer */}
        <div className="px-6 py-3.5 border-t bg-gray-50 dark:bg-slate-900/60 flex items-center justify-end gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            onClick={() => handleSave(true, false)}
            className="text-xs cursor-pointer"
          >
            Save & Confirmation
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting}
            onClick={() => handleSave(false, true)}
            className="text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer min-w-[170px]"
          >
            {isSubmitting ? "Saving..." : "Save & Download Invoice"}
          </Button>
        </div>

        {/* Quick Add Popups */}
        <AddPartyDialog
          open={isAddClientOpen}
          onOpenChange={setIsAddClientOpen}
          initialType="client"
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
          onSaved={(newParty: Party) => {
            setVendorId(newParty.id);
            toast.success(`Vendor ${newParty.name} added and selected`);
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
