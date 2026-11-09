import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useB2BBookings, B2BBooking } from "@/hooks/useB2BBookings";
import { B2BAgent } from "@/hooks/useB2BAgents";
import { useVendors } from "@/hooks/useStorage";
import { useAgency } from "@/hooks/useAgency";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plane, User, CreditCard, Building2, Plus, Store, Search, Filter, Maximize2, Minimize2, FileText, Hotel, Car, Wrench, Calendar, Banknote, Trash2, Clock, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PaymentModeSelect } from "@/components/PaymentModeSelect";
import { ScanAutofillButton } from "@/components/ai/ScanAutofillButton";
import { BulkScanAutofillButton } from "@/components/ai/BulkScanAutofillButton";

interface AddB2BBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: B2BAgent;
  editBooking?: B2BBooking | null;
}

// Helper to parse structured package data from notes
const parsePackageData = (notes: string | null) => {
  if (!notes) return null;
  try {
    if (notes.startsWith('{')) {
      let depth = 0;
      let endIndex = -1;
      for (let i = 0; i < notes.length; i++) {
        if (notes[i] === '{') depth++;
        else if (notes[i] === '}') { depth--; if (depth === 0) { endIndex = i + 1; break; } }
      }
      if (endIndex > 0) return JSON.parse(notes.substring(0, endIndex));
    }
  } catch {
    return null;
  }
  return null;
};

export function AddB2BBookingDialog({ open, onOpenChange, agent, editBooking }: AddB2BBookingDialogProps) {
  const [loading, setLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showQuickVendorAdd, setShowQuickVendorAdd] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState(editBooking?.vendor_id || "none");
  const [vendorSearchOpen, setVendorSearchOpen] = useState(false);
  const [vendorSearchTerm, setVendorSearchTerm] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");
  const [newlyAddedVendor, setNewlyAddedVendor] = useState<any>(null);
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(editBooking?.selling_price || 0);

  // Service type and trip type states
  const [serviceType, setServiceType] = useState<string>("Ticket");
  const [tripType, setTripType] = useState<'one_way' | 'return' | 'multi_city'>('one_way');
  const [transportIncluded, setTransportIncluded] = useState(false);
  const [customServiceName, setCustomServiceName] = useState<string>("");

  // Flight time states
  const [outboundFlightTime, setOutboundFlightTime] = useState("");
  const [returnFlightTime, setReturnFlightTime] = useState("");

  // Multi-city segments state
  const [multiCitySegments, setMultiCitySegments] = useState<Array<{
    departure_city: string; arrival_city: string; flight_date: string; flight_time: string; airline: string; flight_number: string;
  }>>([{ departure_city: '', arrival_city: '', flight_date: '', flight_time: '', airline: '', flight_number: '' }]);

  // Payment mode states
  const [paymentMode, setPaymentMode] = useState<string>("cash");
  const [bankName, setBankName] = useState<string>("");

  // Derived states for conditional rendering
  const isTicketService = serviceType === "Ticket";
  const isReturnTicket = serviceType === "Ticket" && tripType === 'return';
  const isMultiCity = serviceType === "Ticket" && tripType === 'multi_city';
  const isUmrah = serviceType === "Umrah";
  const isCustomService = serviceType === "Custom";

  // Multi-city segment helpers
  const addSegment = () => {
    if (multiCitySegments.length >= 6) return;
    setMultiCitySegments([...multiCitySegments, { departure_city: '', arrival_city: '', flight_date: '', flight_time: '', airline: '', flight_number: '' }]);
  };
  const removeSegment = (idx: number) => {
    if (multiCitySegments.length <= 1) return;
    setMultiCitySegments(multiCitySegments.filter((_, i) => i !== idx));
  };
  const updateSegment = (idx: number, field: string, value: string) => {
    const updated = [...multiCitySegments];
    updated[idx] = { ...updated[idx], [field]: value };
    setMultiCitySegments(updated);
  };

  // Common custom service options
  const customServiceOptions = [
    { value: "Hotel", label: "Hotel Booking", icon: "🏨" },
    { value: "Transport", label: "Transport", icon: "🚗" },
    { value: "Visa", label: "Visa Processing", icon: "📋" },
    { value: "Insurance", label: "Travel Insurance", icon: "🛡️" },
    { value: "Tour Package", label: "Tour Package", icon: "🗺️" },
    { value: "Car Rental", label: "Car Rental", icon: "🚙" },
    { value: "Airport Transfer", label: "Airport Transfer", icon: "✈️" },
    { value: "Other", label: "Other Service", icon: "📦" },
  ];

  const { addBooking, updateBooking } = useB2BBookings(agent.id);
  const { vendors, addVendor } = useVendors();
  const { data: agency } = useAgency();
  const quickVendorFormRef = useRef<HTMLFormElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const applyScan = (f: Record<string, any>) => {
    const form = formRef.current;
    if (!form) return;
    const setVal = (name: string, val: any) => {
      if (val === undefined || val === null || val === "") return;
      const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
      if (el) {
        const setter = Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')?.set;
        setter?.call(el, String(val));
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    setVal("passenger_name", f.full_name || f.passenger_name);
    setVal("passenger_passport", f.passport_number || f.document_number);
    setVal("passenger_contact", f.contact || f.phone);
    setVal("pnr", f.pnr);
    setVal("airline", f.airline);
    setVal("flight_date", f.date || f.departure_date);
    setVal("destination", f.destination || f.arrival_city);
  };

  // Combine vendors list with newly added vendor for immediate display
  const allVendors = useMemo(() => {
    if (newlyAddedVendor && !vendors.find(v => v.id === newlyAddedVendor.id)) {
      return [newlyAddedVendor, ...vendors];
    }
    return vendors;
  }, [vendors, newlyAddedVendor]);

  // Get unique service types for filtering
  const serviceTypes = useMemo(() => {
    const types = new Set(allVendors.map(v => v.service_type).filter(Boolean));
    return Array.from(types).sort();
  }, [allVendors]);

  // Filter vendors based on search term and service type
  const filteredVendors = useMemo(() => {
    return allVendors.filter(vendor => {
      const matchesSearch = vendorSearchTerm === "" ||
        vendor.name.toLowerCase().includes(vendorSearchTerm.toLowerCase()) ||
        vendor.service_type?.toLowerCase().includes(vendorSearchTerm.toLowerCase()) ||
        vendor.contact_person?.toLowerCase().includes(vendorSearchTerm.toLowerCase());

      const matchesServiceType = serviceTypeFilter === "all" || vendor.service_type === serviceTypeFilter;

      return matchesSearch && matchesServiceType;
    });
  }, [allVendors, vendorSearchTerm, serviceTypeFilter]);

  useEffect(() => {
    if (editBooking) {
      setSelectedVendorId(editBooking.vendor_id || "none");
      setSellingPrice(editBooking.selling_price || 0);
      setAmountReceived(0);

      const packageData = parsePackageData(editBooking.notes);
      if (packageData?.type === 'umrah_package') {
        setServiceType("Umrah");
        setTripType('one_way');
        setTransportIncluded(packageData.transport?.included || false);
        if (packageData.flights?.departure_flight_time) setOutboundFlightTime(packageData.flights.departure_flight_time);
        if (packageData.flights?.return_flight_time) setReturnFlightTime(packageData.flights.return_flight_time);
      } else if (packageData?.type === 'return_flight') {
        setServiceType("Ticket");
        setTripType('return');
        if (packageData.outbound_flight_time) setOutboundFlightTime(packageData.outbound_flight_time);
        if (packageData.return_flight_time) setReturnFlightTime(packageData.return_flight_time);
      } else if (packageData?.type === 'multi_city') {
        setServiceType("Ticket");
        setTripType('multi_city');
        if (packageData.segments?.length) setMultiCitySegments(packageData.segments);
      } else if (packageData?.type === 'custom_service') {
        setServiceType("Custom");
        setCustomServiceName(packageData.service_name || "");
      } else {
        setServiceType("Ticket");
        setTripType('one_way');
        if (packageData?.outbound_flight_time) setOutboundFlightTime(packageData.outbound_flight_time);
      }
    }
  }, [editBooking]);

  useEffect(() => {
    if (!open) {
      setNewlyAddedVendor(null);
      setSelectedVendorId("none");
      setShowQuickVendorAdd(false);
      setVendorSearchTerm("");
      setServiceTypeFilter("all");
      setAmountReceived(0);
      setSellingPrice(0);
      setServiceType("Ticket");
      setTripType('one_way');
      setTransportIncluded(false);
      setCustomServiceName("");
      setPaymentMode("cash");
      setBankName("");
      setOutboundFlightTime("");
      setReturnFlightTime("");
      setMultiCitySegments([{ departure_city: '', arrival_city: '', flight_date: '', flight_time: '', airline: '', flight_number: '' }]);
    }
  }, [open]);

  const handleQuickVendorAdd = async () => {
    if (!quickVendorFormRef.current) return;

    const formData = new FormData(quickVendorFormRef.current);
    const rawName = (formData.get("vendor_name") as string | null) || "";
    const vendorName = rawName.trim();

    if (!vendorName) {
      toast.error("Vendor name is required");
      return;
    }

    const isDuplicate = allVendors.some((v) => v.name.toLowerCase() === vendorName.toLowerCase());
    if (isDuplicate) {
      toast.error(`Vendor "${vendorName}" already exists. Please use a different name.`);
      return;
    }

    const vendorData = {
      name: vendorName,
      contact_person: (formData.get("vendor_contact_person") as string) || "",
      contact_number: (formData.get("vendor_contact_number") as string) || "",
      email: (formData.get("vendor_email") as string) || "",
      service_type: (formData.get("vendor_service_type") as string) || "",
      booking_date: null,
      payment_amount: 0,
      amount_paid: 0,
      payment_status: "Pending",
      notes: (formData.get("vendor_notes") as string) || "",
    };

    try {
      toast.loading("Adding vendor...");
      const newVendor = await addVendor.mutateAsync(vendorData);
      setNewlyAddedVendor(newVendor);
      setSelectedVendorId(newVendor.id);
      setShowQuickVendorAdd(false);
      toast.dismiss();
      toast.success(`✓ Vendor "${newVendor.name}" added and linked successfully!`);
      quickVendorFormRef.current.reset();
    } catch (error: any) {
      toast.dismiss();
      toast.error("Failed to add vendor", {
        description: error?.message || "Please try again",
      });
    }
  };

  const calculateCommission = (sellingPrice: number) => {
    if (!agent.commission_value) return 0;
    if (agent.commission_type === 'percentage') {
      return (sellingPrice * agent.commission_value) / 100;
    }
    return agent.commission_value;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const sellingPriceVal = parseFloat(formData.get("selling_price") as string) || 0;
    const purchasingPrice = parseFloat(formData.get("purchasing_price") as string) || 0;
    const commissionAmount = calculateCommission(sellingPriceVal);
    const profit = sellingPriceVal - purchasingPrice - commissionAmount;

    // Validate amount received doesn't exceed total service amount
    const totalServiceAmount = sellingPriceVal - commissionAmount;
    if (amountReceived > totalServiceAmount && !editBooking) {
      toast.error('Amount received cannot exceed outstanding amount', {
        description: `Maximum allowed: PKR ${totalServiceAmount.toLocaleString()}`
      });
      setLoading(false);
      return;
    }

    // Build structured notes based on service type
    let structuredNotes = "";
    const userNotes = (formData.get("notes") as string) || "";

    if (isUmrah) {
      const umrahPackage = {
        type: 'umrah_package',
        flights: {
          departure_city: formData.get("umrah_departure_city") as string || "",
          arrival_city: formData.get("umrah_arrival_city") as string || "",
          departure_date: formData.get("flight_date") as string || "",
          return_date: formData.get("umrah_return_date") as string || "",
          airline: formData.get("airline") as string || "",
          departure_flight_time: outboundFlightTime || "",
          return_flight_time: returnFlightTime || "",
        },
        transport: {
          included: transportIncluded,
          details: formData.get("transport_details") as string || "",
        },
        hotels: {
          makkah: {
            name: formData.get("makkah_hotel") as string || "",
            nights: parseInt(formData.get("makkah_nights") as string) || 0,
          },
          madinah: {
            name: formData.get("madinah_hotel") as string || "",
            nights: parseInt(formData.get("madinah_nights") as string) || 0,
          },
        },
      };
      structuredNotes = JSON.stringify(umrahPackage);
    } else if (isReturnTicket) {
      const returnFlight = {
        type: 'return_flight',
        outbound_flight_time: outboundFlightTime || "",
        return_from: formData.get("return_from") as string || "",
        return_to: formData.get("return_to") as string || "",
        return_date: formData.get("return_date") as string || "",
        return_pnr: formData.get("return_pnr") as string || "",
        return_flight_time: returnFlightTime || "",
      };
      structuredNotes = JSON.stringify(returnFlight);
    } else if (isMultiCity) {
      const multiCityData = {
        type: 'multi_city',
        segments: multiCitySegments.filter(s => s.departure_city || s.arrival_city),
      };
      structuredNotes = JSON.stringify(multiCityData);
    } else if (isCustomService) {
      const customService = {
        type: 'custom_service',
        service_name: customServiceName || "Custom",
        service_location: formData.get("custom_service_location") as string || "",
        start_date: formData.get("custom_start_date") as string || "",
        end_date: formData.get("custom_end_date") as string || "",
        provider: formData.get("custom_provider") as string || "",
        reference_number: formData.get("custom_reference") as string || "",
      };
      structuredNotes = JSON.stringify(customService);
    } else if (outboundFlightTime) {
      // One-way ticket with flight time
      structuredNotes = JSON.stringify({ type: 'ticket_one_way', outbound_flight_time: outboundFlightTime });
    }

    const finalNotes = structuredNotes
      ? (userNotes ? `${structuredNotes}\n\nNotes: ${userNotes}` : structuredNotes)
      : userNotes || null;

    // Determine destination based on service type
    let destination = isMultiCity
      ? (multiCitySegments.map(s => s.arrival_city).filter(Boolean).join(' → ') || null)
      : (formData.get("destination") as string || null);
    if (isUmrah) {
      destination = formData.get("umrah_arrival_city") as string || "Jeddah";
    } else if (isCustomService) {
      destination = formData.get("custom_service_location") as string || customServiceName || null;
    }

    // Determine flight_date based on service type
    let flightDate = isMultiCity
      ? (multiCitySegments[0]?.flight_date || null)
      : (formData.get("flight_date") as string || null);
    if (isCustomService) {
      flightDate = formData.get("custom_start_date") as string || null;
    }

    const bookingData = {
      agent_id: agent.id,
      vendor_id: (selectedVendorId === "none" || !selectedVendorId) ? null : selectedVendorId,
      pnr: isMultiCity ? (multiCitySegments[0]?.flight_number || null) : isCustomService ? (formData.get("custom_reference") as string) || null : (formData.get("pnr") as string) || null,
      passenger_name: formData.get("passenger_name") as string,
      passenger_passport: (formData.get("passenger_passport") as string) || null,
      passenger_contact: (formData.get("passenger_contact") as string) || null,
      destination: destination,
      airline: isMultiCity ? (multiCitySegments[0]?.airline || null) : isCustomService ? (formData.get("custom_provider") as string) || null : (formData.get("airline") as string) || null,
      flight_date: flightDate,
      purchasing_price: purchasingPrice || null,
      selling_price: sellingPriceVal || null,
      commission_amount: commissionAmount || null,
      profit: profit || null,
      booking_status: isMultiCity ? "confirmed" : (formData.get("booking_status") as string) || "confirmed",
      payment_status: (formData.get("payment_status") as string) || "pending",
      notes: finalNotes,
      amount_received: amountReceived,
      payment_mode: amountReceived > 0 ? paymentMode : null,
      bank_name: amountReceived > 0 && paymentMode === 'bank' ? bankName : null,
    };

    try {
      if (editBooking) {
        await updateBooking.mutateAsync({ id: editBooking.id, booking: bookingData });
      } else {
        await addBooking.mutateAsync(bookingData);
      }
      setLoading(false);
      onOpenChange(false);
    } catch (error) {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "enterprise-dialog overflow-hidden flex flex-col transition-all duration-300",
        isFullScreen
          ? "!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !max-w-none w-screen h-[100dvh] !rounded-none border-0"
          : "w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh]"
      )}>
        <DialogHeader className="pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="form-section-icon form-section-icon-blue">
                <Plane className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  {editBooking ? 'Edit B2B Booking' : 'Add New B2B Booking'}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground/80">
                  Booking for agent: <span className="font-medium text-foreground">{agent.agent_name}</span>
                  {agent.business_name && <span className="text-muted-foreground"> ({agent.business_name})</span>}
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="h-8 w-8 shrink-0"
              title={isFullScreen ? "Compact mode" : "Fullscreen mode"}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className={cn("flex-1 overflow-y-auto form-scroll-container", isFullScreen ? "p-6 lg:p-8" : "p-2")}>
          <div className={isFullScreen ? "max-w-6xl mx-auto space-y-6" : "space-y-4"}>

            {/* Passenger Information */}
            <Card className="form-card form-card-blue">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="form-section-icon form-section-icon-blue">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="form-section-title form-section-title-blue">Passenger Information</h3>
                      <p className="form-section-description">Enter passenger details for this booking</p>
                    </div>
                  </div>
                  <ScanAutofillButton onApply={applyScan} docType="auto" label="Scan Passport / Ticket" />
                  <BulkScanAutofillButton
                    label="Bulk Passengers"
                    onApply={(records) => {
                      const form = formRef.current;
                      if (!form || !records.length) return;
                      // Fill first passenger into main fields, add the rest to notes
                      const first = records[0];
                      const setVal = (name: string, val: any) => {
                        if (!val) return;
                        const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
                        if (!el) return;
                        const setter = Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')?.set;
                        setter?.call(el, String(val));
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                      };
                      setVal("passenger_name", first.full_name);
                      setVal("passenger_passport", first.passport_number);
                      if (records.length > 1) {
                        const lines = records.slice(1).map((r, i) => {
                          const bits = [
                            `${i + 2}. ${r.full_name || "-"}`,
                            r.passport_number && `Passport: ${r.passport_number}`,
                            r.date_of_birth && `DOB: ${r.date_of_birth}`,
                            r.nationality,
                            r.passenger_type,
                          ].filter(Boolean);
                          return bits.join(" | ");
                        }).join("\n");
                        const notesEl = form.querySelector<HTMLTextAreaElement>('[name="notes"]');
                        if (notesEl) {
                          const header = `Additional passengers (${records.length - 1}):\n`;
                          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
                          setter?.call(notesEl, notesEl.value ? `${notesEl.value}\n${header}${lines}` : `${header}${lines}`);
                          notesEl.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                      }
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
                <div className="space-y-2">
                  <Label htmlFor="passenger_name" className="text-sm font-medium">Passenger Name *</Label>
                  <Input
                    id="passenger_name"
                    name="passenger_name"
                    required
                    defaultValue={editBooking?.passenger_name || ''}
                    placeholder="Full name as per passport"
                    className="enterprise-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passenger_passport" className="text-sm font-medium">Passport Number</Label>
                  <Input
                    id="passenger_passport"
                    name="passenger_passport"
                    defaultValue={editBooking?.passenger_passport || ''}
                    placeholder="AB1234567"
                    className="enterprise-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passenger_contact" className="text-sm font-medium">Contact Number</Label>
                  <Input
                    id="passenger_contact"
                    name="passenger_contact"
                    defaultValue={editBooking?.passenger_contact || ''}
                    placeholder="03001234567"
                    className="enterprise-input"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Service Type Selection */}
            <Card className="form-card form-card-amber">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon bg-amber-100 dark:bg-amber-900/30 text-amber-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="form-section-title text-amber-800 dark:text-amber-300">Service Type</h3>
                    <p className="form-section-description">Select the type of service for this booking</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Service Type *</Label>
                  <Select
                    value={serviceType}
                    onValueChange={(value) => {
                      setServiceType(value);
                      if (value !== "Ticket") {
                        setTripType('one_way');
                      }
                      if (value !== "Custom") {
                        setCustomServiceName("");
                      }
                    }}
                  >
                    <SelectTrigger className="enterprise-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ticket">✈️ Ticket</SelectItem>
                      <SelectItem value="Umrah">🕌 Umrah</SelectItem>
                      <SelectItem value="Custom">🔧 Custom Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Trip Type - Only for Ticket service */}
                {isTicketService && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Trip Type</Label>
                    <Select value={tripType} onValueChange={(value: 'one_way' | 'return' | 'multi_city') => setTripType(value)}>
                      <SelectTrigger className="enterprise-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_way">One Way</SelectItem>
                        <SelectItem value="return">Return</SelectItem>
                        <SelectItem value="multi_city">✈️ Multi-City</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Custom Service Name - Only for Custom service */}
                {isCustomService && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-sm font-medium">Service Name *</Label>
                    <Select
                      value={customServiceName}
                      onValueChange={setCustomServiceName}
                    >
                      <SelectTrigger className="enterprise-input">
                        <SelectValue placeholder="Select service type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {customServiceOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.icon} {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Flight Details - For Ticket service (not multi-city) */}
            {isTicketService && !isMultiCity && (
              <Card className="form-card form-card-slate">
                <CardHeader className="pb-4 pt-5">
                  <div className="form-section-header">
                    <div className="form-section-icon form-section-icon-slate">
                      <Plane className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="form-section-title form-section-title-slate">
                        {isReturnTicket ? 'Outbound Flight Details' : 'Flight Details'}
                      </h3>
                      <p className="form-section-description">Enter flight and travel information</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
                  <div className="space-y-2">
                    <Label htmlFor="pnr" className="text-sm font-medium">PNR</Label>
                    <Input
                      id="pnr"
                      name="pnr"
                      defaultValue={editBooking?.pnr || ''}
                      placeholder="ABC123"
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destination" className="text-sm font-medium">Destination</Label>
                    <Input
                      id="destination"
                      name="destination"
                      defaultValue={editBooking?.destination || ''}
                      placeholder="Dubai, UAE"
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="airline" className="text-sm font-medium">Airline</Label>
                    <Input
                      id="airline"
                      name="airline"
                      defaultValue={editBooking?.airline || ''}
                      placeholder="PIA, Emirates"
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flight_date" className="text-sm font-medium">{isReturnTicket ? 'Outbound Date' : 'Flight Date'}</Label>
                    <Input
                      id="flight_date"
                      name="flight_date"
                      type="date"
                      defaultValue={editBooking?.flight_date || ''}
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="b2b_outbound_time" className="text-sm font-medium flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {isReturnTicket ? 'Outbound Time' : 'Flight Time'}
                    </Label>
                    <Input id="b2b_outbound_time" type="time" value={outboundFlightTime} onChange={(e) => setOutboundFlightTime(e.target.value)} className="enterprise-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="booking_status" className="text-sm font-medium">Booking Status</Label>
                    <Select name="booking_status" defaultValue={editBooking?.booking_status || "confirmed"}>
                      <SelectTrigger className="enterprise-input">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Return Flight Details - Only for Return Ticket */}
            {isReturnTicket && (
              <Card className="form-card border-l-4 border-l-blue-500">
                <CardHeader className="pb-4 pt-5">
                  <div className="form-section-header">
                    <div className="form-section-icon bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                      <Plane className="w-5 h-5 rotate-180" />
                    </div>
                    <div>
                      <h3 className="form-section-title text-blue-800 dark:text-blue-300">Return Flight Details</h3>
                      <p className="form-section-description">Enter return journey information</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-6">
                  <div className="space-y-2">
                    <Label htmlFor="return_from" className="text-sm font-medium">Return From</Label>
                    <Input
                      id="return_from"
                      name="return_from"
                      placeholder="Return departure city"
                      defaultValue={(() => {
                        const pkg = parsePackageData(editBooking?.notes);
                        return pkg?.return_from || '';
                      })()}
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="return_to" className="text-sm font-medium">Return To</Label>
                    <Input
                      id="return_to"
                      name="return_to"
                      placeholder="Return destination"
                      defaultValue={(() => {
                        const pkg = parsePackageData(editBooking?.notes);
                        return pkg?.return_to || '';
                      })()}
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="return_date" className="text-sm font-medium">Return Date</Label>
                    <Input
                      id="return_date"
                      name="return_date"
                      type="date"
                      defaultValue={(() => {
                        const pkg = parsePackageData(editBooking?.notes);
                        return pkg?.return_date || '';
                      })()}
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="b2b_return_time" className="text-sm font-medium flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Return Flight Time
                    </Label>
                    <Input id="b2b_return_time" type="time" value={returnFlightTime} onChange={(e) => setReturnFlightTime(e.target.value)} className="enterprise-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="return_pnr" className="text-sm font-medium">Return PNR / Flight No</Label>
                    <Input
                      id="return_pnr"
                      name="return_pnr"
                      placeholder="Return flight PNR"
                      defaultValue={(() => {
                        const pkg = parsePackageData(editBooking?.notes);
                        return pkg?.return_pnr || '';
                      })()}
                      className="enterprise-input"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Umrah Package Details */}
            {isUmrah && (
              <Card className="form-card border-l-4 border-l-emerald-500">
                <CardHeader className="pb-4 pt-5">
                  <div className="form-section-header">
                    <div className="form-section-icon bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
                      <span className="text-lg">🕌</span>
                    </div>
                    <div>
                      <h3 className="form-section-title text-emerald-800 dark:text-emerald-300">Umrah Package Details</h3>
                      <p className="form-section-description">Complete package including flights, hotels, and transport</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pb-6">
                  {/* Flights Section */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                      <Plane className="w-4 h-4" />
                      Flights (Return)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="umrah_departure_city" className="text-sm font-medium">Departure City</Label>
                        <Input
                          id="umrah_departure_city"
                          name="umrah_departure_city"
                          placeholder="e.g., Karachi"
                          defaultValue={(() => {
                            const pkg = parsePackageData(editBooking?.notes);
                            return pkg?.flights?.departure_city || '';
                          })()}
                          className="enterprise-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="umrah_arrival_city" className="text-sm font-medium">Arrival City</Label>
                        <Select
                          name="umrah_arrival_city"
                          defaultValue={(() => {
                            const pkg = parsePackageData(editBooking?.notes);
                            return pkg?.flights?.arrival_city || "Jeddah";
                          })()}
                        >
                          <SelectTrigger className="enterprise-input">
                            <SelectValue placeholder="Select city" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Jeddah">Jeddah</SelectItem>
                            <SelectItem value="Madinah">Madinah</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="airline" className="text-sm font-medium">Airline</Label>
                        <Input
                          id="airline"
                          name="airline"
                          placeholder="e.g., Saudi Airlines"
                          defaultValue={editBooking?.airline || ''}
                          className="enterprise-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="flight_date" className="text-sm font-medium">Departure Date</Label>
                        <Input
                          id="flight_date"
                          name="flight_date"
                          type="date"
                          defaultValue={editBooking?.flight_date || ''}
                          className="enterprise-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="b2b_umrah_dep_time" className="text-sm font-medium flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Departure Time
                        </Label>
                        <Input id="b2b_umrah_dep_time" type="time" value={outboundFlightTime} onChange={(e) => setOutboundFlightTime(e.target.value)} className="enterprise-input" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="umrah_return_date" className="text-sm font-medium">Return Date</Label>
                        <Input
                          id="umrah_return_date"
                          name="umrah_return_date"
                          type="date"
                          defaultValue={(() => {
                            const pkg = parsePackageData(editBooking?.notes);
                            return pkg?.flights?.return_date || '';
                          })()}
                          className="enterprise-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="b2b_umrah_ret_time" className="text-sm font-medium flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Return Time
                        </Label>
                        <Input id="b2b_umrah_ret_time" type="time" value={returnFlightTime} onChange={(e) => setReturnFlightTime(e.target.value)} className="enterprise-input" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pnr" className="text-sm font-medium">PNR</Label>
                        <Input
                          id="pnr"
                          name="pnr"
                          defaultValue={editBooking?.pnr || ''}
                          placeholder="Flight PNR"
                          className="enterprise-input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Transport Section */}
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                      <Car className="w-4 h-4" />
                      Transport
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <Label htmlFor="transport_included" className="text-sm font-medium cursor-pointer">
                          Transport Included?
                        </Label>
                        <Switch
                          id="transport_included"
                          checked={transportIncluded}
                          onCheckedChange={setTransportIncluded}
                        />
                      </div>
                      {transportIncluded && (
                        <div className="space-y-2">
                          <Label htmlFor="transport_details" className="text-sm font-medium">Transport Details</Label>
                          <Input
                            id="transport_details"
                            name="transport_details"
                            placeholder="e.g., Bus, Car, Ziyarat"
                            defaultValue={(() => {
                              const pkg = parsePackageData(editBooking?.notes);
                              return pkg?.transport?.details || '';
                            })()}
                            className="enterprise-input"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hotels Section */}
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                      <Hotel className="w-4 h-4" />
                      Hotels
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Makkah Hotel */}
                      <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200/50 dark:border-amber-800/30 space-y-3">
                        <h5 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Makkah Hotel</h5>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2 col-span-2 sm:col-span-1">
                            <Label htmlFor="makkah_hotel" className="text-xs font-medium">Hotel Name</Label>
                            <Input
                              id="makkah_hotel"
                              name="makkah_hotel"
                              placeholder="Hotel name"
                              defaultValue={(() => {
                                const pkg = parsePackageData(editBooking?.notes);
                                return pkg?.hotels?.makkah?.name || '';
                              })()}
                              className="enterprise-input"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="makkah_nights" className="text-xs font-medium">Nights</Label>
                            <Input
                              id="makkah_nights"
                              name="makkah_nights"
                              type="number"
                              min="0"
                              placeholder="0"
                              defaultValue={(() => {
                                const pkg = parsePackageData(editBooking?.notes);
                                return pkg?.hotels?.makkah?.nights || '';
                              })()}
                              className="enterprise-input"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Madinah Hotel */}
                      <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200/50 dark:border-green-800/30 space-y-3">
                        <h5 className="text-sm font-semibold text-green-800 dark:text-green-200">Madinah Hotel</h5>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2 col-span-2 sm:col-span-1">
                            <Label htmlFor="madinah_hotel" className="text-xs font-medium">Hotel Name</Label>
                            <Input
                              id="madinah_hotel"
                              name="madinah_hotel"
                              placeholder="Hotel name"
                              defaultValue={(() => {
                                const pkg = parsePackageData(editBooking?.notes);
                                return pkg?.hotels?.madinah?.name || '';
                              })()}
                              className="enterprise-input"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="madinah_nights" className="text-xs font-medium">Nights</Label>
                            <Input
                              id="madinah_nights"
                              name="madinah_nights"
                              type="number"
                              min="0"
                              placeholder="0"
                              defaultValue={(() => {
                                const pkg = parsePackageData(editBooking?.notes);
                                return pkg?.hotels?.madinah?.nights || '';
                              })()}
                              className="enterprise-input"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Booking Status for Umrah */}
                  <div className="pt-4 border-t">
                    <div className="space-y-2 max-w-xs">
                      <Label htmlFor="booking_status" className="text-sm font-medium">Booking Status</Label>
                      <Select name="booking_status" defaultValue={editBooking?.booking_status || "confirmed"}>
                        <SelectTrigger className="enterprise-input">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Custom Service Details */}
            {isCustomService && (
              <Card className="form-card border-l-4 border-l-violet-500">
                <CardHeader className="pb-4 pt-5">
                  <div className="form-section-header">
                    <div className="form-section-icon bg-violet-100 dark:bg-violet-900/30 text-violet-600">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="form-section-title text-violet-800 dark:text-violet-300">
                        {customServiceName ? `${customServiceName} Details` : 'Custom Service Details'}
                      </h3>
                      <p className="form-section-description">Enter service-specific information</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
                  <div className="space-y-2">
                    <Label htmlFor="custom_service_location" className="text-sm font-medium">Location / Destination</Label>
                    <Input
                      id="custom_service_location"
                      name="custom_service_location"
                      placeholder="e.g., Dubai, UAE"
                      defaultValue={(() => {
                        const pkg = parsePackageData(editBooking?.notes);
                        return pkg?.service_location || editBooking?.destination || '';
                      })()}
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom_provider" className="text-sm font-medium">Service Provider</Label>
                    <Input
                      id="custom_provider"
                      name="custom_provider"
                      placeholder="e.g., ABC Hotels, XYZ Tours"
                      defaultValue={(() => {
                        const pkg = parsePackageData(editBooking?.notes);
                        return pkg?.provider || '';
                      })()}
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom_reference" className="text-sm font-medium">Reference / Booking No.</Label>
                    <Input
                      id="custom_reference"
                      name="custom_reference"
                      placeholder="e.g., REF-12345"
                      defaultValue={(() => {
                        const pkg = parsePackageData(editBooking?.notes);
                        return pkg?.reference_number || editBooking?.pnr || '';
                      })()}
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom_start_date" className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Start Date
                    </Label>
                    <Input
                      id="custom_start_date"
                      name="custom_start_date"
                      type="date"
                      defaultValue={(() => {
                        const pkg = parsePackageData(editBooking?.notes);
                        return pkg?.start_date || editBooking?.flight_date || '';
                      })()}
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom_end_date" className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> End Date
                    </Label>
                    <Input
                      id="custom_end_date"
                      name="custom_end_date"
                      type="date"
                      defaultValue={(() => {
                        const pkg = parsePackageData(editBooking?.notes);
                        return pkg?.end_date || '';
                      })()}
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="booking_status" className="text-sm font-medium">Booking Status</Label>
                    <Select name="booking_status" defaultValue={editBooking?.booking_status || "confirmed"}>
                      <SelectTrigger className="enterprise-input">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Multi-City Flight Segments */}
            {isMultiCity && (
              <Card className="form-card border-l-4 border-l-indigo-500">
                <CardHeader className="pb-4 pt-5">
                  <div className="form-section-header">
                    <div className="form-section-icon bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600">
                      <Route className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="form-section-title text-indigo-800 dark:text-indigo-300">Multi-City Flight Segments</h3>
                      <p className="form-section-description">Add up to 6 flight segments ({multiCitySegments.length}/6)</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pb-6">
                  {multiCitySegments.map((segment, idx) => (
                    <div key={idx} className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200/50 dark:border-indigo-800/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">Segment {idx + 1}</span>
                        {multiCitySegments.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSegment(idx)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">From</Label>
                          <Input value={segment.departure_city} onChange={(e) => updateSegment(idx, 'departure_city', e.target.value)} placeholder="Departure" className="enterprise-input h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">To</Label>
                          <Input value={segment.arrival_city} onChange={(e) => updateSegment(idx, 'arrival_city', e.target.value)} placeholder="Arrival" className="enterprise-input h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Date</Label>
                          <Input type="date" value={segment.flight_date} onChange={(e) => updateSegment(idx, 'flight_date', e.target.value)} className="enterprise-input h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Time</Label>
                          <Input type="time" value={segment.flight_time} onChange={(e) => updateSegment(idx, 'flight_time', e.target.value)} className="enterprise-input h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Airline</Label>
                          <Input value={segment.airline} onChange={(e) => updateSegment(idx, 'airline', e.target.value)} placeholder="Airline" className="enterprise-input h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Flight No</Label>
                          <Input value={segment.flight_number} onChange={(e) => updateSegment(idx, 'flight_number', e.target.value)} placeholder="PNR/Flight#" className="enterprise-input h-9 text-sm" />
                        </div>
                      </div>
                    </div>
                  ))}
                  {multiCitySegments.length < 6 && (
                    <Button type="button" variant="outline" size="sm" onClick={addSegment} className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50">
                      <Plus className="w-4 h-4 mr-2" /> Add Flight Segment
                    </Button>
                  )}
                  <div className="pt-3 border-t">
                    <div className="space-y-2 max-w-xs">
                      <Label htmlFor="mc_booking_status" className="text-sm font-medium">Booking Status</Label>
                      <Select name="booking_status" defaultValue={editBooking?.booking_status || "confirmed"}>
                        <SelectTrigger className="enterprise-input">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="form-card form-card-purple">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon-purple">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="form-section-title form-section-title-purple">Vendor Association</h3>
                    <p className="form-section-description">Link this booking to a vendor (optional)</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                {/* Linked Vendor Display */}
                {selectedVendorId !== "none" && selectedVendorId && (
                  <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Store className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary flex items-center gap-1">
                          ✓ Linked Vendor
                        </p>
                        <p className="text-base font-semibold">{allVendors.find(v => v.id === selectedVendorId)?.name}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setSelectedVendorId("none")}
                    >
                      Remove
                    </Button>
                  </div>
                )}

                {/* Two Simple Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-12 gap-2 hover:bg-primary/5 hover:border-primary/50"
                    onClick={() => setShowQuickVendorAdd(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Add New Vendor
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-12 gap-2 hover:bg-primary/5 hover:border-primary/50"
                    onClick={() => setVendorSearchOpen(true)}
                  >
                    <Store className="w-4 h-4" />
                    Select from List
                  </Button>
                </div>

                {/* Add New Vendor Modal */}
                <Dialog open={showQuickVendorAdd} onOpenChange={setShowQuickVendorAdd}>
                  <DialogContent className="enterprise-dialog w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] overflow-hidden flex flex-col">
                    <DialogHeader className="pb-3 border-b shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="form-section-icon form-section-icon-green">
                          <Plus className="w-5 h-5" />
                        </div>
                        <div>
                          <DialogTitle className="text-xl font-semibold">Add New Vendor</DialogTitle>
                          <DialogDescription className="text-muted-foreground/80">
                            Create a new vendor and link it to this booking
                          </DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>
                    <form ref={quickVendorFormRef} className="flex-1 overflow-y-auto p-1">
                      <div className="space-y-4">
                        {/* Basic Information */}
                        <Card className="form-card form-card-blue">
                          <CardHeader className="pb-3 pt-4">
                            <div className="form-section-header">
                              <div className="form-section-icon form-section-icon-blue">
                                <Building2 className="w-4 h-4" />
                              </div>
                              <div>
                                <h3 className="form-section-title form-section-title-blue text-base">Basic Information</h3>
                                <p className="form-section-description text-xs">Vendor company details</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5">
                            <div className="space-y-2">
                              <Label htmlFor="vendor_name" className="text-sm font-medium">Vendor Name *</Label>
                              <Input id="vendor_name" name="vendor_name" required placeholder="Company name" className="enterprise-input" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="vendor_service_type" className="text-sm font-medium">Service Type</Label>
                              <Input id="vendor_service_type" name="vendor_service_type" placeholder="e.g., Airline, Hotel" className="enterprise-input" />
                            </div>
                          </CardContent>
                        </Card>

                        {/* Contact Information */}
                        <Card className="form-card form-card-green">
                          <CardHeader className="pb-3 pt-4">
                            <div className="form-section-header">
                              <div className="form-section-icon form-section-icon-green">
                                <User className="w-4 h-4" />
                              </div>
                              <div>
                                <h3 className="form-section-title form-section-title-green text-base">Contact Information</h3>
                                <p className="form-section-description text-xs">Contact person and details</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5">
                            <div className="space-y-2">
                              <Label htmlFor="vendor_contact_person" className="text-sm font-medium">Contact Person</Label>
                              <Input id="vendor_contact_person" name="vendor_contact_person" placeholder="Contact name" className="enterprise-input" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="vendor_contact_number" className="text-sm font-medium">Contact Number</Label>
                              <Input id="vendor_contact_number" name="vendor_contact_number" placeholder="Phone number" className="enterprise-input" />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label htmlFor="vendor_email" className="text-sm font-medium">Email</Label>
                              <Input id="vendor_email" name="vendor_email" type="email" placeholder="email@example.com" className="enterprise-input" />
                            </div>
                          </CardContent>
                        </Card>

                        {/* Additional Notes */}
                        <Card className="form-card form-card-slate">
                          <CardHeader className="pb-3 pt-4">
                            <div className="form-section-header">
                              <div className="form-section-icon form-section-icon-slate">
                                <Store className="w-4 h-4" />
                              </div>
                              <div>
                                <h3 className="form-section-title form-section-title-slate text-base">Additional Notes</h3>
                                <p className="form-section-description text-xs">Optional vendor notes</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pb-5">
                            <Textarea
                              id="vendor_notes"
                              name="vendor_notes"
                              rows={3}
                              placeholder="Additional vendor details..."
                              className="enterprise-input resize-none"
                            />
                          </CardContent>
                        </Card>
                      </div>
                    </form>
                    <div className="flex gap-3 justify-end pt-4 border-t shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowQuickVendorAdd(false)}
                        className="min-w-[100px]"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        disabled={addVendor.isPending}
                        onClick={handleQuickVendorAdd}
                        className="min-w-[140px]"
                      >
                        {addVendor.isPending ? "Adding..." : "Add & Link Vendor"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Select from List Modal */}
                <Dialog open={vendorSearchOpen} onOpenChange={setVendorSearchOpen}>
                  <DialogContent className="w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Store className="w-5 h-5 text-primary" />
                        Select Vendor
                      </DialogTitle>
                      <DialogDescription>
                        Choose an existing vendor to link
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                      {/* Search Input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search vendors..."
                          value={vendorSearchTerm}
                          onChange={(e) => setVendorSearchTerm(e.target.value)}
                          className="pl-9 enterprise-input"
                        />
                      </div>

                      {/* Service Type Filter */}
                      {serviceTypes.length > 0 && (
                        <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                          <SelectTrigger className="w-full">
                            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Filter by service" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Service Types</SelectItem>
                            {serviceTypes.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Vendor List */}
                    <div className="flex-1 overflow-y-auto mt-3 -mx-6 px-6 space-y-1 max-h-[50vh]">
                      {/* No Vendor Option */}
                      <button
                        type="button"
                        className={cn(
                          "w-full text-left p-3 rounded-lg border transition-colors",
                          selectedVendorId === "none"
                            ? "border-primary bg-primary/5"
                            : "border-transparent hover:bg-muted/50"
                        )}
                        onClick={() => {
                          setSelectedVendorId("none");
                          setVendorSearchOpen(false);
                        }}
                      >
                        <span className="text-muted-foreground">No Vendor</span>
                      </button>

                      {filteredVendors.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No vendors found</p>
                      ) : (
                        filteredVendors.map((vendor) => (
                          <button
                            key={vendor.id}
                            type="button"
                            className={cn(
                              "w-full text-left p-3 rounded-lg border transition-colors",
                              selectedVendorId === vendor.id
                                ? "border-primary bg-primary/5"
                                : "border-transparent hover:bg-muted/50"
                            )}
                            onClick={() => {
                              setSelectedVendorId(vendor.id);
                              setVendorSearchOpen(false);
                              toast.success(`Linked to "${vendor.name}"`);
                            }}
                          >
                            <p className="font-medium">{vendor.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {vendor.service_type}
                              {vendor.contact_person && ` • ${vendor.contact_person}`}
                            </p>
                          </button>
                        ))
                      )}
                    </div>

                    {filteredVendors.length < allVendors.length && (
                      <p className="text-xs text-muted-foreground text-center pt-2 border-t">
                        Showing {filteredVendors.length} of {allVendors.length} vendors
                      </p>
                    )}
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Pricing & Payment */}
            <Card className="form-card form-card-green">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon-green">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="form-section-title form-section-title-green">Pricing & Payment</h3>
                    <p className="form-section-description">Track pricing, commission and payment status</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="purchasing_price" className="text-sm font-medium">Purchasing Price (PKR)</Label>
                    <Input
                      id="purchasing_price"
                      name="purchasing_price"
                      type="number"
                      defaultValue={editBooking?.purchasing_price || ''}
                      placeholder="Cost from vendor"
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="selling_price" className="text-sm font-medium">Selling Price (PKR)</Label>
                    <Input
                      id="selling_price"
                      name="selling_price"
                      type="number"
                      defaultValue={editBooking?.selling_price || ''}
                      placeholder="Price to agent"
                      className="enterprise-input"
                      onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  {!editBooking && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="amount_received" className="text-sm font-medium">Amount Received (PKR)</Label>
                        <Input
                          id="amount_received"
                          name="amount_received"
                          type="number"
                          min="0"
                          max={sellingPrice - calculateCommission(sellingPrice)}
                          value={amountReceived || ''}
                          onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                          placeholder="Payment at booking (optional)"
                          className="enterprise-input"
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave 0 for unpaid booking
                        </p>
                      </div>
                      {amountReceived > 0 && (
                        <div className="space-y-2 lg:col-span-2">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <Banknote className="w-4 h-4" /> Payment Mode
                          </Label>
                          <PaymentModeSelect
                            value={paymentMode}
                            onChange={setPaymentMode}
                            bankName={bankName}
                            onBankNameChange={setBankName}
                          />
                        </div>
                      )}
                    </>
                  )}
                  {editBooking && (
                    <div className="space-y-2">
                      <Label htmlFor="payment_status" className="text-sm font-medium">Payment Status</Label>
                      <Select name="payment_status" defaultValue={editBooking?.payment_status || "pending"}>
                        <SelectTrigger className="enterprise-input">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Accounting Summary for New Bookings */}
                {!editBooking && sellingPrice > 0 && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200/50 dark:border-blue-800/30 space-y-2">
                    <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3">Accounting Summary</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <span className="text-muted-foreground">Total Service Amount:</span>
                      <span className="font-medium text-right">PKR {(sellingPrice - calculateCommission(sellingPrice)).toLocaleString()}</span>

                      <span className="text-muted-foreground">Less: Agent Commission:</span>
                      <span className="font-medium text-right text-purple-600">- PKR {calculateCommission(sellingPrice).toLocaleString()}</span>

                      <span className="text-muted-foreground">Amount Received:</span>
                      <span className="font-medium text-right text-green-600">PKR {amountReceived.toLocaleString()}</span>

                      <div className="col-span-2 border-t border-blue-200/50 dark:border-blue-800/30 my-1"></div>

                      <span className="font-semibold">Outstanding Balance:</span>
                      <span className={cn(
                        "font-bold text-right",
                        (sellingPrice - calculateCommission(sellingPrice) - amountReceived) > 0
                          ? "text-red-600"
                          : "text-green-600"
                      )}>
                        PKR {Math.abs(sellingPrice - calculateCommission(sellingPrice) - amountReceived).toLocaleString()}
                      </span>

                      <span className="text-muted-foreground">Auto Payment Status:</span>
                      <span className={cn(
                        "font-semibold text-right",
                        amountReceived <= 0 ? "text-red-500" :
                          amountReceived >= (sellingPrice - calculateCommission(sellingPrice)) ? "text-green-600" :
                            "text-amber-500"
                      )}>
                        {amountReceived <= 0 ? 'UNPAID' :
                          amountReceived >= (sellingPrice - calculateCommission(sellingPrice)) ? 'PAID' :
                            'PARTIAL'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Commission Info */}
                <div className="p-3 bg-muted/50 rounded-lg border border-muted">
                  <p className="text-sm text-muted-foreground">
                    Agent Commission: <span className="font-medium text-foreground">
                      {agent.commission_type === 'percentage'
                        ? `${agent.commission_value || 0}% of selling price`
                        : `PKR ${agent.commission_value?.toLocaleString() || 0} fixed`
                      }
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">Additional Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={(() => {
                  // Extract user notes from structured data if present
                  const notes = editBooking?.notes || '';
                  if (notes.includes('\n\nNotes: ')) {
                    return notes.split('\n\nNotes: ')[1] || '';
                  }
                  // If no structured data, return raw notes
                  const packageData = parsePackageData(notes);
                  if (packageData) {
                    return ''; // Structured data present, no user notes
                  }
                  return notes;
                })()}
                placeholder="Any additional information about this booking..."
                rows={3}
                className="enterprise-input min-h-[80px] resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 mt-4 border-t border-border/50 sticky bottom-0 bg-background pb-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="px-6">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25"
            >
              {loading ? 'Saving...' : (editBooking ? 'Update Booking' : 'Add Booking')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
