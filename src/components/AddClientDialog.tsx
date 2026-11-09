import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useClients, useVendors } from "@/hooks/useStorage";
import { useClientPaymentHistoryLocal, useVendorPaymentHistoryLocal } from "@/hooks/useLocalPaymentHistory";
import { useOpeningBalances } from "@/hooks/useOpeningBalances";
import { useAgency } from "@/hooks/useAgency";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, User, Plus, Store, Search, Filter, Pencil, Maximize2, Minimize2, Plane, Hotel, Bus, ArrowLeftRight, AlertCircle, Trash2, Clock, Route, FileText, Scale } from "lucide-react";
import { CreateVoucherDialog } from "@/components/CreateVoucherDialog";
import { useVouchers } from "@/hooks/useVouchers";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { clientSchema, validateData } from "@/lib/validations/schemas";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { FormSectionNav } from "@/components/FormSectionNav";
import { ScanAutofillButton } from "@/components/ai/ScanAutofillButton";
import { Switch } from "@/components/ui/switch";
import { PaymentModeSelect } from "@/components/PaymentModeSelect";

const SECTIONS = [
  { id: 'contact-info', label: 'Contact Information', color: 'blue' },
  { id: 'booking-details', label: 'Booking Details', color: 'slate' },
  { id: 'passenger-docs', label: 'Passenger Documents', color: 'green' },
  { id: 'payment-info', label: 'Payment Information', color: 'amber' },
  { id: 'vendor-association', label: 'Vendor Association', color: 'purple' },
  { id: 'notes', label: 'Notes', color: 'slate' },
];

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editClient?: any;
  prefillClient?: any;
}

export function AddClientDialog({ open, onOpenChange, editClient, prefillClient }: AddClientDialogProps) {
  const initialData = editClient || prefillClient;
  const [loading, setLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const { addVoucher } = useVouchers();
  const [groupBookingType, setGroupBookingType] = useState(initialData?.group_booking_type || "individual");
  const [groupSize, setGroupSize] = useState(initialData?.group_size || 1);
  const [showQuickVendorAdd, setShowQuickVendorAdd] = useState(false);
  const [showQuickVendorEdit, setShowQuickVendorEdit] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState(initialData?.vendor_id || "none");
  const [vendorSearchOpen, setVendorSearchOpen] = useState(false);
  const [vendorSearchTerm, setVendorSearchTerm] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");
  const [newlyAddedVendor, setNewlyAddedVendor] = useState<any>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  
  // Service type and trip type states
  const [serviceType, setServiceType] = useState(initialData?.travel_type || initialData?.service_type || "Ticket");
  const [tripType, setTripType] = useState<'one_way' | 'return' | 'multi_city'>('one_way');
  const [transportIncluded, setTransportIncluded] = useState(false);
  
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
  
  const { addClient, updateClient } = useClients();
  const { vendors, addVendor, updateVendor } = useVendors();
  const { addPaymentHistory } = useClientPaymentHistoryLocal();
  const { addPaymentHistory: addVendorPaymentHistory } = useVendorPaymentHistoryLocal();
  const { balances, upsertBalance } = useOpeningBalances();
  const { data: agency } = useAgency();

  const existingClientBalance = editClient
    ? balances.find((b) => b.party_type === "client" && b.party_id === editClient.id)
    : null;
  const [openingBalanceAmount, setOpeningBalanceAmount] = useState<string>("");
  const [openingBalanceType, setOpeningBalanceType] = useState<"receivable" | "payable">("receivable");

  useEffect(() => {
    if (existingClientBalance) {
      setOpeningBalanceAmount(String(existingClientBalance.amount));
      setOpeningBalanceType(existingClientBalance.balance_type);
    } else {
      setOpeningBalanceAmount("");
      setOpeningBalanceType("receivable");
    }
  }, [existingClientBalance]);
  const quickVendorFormRef = useRef<HTMLFormElement | null>(null);
  
  // Scroll animation hook
  const { activeSection, setSectionRef, scrollToSection, containerRef, isVisible } = useScrollAnimation(SECTIONS.length);

  // Determine if this is a ticket service (one way or return)
  const isTicketService = serviceType === "Ticket" || serviceType === "Ticket – Return";
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
    if (editClient) {
      setGroupBookingType(editClient.group_booking_type || "individual");
      setGroupSize(editClient.group_size || 1);
      setSelectedVendorId(editClient.vendor_id || "none");
      
      // Determine service type from existing data
      const travelType = editClient.travel_type || "Ticket";
      if (travelType === "Ticket" || travelType === "Ticket – One Way") {
        setServiceType("Ticket");
        setTripType('one_way');
      } else if (travelType === "Ticket – Return") {
        setServiceType("Ticket");
        setTripType('return');
      } else if (travelType === "Ticket – Multi-City") {
        setServiceType("Ticket");
        setTripType('multi_city');
      } else if (travelType === "Umrah") {
        setServiceType("Umrah");
      } else {
        setServiceType(travelType);
      }
      
      // Restore flight times and multi-city segments
      const p0 = editClient.passengers_data?.[0];
      if (p0?.outbound_flight_time) setOutboundFlightTime(p0.outbound_flight_time);
      if (p0?.return_flight_time) setReturnFlightTime(p0.return_flight_time);
      if (p0?.multi_city_segments?.length) setMultiCitySegments(p0.multi_city_segments);
      
      // Check for transport included in notes or passengers_data
      if (p0?.transport_included) {
        setTransportIncluded(true);
      }
    }
  }, [editClient]);

  // Reset newly added vendor when dialog closes
  useEffect(() => {
    if (!open) {
      setNewlyAddedVendor(null);
      setSelectedVendorId("none");
      setGroupBookingType("individual");
      setGroupSize(1);
      setShowQuickVendorAdd(false);
      setShowQuickVendorEdit(false);
      setVendorSearchTerm("");
      setServiceTypeFilter("all");
      setServiceType("Ticket");
      setTripType('one_way');
      setTransportIncluded(false);
      setMissingFields([]);
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

    const totalAmount = formData.get("vendor_payment_amount") ? parseFloat(formData.get("vendor_payment_amount") as string) : 0;
    const amountPaid = formData.get("vendor_amount_paid") ? parseFloat(formData.get("vendor_amount_paid") as string) : 0;
    const paymentStatus = amountPaid >= totalAmount ? "Paid" : "Pending";

    const vendorData = {
      name: vendorName,
      contact_person: (formData.get("vendor_contact_person") as string) || "",
      contact_number: (formData.get("vendor_contact_number") as string) || "",
      email: (formData.get("vendor_email") as string) || "",
      service_type: (formData.get("vendor_service_type") as string) || "",
      booking_date: (formData.get("vendor_booking_date") as string) || null,
      payment_amount: totalAmount,
      amount_paid: amountPaid,
      payment_status: paymentStatus,
      notes: (formData.get("vendor_notes") as string) || "",
    };

    try {
      toast.loading("Adding vendor...");
      const newVendor = await addVendor.mutateAsync(vendorData);

      if (amountPaid > 0) {
        const paymentType: "partial" | "full" = amountPaid >= totalAmount ? "full" : "partial";
        await addVendorPaymentHistory.mutateAsync({
          vendor_id: newVendor.id,
          agency_id: agency?.id || "",
          payment_amount: amountPaid,
          payment_type: paymentType,
          payment_date: new Date().toISOString().split("T")[0],
          notes: `Initial payment of ₨${amountPaid.toLocaleString()}`,
        });
      }

      setNewlyAddedVendor(newVendor);
      setSelectedVendorId(newVendor.id);
      setShowQuickVendorAdd(false);
      toast.dismiss();
      toast.success(`✓ Vendor "${newVendor.name}" added and linked successfully!`, {
        description: "Now available in Vendors section",
      });
      quickVendorFormRef.current.reset();
    } catch (error: any) {
      toast.dismiss();
      toast.error("Failed to add vendor", {
        description: error?.message || "Please try again",
      });
    }
  };

  const handleQuickVendorEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const vendorToEdit = allVendors.find(v => v.id === selectedVendorId);
    if (!vendorToEdit) return;

    const totalAmount = formData.get("edit_vendor_payment_amount") ? parseFloat(formData.get("edit_vendor_payment_amount") as string) : 0;
    const amountPaid = formData.get("edit_vendor_amount_paid") ? parseFloat(formData.get("edit_vendor_amount_paid") as string) : 0;
    const paymentStatus = amountPaid >= totalAmount ? "Paid" : "Pending";
    
    const vendorData = {
      name: formData.get("edit_vendor_name") as string,
      contact_person: formData.get("edit_vendor_contact_person") as string,
      contact_number: formData.get("edit_vendor_contact_number") as string,
      email: formData.get("edit_vendor_email") as string,
      service_type: formData.get("edit_vendor_service_type") as string,
      booking_date: formData.get("edit_vendor_booking_date") as string || null,
      payment_amount: totalAmount,
      amount_paid: amountPaid,
      payment_status: paymentStatus,
      notes: formData.get("edit_vendor_notes") as string,
    };

    try {
      await updateVendor.mutateAsync({ id: vendorToEdit.id, vendor: vendorData });
      setShowQuickVendorEdit(false);
      toast.success(`Vendor "${vendorData.name}" updated successfully!`);
    } catch (error) {
      toast.error("Failed to update vendor");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMissingFields([]); // Clear previous missing fields
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    // Check required fields and collect missing ones
    const missing: string[] = [];
    const contactName = (formData.get("name") as string || "").trim();
    if (!contactName || contactName.length < 2) {
      missing.push("Contact Name");
    }
    
    const totalAmountStr = formData.get("sellingPrice") as string;
    if (!totalAmountStr || parseFloat(totalAmountStr) <= 0) {
      missing.push("Total Amount");
    }
    
    // Check passenger names (required)
    const numberOfPassengers = groupBookingType === 'individual' ? 1 : groupSize;
    for (let i = 1; i <= numberOfPassengers; i++) {
      const passengerName = (formData.get(`passenger_${i}_name`) as string || "").trim();
      if (!passengerName || passengerName.length < 2) {
        missing.push(`Passenger ${i} Name`);
      }
    }
    
    // Check Umrah-specific required fields
    if (isUmrah) {
      if (!(formData.get("umrah_departure_city") as string)?.trim()) {
        missing.push("Departure City");
      }
      if (!(formData.get("umrah_departure_date") as string)) {
        missing.push("Departure Date");
      }
      if (!(formData.get("umrah_return_date") as string)) {
        missing.push("Return Date");
      }
    }
    
    if (missing.length > 0) {
      setMissingFields(missing);
      setLoading(false);
      toast.error(`Please fill required fields: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` and ${missing.length - 3} more` : ""}`);
      return;
    }

    // Determine final service type
    let finalServiceType = serviceType;
    if (serviceType === "Ticket" && tripType === 'return') {
      finalServiceType = "Ticket – Return";
    } else if (serviceType === "Ticket" && tripType === 'multi_city') {
      finalServiceType = "Ticket – Multi-City";
    } else if (serviceType === "Custom") {
      const customServiceType = formData.get("customServiceType") as string;
      finalServiceType = customServiceType || "Custom";
    }

    const totalAmount = formData.get("sellingPrice") ? parseFloat(formData.get("sellingPrice") as string) : 0;
    const amountPaid = formData.get("amountPaid") ? parseFloat(formData.get("amountPaid") as string) : 0;
    
    // Auto-determine payment status based on amounts
    const paymentStatus = amountPaid >= totalAmount ? "Paid" : "Pending";
    
    const vendorId = formData.get("vendorId") as string;
    
    // Collect passengers data for both individual and group bookings
    const passengersData = [];
    if ((groupBookingType === 'group' && groupSize >= 1) || groupBookingType === 'individual') {
      const numberOfPassengers = groupBookingType === 'individual' ? 1 : groupSize;
      for (let i = 1; i <= numberOfPassengers; i++) {
        const passengerData: any = {
          passenger_number: i,
          name: formData.get(`passenger_${i}_name`) as string || '',
          passport_number: formData.get(`passenger_${i}_passport`) as string || '',
          cnic: formData.get(`passenger_${i}_cnic`) as string || '',
          date_of_birth: formData.get(`passenger_${i}_dob`) as string || '',
          gender: formData.get(`passenger_${i}_gender`) as string || '',
          nationality: formData.get(`passenger_${i}_nationality`) as string || '',
        };
        
        // Add flight times and multi-city data to first passenger record
        if (i === 1) {
          if (outboundFlightTime) passengerData.outbound_flight_time = outboundFlightTime;
          if (returnFlightTime) passengerData.return_flight_time = returnFlightTime;
          if (isMultiCity) {
            passengerData.multi_city_segments = multiCitySegments.filter(s => s.departure_city || s.arrival_city);
          }
        }
        
        // Add Umrah-specific data to first passenger record (package info)
        if (i === 1 && isUmrah) {
          passengerData.umrah_package = {
            departure_city: formData.get("umrah_departure_city") as string || '',
            arrival_city: formData.get("umrah_arrival_city") as string || '',
            departure_date: formData.get("umrah_departure_date") as string || '',
            return_date: formData.get("umrah_return_date") as string || '',
            airline: formData.get("umrah_airline") as string || '',
            departure_flight_time: outboundFlightTime || '',
            return_flight_time: returnFlightTime || '',
            transport_included: transportIncluded,
            transport_details: formData.get("umrah_transport_details") as string || '',
            makkah_hotel: formData.get("umrah_makkah_hotel") as string || '',
            makkah_nights: parseInt(formData.get("umrah_makkah_nights") as string) || 0,
            madinah_hotel: formData.get("umrah_madinah_hotel") as string || '',
            madinah_nights: parseInt(formData.get("umrah_madinah_nights") as string) || 0,
          };
        }
        
        // Add return ticket data to first passenger record
        if (i === 1 && isReturnTicket) {
          passengerData.return_flight = {
            return_from: formData.get("return_from") as string || '',
            return_to: formData.get("return_to") as string || '',
            return_date: formData.get("return_date") as string || '',
            return_pnr: formData.get("return_pnr") as string || '',
            return_flight_time: returnFlightTime || '',
          };
        }
        
        // Add custom service data to first passenger record
        if (i === 1 && isCustomService) {
          passengerData.custom_service = {
            start_date: formData.get("custom_start_date") as string || '',
            end_date: formData.get("custom_end_date") as string || '',
            reference: formData.get("custom_reference") as string || '',
            location: formData.get("custom_location") as string || '',
          };
        }
        
        passengersData.push(passengerData);
      }
    }
    
    const clientData = {
      name: formData.get("name") as string,
      contact_number: formData.get("contactNumber") as string || undefined,
      email: (formData.get("email") as string) || undefined,
      destination: isMultiCity
        ? (multiCitySegments.map(s => s.arrival_city).filter(Boolean).join(' → ') || undefined)
        : isUmrah 
          ? (formData.get("umrah_arrival_city") as string || "Jeddah")
          : isCustomService 
            ? (formData.get("custom_location") as string || undefined)
            : (formData.get("destination") as string || undefined),
      airline: isMultiCity
        ? (multiCitySegments[0]?.airline || undefined)
        : isUmrah 
          ? (formData.get("umrah_airline") as string || undefined)
          : isCustomService 
            ? undefined
            : (formData.get("airline") as string || undefined),
      pnr: isMultiCity
        ? (multiCitySegments[0]?.flight_number || undefined)
        : isCustomService 
          ? (formData.get("custom_reference") as string || undefined)
          : (formData.get("pnr") as string || undefined),
      flight_date: isMultiCity
        ? (multiCitySegments[0]?.flight_date || undefined)
        : isUmrah 
          ? (formData.get("umrah_departure_date") as string || undefined)
          : isCustomService
            ? (formData.get("custom_start_date") as string || undefined)
            : (formData.get("flightDate") as string || undefined),
      selling_price: totalAmount || undefined,
      purchasing_price: formData.get("purchasingPrice") ? parseFloat(formData.get("purchasingPrice") as string) : undefined,
      amount_paid: amountPaid || undefined,
      group_size: groupSize,
      notes: formData.get("notes") as string || undefined,
      passengers_data: passengersData,
    };

    // Validate client data
    const validation = validateData(clientSchema, clientData);
    
    if (!validation.success) {
      setLoading(false);
      toast.error((validation as { success: false; error: string }).error);
      return;
    }

    const validatedData = validation.data;
    
    const finalClientData = {
      ...validatedData,
      travel_type: finalServiceType,
      // Keep date mapping consistent across service types (Ticket/Umrah/Custom)
      flight_date: isMultiCity
        ? (multiCitySegments[0]?.flight_date || null)
        : isUmrah
          ? ((formData.get("umrah_departure_date") as string) || null)
          : isCustomService
            ? ((formData.get("custom_start_date") as string) || null)
            : ((formData.get("flightDate") as string) || null),
      name_update_date: (formData.get("nameUpdateDate") as string) || null,
      remaining_payment_date: (formData.get("remainingPaymentDate") as string) || null,
      payment_amount: totalAmount || null,
      payment_status: paymentStatus,
      vendor_id: vendorId && vendorId !== "none" ? vendorId : null,
      group_booking_type: groupBookingType,
      converted_from_query_id: prefillClient?.converted_from_query_id || editClient?.converted_from_query_id || null,
      converted_from_quote_id: prefillClient?.converted_from_quote_id || editClient?.converted_from_quote_id || null,
    };

    if (editClient) {
      updateClient.mutate({ id: editClient.id, client: finalClientData }, {
        onSuccess: async () => {
          const opBalNum = parseFloat(openingBalanceAmount);
          if (editClient.id && !isNaN(opBalNum) && opBalNum > 0) {
            await upsertBalance.mutateAsync({
              party_type: "client",
              party_id: editClient.id,
              balance_type: openingBalanceType,
              amount: opBalNum,
              as_of_date: new Date().toISOString().split("T")[0],
              notes: "Client opening balance brought forward",
            });
          }
          setLoading(false);
          onOpenChange(false);
        },
        onError: () => setLoading(false)
      });
    } else {
      try {
        const newClient = await addClient.mutateAsync(finalClientData);
        
        // Record initial payment history if amount was paid
        if (amountPaid > 0) {
          const paymentType: "partial" | "full" = amountPaid >= totalAmount ? "full" : "partial";
          await addPaymentHistory.mutateAsync({
            client_id: newClient.id,
            payment_amount: amountPaid,
            payment_type: paymentType,
            payment_date: new Date().toISOString().split('T')[0],
            notes: `Initial payment of ₨${amountPaid.toLocaleString()}`,
            payment_mode: paymentMode,
            bank_name: paymentMode === 'bank' ? bankName : null,
          });
        }

        // Record optional Opening Balance
        const opBalNum = parseFloat(openingBalanceAmount);
        if (newClient?.id && !isNaN(opBalNum) && opBalNum > 0) {
          await upsertBalance.mutateAsync({
            party_type: "client",
            party_id: newClient.id,
            balance_type: openingBalanceType,
            amount: opBalNum,
            as_of_date: new Date().toISOString().split("T")[0],
            notes: "Client opening balance brought forward",
          });
        }

        // If converted from a Query, mark query completed
        if (prefillClient?.converted_from_query_id) {
          try {
            await (supabase as any)
              .from('queries')
              .update({ status: 'completed', converted_booking_id: newClient.id, updated_at: new Date().toISOString() })
              .eq('id', prefillClient.converted_from_query_id);
          } catch (e) {
            console.warn("Failed to update source query status", e);
          }
        }

        // If converted from a Quotation, mark quotation accepted
        if (prefillClient?.converted_from_quote_id) {
          try {
            await (supabase as any)
              .from('quotations')
              .update({ status: 'accepted', converted_booking_id: newClient.id, updated_at: new Date().toISOString() })
              .eq('id', prefillClient.converted_from_quote_id);
          } catch (e) {
            console.warn("Failed to update source quotation status", e);
          }
        }
        
        setLoading(false);
        onOpenChange(false);
        e.currentTarget.reset();
        setGroupBookingType("individual");
        setGroupSize(1);
      } catch (error) {
        setLoading(false);
      }
    }
  };

  // Get existing passenger data for editing
  const getPassengerData = (passengerNumber: number, field: string) => {
    if (!editClient?.passengers_data) return '';
    const passenger = editClient.passengers_data.find((p: any) => p.passenger_number === passengerNumber);
    return passenger?.[field] || '';
  };

  // Get Umrah package data for editing
  const getUmrahData = (field: string) => {
    if (!editClient?.passengers_data?.[0]?.umrah_package) return '';
    return editClient.passengers_data[0].umrah_package[field] || '';
  };

  // Get return flight data for editing
  const getReturnFlightData = (field: string) => {
    if (!editClient?.passengers_data?.[0]?.return_flight) return '';
    return editClient.passengers_data[0].return_flight[field] || '';
  };

  // Get Custom Service data for editing
  const getCustomServiceData = (field: string) => {
    if (!editClient?.passengers_data?.[0]?.custom_service) return '';
    return editClient.passengers_data[0].custom_service[field] || '';
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
                <User className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">{editClient ? 'Edit Client Booking' : 'Add New Client Booking'}</DialogTitle>
                <DialogDescription className="text-muted-foreground/80">Fill client and booking details. For group bookings, enter details for each passenger.</DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {editClient && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVoucherModal(true)}
                  className="h-8 text-xs gap-1.5 font-medium border-primary/40 text-primary hover:bg-primary/5"
                  title="Generate Voucher for this booking"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Create Voucher
                </Button>
              )}
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
          </div>
        </DialogHeader>
        
        {/* Section Navigation - Only in fullscreen */}
        {isFullScreen && (
          <FormSectionNav
            sections={SECTIONS}
            activeSection={activeSection}
            onNavigate={scrollToSection}
          />
        )}
        
        <form onSubmit={handleSubmit} className={cn("flex-1 overflow-y-auto form-scroll-container", isFullScreen ? "p-6 lg:p-8" : "p-2")}>
          <div ref={containerRef} className={isFullScreen ? "max-w-6xl mx-auto space-y-6" : "space-y-4"}>
          <div className="flex justify-end">
            <ScanAutofillButton
              docType="passport"
              label="Scan Passport / ID"
              onApply={(f) => {
                const form = (document.activeElement as HTMLElement)?.closest("form") as HTMLFormElement | null;
                const root = form || document.querySelector<HTMLFormElement>("form");
                if (!root) return;
                const setVal = (name: string, val: any) => {
                  if (!val) return;
                  const el = root.querySelector<HTMLInputElement>(`[name="${name}"]`);
                  if (el) {
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
                    setter?.call(el, String(val));
                    el.dispatchEvent(new Event("input", { bubbles: true }));
                  }
                };
                setVal("passenger_1_name", f.full_name);
                setVal("passenger_1_passport", f.passport_number || f.document_number);
                setVal("passenger_1_dob", f.date_of_birth);
                setVal("passenger_1_nationality", f.nationality);
                setVal("passenger_1_expiry", f.expiry_date);
              }}
            />
          </div>
          
          {/* Validation Summary - Shows missing required fields */}
          {missingFields.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Please fill required fields:</p>
                <ul className="text-xs text-destructive/80 mt-1 list-disc list-inside">
                  {missingFields.map((field, idx) => (
                    <li key={idx}>{field}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Primary Contact Information */}
          <div ref={setSectionRef(0)} className={cn("scroll-reveal", isVisible(0) && "is-visible")}>
          <Card className="form-card form-card-blue">
            <CardHeader className="pb-4 pt-5">
              <div className="form-section-header">
                <div className="form-section-icon form-section-icon-blue">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="form-section-title form-section-title-blue">Primary Contact Information</h3>
                  <p className="form-section-description">Enter the person or company making this booking</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Contact Name *</Label>
                <Input id="name" name="name" required defaultValue={initialData?.name || initialData?.client_name || ''} className="enterprise-input" placeholder="Full name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactNumber" className="text-sm font-medium">Contact Number</Label>
                <Input id="contactNumber" name="contactNumber" defaultValue={initialData?.contact_number || initialData?.phone || ''} className="enterprise-input" placeholder="03001234567" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email" className="text-sm font-medium">Client Email</Label>
                <Input 
                  id="email" 
                  name="email" 
                  type="email"
                  placeholder="client@example.com"
                  defaultValue={initialData?.email || initialData?.client_email || ''} 
                  className="enterprise-input"
                />
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Booking Details */}
          <div ref={setSectionRef(1)} className={cn("scroll-reveal", isVisible(1) && "is-visible")}>
          <Card className="form-card form-card-slate">
            <CardHeader className="pb-4 pt-5">
              <div className="form-section-header">
                <div className="form-section-icon form-section-icon-slate">
                  <Filter className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="form-section-title form-section-title-slate">Booking Details</h3>
                  <p className="form-section-description">Configure the service and travel information</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
              <div className="space-y-2">
                <Label htmlFor="serviceType" className="text-sm font-medium">Service Type *</Label>
                <Select 
                  value={serviceType} 
                  onValueChange={(value) => {
                    setServiceType(value);
                    if (value !== "Ticket") {
                      setTripType('one_way');
                    }
                  }}
                >
                  <SelectTrigger className="enterprise-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ticket">Ticket</SelectItem>
                    <SelectItem value="Umrah">Umrah</SelectItem>
                    <SelectItem value="Custom">Custom Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Trip Type - Only for Ticket service */}
              {serviceType === "Ticket" && (
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
              
              {/* Custom Service Name - Only for Custom */}
              {serviceType === "Custom" && (
                <div className="space-y-2">
                  <Label htmlFor="customServiceType" className="text-sm font-medium">Custom Service Name</Label>
                  <Input 
                    id="customServiceType" 
                    name="customServiceType" 
                    placeholder="Enter service name" 
                    defaultValue={editClient?.travel_type && !['Ticket', 'Ticket – One Way', 'Ticket – Return', 'Umrah'].includes(editClient.travel_type) ? editClient.travel_type : ''} 
                    className="enterprise-input" 
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="groupBookingType" className="text-sm font-medium">Booking Type *</Label>
                <Select 
                  name="groupBookingType" 
                  value={groupBookingType}
                  onValueChange={(value) => {
                    setGroupBookingType(value);
                    if (value === 'individual') {
                      setGroupSize(1);
                    }
                  }}
                  required
                >
                  <SelectTrigger className="enterprise-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual Booking</SelectItem>
                    <SelectItem value="group">Group Booking</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="groupSize" className="text-sm font-medium">Number of Passengers *</Label>
                <Input 
                  id="groupSize" 
                  name="groupSize" 
                  type="number" 
                  min="1" 
                  max="50"
                  disabled={groupBookingType === 'individual'}
                  value={groupSize}
                  onChange={(e) => setGroupSize(parseInt(e.target.value) || 1)}
                  required
                  className="enterprise-input"
                />
              </div>
              
              {/* Standard Ticket Fields - Only show when NOT Umrah, NOT Custom, NOT Multi-City */}
              {!isUmrah && !isCustomService && !isMultiCity && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="flightDate" className="text-sm font-medium">{isReturnTicket ? 'Outbound Date' : 'Flight Date'}</Label>
                    <Input id="flightDate" name="flightDate" type="date" defaultValue={editClient?.flight_date || ''} className="enterprise-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="outboundFlightTime" className="text-sm font-medium flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {isReturnTicket ? 'Outbound Time' : 'Flight Time'}
                    </Label>
                    <Input id="outboundFlightTime" type="time" value={outboundFlightTime} onChange={(e) => setOutboundFlightTime(e.target.value)} className="enterprise-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destination" className="text-sm font-medium">{isReturnTicket ? 'Arrival City' : 'Destination'}</Label>
                    <Input id="destination" name="destination" defaultValue={editClient?.destination || ''} className="enterprise-input" placeholder={isReturnTicket ? "e.g., Dubai" : "e.g., Dubai, London"} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="airline" className="text-sm font-medium">Airline</Label>
                    <Input id="airline" name="airline" defaultValue={editClient?.airline || ''} className="enterprise-input" placeholder="e.g., Emirates, PIA" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pnr" className="text-sm font-medium">{isReturnTicket ? 'Outbound PNR / Flight No' : 'PNR / Reference'}</Label>
                    <Input id="pnr" name="pnr" defaultValue={editClient?.pnr || ''} className="enterprise-input" placeholder="Booking reference" />
                  </div>
                  
                  {/* Return Flight Fields - Only for Return trips */}
                  {isReturnTicket && (
                    <>
                      <Separator className="sm:col-span-2 my-2" />
                      <div className="sm:col-span-2">
                        <div className="flex items-center gap-2 mb-3">
                          <ArrowLeftRight className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-semibold text-blue-600">Return Flight Details</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="return_from" className="text-sm font-medium">Return From</Label>
                        <Input 
                          id="return_from" 
                          name="return_from" 
                          defaultValue={getReturnFlightData('return_from')} 
                          className="enterprise-input" 
                          placeholder="e.g., Dubai" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="return_to" className="text-sm font-medium">Return To</Label>
                        <Input 
                          id="return_to" 
                          name="return_to" 
                          defaultValue={getReturnFlightData('return_to')} 
                          className="enterprise-input" 
                          placeholder="e.g., Lahore" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="return_date" className="text-sm font-medium">Return Date</Label>
                        <Input 
                          id="return_date" 
                          name="return_date" 
                          type="date" 
                          defaultValue={getReturnFlightData('return_date')} 
                          className="enterprise-input" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="returnFlightTime" className="text-sm font-medium flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Return Flight Time
                        </Label>
                        <Input id="returnFlightTime" type="time" value={returnFlightTime} onChange={(e) => setReturnFlightTime(e.target.value)} className="enterprise-input" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="return_pnr" className="text-sm font-medium">Return PNR / Flight No</Label>
                        <Input 
                          id="return_pnr" 
                          name="return_pnr" 
                          defaultValue={getReturnFlightData('return_pnr')} 
                          className="enterprise-input" 
                          placeholder="Return flight reference" 
                        />
                      </div>
                    </>
                  )}
                  
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="nameUpdateDate" className="text-sm font-medium">Name Update Date (Optional)</Label>
                    <Input 
                      id="nameUpdateDate" 
                      name="nameUpdateDate" 
                      type="date" 
                      defaultValue={editClient?.name_update_date || ''} 
                      className="enterprise-input"
                    />
                    <p className="text-xs text-muted-foreground/70">
                      Set reminder for when to update passenger name on ticket
                    </p>
                  </div>
                </>
              )}

              {/* Multi-City Flight Segments */}
              {isMultiCity && (
                <>
                  <div className="sm:col-span-2 space-y-4 mt-2">
                    <div className="flex items-center gap-2">
                      <Route className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">Multi-City Flight Segments</span>
                      <span className="text-xs text-muted-foreground ml-auto">{multiCitySegments.length}/6 segments</span>
                    </div>
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
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="nameUpdateDate" className="text-sm font-medium">Name Update Date (Optional)</Label>
                    <Input id="nameUpdateDate" name="nameUpdateDate" type="date" defaultValue={editClient?.name_update_date || ''} className="enterprise-input" />
                  </div>
                </>
              )}
              {/* Custom Service Fields - Only show for Custom Service */}
              {isCustomService && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="custom_start_date" className="text-sm font-medium">Start Date / Service Date</Label>
                    <Input 
                      id="custom_start_date" 
                      name="custom_start_date" 
                      type="date" 
                      defaultValue={getCustomServiceData('start_date') || editClient?.flight_date || ''} 
                      className="enterprise-input" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom_end_date" className="text-sm font-medium">End Date / Expiry Date</Label>
                    <Input 
                      id="custom_end_date" 
                      name="custom_end_date" 
                      type="date" 
                      defaultValue={getCustomServiceData('end_date')} 
                      className="enterprise-input" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom_reference" className="text-sm font-medium">Reference Number / Appointment ID</Label>
                    <Input 
                      id="custom_reference" 
                      name="custom_reference" 
                      defaultValue={getCustomServiceData('reference') || editClient?.pnr || ''} 
                      className="enterprise-input" 
                      placeholder="e.g., APT-12345" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom_location" className="text-sm font-medium">Service Location / Platform</Label>
                    <Input 
                      id="custom_location" 
                      name="custom_location" 
                      defaultValue={getCustomServiceData('location')} 
                      className="enterprise-input" 
                      placeholder="e.g., Islamabad Office, Online" 
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          </div>

          {/* UMRAH PACKAGE BLOCK - Only when Umrah is selected */}
          {isUmrah && (
            <Card className="form-card form-card-emerald border-emerald-200 dark:border-emerald-800/30">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                    <Plane className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="form-section-title text-emerald-700 dark:text-emerald-400">Umrah Package Details</h3>
                    <p className="form-section-description">Return flight, hotels, and transport information</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pb-6">
                {/* Flights Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Plane className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Flights (Return)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="umrah_departure_city" className="text-sm font-medium">Departure City *</Label>
                      <Input 
                        id="umrah_departure_city" 
                        name="umrah_departure_city" 
                        required
                        defaultValue={getUmrahData('departure_city')} 
                        className="enterprise-input border-emerald-200 focus:border-emerald-500" 
                        placeholder="e.g., Lahore, Karachi" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="umrah_arrival_city" className="text-sm font-medium">Arrival City *</Label>
                      <Select 
                        name="umrah_arrival_city" 
                        defaultValue={getUmrahData('arrival_city') || "Jeddah"}
                      >
                        <SelectTrigger className="enterprise-input border-emerald-200 focus:border-emerald-500">
                          <SelectValue placeholder="Select city" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Jeddah">Jeddah</SelectItem>
                          <SelectItem value="Madinah">Madinah</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="umrah_airline" className="text-sm font-medium">Airline</Label>
                      <Input 
                        id="umrah_airline" 
                        name="umrah_airline" 
                        defaultValue={getUmrahData('airline')} 
                        className="enterprise-input border-emerald-200 focus:border-emerald-500" 
                        placeholder="e.g., Saudi Airlines, PIA" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="umrah_departure_date" className="text-sm font-medium">Departure Date *</Label>
                      <Input 
                        id="umrah_departure_date" 
                        name="umrah_departure_date" 
                        type="date" 
                        required
                        defaultValue={getUmrahData('departure_date') || editClient?.flight_date || ''} 
                        className="enterprise-input border-emerald-200 focus:border-emerald-500" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="umrahOutboundTime" className="text-sm font-medium flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Departure Time
                      </Label>
                      <Input id="umrahOutboundTime" type="time" value={outboundFlightTime} onChange={(e) => setOutboundFlightTime(e.target.value)} className="enterprise-input border-emerald-200 focus:border-emerald-500" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="umrah_return_date" className="text-sm font-medium">Return Date *</Label>
                      <Input 
                        id="umrah_return_date" 
                        name="umrah_return_date" 
                        type="date" 
                        required
                        defaultValue={getUmrahData('return_date')} 
                        className="enterprise-input border-emerald-200 focus:border-emerald-500" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="umrahReturnTime" className="text-sm font-medium flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Return Time
                      </Label>
                      <Input id="umrahReturnTime" type="time" value={returnFlightTime} onChange={(e) => setReturnFlightTime(e.target.value)} className="enterprise-input border-emerald-200 focus:border-emerald-500" />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Transport Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Bus className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Transport</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800/30">
                      <Label htmlFor="transport_included" className="text-sm font-medium cursor-pointer">Transport Included?</Label>
                      <Switch 
                        id="transport_included"
                        checked={transportIncluded}
                        onCheckedChange={setTransportIncluded}
                      />
                    </div>
                    {transportIncluded && (
                      <div className="space-y-2">
                        <Label htmlFor="umrah_transport_details" className="text-sm font-medium">Transport Details</Label>
                        <Input 
                          id="umrah_transport_details" 
                          name="umrah_transport_details" 
                          defaultValue={getUmrahData('transport_details')} 
                          className="enterprise-input border-emerald-200 focus:border-emerald-500" 
                          placeholder="e.g., Bus / Car / Ziyarat" 
                        />
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Hotels Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Hotel className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Hotels</span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Makkah Hotel */}
                    <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-lg border border-emerald-200/50 dark:border-emerald-800/20">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-3">🕋 Makkah Hotel</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2 col-span-2">
                          <Label htmlFor="umrah_makkah_hotel" className="text-sm font-medium">Hotel Name</Label>
                          <Input 
                            id="umrah_makkah_hotel" 
                            name="umrah_makkah_hotel" 
                            defaultValue={getUmrahData('makkah_hotel')} 
                            className="enterprise-input border-emerald-200 focus:border-emerald-500" 
                            placeholder="e.g., Grand Zamzam" 
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label htmlFor="umrah_makkah_nights" className="text-sm font-medium">Nights</Label>
                          <Input 
                            id="umrah_makkah_nights" 
                            name="umrah_makkah_nights" 
                            type="number"
                            min="0"
                            defaultValue={getUmrahData('makkah_nights') || ''} 
                            className="enterprise-input border-emerald-200 focus:border-emerald-500" 
                            placeholder="0" 
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Madinah Hotel */}
                    <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-lg border border-emerald-200/50 dark:border-emerald-800/20">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-3">🕌 Madinah Hotel</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2 col-span-2">
                          <Label htmlFor="umrah_madinah_hotel" className="text-sm font-medium">Hotel Name</Label>
                          <Input 
                            id="umrah_madinah_hotel" 
                            name="umrah_madinah_hotel" 
                            defaultValue={getUmrahData('madinah_hotel')} 
                            className="enterprise-input border-emerald-200 focus:border-emerald-500" 
                            placeholder="e.g., Dar Al Hijra" 
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label htmlFor="umrah_madinah_nights" className="text-sm font-medium">Nights</Label>
                          <Input 
                            id="umrah_madinah_nights" 
                            name="umrah_madinah_nights" 
                            type="number"
                            min="0"
                            defaultValue={getUmrahData('madinah_nights') || ''} 
                            className="enterprise-input border-emerald-200 focus:border-emerald-500" 
                            placeholder="0" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Passenger Details for Individual and Group Bookings */}
          <div ref={setSectionRef(2)} className={cn("scroll-reveal", isVisible(2) && "is-visible")}>
          {((groupBookingType === 'group' && groupSize >= 1) || groupBookingType === 'individual') && (
            <Card className="form-card form-card-green">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon-green">
                    {groupBookingType === 'individual' ? <User className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="form-section-title form-section-title-green">Passenger Travel Documents</h3>
                    <p className="form-section-description">
                      Enter actual traveler details - this information will appear on tickets and boarding passes
                      {groupBookingType !== 'individual' && ` (${groupSize} passengers)`}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                {Array.from({ length: groupBookingType === 'individual' ? 1 : groupSize }, (_, index) => {
                  const passengerNum = index + 1;
                  return (
                    <div key={passengerNum} className="passenger-card passenger-card-green">
                      <h4 className="font-semibold text-sm flex items-center gap-2 mb-4">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                          {passengerNum}
                        </span>
                        <span className="form-section-title-green">Passenger {passengerNum}</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`passenger_${passengerNum}_name`} className="text-sm font-medium">Full Name (as on passport) *</Label>
                          <Input 
                            id={`passenger_${passengerNum}_name`}
                            name={`passenger_${passengerNum}_name`}
                            placeholder="Full legal name"
                            defaultValue={getPassengerData(passengerNum, 'name')}
                            required
                            className="enterprise-input border-green-200 focus:border-green-500 focus:ring-green-500/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`passenger_${passengerNum}_passport`} className="text-sm font-medium">Passport Number</Label>
                          <Input 
                            id={`passenger_${passengerNum}_passport`}
                            name={`passenger_${passengerNum}_passport`}
                            placeholder="AB1234567"
                            defaultValue={getPassengerData(passengerNum, 'passport_number')}
                            className="enterprise-input border-green-200 focus:border-green-500 focus:ring-green-500/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`passenger_${passengerNum}_cnic`} className="text-sm font-medium">CNIC</Label>
                          <Input 
                            id={`passenger_${passengerNum}_cnic`}
                            name={`passenger_${passengerNum}_cnic`}
                            placeholder="12345-1234567-1"
                            defaultValue={getPassengerData(passengerNum, 'cnic')}
                            className="enterprise-input border-green-200 focus:border-green-500 focus:ring-green-500/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`passenger_${passengerNum}_dob`} className="text-sm font-medium">Date of Birth</Label>
                          <Input 
                            id={`passenger_${passengerNum}_dob`}
                            name={`passenger_${passengerNum}_dob`}
                            type="date"
                            defaultValue={getPassengerData(passengerNum, 'date_of_birth')}
                            className="enterprise-input border-green-200 focus:border-green-500 focus:ring-green-500/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`passenger_${passengerNum}_gender`} className="text-sm font-medium">Gender</Label>
                          <Select 
                            name={`passenger_${passengerNum}_gender`}
                            defaultValue={getPassengerData(passengerNum, 'gender')}
                          >
                            <SelectTrigger className="enterprise-input border-green-200 focus:border-green-500 focus:ring-green-500/20">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="M">Male</SelectItem>
                              <SelectItem value="F">Female</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`passenger_${passengerNum}_nationality`} className="text-sm font-medium">Nationality</Label>
                          <Input 
                            id={`passenger_${passengerNum}_nationality`}
                            name={`passenger_${passengerNum}_nationality`}
                            placeholder="e.g., Pakistani"
                            defaultValue={getPassengerData(passengerNum, 'nationality')}
                            className="enterprise-input border-green-200 focus:border-green-500 focus:ring-green-500/20"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          </div>

          {/* Payment Information */}
          <div ref={setSectionRef(3)} className={cn("scroll-reveal", isVisible(3) && "is-visible")}>
          <Card className="form-card form-card-amber">
            <CardHeader className="pb-4 pt-5">
              <div className="form-section-header">
                <div className="form-section-icon form-section-icon-amber">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="form-section-title form-section-title-amber">Payment Information</h3>
                  <p className="form-section-description">Track pricing and payment details</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
              <div className="space-y-2">
                <Label htmlFor="purchasingPrice" className="text-sm font-medium">Purchasing Price (PKR)</Label>
                <Input id="purchasingPrice" name="purchasingPrice" type="number" step="0.01" placeholder="Cost price" defaultValue={initialData?.purchasing_price || ''} className="enterprise-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellingPrice" className="text-sm font-medium">Total Amount (PKR) *</Label>
                <Input 
                  id="sellingPrice" 
                  name="sellingPrice" 
                  type="number" 
                  step="0.01" 
                  required 
                  placeholder="Total amount" 
                  defaultValue={initialData?.selling_price || initialData?.payment_amount || ''} 
                  className="enterprise-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amountPaid" className="text-sm font-medium">Amount Paid (PKR) *</Label>
                <Input 
                  id="amountPaid" 
                  name="amountPaid" 
                  type="number" 
                  step="0.01" 
                  required
                  placeholder="Paid amount" 
                  defaultValue={initialData?.amount_paid || 0} 
                  className="enterprise-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remainingPaymentDate" className="text-sm font-medium">Remaining Payment Due</Label>
                <Input id="remainingPaymentDate" name="remainingPaymentDate" type="date" defaultValue={initialData?.remaining_payment_date || ''} className="enterprise-input" />
              </div>
              {!editClient && (
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-sm font-medium">Payment Mode</Label>
                  <PaymentModeSelect
                    value={paymentMode}
                    onChange={setPaymentMode}
                    bankName={bankName}
                    onBankNameChange={setBankName}
                  />
                </div>
              )}

              {/* Optional Opening Balance Section */}
              <div className="sm:col-span-2 p-3.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-amber-600" />
                  <div>
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-300">Opening Balance (Optional Brought-Forward)</p>
                    <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">Historical balance prior to software start. Does not affect P&L or sales revenue.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Opening Balance (PKR)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={openingBalanceAmount}
                      onChange={(e) => setOpeningBalanceAmount(e.target.value)}
                      placeholder="0.00"
                      className="h-9 text-xs enterprise-input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Balance Type</Label>
                    <Select
                      value={openingBalanceType}
                      onValueChange={(val: any) => setOpeningBalanceType(val)}
                    >
                      <SelectTrigger className="h-9 text-xs enterprise-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receivable">Receivable (Client owes Agency)</SelectItem>
                        <SelectItem value="payable">Advance / Credit (Agency owes Client)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Vendor Association */}
          <div ref={setSectionRef(4)} className={cn("scroll-reveal", isVisible(4) && "is-visible")}>
          <Card className="form-card form-card-purple">
            <CardHeader className="pb-4 pt-5">
              <div className="form-section-header">
                <div className="form-section-icon form-section-icon-purple">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="form-section-title form-section-title-purple">Vendor Association</h3>
                  <p className="form-section-description">Link this booking to a vendor (optional)</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <input type="hidden" name="vendorId" value={selectedVendorId} />
              
              {/* Linked Vendor Display */}
              {selectedVendorId !== "none" && (
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
                <DialogContent className="w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Plus className="w-5 h-5 text-primary" />
                      Add New Vendor
                    </DialogTitle>
                    <DialogDescription>
                      Create a new vendor and link it to this booking
                    </DialogDescription>
                  </DialogHeader>
                  <form ref={quickVendorFormRef} className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="vendor_name" className="text-sm">Vendor Name *</Label>
                        <Input id="vendor_name" name="vendor_name" required placeholder="Company name" className="enterprise-input" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="vendor_service_type" className="text-sm">Service Type *</Label>
                        <Input id="vendor_service_type" name="vendor_service_type" required placeholder="e.g., Hotel, Transport" className="enterprise-input" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="vendor_contact_person" className="text-sm">Contact Person</Label>
                        <Input id="vendor_contact_person" name="vendor_contact_person" placeholder="Contact name" className="enterprise-input" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="vendor_contact_number" className="text-sm">Contact Number</Label>
                        <Input id="vendor_contact_number" name="vendor_contact_number" placeholder="Phone number" className="enterprise-input" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="vendor_email" className="text-sm">Email</Label>
                        <Input id="vendor_email" name="vendor_email" type="email" placeholder="email@example.com" className="enterprise-input" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="vendor_booking_date" className="text-sm">Booking Date</Label>
                        <Input id="vendor_booking_date" name="vendor_booking_date" type="date" className="enterprise-input" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="vendor_payment_amount" className="text-sm">Total Amount (₨)</Label>
                        <Input id="vendor_payment_amount" name="vendor_payment_amount" type="number" step="0.01" placeholder="0" className="enterprise-input" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="vendor_amount_paid" className="text-sm">Amount Paid (₨)</Label>
                        <Input id="vendor_amount_paid" name="vendor_amount_paid" type="number" step="0.01" placeholder="0" defaultValue="0" className="enterprise-input" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="vendor_notes" className="text-sm">Notes</Label>
                      <Textarea id="vendor_notes" name="vendor_notes" rows={2} placeholder="Additional vendor details..." />
                    </div>
                    <div className="flex gap-2 justify-end pt-3 border-t">
                      <Button 
                        type="button" 
                        variant="ghost"
                        onClick={() => setShowQuickVendorAdd(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        disabled={addVendor.isPending}
                        onClick={handleQuickVendorAdd}
                      >
                        {addVendor.isPending ? "Adding..." : "Add & Link Vendor"}
                      </Button>
                    </div>
                  </form>
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
          </div>

          {/* Additional Notes */}
          <div ref={setSectionRef(5)} className={cn("scroll-reveal", isVisible(5) && "is-visible")}>
          <div className="space-y-2 lg:col-span-2 xl:col-span-3">
            <Label htmlFor="notes" className="text-sm font-medium">Additional Notes</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="Any additional information about this booking..." defaultValue={initialData?.notes || ''} className="enterprise-input min-h-[80px] resize-none" />
          </div>
          </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 mt-4 border-t border-border/50 sticky bottom-0 bg-background pb-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="px-6">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || addClient.isPending || updateClient.isPending}
              className="px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25"
            >
              {loading || addClient.isPending || updateClient.isPending ? (editClient ? "Updating..." : "Adding...") : (editClient ? "Update Booking" : "Add Booking")}
            </Button>
          </div>
        </form>

        {showVoucherModal && (
          <CreateVoucherDialog
            open={showVoucherModal}
            onOpenChange={setShowVoucherModal}
            initialBookingData={editClient}
            onSave={async (v) => {
              await addVoucher.mutateAsync({ ...v, booking_id: editClient?.id });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
