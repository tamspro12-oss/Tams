import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClients } from "@/hooks/useStorage";
import { useB2BAgents, B2BAgent } from "@/hooks/useB2BAgents";
import { useB2BBookings, B2BBooking } from "@/hooks/useB2BBookings";
import { useVendors } from "@/hooks/useStorage";
import { useAgency } from "@/hooks/useAgency";
import { useClientPaymentHistoryLocal } from "@/hooks/useLocalPaymentHistory";
import { useOpeningBalances } from "@/hooks/useOpeningBalances";
import { ScanAutofillButton } from "@/components/ai/ScanAutofillButton";
import {
  X,
  Plus,
  Trash2,
  ScanLine,
  User,
  Users,
  Building2,
  Plane,
  CreditCard,
  DollarSign,
  Calendar as CalendarIcon,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronDown,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export interface PassengerItem {
  id: string;
  name: string;
  passport_number: string;
  cnic: string;
  date_of_birth: string;
  gender: string;
  nationality: string;
}

interface MasterAddBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "direct" | "b2b";
  prefilledAgentId?: string | null;
  editBookingData?: any | null; // Can be a direct client booking or B2B booking
  onSaved?: (savedItem: any, mode: "direct" | "b2b") => void;
}

export function MasterAddBookingModal({
  open,
  onOpenChange,
  initialMode = "direct",
  prefilledAgentId = null,
  editBookingData = null,
  onSaved,
}: MasterAddBookingModalProps) {
  // Mode: direct vs b2b
  const [bookingMode, setBookingMode] = useState<"direct" | "b2b">(
    editBookingData?.agent_id ? "b2b" : initialMode
  );

  // Unsaved changes confirmation dialog
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // API Hooks
  const { addClient, updateClient } = useClients();
  const { agents, addAgent } = useB2BAgents();
  const { addBooking: addB2BBooking, updateBooking: updateB2BBooking } = useB2BBookings();
  const { vendors, addVendor } = useVendors();
  const { data: agency } = useAgency();
  const { addPaymentHistory } = useClientPaymentHistoryLocal();
  const { balances, upsertBalance } = useOpeningBalances();

  // References for focus management
  const contactNameInputRef = useRef<HTMLInputElement>(null);
  const firstPassengerNameRef = useRef<HTMLInputElement>(null);

  // =================== AGENT STATE (B2B) ===================
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    prefilledAgentId || editBookingData?.agent_id || ""
  );
  const [agentSearchOpen, setAgentSearchOpen] = useState(false);
  const [agentSearchQuery, setAgentSearchQuery] = useState("");
  const [showAgentDetails, setShowAgentDetails] = useState(false);

  // New Agent inline details
  const [newAgentBusiness, setNewAgentBusiness] = useState("");
  const [newAgentEmail, setNewAgentEmail] = useState("");
  const [newAgentPhone, setNewAgentPhone] = useState("");
  const [newAgentCountry, setNewAgentCountry] = useState("Pakistan");
  const [newAgentCity, setNewAgentCity] = useState("");
  const [newAgentCommissionType, setNewAgentCommissionType] = useState<"percentage" | "fixed">("percentage");
  const [newAgentCommissionValue, setNewAgentCommissionValue] = useState<string>("0");
  const [newAgentStatus, setNewAgentStatus] = useState<"active" | "inactive">("active");
  const [newAgentOpeningBalance, setNewAgentOpeningBalance] = useState<string>("");
  const [newAgentOpeningBalanceType, setNewAgentOpeningBalanceType] = useState<"receivable" | "payable">("receivable");
  const [newAgentNotes, setNewAgentNotes] = useState("");

  // =================== ROW 1: CONTACT INFO ===================
  const [contactName, setContactName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // =================== ROW 2: SERVICE & FLIGHT ===================
  const [serviceType, setServiceType] = useState("Ticket");
  const [tripType, setTripType] = useState<"one_way" | "return" | "multi_city">("one_way");
  const [paxCount, setPaxCount] = useState<number>(1);
  const [airline, setAirline] = useState("");
  const [destination, setDestination] = useState("");
  const [flightDate, setFlightDate] = useState("");
  const [flightTime, setFlightTime] = useState("");
  const [pnr, setPnr] = useState("");
  const [nameUpdateDate, setNameUpdateDate] = useState("");

  // =================== ROW 3: PASSENGERS TABLE ===================
  const [passengers, setPassengers] = useState<PassengerItem[]>([
    {
      id: "pax-1",
      name: "",
      passport_number: "",
      cnic: "",
      date_of_birth: "",
      gender: "M",
      nationality: "Pakistani",
    },
  ]);

  // =================== ROW 4: FINANCIALS & OPS ===================
  const [purchasingPrice, setPurchasingPrice] = useState<string>("");
  const [sellingPrice, setSellingPrice] = useState<string>("");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<string>("cash");
  const [bankName, setBankName] = useState<string>("");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("none");
  const [vendorSearchOpen, setVendorSearchOpen] = useState(false);
  const [notes, setNotes] = useState("");

  // Quick Vendor Add state
  const [showQuickVendorAdd, setShowQuickVendorAdd] = useState(false);
  const [quickVendorName, setQuickVendorName] = useState("");
  const [quickVendorService, setQuickVendorService] = useState("");

  // Opening Balance Toggle for direct client
  const [showOpeningBalance, setShowOpeningBalance] = useState(false);
  const [openingBalanceAmount, setOpeningBalanceAmount] = useState("");
  const [openingBalanceType, setOpeningBalanceType] = useState<"receivable" | "payable">("receivable");

  // Track if form is dirty
  const isDirty = useMemo(() => {
    return Boolean(
      contactName ||
      contactNumber ||
      contactEmail ||
      airline ||
      destination ||
      pnr ||
      purchasingPrice ||
      sellingPrice ||
      amountPaid ||
      passengers.some((p) => p.name || p.passport_number)
    );
  }, [
    contactName,
    contactNumber,
    contactEmail,
    airline,
    destination,
    pnr,
    purchasingPrice,
    sellingPrice,
    amountPaid,
    passengers,
  ]);

  // Active agent object
  const activeAgent = useMemo(() => {
    return agents.find((a) => a.id === selectedAgentId) || null;
  }, [agents, selectedAgentId]);

  // Remaining calculation
  const remainingAmount = useMemo(() => {
    const total = parseFloat(sellingPrice) || 0;
    const paid = parseFloat(amountPaid) || 0;
    return Math.max(0, total - paid);
  }, [sellingPrice, amountPaid]);

  // Commission calculation for B2B
  const calculatedCommission = useMemo(() => {
    if (bookingMode !== "b2b") return 0;
    const total = parseFloat(sellingPrice) || 0;
    if (activeAgent) {
      if (activeAgent.commission_type === "percentage") {
        return (total * (activeAgent.commission_value || 0)) / 100;
      }
      return activeAgent.commission_value || 0;
    }
    const commVal = parseFloat(newAgentCommissionValue) || 0;
    if (newAgentCommissionType === "percentage") {
      return (total * commVal) / 100;
    }
    return commVal;
  }, [bookingMode, sellingPrice, activeAgent, newAgentCommissionType, newAgentCommissionValue]);

  // Gross profit calculation
  const calculatedProfit = useMemo(() => {
    const sell = parseFloat(sellingPrice) || 0;
    const purchase = parseFloat(purchasingPrice) || 0;
    if (bookingMode === "b2b") {
      return sell - purchase - calculatedCommission;
    }
    return sell - purchase;
  }, [sellingPrice, purchasingPrice, bookingMode, calculatedCommission]);

  // Synchronize passengers array length with paxCount
  useEffect(() => {
    if (paxCount < 1) return;
    setPassengers((prev) => {
      if (prev.length === paxCount) return prev;
      if (prev.length < paxCount) {
        const added: PassengerItem[] = [];
        for (let i = prev.length + 1; i <= paxCount; i++) {
          added.push({
            id: `pax-${i}-${Date.now()}`,
            name: "",
            passport_number: "",
            cnic: "",
            date_of_birth: "",
            gender: "M",
            nationality: "Pakistani",
          });
        }
        return [...prev, ...added];
      }
      return prev.slice(0, paxCount);
    });
  }, [paxCount]);

  // Autofocus contact name on open
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        contactNameInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Prepopulate if editBookingData is provided
  useEffect(() => {
    if (editBookingData && open) {
      const isB2B = Boolean(editBookingData.agent_id);
      setBookingMode(isB2B ? "b2b" : "direct");
      if (isB2B) {
        setSelectedAgentId(editBookingData.agent_id);
      }
      setContactName(
        editBookingData.name || editBookingData.passenger_name || editBookingData.contact_person || ""
      );
      setContactNumber(
        editBookingData.contact_number || editBookingData.passenger_contact || ""
      );
      setContactEmail(editBookingData.email || "");
      setServiceType(editBookingData.travel_type || "Ticket");
      setAirline(editBookingData.airline || "");
      setDestination(editBookingData.destination || "");
      setFlightDate(editBookingData.flight_date || "");
      setPnr(editBookingData.pnr || "");
      setNameUpdateDate(editBookingData.name_update_date || "");
      setPurchasingPrice(editBookingData.purchasing_price?.toString() || "");
      setSellingPrice(editBookingData.selling_price?.toString() || "");
      setAmountPaid(editBookingData.amount_paid?.toString() || "");
      setSelectedVendorId(editBookingData.vendor_id || "none");
      setNotes(editBookingData.notes || "");

      // Populate passengers
      if (Array.isArray(editBookingData.passengers_data) && editBookingData.passengers_data.length > 0) {
        setPaxCount(editBookingData.passengers_data.length);
        setPassengers(
          editBookingData.passengers_data.map((p: any, idx: number) => ({
            id: `edit-pax-${idx}`,
            name: p.name || "",
            passport_number: p.passport_number || "",
            cnic: p.cnic || "",
            date_of_birth: p.date_of_birth || "",
            gender: p.gender || "M",
            nationality: p.nationality || "Pakistani",
          }))
        );
      } else if (editBookingData.passenger_name) {
        setPaxCount(1);
        setPassengers([
          {
            id: "edit-pax-single",
            name: editBookingData.passenger_name || "",
            passport_number: editBookingData.passenger_passport || "",
            cnic: editBookingData.cnic || "",
            date_of_birth: "",
            gender: "M",
            nationality: "Pakistani",
          },
        ]);
      }
    } else if (!editBookingData && open) {
      if (prefilledAgentId) {
        setBookingMode("b2b");
        setSelectedAgentId(prefilledAgentId);
      } else {
        setBookingMode(initialMode);
      }
    }
  }, [editBookingData, open, prefilledAgentId, initialMode]);

  // Keyboard shortcut listener:
  // Ctrl+1: Direct mode
  // Ctrl+2: B2B mode
  // Ctrl+Enter: Save
  // Ctrl+Shift+Enter: Save & Add Next
  // Esc: Cancel
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && e.key === "1") {
        e.preventDefault();
        setBookingMode("direct");
        toast.info("Switched to Direct Client mode");
      } else if (isCtrlOrCmd && e.key === "2") {
        e.preventDefault();
        setBookingMode("b2b");
        toast.info("Switched to B2B Agent mode");
      } else if (isCtrlOrCmd && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        handleSave(true); // Save and Add Next
      } else if (isCtrlOrCmd && e.key === "Enter") {
        e.preventDefault();
        handleSave(false); // Save
      } else if (e.key === "Escape") {
        // If child popovers or selects are open, allow default behavior
        if (agentSearchOpen || vendorSearchOpen || showQuickVendorAdd) {
          return;
        }
        e.preventDefault();
        handleCloseRequest();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    open,
    agentSearchOpen,
    vendorSearchOpen,
    showQuickVendorAdd,
    isDirty,
    bookingMode,
    contactName,
    contactNumber,
    contactEmail,
    airline,
    destination,
    flightDate,
    pnr,
    sellingPrice,
    purchasingPrice,
    amountPaid,
    selectedAgentId,
    selectedVendorId,
    passengers,
  ]);

  const handleCloseRequest = () => {
    if (isDirty) {
      setShowExitConfirm(true);
    } else {
      onOpenChange(false);
    }
  };

  // Helper for ddmmyyyy auto-format
  const handleDateInputBlurOrChange = (
    val: string,
    setter: (val: string) => void
  ) => {
    const cleanDigits = val.replace(/\D/g, "");
    if (cleanDigits.length === 8) {
      const day = cleanDigits.substring(0, 2);
      const month = cleanDigits.substring(2, 4);
      const year = cleanDigits.substring(4, 8);
      // Validate reasonable year/month/day
      if (parseInt(month, 10) >= 1 && parseInt(month, 10) <= 12) {
        setter(`${year}-${month}-${day}`);
        return;
      }
    }
    setter(val);
  };

  // Passenger update handler
  const updatePassenger = (
    index: number,
    field: keyof PassengerItem,
    value: string
  ) => {
    setPassengers((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });

    // If updating passenger 1 name and contact name is empty, sync contact name
    if (index === 0 && field === "name" && !contactName) {
      setContactName(value);
    }
  };

  // Passenger removal handler
  const removePassenger = (index: number) => {
    if (passengers.length <= 1) return;
    setPassengers((prev) => prev.filter((_, idx) => idx !== index));
    setPaxCount((prev) => Math.max(1, prev - 1));
  };

  // Handle Enter key on the last passenger row's nationality field to add row
  const handleLastPassengerKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    isLastRow: boolean
  ) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      if (isLastRow) {
        e.preventDefault();
        setPaxCount((prev) => prev + 1);
        setTimeout(() => {
          // Focus new passenger name
          const inputs = document.querySelectorAll<HTMLInputElement>(
            'input[data-pax-field="name"]'
          );
          inputs[inputs.length - 1]?.focus();
        }, 60);
      }
    }
  };

  // Quick Vendor Add handler
  const handleQuickAddVendor = async () => {
    if (!quickVendorName.trim()) {
      toast.error("Vendor name is required");
      return;
    }
    try {
      const newV = await addVendor.mutateAsync({
        name: quickVendorName.trim(),
        service_type: quickVendorService || serviceType,
        payment_amount: 0,
        amount_paid: 0,
        payment_status: "Pending",
      });
      setSelectedVendorId(newV.id);
      setShowQuickVendorAdd(false);
      setQuickVendorName("");
      toast.success(`Vendor "${newV.name}" created and selected!`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to add vendor");
    }
  };

  // Inline Agent Creation handler
  const handleCreateInlineAgent = async (name: string) => {
    if (!name.trim()) return;
    try {
      const created = await addAgent.mutateAsync({
        agent_name: name.trim(),
        business_name: newAgentBusiness || null,
        email: newAgentEmail || null,
        phone: newAgentPhone || null,
        country: newAgentCountry || "Pakistan",
        city: newAgentCity || null,
        commission_type: newAgentCommissionType,
        commission_value: parseFloat(newAgentCommissionValue) || 0,
        status: newAgentStatus,
        notes: newAgentNotes || null,
      });

      // Opening balance if provided
      const opBal = parseFloat(newAgentOpeningBalance);
      if (!isNaN(opBal) && opBal > 0) {
        await upsertBalance.mutateAsync({
          party_type: "b2b_agent",
          party_id: created.id,
          balance_type: newAgentOpeningBalanceType,
          amount: opBal,
          as_of_date: new Date().toISOString().split("T")[0],
          notes: "Initial brought-forward opening balance",
        });
      }

      setSelectedAgentId(created.id);
      setAgentSearchOpen(false);
      setAgentSearchQuery("");
      setShowAgentDetails(false);
      toast.success(`Agent "${created.agent_name}" created & linked!`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create agent");
    }
  };

  // Scan & Autofill handler
  const handleScanApply = (fields: Record<string, any>) => {
    if (fields.full_name || fields.passenger_name) {
      const name = fields.full_name || fields.passenger_name;
      setContactName(name);
      updatePassenger(0, "name", name);
    }
    if (fields.passport_number || fields.document_number) {
      updatePassenger(
        0,
        "passport_number",
        fields.passport_number || fields.document_number
      );
    }
    if (fields.contact || fields.phone) {
      setContactNumber(fields.contact || fields.phone);
    }
    if (fields.pnr) setPnr(fields.pnr.toUpperCase());
    if (fields.airline) setAirline(fields.airline);
    if (fields.departure_date || fields.date) {
      setFlightDate(fields.departure_date || fields.date);
    }
    if (fields.arrival_city || fields.destination) {
      setDestination(fields.arrival_city || fields.destination);
    }
    toast.success("Document scanned & fields autofilled!");
  };

  // Reset form for "Save & Add Next"
  const resetFormForNext = () => {
    // Keeps: agent, flightDate, serviceType, airline, paymentMode, selectedVendorId
    // Clears: passengers list, amounts, contact name, contact number, pnr
    setContactName("");
    setContactNumber("");
    setContactEmail("");
    setPnr("");
    setPurchasingPrice("");
    setSellingPrice("");
    setAmountPaid("");
    setPaxCount(1);
    setPassengers([
      {
        id: `pax-next-${Date.now()}`,
        name: "",
        passport_number: "",
        cnic: "",
        date_of_birth: "",
        gender: "M",
        nationality: "Pakistani",
      },
    ]);
    setTimeout(() => {
      // Set cursor on first passenger name
      firstPassengerNameRef.current?.focus();
    }, 100);
  };

  // Main Save Handler
  const handleSave = async (isSaveAndAddNext = false) => {
    // Validation
    const cleanContact = contactName.trim() || passengers[0]?.name.trim();
    if (!cleanContact) {
      toast.error("Contact name or Passenger name is required");
      contactNameInputRef.current?.focus();
      return;
    }

    const sellPrice = parseFloat(sellingPrice) || 0;
    if (sellPrice <= 0) {
      toast.error("Total Amount (Selling Price) is required");
      return;
    }

    if (bookingMode === "b2b" && !selectedAgentId) {
      toast.error("Please select or create a B2B Agent");
      return;
    }

    setIsSubmitting(true);

    try {
      const purchasePriceVal = parseFloat(purchasingPrice) || 0;
      const paidVal = parseFloat(amountPaid) || 0;
      const paymentStatus =
        paidVal >= sellPrice ? "Paid" : paidVal > 0 ? "Partial" : "Pending";
      const vendorIdVal =
        selectedVendorId && selectedVendorId !== "none" ? selectedVendorId : null;

      // Passengers payload
      const passengersData = passengers.map((p, idx) => ({
        passenger_number: idx + 1,
        name: p.name || cleanContact,
        passport_number: p.passport_number,
        cnic: p.cnic,
        date_of_birth: p.date_of_birth,
        gender: p.gender,
        nationality: p.nationality,
        flight_time: flightTime || undefined,
        trip_type: tripType,
      }));

      if (bookingMode === "direct") {
        // DIRECT CLIENT BOOKING
        const clientPayload: any = {
          name: cleanContact,
          contact_number: contactNumber || null,
          email: contactEmail || null,
          destination: destination || null,
          airline: airline || null,
          pnr: pnr || null,
          flight_date: flightDate || null,
          name_update_date: nameUpdateDate || null,
          travel_type:
            serviceType === "Ticket" && tripType === "return"
              ? "Ticket – Return"
              : serviceType === "Ticket" && tripType === "multi_city"
              ? "Ticket – Multi-City"
              : serviceType,
          purchasing_price: purchasePriceVal || null,
          selling_price: sellPrice || null,
          payment_amount: sellPrice || null,
          amount_paid: paidVal || 0,
          payment_status: paymentStatus,
          vendor_id: vendorIdVal,
          group_size: paxCount,
          group_booking_type: paxCount > 1 ? "group" : "individual",
          passport_number: passengers[0]?.passport_number || null,
          cnic: passengers[0]?.cnic || null,
          passengers_data: passengersData,
          notes: notes || null,
        };

        let savedResult: any = null;
        if (editBookingData && !editBookingData.agent_id) {
          await updateClient.mutateAsync({
            id: editBookingData.id,
            client: clientPayload,
          });
          savedResult = { ...editBookingData, ...clientPayload };
          toast.success("Direct booking updated successfully!");
        } else {
          savedResult = await addClient.mutateAsync(clientPayload);
          toast.success("Direct booking created successfully!");

          // Add payment history if paid
          if (paidVal > 0 && savedResult?.id) {
            await addPaymentHistory.mutateAsync({
              client_id: savedResult.id,
              payment_amount: paidVal,
              payment_type: paidVal >= sellPrice ? "full" : "partial",
              payment_date: new Date().toISOString().split("T")[0],
              payment_mode: paymentMode,
              bank_name: paymentMode === "bank" ? bankName : null,
              notes: `Initial payment on booking`,
            });
          }

          // Opening balance if toggled
          const opBal = parseFloat(openingBalanceAmount);
          if (showOpeningBalance && !isNaN(opBal) && opBal > 0 && savedResult?.id) {
            await upsertBalance.mutateAsync({
              party_type: "client",
              party_id: savedResult.id,
              balance_type: openingBalanceType,
              amount: opBal,
              as_of_date: new Date().toISOString().split("T")[0],
              notes: "Client opening balance brought forward",
            });
          }
        }

        onSaved?.(savedResult, "direct");
      } else {
        // B2B AGENT BOOKING
        const b2bPayload: any = {
          agent_id: selectedAgentId,
          vendor_id: vendorIdVal,
          pnr: pnr || null,
          passenger_name: cleanContact,
          passenger_passport: passengers[0]?.passport_number || null,
          passenger_contact: contactNumber || null,
          destination: destination || null,
          airline: airline || null,
          flight_date: flightDate || null,
          purchasing_price: purchasePriceVal || null,
          selling_price: sellPrice || null,
          commission_amount: calculatedCommission || 0,
          profit: calculatedProfit || 0,
          booking_status: "confirmed",
          payment_status: paymentStatus.toLowerCase(),
          notes: notes
            ? `${notes}\n\nPassengers: ${JSON.stringify(passengersData)}`
            : JSON.stringify(passengersData),
          amount_received: paidVal,
          payment_mode: paidVal > 0 ? paymentMode : null,
          bank_name: paidVal > 0 && paymentMode === "bank" ? bankName : null,
        };

        let savedB2B: any = null;
        if (editBookingData && editBookingData.agent_id) {
          await updateB2BBooking.mutateAsync({
            id: editBookingData.id,
            booking: b2bPayload,
          });
          savedB2B = { ...editBookingData, ...b2bPayload };
          toast.success("B2B booking updated successfully!");
        } else {
          savedB2B = await addB2BBooking.mutateAsync(b2bPayload);
          toast.success("B2B booking created successfully!");
        }

        onSaved?.(savedB2B, "b2b");
      }

      if (isSaveAndAddNext) {
        resetFormForNext();
        toast.info("Ready for next booking. Agent & details preserved.");
      } else {
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save booking");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background flex flex-col h-screen w-screen overflow-hidden text-foreground animate-in fade-in duration-200">
        {/* ======================= TOP BAR ======================= */}
        <div className="h-12 border-b border-border/80 px-4 flex items-center justify-between shrink-0 bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="font-bold text-base tracking-tight flex items-center gap-2">
              <Plane className="w-4 h-4 text-primary" />
              {editBookingData ? "Edit Booking" : "New Booking"}
            </span>

            {/* Toggle: Direct vs B2B Agent */}
            <div className="inline-flex rounded-md border p-0.5 bg-background shadow-xs">
              <button
                type="button"
                onClick={() => setBookingMode("direct")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer",
                  bookingMode === "direct"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Ctrl + 1"
              >
                <User className="w-3.5 h-3.5" />
                Direct Client
                <kbd className="hidden sm:inline-block text-[10px] opacity-75 font-mono ml-1 px-1 bg-black/20 rounded">
                  Ctrl+1
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => setBookingMode("b2b")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer",
                  bookingMode === "b2b"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Ctrl + 2"
              >
                <Users className="w-3.5 h-3.5" />
                B2B Agent
                <kbd className="hidden sm:inline-block text-[10px] opacity-75 font-mono ml-1 px-1 bg-black/20 rounded">
                  Ctrl+2
                </kbd>
              </button>
            </div>
          </div>

          {/* Center: Live Financial Badges */}
          <div className="hidden md:flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1 bg-muted/60 px-2.5 py-1 rounded-sm border">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold text-foreground">
                PKR {(parseFloat(sellingPrice) || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-muted/60 px-2.5 py-1 rounded-sm border">
              <span className="text-muted-foreground">Paid:</span>
              <span className="font-semibold text-emerald-600">
                PKR {(parseFloat(amountPaid) || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-muted/60 px-2.5 py-1 rounded-sm border">
              <span className="text-muted-foreground">Due:</span>
              <span
                className={cn(
                  "font-semibold",
                  remainingAmount > 0 ? "text-amber-600" : "text-muted-foreground"
                )}
              >
                PKR {remainingAmount.toLocaleString()}
              </span>
            </div>
            {calculatedProfit !== 0 && (
              <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-sm border border-emerald-200 dark:border-emerald-800">
                <span className="text-emerald-700 dark:text-emerald-300">Profit:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">
                  PKR {calculatedProfit.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Right: Keyboard Shortcut Info & Close */}
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border">
              <span>
                <kbd className="px-1 py-0.5 bg-background border rounded text-[10px]">
                  Ctrl+Enter
                </kbd>{" "}
                Save
              </span>
              <span>•</span>
              <span>
                <kbd className="px-1 py-0.5 bg-background border rounded text-[10px]">
                  Ctrl+Shift+Enter
                </kbd>{" "}
                Save & Add Next
              </span>
              <span>•</span>
              <span>
                <kbd className="px-1 py-0.5 bg-background border rounded text-[10px]">
                  Esc
                </kbd>{" "}
                Cancel
              </span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleCloseRequest}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ======================= BODY: DENSE GRID ======================= */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* ========== B2B AGENT SELECTOR ROW (Only if B2B) ========== */}
          {bookingMode === "b2b" && (
            <div className="p-2.5 bg-purple-500/5 rounded-md border border-purple-500/20 space-y-2 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[260px]">
                  <Label className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1 block">
                    B2B Agent <span className="text-red-500">*</span>
                  </Label>
                  <Popover open={agentSearchOpen} onOpenChange={setAgentSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={agentSearchOpen}
                        className="w-full justify-between h-8 text-xs bg-background font-normal"
                      >
                        {activeAgent ? (
                          <span className="font-semibold text-foreground truncate">
                            {activeAgent.agent_name}
                            {activeAgent.business_name && (
                              <span className="text-muted-foreground ml-1.5 font-normal">
                                ({activeAgent.business_name})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Type to search or add agent...</span>
                        )}
                        <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search or enter new agent..."
                          value={agentSearchQuery}
                          onValueChange={setAgentSearchQuery}
                          className="h-8 text-xs"
                        />
                        <CommandList>
                          <CommandEmpty className="p-2 text-xs text-muted-foreground">
                            {agentSearchQuery.trim() ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-start text-xs gap-1.5 text-purple-600 font-semibold"
                                onClick={() => handleCreateInlineAgent(agentSearchQuery)}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                + Create &quot;{agentSearchQuery}&quot; (Enter)
                              </Button>
                            ) : (
                              "No agents found"
                            )}
                          </CommandEmpty>
                          <CommandGroup heading="Existing Agents">
                            {agents.map((agent) => (
                              <CommandItem
                                key={agent.id}
                                value={agent.agent_name}
                                onSelect={() => {
                                  setSelectedAgentId(agent.id);
                                  setAgentSearchOpen(false);
                                  setAgentSearchQuery("");
                                }}
                                className="text-xs flex items-center justify-between cursor-pointer"
                              >
                                <div className="truncate">
                                  <span className="font-medium">{agent.agent_name}</span>
                                  {agent.business_name && (
                                    <span className="text-[11px] text-muted-foreground ml-1.5">
                                      - {agent.business_name}
                                    </span>
                                  )}
                                </div>
                                {selectedAgentId === agent.id && (
                                  <Check className="w-3.5 h-3.5 text-purple-600" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {activeAgent && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-4">
                    {activeAgent.phone && (
                      <span>Phone: <b className="text-foreground">{activeAgent.phone}</b></span>
                    )}
                    {activeAgent.city && (
                      <span>City: <b className="text-foreground">{activeAgent.city}</b></span>
                    )}
                    <Badge variant="outline" className="text-[10px] h-5 border-purple-500/30 text-purple-700 dark:text-purple-300">
                      Comm: {activeAgent.commission_type === "percentage" ? `${activeAgent.commission_value}%` : `PKR ${activeAgent.commission_value}`}
                    </Badge>
                  </div>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAgentDetails(!showAgentDetails)}
                  className="h-7 text-xs text-purple-600 hover:text-purple-700 ml-auto mt-4"
                >
                  {showAgentDetails ? "Hide New Agent Fields" : "+ New Agent Extra Details"}
                </Button>
              </div>

              {/* Optional inline agent details row */}
              {showAgentDetails && (
                <div className="pt-2 border-t border-purple-500/20 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Business Name</Label>
                    <Input
                      placeholder="Agency Name"
                      value={newAgentBusiness}
                      onChange={(e) => setNewAgentBusiness(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Phone</Label>
                    <Input
                      placeholder="0300..."
                      value={newAgentPhone}
                      onChange={(e) => setNewAgentPhone(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">City</Label>
                    <Input
                      placeholder="Lahore / Karachi"
                      value={newAgentCity}
                      onChange={(e) => setNewAgentCity(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Commission</Label>
                    <div className="flex gap-1">
                      <Select
                        value={newAgentCommissionType}
                        onValueChange={(val: any) => setNewAgentCommissionType(val)}
                      >
                        <SelectTrigger className="h-7 text-xs w-16">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">%</SelectItem>
                          <SelectItem value="fixed">PKR</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Val"
                        value={newAgentCommissionValue}
                        onChange={(e) => setNewAgentCommissionValue(e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Opening Bal</Label>
                    <div className="flex gap-1">
                      <Select
                        value={newAgentOpeningBalanceType}
                        onValueChange={(val: any) => setNewAgentOpeningBalanceType(val)}
                      >
                        <SelectTrigger className="h-7 text-xs w-14">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="receivable">Rec</SelectItem>
                          <SelectItem value="payable">Pay</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="0"
                        value={newAgentOpeningBalance}
                        onChange={(e) => setNewAgentOpeningBalance(e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCreateInlineAgent(agentSearchQuery || "New Agent")}
                      className="h-7 text-xs w-full bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Save Agent Inline
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== ROW 1: CONTACT DETAILS ========== */}
          <div className="bg-muted/20 border border-border/60 rounded-md p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-500" />
                Row 1: Contact Information
              </span>
              <ScanAutofillButton
                onApply={handleScanApply}
                label="Scan Passport / ID"
                size="sm"
                variant="outline"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <Label className="text-xs font-semibold mb-1 block">
                  Contact Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  ref={contactNameInputRef}
                  placeholder="Primary contact / passenger name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="h-8 text-xs font-medium"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">
                  Contact Number
                </Label>
                <Input
                  placeholder="0300-1234567"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">
                  Contact Email
                </Label>
                <Input
                  type="email"
                  placeholder="client@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* ========== ROW 2: SERVICE & FLIGHT SPECS ========== */}
          <div className="bg-muted/20 border border-border/60 rounded-md p-2.5">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Plane className="w-3.5 h-3.5 text-emerald-500" />
              Row 2: Service & Flight Specifications
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-9 gap-2">
              {/* Service Type */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">Service</Label>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ticket">Ticket</SelectItem>
                    <SelectItem value="Umrah">Umrah</SelectItem>
                    <SelectItem value="Hotel">Hotel</SelectItem>
                    <SelectItem value="Visa">Visa</SelectItem>
                    <SelectItem value="Tour">Tour</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Trip Type */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">Trip Type</Label>
                <Select
                  value={tripType}
                  onValueChange={(val: any) => setTripType(val)}
                  disabled={serviceType !== "Ticket"}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_way">One Way</SelectItem>
                    <SelectItem value="return">Return</SelectItem>
                    <SelectItem value="multi_city">Multi-City</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Pax Count */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">Pax Count</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={paxCount}
                  onChange={(e) => setPaxCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-8 text-xs font-bold text-center"
                />
              </div>

              {/* Airline */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">Airline</Label>
                <Input
                  placeholder="PIA, SV, EK..."
                  value={airline}
                  onChange={(e) => setAirline(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* Destination */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">Destination</Label>
                <Input
                  placeholder="JED, DXB, LHR..."
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="h-8 text-xs uppercase"
                />
              </div>

              {/* Flight Date */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">
                  Flight Date
                </Label>
                <Input
                  placeholder="YYYY-MM-DD or ddmmyyyy"
                  value={flightDate}
                  onChange={(e) => setFlightDate(e.target.value)}
                  onBlur={(e) =>
                    handleDateInputBlurOrChange(e.target.value, setFlightDate)
                  }
                  className="h-8 text-xs"
                />
              </div>

              {/* Flight Time */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">Time</Label>
                <Input
                  placeholder="14:30"
                  value={flightTime}
                  onChange={(e) => setFlightTime(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* PNR */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">PNR</Label>
                <Input
                  placeholder="6-char PNR"
                  value={pnr}
                  onChange={(e) => setPnr(e.target.value.toUpperCase())}
                  className="h-8 text-xs font-mono font-bold uppercase tracking-wider"
                />
              </div>

              {/* Name Update Date */}
              <div>
                <Label className="text-xs font-semibold mb-1 block truncate">
                  Name Update
                </Label>
                <Input
                  placeholder="YYYY-MM-DD"
                  value={nameUpdateDate}
                  onChange={(e) => setNameUpdateDate(e.target.value)}
                  onBlur={(e) =>
                    handleDateInputBlurOrChange(e.target.value, setNameUpdateDate)
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* ========== ROW 3: PASSENGERS TABLE ========== */}
          <div className="bg-muted/20 border border-border/60 rounded-md p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                Row 3: Passengers Manifest ({passengers.length} Passenger{passengers.length > 1 ? "s" : ""})
              </span>
              <span className="text-[11px] text-muted-foreground hidden sm:inline-block">
                Press <kbd className="px-1 py-0.5 bg-background border rounded text-[10px]">Enter</kbd> on last field to add row
              </span>
            </div>

            <div className="border border-border/80 rounded-sm overflow-hidden bg-background">
              <div className="max-h-[160px] overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-muted/70 text-muted-foreground sticky top-0 z-10 border-b">
                    <tr>
                      <th className="p-1.5 text-center w-8">#</th>
                      <th className="p-1.5 text-left min-w-[140px]">
                        Passenger Name <span className="text-red-500">*</span>
                      </th>
                      <th className="p-1.5 text-left min-w-[110px]">Passport No</th>
                      <th className="p-1.5 text-left min-w-[110px]">CNIC</th>
                      <th className="p-1.5 text-left min-w-[95px]">DOB</th>
                      <th className="p-1.5 text-center w-20">Gender</th>
                      <th className="p-1.5 text-left min-w-[90px]">Nationality</th>
                      <th className="p-1.5 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {passengers.map((pax, idx) => {
                      const isFirst = idx === 0;
                      const isLast = idx === passengers.length - 1;
                      return (
                        <tr key={pax.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-1 text-center font-bold text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="p-1">
                            <Input
                              ref={isFirst ? firstPassengerNameRef : undefined}
                              data-pax-field="name"
                              placeholder="FULL NAME AS IN PASSPORT"
                              value={pax.name}
                              onChange={(e) =>
                                updatePassenger(idx, "name", e.target.value.toUpperCase())
                              }
                              className="h-7 text-xs font-semibold uppercase"
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              placeholder="Passport #"
                              value={pax.passport_number}
                              onChange={(e) =>
                                updatePassenger(
                                  idx,
                                  "passport_number",
                                  e.target.value.toUpperCase()
                                )
                              }
                              className="h-7 text-xs uppercase"
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              placeholder="42101-..."
                              value={pax.cnic}
                              onChange={(e) =>
                                updatePassenger(idx, "cnic", e.target.value)
                              }
                              className="h-7 text-xs"
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              placeholder="DD/MM/YYYY"
                              value={pax.date_of_birth}
                              onChange={(e) =>
                                updatePassenger(idx, "date_of_birth", e.target.value)
                              }
                              onBlur={(e) =>
                                handleDateInputBlurOrChange(e.target.value, (val) =>
                                  updatePassenger(idx, "date_of_birth", val)
                                )
                              }
                              className="h-7 text-xs"
                            />
                          </td>
                          <td className="p-1 text-center">
                            <Select
                              value={pax.gender || "M"}
                              onValueChange={(val) => updatePassenger(idx, "gender", val)}
                            >
                              <SelectTrigger className="h-7 text-xs w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="M">Male</SelectItem>
                                <SelectItem value="F">Female</SelectItem>
                                <SelectItem value="O">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-1">
                            <Input
                              placeholder="Nationality"
                              value={pax.nationality}
                              onChange={(e) =>
                                updatePassenger(idx, "nationality", e.target.value)
                              }
                              onKeyDown={(e) => handleLastPassengerKeyDown(e, isLast)}
                              className="h-7 text-xs"
                            />
                          </td>
                          <td className="p-1 text-center">
                            {passengers.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removePassenger(idx)}
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ========== ROW 4: FINANCIALS, PAYMENT, VENDOR & NOTES ========== */}
          <div className="bg-muted/20 border border-border/60 rounded-md p-2.5">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                Row 4: Financials, Settlement, Vendor & Notes
              </span>
              {bookingMode === "direct" && (
                <button
                  type="button"
                  onClick={() => setShowOpeningBalance(!showOpeningBalance)}
                  className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                >
                  {showOpeningBalance ? "Hide Opening Balance" : "+ Opening Balance"}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
              {/* Purchase Price */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">Purchase Cost</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={purchasingPrice}
                  onChange={(e) => setPurchasingPrice(e.target.value)}
                  className="h-8 text-xs font-semibold"
                />
              </div>

              {/* Total (Selling Price) */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">
                  Total (Selling) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="h-8 text-xs font-bold text-primary"
                  required
                />
              </div>

              {/* Amount Paid */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">Paid</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="h-8 text-xs font-semibold text-emerald-600"
                />
              </div>

              {/* Remaining (Auto) */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">Remaining</Label>
                <div
                  className={cn(
                    "h-8 px-2 flex items-center rounded-md border text-xs font-bold bg-muted/50",
                    remainingAmount > 0 ? "text-amber-600" : "text-muted-foreground"
                  )}
                >
                  PKR {remainingAmount.toLocaleString()}
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">Payment Mode</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bank Name if Bank Transfer selected, otherwise Notes preview */}
              {paymentMode === "bank" ? (
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Bank Name</Label>
                  <Input
                    placeholder="Meezan, HBL..."
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              ) : (
                <div className="md:col-span-1">
                  <Label className="text-xs font-semibold mb-1 block">Vendor</Label>
                  <div className="flex gap-1">
                    <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                      <SelectTrigger className="h-8 text-xs flex-1 truncate">
                        <SelectValue placeholder="Select Vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None / Direct</SelectItem>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Popover open={showQuickVendorAdd} onOpenChange={setShowQuickVendorAdd}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          title="Quick Add Vendor"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3 space-y-2" align="end">
                        <div className="font-semibold text-xs flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-primary" />
                          Quick Add Vendor
                        </div>
                        <Input
                          placeholder="Vendor Name"
                          value={quickVendorName}
                          onChange={(e) => setQuickVendorName(e.target.value)}
                          className="h-7 text-xs"
                        />
                        <Input
                          placeholder="Service (Airlines / Hotel)"
                          value={quickVendorService}
                          onChange={(e) => setQuickVendorService(e.target.value)}
                          className="h-7 text-xs"
                        />
                        <Button
                          size="sm"
                          onClick={handleQuickAddVendor}
                          className="w-full h-7 text-xs"
                        >
                          Save & Select
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              {/* Vendor field if bank was shown in column 6 */}
              {paymentMode === "bank" && (
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Vendor</Label>
                  <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                    <SelectTrigger className="h-8 text-xs flex-1 truncate">
                      <SelectValue placeholder="Select Vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None / Direct</SelectItem>
                      {vendors.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Notes */}
              <div className={paymentMode === "bank" ? "md:col-span-1" : "md:col-span-2"}>
                <Label className="text-xs font-semibold mb-1 block">Notes / Remarks</Label>
                <Input
                  placeholder="Special requests or instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Optional Opening Balance for Direct Client */}
            {bookingMode === "direct" && showOpeningBalance && (
              <div className="mt-2 pt-2 border-t border-border/60 flex items-center gap-3 text-xs animate-in fade-in">
                <span className="font-semibold text-muted-foreground">
                  Client Opening Balance:
                </span>
                <Select
                  value={openingBalanceType}
                  onValueChange={(val: any) => setOpeningBalanceType(val)}
                >
                  <SelectTrigger className="h-7 text-xs w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receivable">Receivable</SelectItem>
                    <SelectItem value="payable">Payable</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Amount (PKR)"
                  value={openingBalanceAmount}
                  onChange={(e) => setOpeningBalanceAmount(e.target.value)}
                  className="h-7 text-xs w-36"
                />
              </div>
            )}
          </div>
        </div>

        {/* ======================= BOTTOM STICKY FOOTER ======================= */}
        <div className="h-14 border-t border-border px-4 flex items-center justify-between shrink-0 bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCloseRequest}
              disabled={isSubmitting}
              className="text-xs h-9 cursor-pointer"
            >
              Cancel (Esc)
            </Button>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleSave(true)}
              disabled={isSubmitting}
              className="text-xs h-9 font-semibold gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Save & Add Next
              <kbd className="hidden sm:inline-block text-[10px] opacity-75 font-mono ml-1 px-1 bg-black/10 dark:bg-white/10 rounded">
                Ctrl+Shift+Enter
              </kbd>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => handleSave(false)}
              disabled={isSubmitting}
              className="text-xs h-9 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Save Booking
              <kbd className="hidden sm:inline-block text-[10px] opacity-75 font-mono ml-1 px-1 bg-white/20 rounded">
                Ctrl+Enter
              </kbd>
            </Button>
          </div>
        </div>
      </div>

      {/* Exit confirmation dialog */}
      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved booking details. Are you sure you want to discard them and exit?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowExitConfirm(false);
                onOpenChange(false);
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Discard & Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

