import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Calendar, FileText, User, Plane, Building2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useClients } from "@/hooks/useStorage";
import { useB2BAgents } from "@/hooks/useB2BAgents";
import type { Voucher, VoucherType, VoucherStatus, VoucherPassenger } from "@/types/voucher";

interface CreateVoucherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voucherToEdit?: Voucher | null;
  initialBookingData?: any | null; // For auto-fill when triggered from booking dialog
  onSave: (voucher: any) => Promise<any>;
}

export function CreateVoucherDialog({
  open,
  onOpenChange,
  voucherToEdit,
  initialBookingData,
  onSave,
}: CreateVoucherDialogProps) {
  const { clients = [] } = useClients();
  const { agents = [] } = useB2BAgents();

  const [voucherType, setVoucherType] = useState<VoucherType>("Umrah");
  const [status, setStatus] = useState<VoucherStatus>("Issued");
  const [passengerName, setPassengerName] = useState("");
  const [passengerPassport, setPassengerPassport] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("none");
  const [bookingId, setBookingId] = useState<string>("");

  // Additional passengers
  const [passengers, setPassengers] = useState<VoucherPassenger[]>([]);

  // Umrah & Hotel fields
  const [packageName, setPackageName] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [city, setCity] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [nights, setNights] = useState<number>(0);
  const [roomType, setRoomType] = useState("Standard Room");
  const [numberOfRooms, setNumberOfRooms] = useState<number>(1);
  const [mealPlan, setMealPlan] = useState("Room Only");
  const [hotelConfirmationCode, setHotelConfirmationCode] = useState("");
  const [transportDetails, setTransportDetails] = useState("");
  const [ziyaratDetails, setZiyaratDetails] = useState("");
  const [visaStatus, setVisaStatus] = useState("Approved / Issued");

  // Umrah specific dual hotels
  const [makkahHotel, setMakkahHotel] = useState("");
  const [makkahCheckIn, setMakkahCheckIn] = useState("");
  const [makkahCheckOut, setMakkahCheckOut] = useState("");
  const [makkahNights, setMakkahNights] = useState<number>(0);

  const [madinahHotel, setMadinahHotel] = useState("");
  const [madinahCheckIn, setMadinahCheckIn] = useState("");
  const [madinahCheckOut, setMadinahCheckOut] = useState("");
  const [madinahNights, setMadinahNights] = useState<number>(0);

  // Ticket fields
  const [airline, setAirline] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [sector, setSector] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [flightClass, setFlightClass] = useState("Economy");
  const [baggage, setBaggage] = useState("30 KG");
  const [pnr, setPnr] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");

  const [remarks, setRemarks] = useState("");
  const [terms, setTerms] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing voucher or initial booking data
  useEffect(() => {
    if (voucherToEdit) {
      setVoucherType(voucherToEdit.voucher_type);
      setStatus(voucherToEdit.status);
      setPassengerName(voucherToEdit.passenger_name || "");
      setPassengerPassport(voucherToEdit.passenger_passport || "");
      setContactNumber(voucherToEdit.contact_number || "");
      setSelectedAgentId(voucherToEdit.agent_id || "none");
      setBookingId(voucherToEdit.booking_id || "");
      setPassengers(voucherToEdit.passengers || []);

      setPackageName(voucherToEdit.package_name || "");
      setHotelName(voucherToEdit.hotel_name || "");
      setCity(voucherToEdit.city || "");
      setCheckIn(voucherToEdit.check_in || "");
      setCheckOut(voucherToEdit.check_out || "");
      setNights(voucherToEdit.nights || 0);
      setRoomType(voucherToEdit.room_type || "Standard Room");
      setNumberOfRooms(voucherToEdit.number_of_rooms || 1);
      setMealPlan(voucherToEdit.meal_plan || "Room Only");
      setHotelConfirmationCode(voucherToEdit.hotel_confirmation_code || "");
      setTransportDetails(voucherToEdit.transport_details || "");
      setZiyaratDetails(voucherToEdit.ziyarat_details || "");
      setVisaStatus(voucherToEdit.visa_status || "Approved / Issued");

      setMakkahHotel(voucherToEdit.makkah_hotel || "");
      setMakkahCheckIn(voucherToEdit.makkah_check_in || "");
      setMakkahCheckOut(voucherToEdit.makkah_check_out || "");
      setMakkahNights(voucherToEdit.makkah_nights || 0);

      setMadinahHotel(voucherToEdit.madinah_hotel || "");
      setMadinahCheckIn(voucherToEdit.madinah_check_in || "");
      setMadinahCheckOut(voucherToEdit.madinah_check_out || "");
      setMadinahNights(voucherToEdit.madinah_nights || 0);

      setAirline(voucherToEdit.airline || "");
      setFlightNumber(voucherToEdit.flight_number || "");
      setSector(voucherToEdit.sector || "");
      setDepartureDate(voucherToEdit.departure_date ? voucherToEdit.departure_date.slice(0, 16) : "");
      setArrivalDate(voucherToEdit.arrival_date ? voucherToEdit.arrival_date.slice(0, 16) : "");
      setFlightClass(voucherToEdit.flight_class || "Economy");
      setBaggage(voucherToEdit.baggage || "30 KG");
      setPnr(voucherToEdit.pnr || "");
      setTicketNumber(voucherToEdit.ticket_number || "");

      setRemarks(voucherToEdit.remarks || "");
      setTerms(voucherToEdit.terms_and_conditions || "");
    } else if (initialBookingData) {
      applyBookingAutofill(initialBookingData);
    } else {
      resetForm();
    }
  }, [voucherToEdit, initialBookingData, open]);

  const resetForm = () => {
    setVoucherType("Umrah");
    setStatus("Issued");
    setPassengerName("");
    setPassengerPassport("");
    setContactNumber("");
    setSelectedAgentId("none");
    setBookingId("");
    setPassengers([]);

    setPackageName("");
    setHotelName("");
    setCity("");
    setCheckIn("");
    setCheckOut("");
    setNights(0);
    setRoomType("Standard Room");
    setNumberOfRooms(1);
    setMealPlan("Room Only");
    setHotelConfirmationCode("");
    setTransportDetails("");
    setZiyaratDetails("");
    setVisaStatus("Approved / Issued");

    setMakkahHotel("");
    setMakkahCheckIn("");
    setMakkahCheckOut("");
    setMakkahNights(0);

    setMadinahHotel("");
    setMadinahCheckIn("");
    setMadinahCheckOut("");
    setMadinahNights(0);

    setAirline("");
    setFlightNumber("");
    setSector("");
    setDepartureDate("");
    setArrivalDate("");
    setFlightClass("Economy");
    setBaggage("30 KG");
    setPnr("");
    setTicketNumber("");

    setRemarks("");
    setTerms("");
  };

  const applyBookingAutofill = (booking: any) => {
    const pName = booking.name || booking.passenger_name || booking.client_name || "";
    const pPassport = booking.passport_number || booking.passenger_passport || "";
    const pContact = booking.contact_number || booking.passenger_contact || "";
    const pPnr = booking.pnr || "";
    const pAirline = booking.airline || "";
    const pDestination = booking.destination || "";
    const pDate = booking.flight_date || booking.travelDate || "";

    setPassengerName(pName);
    setPassengerPassport(pPassport);
    setContactNumber(pContact);
    setPnr(pPnr);
    setAirline(pAirline);
    setBookingId(booking.id || "");

    if (booking.agent_id) {
      setSelectedAgentId(booking.agent_id);
    }

    // Determine type from booking
    const travelType = (booking.travel_type || booking.service_type || "").toLowerCase();
    if (travelType.includes("umrah")) {
      setVoucherType("Umrah");
      setPackageName(booking.package_name || "Umrah Package");
      setMakkahHotel(booking.makkah_hotel || "Makkah Hotel");
      setMadinahHotel(booking.madinah_hotel || "Madinah Hotel");
      setTransportDetails("Complete Jeddah - Makkah - Madinah - Airport transfers");
      setZiyaratDetails("Makkah & Madinah Ziyarat included");
    } else if (travelType.includes("hotel")) {
      setVoucherType("Hotel");
      setHotelName(pDestination || "Hotel");
      setCity(pDestination || "");
    } else {
      setVoucherType("Ticket");
      setSector(pDestination ? `Departure - ${pDestination}` : "");
      if (pDate) {
        setDepartureDate(`${pDate}T10:00`);
      }
    }

    toast.success("Autofilled from booking!");
  };

  const addPassenger = () => {
    setPassengers([...passengers, { name: "", passport: "", type: "Adult", ticket_number: "" }]);
  };

  const updatePassenger = (index: number, field: keyof VoucherPassenger, value: string) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };

  const removePassenger = (index: number) => {
    setPassengers(passengers.filter((_, i) => i !== index));
  };

  // Auto-calculate hotel nights
  useEffect(() => {
    if (checkIn && checkOut) {
      const d1 = new Date(checkIn);
      const d2 = new Date(checkOut);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) setNights(diffDays);
    }
  }, [checkIn, checkOut]);

  // Auto-calculate Makkah nights
  useEffect(() => {
    if (makkahCheckIn && makkahCheckOut) {
      const d1 = new Date(makkahCheckIn);
      const d2 = new Date(makkahCheckOut);
      const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 0) setMakkahNights(diff);
    }
  }, [makkahCheckIn, makkahCheckOut]);

  // Auto-calculate Madinah nights
  useEffect(() => {
    if (madinahCheckIn && madinahCheckOut) {
      const d1 = new Date(madinahCheckIn);
      const d2 = new Date(madinahCheckOut);
      const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 0) setMadinahNights(diff);
    }
  }, [madinahCheckIn, madinahCheckOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passengerName.trim()) {
      toast.error("Please enter the Lead Passenger Name");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        voucher_type: voucherType,
        status,
        passenger_name: passengerName.trim(),
        passenger_passport: passengerPassport.trim() || null,
        contact_number: contactNumber.trim() || null,
        agent_id: selectedAgentId !== "none" ? selectedAgentId : null,
        booking_id: bookingId || null,
        passengers: passengers.filter((p) => p.name.trim().length > 0),

        remarks: remarks.trim() || null,
        terms_and_conditions: terms.trim() || null,
      };

      if (voucherType === "Umrah") {
        payload.package_name = packageName.trim() || null;
        payload.makkah_hotel = makkahHotel.trim() || null;
        payload.makkah_check_in = makkahCheckIn || null;
        payload.makkah_check_out = makkahCheckOut || null;
        payload.makkah_nights = makkahNights || null;

        payload.madinah_hotel = madinahHotel.trim() || null;
        payload.madinah_check_in = madinahCheckIn || null;
        payload.madinah_check_out = madinahCheckOut || null;
        payload.madinah_nights = madinahNights || null;

        payload.room_type = roomType || null;
        payload.number_of_rooms = numberOfRooms || 1;
        payload.meal_plan = mealPlan || null;
        payload.hotel_confirmation_code = hotelConfirmationCode.trim() || null;
        payload.transport_details = transportDetails.trim() || null;
        payload.ziyarat_details = ziyaratDetails.trim() || null;
        payload.visa_status = visaStatus || null;
      } else if (voucherType === "Hotel") {
        payload.hotel_name = hotelName.trim() || null;
        payload.city = city.trim() || null;
        payload.check_in = checkIn || null;
        payload.check_out = checkOut || null;
        payload.nights = nights || null;
        payload.room_type = roomType || null;
        payload.number_of_rooms = numberOfRooms || 1;
        payload.meal_plan = mealPlan || null;
        payload.hotel_confirmation_code = hotelConfirmationCode.trim() || null;
      } else if (voucherType === "Ticket") {
        payload.airline = airline.trim() || null;
        payload.flight_number = flightNumber.trim() || null;
        payload.sector = sector.trim() || null;
        payload.departure_date = departureDate ? new Date(departureDate).toISOString() : null;
        payload.arrival_date = arrivalDate ? new Date(arrivalDate).toISOString() : null;
        payload.flight_class = flightClass || "Economy";
        payload.baggage = baggage.trim() || null;
        payload.pnr = pnr.trim() || null;
        payload.ticket_number = ticketNumber.trim() || null;
      }

      if (voucherToEdit) {
        await onSave({ id: voucherToEdit.id, ...payload });
      } else {
        await onSave(payload);
      }

      onOpenChange(false);
    } catch (err: any) {
      console.error("Voucher submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {voucherToEdit ? `Edit Voucher (${voucherToEdit.voucher_number})` : "Create New Voucher"}
          </DialogTitle>
          <DialogDescription>
            Generate branded Umrah, Hotel, or Airline ticket vouchers with auto-fill and instant PDF export.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Voucher Type Tabs */}
          {!voucherToEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Voucher Type
              </Label>
              <Tabs
                value={voucherType}
                onValueChange={(val) => setVoucherType(val as VoucherType)}
                className="w-full"
              >
                <TabsList className="grid grid-cols-3 w-full h-11">
                  <TabsTrigger value="Umrah" className="gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Umrah Package
                  </TabsTrigger>
                  <TabsTrigger value="Hotel" className="gap-2">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    Hotel Only
                  </TabsTrigger>
                  <TabsTrigger value="Ticket" className="gap-2">
                    <Plane className="w-4 h-4 text-emerald-500" />
                    Flight / Ticket
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* Quick Auto-fill from Existing Booking */}
          {!voucherToEdit && clients.length > 0 && (
            <div className="bg-muted/40 p-3 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs">
                <p className="font-semibold text-foreground">Auto-fill from Booking</p>
                <p className="text-muted-foreground">Select an existing client booking to populate details automatically</p>
              </div>
              <Select
                onValueChange={(val) => {
                  const b = clients.find((c: any) => c.id === val);
                  if (b) applyBookingAutofill(b);
                }}
              >
                <SelectTrigger className="w-full sm:w-[220px] h-9 text-xs">
                  <SelectValue placeholder="Choose booking..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {clients.slice(0, 30).map((c: any) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name || "Client"} {c.pnr ? `(PNR: ${c.pnr})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status & Agent Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Voucher Status</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as VoucherStatus)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Issued">Issued (Active)</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">B2B Agent (Optional)</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Direct Client (No Agent)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Direct Client (No Agent)</SelectItem>
                  {agents.map((ag: any) => (
                    <SelectItem key={ag.id} value={ag.id} className="text-xs">
                      {ag.agency_name} ({ag.contact_person})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lead Passenger & Contact */}
          <Card className="p-3.5 space-y-3 bg-card/60 border">
            <div className="flex items-center gap-2 pb-1 border-b">
              <User className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Lead Guest / Passenger Details
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Lead Passenger Name *</Label>
                <Input
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  placeholder="e.g. Muhammad Usman"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Passport Number</Label>
                <Input
                  value={passengerPassport}
                  onChange={(e) => setPassengerPassport(e.target.value)}
                  placeholder="e.g. AB1234567"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Contact Number</Label>
                <Input
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. +92 300 1234567"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Additional Passengers */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-muted-foreground">
                  Additional Passengers ({passengers.length})
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPassenger}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add Passenger
                </Button>
              </div>

              {passengers.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="Full Name"
                    value={p.name}
                    onChange={(e) => updatePassenger(idx, "name", e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <Input
                    placeholder="Passport #"
                    value={p.passport || ""}
                    onChange={(e) => updatePassenger(idx, "passport", e.target.value)}
                    className="h-8 text-xs w-28"
                  />
                  <Select
                    value={p.type || "Adult"}
                    onValueChange={(val: any) => updatePassenger(idx, "type", val)}
                  >
                    <SelectTrigger className="h-8 text-xs w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Adult">Adult</SelectItem>
                      <SelectItem value="Child">Child</SelectItem>
                      <SelectItem value="Infant">Infant</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePassenger(idx)}
                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          {/* VOUCHER TYPE: UMRAH */}
          {voucherType === "Umrah" && (
            <Card className="p-3.5 space-y-4 bg-card/60 border">
              <div className="flex items-center gap-2 pb-1 border-b">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Umrah Package & Dual Hotels
                </h4>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Package / Group Name</Label>
                <Input
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="e.g. 15 Days Premium Umrah Package"
                  className="h-9 text-xs"
                />
              </div>

              {/* Makkah Hotel */}
              <div className="p-3 rounded-lg bg-muted/30 border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">🕋 Makkah Hotel</span>
                  <span className="text-[11px] text-muted-foreground">{makkahNights} Night(s)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    placeholder="Makkah Hotel Name"
                    value={makkahHotel}
                    onChange={(e) => setMakkahHotel(e.target.value)}
                    className="h-8 text-xs sm:col-span-1"
                  />
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Check-in</Label>
                    <Input
                      type="date"
                      value={makkahCheckIn}
                      onChange={(e) => setMakkahCheckIn(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Check-out</Label>
                    <Input
                      type="date"
                      value={makkahCheckOut}
                      onChange={(e) => setMakkahCheckOut(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Madinah Hotel */}
              <div className="p-3 rounded-lg bg-muted/30 border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">🕌 Madinah Hotel</span>
                  <span className="text-[11px] text-muted-foreground">{madinahNights} Night(s)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    placeholder="Madinah Hotel Name"
                    value={madinahHotel}
                    onChange={(e) => setMadinahHotel(e.target.value)}
                    className="h-8 text-xs sm:col-span-1"
                  />
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Check-in</Label>
                    <Input
                      type="date"
                      value={madinahCheckIn}
                      onChange={(e) => setMadinahCheckIn(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Check-out</Label>
                    <Input
                      type="date"
                      value={madinahCheckOut}
                      onChange={(e) => setMadinahCheckOut(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Room & Service Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <Label className="text-[11px]">Room Type</Label>
                  <Input
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    placeholder="Quad / Triple / Double"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">No. of Rooms</Label>
                  <Input
                    type="number"
                    min="1"
                    value={numberOfRooms}
                    onChange={(e) => setNumberOfRooms(parseInt(e.target.value) || 1)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Meal Plan</Label>
                  <Input
                    value={mealPlan}
                    onChange={(e) => setMealPlan(e.target.value)}
                    placeholder="Room Only / Breakfast"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Confirmation Code</Label>
                  <Input
                    value={hotelConfirmationCode}
                    onChange={(e) => setHotelConfirmationCode(e.target.value)}
                    placeholder="e.g. MK-88291"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-[11px]">Transport Details</Label>
                  <Input
                    value={transportDetails}
                    onChange={(e) => setTransportDetails(e.target.value)}
                    placeholder="Private GMC / Coaster / Train"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Ziyarat Details</Label>
                  <Input
                    value={ziyaratDetails}
                    onChange={(e) => setZiyaratDetails(e.target.value)}
                    placeholder="Makkah & Madinah Ziyarat included"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Visa Status</Label>
                  <Input
                    value={visaStatus}
                    onChange={(e) => setVisaStatus(e.target.value)}
                    placeholder="Approved / Issued"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </Card>
          )}

          {/* VOUCHER TYPE: HOTEL ONLY */}
          {voucherType === "Hotel" && (
            <Card className="p-3.5 space-y-3 bg-card/60 border">
              <div className="flex items-center gap-2 pb-1 border-b">
                <Building2 className="w-4 h-4 text-blue-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Hotel Accommodation Details
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Hotel Name *</Label>
                  <Input
                    value={hotelName}
                    onChange={(e) => setHotelName(e.target.value)}
                    placeholder="e.g. Swissotel Al Maqam"
                    className="h-9 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">City / Destination</Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Makkah / Dubai / Istanbul"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Check-in Date</Label>
                  <Input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Check-out Date</Label>
                  <Input
                    type="date"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nights</Label>
                  <Input
                    type="number"
                    min="0"
                    value={nights}
                    onChange={(e) => setNights(parseInt(e.target.value) || 0)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <Label className="text-[11px]">Room Type</Label>
                  <Input
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    placeholder="Deluxe Double"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">No. of Rooms</Label>
                  <Input
                    type="number"
                    min="1"
                    value={numberOfRooms}
                    onChange={(e) => setNumberOfRooms(parseInt(e.target.value) || 1)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Meal Plan</Label>
                  <Input
                    value={mealPlan}
                    onChange={(e) => setMealPlan(e.target.value)}
                    placeholder="Breakfast Included"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Confirmation Code</Label>
                  <Input
                    value={hotelConfirmationCode}
                    onChange={(e) => setHotelConfirmationCode(e.target.value)}
                    placeholder="e.g. HTL-99201"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </Card>
          )}

          {/* VOUCHER TYPE: TICKET */}
          {voucherType === "Ticket" && (
            <Card className="p-3.5 space-y-3 bg-card/60 border">
              <div className="flex items-center gap-2 pb-1 border-b">
                <Plane className="w-4 h-4 text-emerald-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Flight & Ticket Details
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Airline</Label>
                  <Input
                    value={airline}
                    onChange={(e) => setAirline(e.target.value)}
                    placeholder="e.g. Saudia / PIA / Emirates"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Flight Number</Label>
                  <Input
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value)}
                    placeholder="e.g. SV-735"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Sector / Route</Label>
                  <Input
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    placeholder="e.g. LHE - JED - LHE"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Departure Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Arrival Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <Label className="text-[11px]">PNR / Booking Ref</Label>
                  <Input
                    value={pnr}
                    onChange={(e) => setPnr(e.target.value.toUpperCase())}
                    placeholder="e.g. 6QW8KL"
                    className="h-8 text-xs uppercase"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Ticket Number</Label>
                  <Input
                    value={ticketNumber}
                    onChange={(e) => setTicketNumber(e.target.value)}
                    placeholder="065-2819283718"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Cabin Class</Label>
                  <Input
                    value={flightClass}
                    onChange={(e) => setFlightClass(e.target.value)}
                    placeholder="Economy / Business"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Baggage Allowance</Label>
                  <Input
                    value={baggage}
                    onChange={(e) => setBaggage(e.target.value)}
                    placeholder="2 Pieces (23kg each)"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Remarks & Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Special Remarks / Instructions</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Breakfast included, transfer representative will meet at gate 4..."
                className="text-xs h-20"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Custom Terms & Conditions (Optional)</Label>
              <Textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Leave blank to use agency standard terms & conditions."
                className="text-xs h-20"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="font-semibold gap-2">
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  {voucherToEdit ? "Update Voucher" : "Issue Voucher"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
