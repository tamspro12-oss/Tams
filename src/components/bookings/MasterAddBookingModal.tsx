import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClients } from "@/hooks/useStorage";
import { useB2BAgents } from "@/hooks/useB2BAgents";
import { useB2BBookings } from "@/hooks/useB2BBookings";
import { useVendors } from "@/hooks/useStorage";
import { useAgency } from "@/hooks/useAgency";
import { useClientPaymentHistoryLocal } from "@/hooks/useLocalPaymentHistory";
import { useOpeningBalances } from "@/hooks/useOpeningBalances";
import {
  X,
  Plus,
  Trash2,
  User,
  Users,
  Plane,
  CreditCard,
  Check,
  ChevronDown,
  Sparkles,
  Store,
  Building2,
  FileText,
} from "lucide-react";
import { AddB2BAgentDialog } from "@/components/AddB2BAgentDialog";
import { AddVendorDialog } from "@/components/AddVendorDialog";
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

// Reusable Keyboard-Aware Select for frictionless Enter / Arrow navigation
interface BookingSelectProps {
  value: string;
  onValueChange: (val: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  dataField?: string;
  ariaLabel?: string;
  triggerRef?: React.RefObject<HTMLButtonElement>;
  onAdvance?: () => void;
}

function BookingSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  triggerClassName,
  dataField,
  ariaLabel,
  triggerRef: externalRef,
  onAdvance,
}: BookingSelectProps) {
  const internalRef = useRef<HTMLButtonElement>(null);
  const activeRef = externalRef || internalRef;
  const advanceAfterSelectRef = useRef(false);

  return (
    <Select
      value={value}
      onValueChange={(val) => {
        onValueChange(val);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        ref={activeRef}
        aria-label={ariaLabel}
        data-booking-input="true"
        data-field={dataField}
        className={cn(
          "h-8 text-xs bg-background transition-colors focus-visible:ring-2",
          triggerClassName
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            advanceAfterSelectRef.current = true;
          }
        }}
        onCloseAutoFocus={(e) => {
          if (advanceAfterSelectRef.current) {
            advanceAfterSelectRef.current = false;
            e.preventDefault();
            if (onAdvance) {
              onAdvance();
            } else if (activeRef.current) {
              // Trigger auto-advance to next form field
              const form = activeRef.current.closest("[data-booking-form]");
              if (form) {
                const elements = Array.from(
                  form.querySelectorAll<HTMLElement>(
                    '[data-booking-input="true"]:not([disabled]):not([aria-disabled="true"])'
                  )
                ).filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
                const idx = elements.indexOf(activeRef.current);
                if (idx !== -1 && idx < elements.length - 1) {
                  elements[idx + 1].focus();
                }
              }
            }
          }
        }}
      >
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs cursor-pointer">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
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
  const { data: _agency } = useAgency();
  const { addPaymentHistory } = useClientPaymentHistoryLocal();
  const { upsertBalance } = useOpeningBalances();

  // References for focus management
  const formContainerRef = useRef<HTMLDivElement>(null);
  const serviceTriggerRef = useRef<HTMLButtonElement>(null);
  const agentTriggerRef = useRef<HTMLButtonElement>(null);
  const vendorTriggerRef = useRef<HTMLButtonElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // Add Agent & Add Vendor modal states
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [addAgentInitialName, setAddAgentInitialName] = useState("");
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [addVendorInitialName, setAddVendorInitialName] = useState("");
  const [vendorSearchOpen, setVendorSearchOpen] = useState(false);
  const [vendorSearchQuery, setVendorSearchQuery] = useState("");

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
  const [showQuickVendorAdd, setShowQuickVendorAdd] = useState(false);
  const [quickVendorName, setQuickVendorName] = useState("");
  const [quickVendorService, setQuickVendorService] = useState("");
  const [notes, setNotes] = useState("");

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

  // Move focus to next form field
  const focusNext = (currentEl: HTMLElement | null) => {
    if (!formContainerRef.current) return;
    const elements = Array.from(
      formContainerRef.current.querySelectorAll<HTMLElement>(
        '[data-booking-input="true"]:not([disabled]):not([aria-disabled="true"])'
      )
    ).filter((el) => {
      return el.offsetParent !== null || el.getClientRects().length > 0;
    });

    if (!currentEl) {
      elements[0]?.focus();
      return;
    }

    const currentIndex = elements.indexOf(currentEl);
    if (currentIndex !== -1 && currentIndex < elements.length - 1) {
      const nextEl = elements[currentIndex + 1];
      nextEl.focus();
      if (nextEl instanceof HTMLInputElement && nextEl.type !== "file") {
        nextEl.select?.();
      }
    } else if (currentIndex === elements.length - 1) {
      saveButtonRef.current?.focus();
    }
  };

  // Autofocus first field on open
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (bookingMode === "b2b" && !selectedAgentId) {
          agentTriggerRef.current?.focus();
        } else {
          serviceTriggerRef.current?.focus();
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [open, bookingMode, selectedAgentId]);

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

  // Global Keyboard shortcut listener
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
        handleSave(false); // Save Booking
      } else if (e.key === "Escape") {
        // If child search popovers are open, let them close themselves
        if (agentSearchOpen || showQuickVendorAdd) {
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
      // Focus Service field next
      setTimeout(() => serviceTriggerRef.current?.focus(), 60);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create agent");
    }
  };

  // Reset form for "Save & Add Next"
  const resetFormForNext = () => {
    setContactName("");
    setContactNumber("");
    setContactEmail("");
    setPnr("");
    setPurchasingPrice("");
    setSellingPrice("");
    setAmountPaid("");
    setNameUpdateDate("");
    setNotes("");
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
      // Auto-focus Service field
      serviceTriggerRef.current?.focus();
    }, 100);
  };

  // Main Save Handler
  const handleSave = async (isSaveAndAddNext = false) => {
    // Validation in on-screen order
    if (bookingMode === "b2b" && !selectedAgentId) {
      toast.error("Please select or create a B2B Agent");
      agentTriggerRef.current?.focus();
      return;
    }

    const cleanContact = (passengers[0]?.name || contactName).trim();
    if (!cleanContact) {
      toast.error("First passenger name is required (used as primary contact)");
      const firstPaxInput = formContainerRef.current?.querySelector<HTMLInputElement>(
        'input[data-pax-field="name"]'
      );
      firstPaxInput?.focus();
      return;
    }

    const sellPrice = parseFloat(sellingPrice) || 0;
    if (sellPrice <= 0) {
      toast.error("Total Amount (Selling Price) is required");
      const sellInput = formContainerRef.current?.querySelector<HTMLInputElement>(
        'input[data-field="sellingPrice"]'
      );
      sellInput?.focus();
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

  // Keyboard navigation handler for container
  const handleContainerKeyDown = (e: React.KeyboardEvent) => {
    // Shortcuts with Ctrl / Cmd are handled globally
    if (e.ctrlKey || e.metaKey) return;

    if (e.key === "Enter") {
      const target = e.target as HTMLElement;

      // Let Radix Select popover / content listbox handle Enter
      if (target.closest('[role="listbox"]') || target.closest('[data-radix-select-viewport]')) {
        return;
      }

      // If inside agent command menu, let Command handle selection
      if (target.closest('[cmdk-root]')) {
        return;
      }

      // If target is a button other than a data-booking-input
      if (target.tagName === "BUTTON" && !target.hasAttribute("data-booking-input")) {
        return;
      }

      // If target is textarea and shiftKey is pressed, allow newline
      if (target.tagName === "TEXTAREA" && e.shiftKey) {
        return;
      }

      // If on Notes field (with data-field="notes") and plain Enter was pressed:
      // Focus Save Booking button!
      if (target.getAttribute("data-field") === "notes") {
        e.preventDefault();
        e.stopPropagation();
        saveButtonRef.current?.focus();
        return;
      }

      // For any field marked data-booking-input
      const bookingInput = target.closest<HTMLElement>('[data-booking-input="true"]');
      if (bookingInput) {
        e.preventDefault();
        e.stopPropagation();
        focusNext(bookingInput);
      }
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden text-foreground animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleCloseRequest();
          }
        }}
      >
        {/* Main Dialog Card: max-h-[92vh] so height fits content snugly without empty space */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-dialog-title"
          ref={formContainerRef}
          data-booking-form="true"
          onKeyDown={handleContainerKeyDown}
          className="relative w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {/* ======================= 1. HEADER (CENTERED TABS) ======================= */}
          <div className="h-14 border-b border-border/80 px-3 sm:px-4 flex items-center justify-between shrink-0 bg-muted/30">
            {/* Left: Title */}
            <div className="flex items-center gap-2.5 min-w-0 sm:min-w-[170px]">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Plane className="w-4 h-4" />
              </div>
              <div className="truncate">
                <h2
                  id="booking-dialog-title"
                  className="font-bold text-sm sm:text-base tracking-tight leading-tight truncate"
                >
                  {editBookingData ? "Edit Booking" : "New Booking"}
                </h2>
                <p className="text-[11px] text-muted-foreground hidden sm:block leading-none mt-0.5">
                  {bookingMode === "direct" ? "Direct Client" : "B2B Agent Booking"}
                </p>
              </div>
            </div>

            {/* Center: Segmented Control Switcher */}
            <div className="inline-flex rounded-lg border border-border/70 p-1 bg-background/80 shadow-xs shrink-0 mx-2">
              <button
                type="button"
                onClick={() => setBookingMode("direct")}
                className={cn(
                  "px-3.5 sm:px-5 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all flex items-center gap-2 cursor-pointer select-none",
                  bookingMode === "direct"
                    ? "bg-blue-600 text-white shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Direct Client</span>
              </button>

              <button
                type="button"
                onClick={() => setBookingMode("b2b")}
                className={cn(
                  "px-3.5 sm:px-5 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all flex items-center gap-2 cursor-pointer select-none",
                  bookingMode === "b2b"
                    ? "bg-purple-600 text-white shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>B2B Agent</span>
              </button>
            </div>

            {/* Right: Close (X) */}
            <div className="flex items-center justify-end min-w-0 sm:min-w-[170px]">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                onClick={handleCloseRequest}
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* ======================= 2. SCROLLABLE FORM BODY ======================= */}
          <div className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-4 py-3 space-y-3">
            {/* ========== 1. AGENT & SERVICE/FLIGHT SPECS (BLUE TINT) ========== */}
            <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 border-l-4 border-l-blue-600 dark:border-l-blue-500 rounded-lg p-2.5 sm:p-3">
              <div className="text-xs sm:text-sm font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400">
                    {bookingMode === "b2b" ? (
                      <Building2 className="w-3.5 h-3.5" />
                    ) : (
                      <Plane className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <span>
                    {bookingMode === "b2b"
                      ? "Agent & Service / Flight Details"
                      : "Service & Flight Details"}
                  </span>
                </span>
              </div>

              {/* B2B Agent Selector (Row inside Blue card when B2B mode) */}
              {bookingMode === "b2b" && (
                <div className="mb-2.5 pb-2.5 border-b border-blue-200/80 dark:border-blue-900/60">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex-1 min-w-[260px]">
                      <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        B2B Agent <span className="text-red-500 font-bold">*</span>
                      </Label>
                      <div className="flex gap-1">
                        <Popover open={agentSearchOpen} onOpenChange={setAgentSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              ref={agentTriggerRef}
                              variant="outline"
                              role="combobox"
                              aria-expanded={agentSearchOpen}
                              data-booking-input="true"
                              data-field="agent"
                              className="w-full justify-between h-8 text-xs bg-background font-normal border-blue-200 dark:border-blue-800 focus-visible:ring-blue-500 truncate"
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
                                <span className="text-muted-foreground">Search or choose agent...</span>
                              )}
                              <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0 ml-1" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[320px] p-0" align="start">
                            <Command>
                              <CommandInput
                                placeholder="Search agent name or agency..."
                                value={agentSearchQuery}
                                onValueChange={setAgentSearchQuery}
                                className="h-8 text-xs"
                              />
                              <CommandList>
                                <CommandEmpty className="p-2 text-xs text-muted-foreground">
                                  {agentSearchQuery.trim() ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="w-full justify-start text-xs gap-1.5 text-blue-600 font-semibold"
                                      onClick={() => {
                                        setIsAddAgentOpen(true);
                                        setAddAgentInitialName(agentSearchQuery);
                                        setAgentSearchOpen(false);
                                      }}
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      + Add &quot;{agentSearchQuery}&quot;
                                    </Button>
                                  ) : (
                                    "No agents found"
                                  )}
                                </CommandEmpty>
                                <CommandGroup heading="Existing Agents">
                                  {agents.map((agent) => (
                                    <CommandItem
                                      key={agent.id}
                                      value={`${agent.agent_name} ${agent.business_name || ""}`}
                                      onSelect={() => {
                                        setSelectedAgentId(agent.id);
                                        setAgentSearchOpen(false);
                                        setAgentSearchQuery("");
                                        setTimeout(() => serviceTriggerRef.current?.focus(), 60);
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
                                        <Check className="w-3.5 h-3.5 text-blue-600" />
                                      )}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                                {agentSearchQuery.trim() && (
                                  <CommandGroup heading="New Agent">
                                    <CommandItem
                                      value={`add-${agentSearchQuery}`}
                                      onSelect={() => {
                                        setIsAddAgentOpen(true);
                                        setAddAgentInitialName(agentSearchQuery);
                                        setAgentSearchOpen(false);
                                      }}
                                      className="text-xs text-blue-600 font-semibold cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                                      + Add &quot;{agentSearchQuery}&quot;
                                    </CommandItem>
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>

                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          tabIndex={-1}
                          onClick={() => {
                            setIsAddAgentOpen(true);
                            setAddAgentInitialName("");
                          }}
                          title="Add New Agent"
                          className="h-8 w-8 shrink-0 cursor-pointer border-blue-200 dark:border-blue-800 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {activeAgent && (
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-4">
                        {activeAgent.phone && (
                          <span>
                            Phone: <b className="text-foreground">{activeAgent.phone}</b>
                          </span>
                        )}
                        {activeAgent.city && (
                          <span>
                            City: <b className="text-foreground">{activeAgent.city}</b>
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 border-blue-500/30 text-blue-700 dark:text-blue-300"
                        >
                          Comm:{" "}
                          {activeAgent.commission_type === "percentage"
                            ? `${activeAgent.commission_value}%`
                            : `PKR ${activeAgent.commission_value?.toLocaleString()}`}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
                {/* 1. Service Type */}
                <div>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                    Service <span className="text-red-500 font-bold">*</span>
                  </Label>
                  <BookingSelect
                    triggerRef={serviceTriggerRef}
                    dataField="service"
                    ariaLabel="Service"
                    value={serviceType}
                    onValueChange={setServiceType}
                    triggerClassName="focus-visible:ring-blue-500"
                    options={[
                      { label: "Ticket", value: "Ticket" },
                      { label: "Umrah", value: "Umrah" },
                      { label: "Hotel", value: "Hotel" },
                      { label: "Visa", value: "Visa" },
                      { label: "Tour", value: "Tour" },
                      { label: "Custom", value: "Custom" },
                    ]}
                  />
                </div>

                {/* 2. Trip Type */}
                <div>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                    Trip Type
                  </Label>
                  <BookingSelect
                    dataField="tripType"
                    ariaLabel="Trip Type"
                    value={tripType}
                    onValueChange={(val: any) => setTripType(val)}
                    disabled={serviceType !== "Ticket"}
                    triggerClassName="focus-visible:ring-blue-500"
                    options={[
                      { label: "One Way", value: "one_way" },
                      { label: "Return", value: "return" },
                      { label: "Multi-City", value: "multi_city" },
                    ]}
                  />
                </div>

                {/* 3. Pax Count */}
                <div>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                    Pax Count
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    data-booking-input="true"
                    data-field="paxCount"
                    value={paxCount}
                    onChange={(e) => setPaxCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-8 text-xs font-bold text-center bg-background focus-visible:ring-blue-500"
                  />
                </div>

                {/* 4. Airline */}
                <div>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                    Airline
                  </Label>
                  <Input
                    placeholder="PIA, SV, EK..."
                    data-booking-input="true"
                    data-field="airline"
                    value={airline}
                    onChange={(e) => setAirline(e.target.value)}
                    className="h-8 text-xs bg-background focus-visible:ring-blue-500"
                  />
                </div>

                {/* 5. Destination */}
                <div>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                    Destination
                  </Label>
                  <Input
                    placeholder="JED, DXB, LHR..."
                    data-booking-input="true"
                    data-field="destination"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="h-8 text-xs uppercase bg-background focus-visible:ring-blue-500"
                  />
                </div>

                {/* 6. Flight Date */}
                <div>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                    Flight Date
                  </Label>
                  <Input
                    placeholder="YYYY-MM-DD"
                    data-booking-input="true"
                    data-field="flightDate"
                    value={flightDate}
                    onChange={(e) => setFlightDate(e.target.value)}
                    onBlur={(e) =>
                      handleDateInputBlurOrChange(e.target.value, setFlightDate)
                    }
                    className="h-8 text-xs bg-background focus-visible:ring-blue-500"
                  />
                </div>

                {/* 7. Flight Time */}
                <div>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                    Time
                  </Label>
                  <Input
                    placeholder="14:30"
                    data-booking-input="true"
                    data-field="flightTime"
                    value={flightTime}
                    onChange={(e) => setFlightTime(e.target.value)}
                    className="h-8 text-xs bg-background focus-visible:ring-blue-500"
                  />
                </div>

                {/* 8. PNR */}
                <div>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                    PNR
                  </Label>
                  <Input
                    placeholder="6-char PNR"
                    data-booking-input="true"
                    data-field="pnr"
                    value={pnr}
                    onChange={(e) => setPnr(e.target.value.toUpperCase())}
                    className="h-8 text-xs font-mono font-bold uppercase tracking-wider bg-background focus-visible:ring-blue-500"
                  />
                </div>

                {/* 9. Contact Number */}
                <div>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                    Contact Number
                  </Label>
                  <Input
                    placeholder="0300-1234567"
                    data-booking-input="true"
                    data-field="contactNumber"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="h-8 text-xs bg-background focus-visible:ring-blue-500"
                  />
                </div>

                {/* 10. Contact Email */}
                <div>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                    Contact Email
                  </Label>
                  <Input
                    type="email"
                    placeholder="client@example.com"
                    data-booking-input="true"
                    data-field="contactEmail"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="h-8 text-xs bg-background focus-visible:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* ========== 2. PASSENGERS SECTION (PURPLE TINT) ========== */}
            <div className="bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/60 border-l-4 border-l-purple-600 dark:border-l-purple-500 rounded-lg p-2.5 sm:p-3">
              <div className="text-xs sm:text-sm font-bold text-purple-900 dark:text-purple-300 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-400">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <span>Passengers</span>
                  <span className="text-[11px] font-normal text-muted-foreground ml-1">
                    ({passengers.length} {passengers.length === 1 ? "passenger" : "passengers"})
                  </span>
                </span>
              </div>

              <div className="border border-purple-200 dark:border-purple-900/60 rounded-md overflow-hidden bg-background">
                <div className="max-h-[145px] sm:max-h-[165px] overflow-y-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-purple-100/60 dark:bg-purple-950/50 text-purple-900 dark:text-purple-200 sticky top-0 z-10 border-b border-purple-200 dark:border-purple-900/60">
                      <tr>
                        <th className="p-1.5 text-center w-8">#</th>
                        <th className="p-1.5 text-left min-w-[140px]">
                          Passenger Name <span className="text-red-500 font-bold">*</span>
                        </th>
                        <th className="p-1.5 text-left min-w-[110px]">Passport No</th>
                        <th className="p-1.5 text-left min-w-[110px]">CNIC</th>
                        <th className="p-1.5 text-left min-w-[95px]">DOB</th>
                        <th className="p-1.5 text-center w-24">Gender</th>
                        <th className="p-1.5 text-left min-w-[90px]">Nationality</th>
                        <th className="p-1.5 text-center w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-100 dark:divide-purple-900/40">
                      {passengers.map((pax, idx) => {
                        return (
                          <tr key={pax.id} className="hover:bg-purple-500/5 transition-colors">
                            <td className="p-1 text-center font-bold text-muted-foreground">
                              {idx + 1}
                            </td>
                            <td className="p-1">
                              <Input
                                data-booking-input="true"
                                data-pax-index={idx}
                                data-pax-field="name"
                                placeholder="FULL NAME AS IN PASSPORT"
                                value={pax.name}
                                onChange={(e) =>
                                  updatePassenger(idx, "name", e.target.value.toUpperCase())
                                }
                                className="h-7 text-xs font-semibold uppercase bg-background focus-visible:ring-purple-500"
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                data-booking-input="true"
                                data-pax-index={idx}
                                data-pax-field="passport_number"
                                placeholder="Passport #"
                                value={pax.passport_number}
                                onChange={(e) =>
                                  updatePassenger(
                                    idx,
                                    "passport_number",
                                    e.target.value.toUpperCase()
                                  )
                                }
                                className="h-7 text-xs uppercase bg-background focus-visible:ring-purple-500"
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                data-booking-input="true"
                                data-pax-index={idx}
                                data-pax-field="cnic"
                                placeholder="42101-..."
                                value={pax.cnic}
                                onChange={(e) =>
                                  updatePassenger(idx, "cnic", e.target.value)
                                }
                                className="h-7 text-xs bg-background focus-visible:ring-purple-500"
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                data-booking-input="true"
                                data-pax-index={idx}
                                data-pax-field="date_of_birth"
                                placeholder="YYYY-MM-DD"
                                value={pax.date_of_birth}
                                onChange={(e) =>
                                  updatePassenger(idx, "date_of_birth", e.target.value)
                                }
                                onBlur={(e) =>
                                  handleDateInputBlurOrChange(e.target.value, (val) =>
                                    updatePassenger(idx, "date_of_birth", val)
                                  )
                                }
                                className="h-7 text-xs bg-background focus-visible:ring-purple-500"
                              />
                            </td>
                            <td className="p-1 text-center">
                              <BookingSelect
                                dataField={`gender-${idx}`}
                                ariaLabel={`Gender Passenger ${idx + 1}`}
                                value={pax.gender || "M"}
                                onValueChange={(val) => updatePassenger(idx, "gender", val)}
                                triggerClassName="h-7 text-xs focus-visible:ring-purple-500"
                                options={[
                                  { label: "Male", value: "M" },
                                  { label: "Female", value: "F" },
                                  { label: "Other", value: "O" },
                                ]}
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                data-booking-input="true"
                                data-pax-index={idx}
                                data-pax-field="nationality"
                                placeholder="Nationality"
                                value={pax.nationality}
                                onChange={(e) =>
                                  updatePassenger(idx, "nationality", e.target.value)
                                }
                                className="h-7 text-xs bg-background focus-visible:ring-purple-500"
                              />
                            </td>
                            <td className="p-1 text-center">
                              {passengers.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  tabIndex={-1}
                                  onClick={() => removePassenger(idx)}
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive cursor-pointer"
                                  aria-label={`Remove Passenger ${idx + 1}`}
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

            {/* ========== 3. PRICING & PAYMENT (GREEN TINT) ========== */}
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 border-l-4 border-l-emerald-600 dark:border-l-emerald-500 rounded-lg p-2.5 sm:p-3">
              <div className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-300 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400">
                    <CreditCard className="w-3.5 h-3.5" />
                  </div>
                  <span>Pricing & Payment</span>
                </span>

                {bookingMode === "direct" && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowOpeningBalance(!showOpeningBalance)}
                    className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer font-medium"
                  >
                    {showOpeningBalance ? "Hide Opening Balance" : "+ Client Opening Balance"}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {/* 0. Agent Rate (Only shown in B2B mode) */}
                {bookingMode === "b2b" && (
                  <div>
                    <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                      Agent Rate
                    </Label>
                    <div
                      tabIndex={-1}
                      aria-label="Agent Rate"
                      className="h-8 px-2 flex items-center justify-between rounded-md border text-xs font-semibold bg-background text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 select-none truncate"
                    >
                      <span className="truncate">
                        {activeAgent
                          ? activeAgent.commission_type === "percentage"
                            ? `${activeAgent.commission_value}%`
                            : `PKR ${activeAgent.commission_value?.toLocaleString()}`
                          : "Standard"}
                      </span>
                      {calculatedCommission > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-1 shrink-0">
                          ({calculatedCommission.toLocaleString()})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 1. Purchase Cost */}
                <div>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                    Purchase Cost
                  </Label>
                  <Input
                    type="number"
                    placeholder="0"
                    data-booking-input="true"
                    data-field="purchasingPrice"
                    value={purchasingPrice}
                    onChange={(e) => setPurchasingPrice(e.target.value)}
                    className="h-8 text-xs font-semibold bg-background focus-visible:ring-emerald-500"
                  />
                </div>

                {/* 2. Total (Selling Price) */}
                <div>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                    Total (Selling) <span className="text-red-500 font-bold">*</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="0"
                    data-booking-input="true"
                    data-field="sellingPrice"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="h-8 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-background focus-visible:ring-emerald-500"
                    required
                  />
                </div>

                {/* 3. Paid */}
                <div>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                    Paid
                  </Label>
                  <Input
                    type="number"
                    placeholder="0"
                    data-booking-input="true"
                    data-field="amountPaid"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="h-8 text-xs font-semibold text-emerald-600 bg-background focus-visible:ring-emerald-500"
                  />
                </div>

                {/* 4. Remaining (Read-only - skipped by Enter & Tab) */}
                <div>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                    Remaining
                  </Label>
                  <div
                    aria-label="Remaining Amount"
                    className={cn(
                      "h-8 px-2 flex items-center rounded-md border text-xs font-bold select-none",
                      remainingAmount === 0
                        ? "bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                        : "bg-rose-100/80 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                    )}
                  >
                    PKR {remainingAmount.toLocaleString()}
                  </div>
                </div>

                {/* 5. Payment Mode */}
                <div>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                    Payment Mode
                  </Label>
                  <BookingSelect
                    dataField="paymentMode"
                    ariaLabel="Payment Mode"
                    value={paymentMode}
                    onValueChange={setPaymentMode}
                    triggerClassName="focus-visible:ring-emerald-500"
                    options={[
                      { label: "Cash", value: "cash" },
                      { label: "Bank Transfer", value: "bank" },
                      { label: "Cheque", value: "cheque" },
                      { label: "Online", value: "online" },
                    ]}
                  />
                </div>

                {/* 6. Bank Name if Bank Transfer selected */}
                {paymentMode === "bank" && (
                  <div>
                    <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                      Bank Name
                    </Label>
                    <Input
                      placeholder="Meezan, HBL..."
                      data-booking-input="true"
                      data-field="bankName"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="h-8 text-xs bg-background focus-visible:ring-emerald-500"
                    />
                  </div>
                )}

                {/* 7. Vendor Selector */}
                <div className={paymentMode === "bank" ? "col-span-1" : "col-span-1 sm:col-span-2"}>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block">
                    Vendor
                  </Label>
                  <div className="flex gap-1">
                    <Popover open={vendorSearchOpen} onOpenChange={setVendorSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          ref={vendorTriggerRef}
                          variant="outline"
                          role="combobox"
                          aria-expanded={vendorSearchOpen}
                          data-booking-input="true"
                          data-field="vendor"
                          className="w-full justify-between h-8 text-xs bg-background font-normal border-emerald-200 dark:border-emerald-800 focus-visible:ring-emerald-500 truncate"
                        >
                          <span className="truncate">
                            {selectedVendorId === "none"
                              ? "None / Direct"
                              : vendors.find((v) => v.id === selectedVendorId)?.name || "Select Vendor"}
                          </span>
                          <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0 ml-1" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Search vendor or service..."
                            value={vendorSearchQuery}
                            onValueChange={setVendorSearchQuery}
                            className="h-8 text-xs"
                          />
                          <CommandList>
                            <CommandEmpty className="p-2 text-xs text-muted-foreground">
                              {vendorSearchQuery.trim() ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start text-xs gap-1.5 text-emerald-600 font-semibold"
                                  onClick={() => {
                                    setIsAddVendorOpen(true);
                                    setAddVendorInitialName(vendorSearchQuery);
                                    setVendorSearchOpen(false);
                                  }}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  + Add &quot;{vendorSearchQuery}&quot;
                                </Button>
                              ) : (
                                "No vendors found"
                              )}
                            </CommandEmpty>
                            <CommandGroup heading="Vendors">
                              <CommandItem
                                value="none direct"
                                onSelect={() => {
                                  setSelectedVendorId("none");
                                  setVendorSearchOpen(false);
                                  setVendorSearchQuery("");
                                  setTimeout(() => {
                                    const nameUpdateEl = document.querySelector<HTMLInputElement>(
                                      'input[data-field="nameUpdateDate"]'
                                    );
                                    if (nameUpdateEl) {
                                      nameUpdateEl.focus();
                                    } else {
                                      notesRef.current?.focus();
                                    }
                                  }, 60);
                                }}
                                className="text-xs flex items-center justify-between cursor-pointer"
                              >
                                <span>None / Direct</span>
                                {selectedVendorId === "none" && (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                )}
                              </CommandItem>
                              {vendors.map((v) => (
                                <CommandItem
                                  key={v.id}
                                  value={`${v.name} ${v.service_type || ""}`}
                                  onSelect={() => {
                                    setSelectedVendorId(v.id);
                                    setVendorSearchOpen(false);
                                    setVendorSearchQuery("");
                                    setTimeout(() => {
                                      const nameUpdateEl = document.querySelector<HTMLInputElement>(
                                        'input[data-field="nameUpdateDate"]'
                                      );
                                      if (nameUpdateEl) {
                                        nameUpdateEl.focus();
                                      } else {
                                        notesRef.current?.focus();
                                      }
                                    }, 60);
                                  }}
                                  className="text-xs flex items-center justify-between cursor-pointer"
                                >
                                  <div className="truncate">
                                    <span className="font-medium">{v.name}</span>
                                    {v.service_type && (
                                      <span className="text-[11px] text-muted-foreground ml-1.5">
                                        ({v.service_type})
                                      </span>
                                    )}
                                  </div>
                                  {selectedVendorId === v.id && (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            {vendorSearchQuery.trim() && (
                              <CommandGroup heading="New Vendor">
                                <CommandItem
                                  value={`add-${vendorSearchQuery}`}
                                  onSelect={() => {
                                    setIsAddVendorOpen(true);
                                    setAddVendorInitialName(vendorSearchQuery);
                                    setVendorSearchOpen(false);
                                  }}
                                  className="text-xs text-emerald-600 font-semibold cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                                  + Add &quot;{vendorSearchQuery}&quot;
                                </CommandItem>
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      tabIndex={-1}
                      onClick={() => {
                        setIsAddVendorOpen(true);
                        setAddVendorInitialName("");
                      }}
                      title="Add New Vendor"
                      className="h-8 w-8 shrink-0 cursor-pointer border-emerald-200 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* 8. Name Update Date */}
                <div>
                  <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 block truncate">
                    Name Update
                  </Label>
                  <Input
                    placeholder="YYYY-MM-DD"
                    data-booking-input="true"
                    data-field="nameUpdateDate"
                    value={nameUpdateDate}
                    onChange={(e) => setNameUpdateDate(e.target.value)}
                    onBlur={(e) =>
                      handleDateInputBlurOrChange(e.target.value, setNameUpdateDate)
                    }
                    className="h-8 text-xs bg-background focus-visible:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Optional Opening Balance for Direct Client */}
              {bookingMode === "direct" && showOpeningBalance && (
                <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800/60 flex items-center gap-3 text-xs animate-in fade-in">
                  <span className="font-semibold text-muted-foreground">
                    Client Opening Balance:
                  </span>
                  <Select
                    value={openingBalanceType}
                    onValueChange={(val: any) => setOpeningBalanceType(val)}
                  >
                    <SelectTrigger className="h-7 text-xs w-28 bg-background">
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
                    className="h-7 text-xs w-36 bg-background"
                  />
                </div>
              )}
            </div>

            {/* ========== 4. NOTES / REMARKS (AMBER / NEUTRAL TINT) ========== */}
            <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 border-l-4 border-l-amber-500 dark:border-l-amber-500 rounded-lg p-2.5 sm:p-3">
              <div className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-300 mb-1.5 flex items-center gap-2">
                <div className="p-1 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span>Notes / Remarks</span>
              </div>
              <Textarea
                ref={notesRef}
                rows={2}
                placeholder="Special requests, flight notes, passenger instructions... (Shift+Enter for new line, Enter to focus Save)"
                data-booking-input="true"
                data-field="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs w-full bg-background resize-none focus-visible:ring-amber-500"
              />
            </div>
          </div>

          {/* ======================= 3. STICKY FOOTER (CANCEL / SAVE NEXT / SAVE) ======================= */}
          <div className="shrink-0 border-t border-border px-3 sm:px-4 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 bg-background/95 backdrop-blur-sm">
            {/* Left: Cancel */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCloseRequest}
              disabled={isSubmitting}
              className="text-xs h-8 cursor-pointer hover:bg-muted"
            >
              Cancel
            </Button>

            {/* Center: Keyboard hint */}
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground select-none">
              <span className="font-semibold text-foreground/80">Enter</span> = next field •
              <span className="font-semibold text-foreground/80">Ctrl+Enter</span> = save •
              <span className="font-semibold text-foreground/80">Esc</span> = cancel
            </div>

            {/* Right: Save & Add Next + Save Booking */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleSave(true)}
                disabled={isSubmitting}
                className="text-xs h-8 font-semibold gap-1.5 cursor-pointer hover:bg-secondary/80"
              >
                <Plus className="w-3.5 h-3.5" />
                Save & Add Next
              </Button>

              <Button
                ref={saveButtonRef}
                type="button"
                size="sm"
                onClick={() => handleSave(false)}
                disabled={isSubmitting}
                className="text-xs h-8 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-sm cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Check className="w-4 h-4" />
                Save Booking
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Exit confirmation dialog for unsaved changes */}
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
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
            >
              Discard & Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Add B2B Agent Modal */}
      <AddB2BAgentDialog
        open={isAddAgentOpen}
        onOpenChange={setIsAddAgentOpen}
        initialName={addAgentInitialName}
        onSaved={(newAgent) => {
          setSelectedAgentId(newAgent.id);
          setIsAddAgentOpen(false);
          setAddAgentInitialName("");
          toast.success(`Agent "${newAgent.agent_name}" selected`);
          setTimeout(() => {
            serviceTriggerRef.current?.focus();
          }, 80);
        }}
      />

      {/* Add Vendor Modal */}
      <AddVendorDialog
        open={isAddVendorOpen}
        onOpenChange={setIsAddVendorOpen}
        initialName={addVendorInitialName}
        onSaved={(newVendor) => {
          setSelectedVendorId(newVendor.id);
          setIsAddVendorOpen(false);
          setAddVendorInitialName("");
          toast.success(`Vendor "${newVendor.name}" selected`);
          setTimeout(() => {
            const nameUpdateEl = document.querySelector<HTMLInputElement>(
              'input[data-field="nameUpdateDate"]'
            );
            if (nameUpdateEl) {
              nameUpdateEl.focus();
            } else {
              notesRef.current?.focus();
            }
          }, 80);
        }}
      />
    </>
  );
}
