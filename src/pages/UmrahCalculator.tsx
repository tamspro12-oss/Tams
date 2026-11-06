import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, RotateCcw, Calendar as CalendarIcon, Save, Upload, Maximize2, Minimize2, Plus, Trash2, Package, PlusCircle, Ticket, FileDown, FileText } from "lucide-react";
import { exportUmrahSummaryPdf } from "@/lib/umrahSummaryPdf";
import { useAgency } from "@/hooks/useAgency";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TicketPayableCalculator } from "@/components/TicketPayableCalculator";
import { MobileUmrahCostCards } from "@/components/MobileUmrahCostCards";
import { useIsMobile } from "@/hooks/use-mobile";

// Calculator mode type
type CalculatorMode = "umrah" | "ticket";

// Rate mode: "sharing" = per person rate, "room" = room rate divided by occupancy
type RateMode = "sharing" | "room";

// Occupancy divisors for room rate mode
const OCCUPANCY_DIVISORS: Record<string, number> = {
  Quint: 5,
  Quad: 4,
  Triple: 3,
  Double: 2,
  Sharing: 1, // Sharing = per person, no division
};

// Types for multi-hotel support
interface HotelEntry {
  id: string;
  name: string;
  sharingType: "Quint" | "Quad" | "Triple" | "Double" | "Sharing";
  rateMode: RateMode;
  rate: string;
  nights: string;
}

// Custom presets stored in localStorage
interface CustomPreset extends PresetPackage {
  isCustom: true;
}

interface PresetPackage {
  id: string;
  name: string;
  makkahHotels: Omit<HotelEntry, 'id'>[];
  madinahHotels: Omit<HotelEntry, 'id'>[];
  visaFee?: string;
  transport?: string;
  ziyarat?: string;
  food?: string;
}

interface CalculationResult {
  nights: number;
  makkahCost: number;
  madinahCost: number;
  baseTotal: number;
  profitAmount: number;
  finalTotal: number;
  perPerson: number;
  totalPassengers: number;
}

// Default presets (read-only templates) - ALL use "Sharing" type, default visa=0, nights 12/8
const DEFAULT_PRESETS: PresetPackage[] = [
  {
    id: "package1",
    name: "Package 1",
    makkahHotels: [{ name: "Standard Hotel Makkah", sharingType: "Sharing", rateMode: "sharing", rate: "150", nights: "12" }],
    madinahHotels: [{ name: "Standard Hotel Madinah", sharingType: "Sharing", rateMode: "sharing", rate: "120", nights: "8" }],
    visaFee: "0",
    transport: "0",
    ziyarat: "0",
    food: "0",
  },
  {
    id: "package2",
    name: "Package 2",
    makkahHotels: [{ name: "3-Star Hotel Makkah", sharingType: "Sharing", rateMode: "sharing", rate: "250", nights: "12" }],
    madinahHotels: [{ name: "3-Star Hotel Madinah", sharingType: "Sharing", rateMode: "sharing", rate: "200", nights: "8" }],
    visaFee: "0",
    transport: "0",
    ziyarat: "0",
    food: "0",
  },
  {
    id: "package3",
    name: "Package 3",
    makkahHotels: [{ name: "4-Star Hotel Makkah", sharingType: "Sharing", rateMode: "sharing", rate: "450", nights: "12" }],
    madinahHotels: [{ name: "4-Star Hotel Madinah", sharingType: "Sharing", rateMode: "sharing", rate: "380", nights: "8" }],
    visaFee: "0",
    transport: "0",
    ziyarat: "0",
    food: "0",
  },
  {
    id: "package4",
    name: "Package 4",
    makkahHotels: [
      { name: "5-Star Hotel Makkah", sharingType: "Sharing", rateMode: "sharing", rate: "800", nights: "12" },
    ],
    madinahHotels: [
      { name: "5-Star Hotel Madinah", sharingType: "Sharing", rateMode: "sharing", rate: "650", nights: "8" },
    ],
    visaFee: "0",
    transport: "0",
    ziyarat: "0",
    food: "0",
  },
];

// "Sharing" renamed to more common industry term
// "Sharing" is default type
const SHARING_TYPES = ["Sharing", "Quint", "Quad", "Triple", "Double"] as const;

export default function UmrahCalculator() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: agency } = useAgency();

  // Calculator Mode Toggle
  const [calculatorMode, setCalculatorMode] = useState<CalculatorMode>("umrah");
  
  // Exchange Rate
  const [sarToPkrRate, setSarToPkrRate] = useState("77.50");
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Travel & Hotels - Original single hotel (backward compatibility)
  // DEFAULT: Makkah 12 nights, Madinah 8 nights (changeable by user)
  const [arrivalDate, setArrivalDate] = useState<Date | undefined>(undefined);
  const [departureDate, setDepartureDate] = useState<Date | undefined>(undefined);
  const [makkahNights, setMakkahNights] = useState("12");
  const [madinahNights, setMadinahNights] = useState("8");
  const [makkahRate, setMakkahRate] = useState("");
  const [madinahRate, setMadinahRate] = useState("");
  const [hotelCurrency, setHotelCurrency] = useState("SAR");

  // NEW: Multi-hotel support (additive feature)
  const [useMultiHotel, setUseMultiHotel] = useState(false);
  const [makkahHotels, setMakkahHotels] = useState<HotelEntry[]>([]);
  const [madinahHotels, setMadinahHotels] = useState<HotelEntry[]>([]);
  
  // NEW: Sharing type labels for single hotel mode - DEFAULT is "Sharing"
  const [makkahSharingType, setMakkahSharingType] = useState<HotelEntry['sharingType']>("Sharing");
  const [madinahSharingType, setMadinahSharingType] = useState<HotelEntry['sharingType']>("Sharing");
  
  // NEW: Rate mode for single hotel mode - "sharing" = per person, "room" = room rate / occupancy
  const [makkahRateMode, setMakkahRateMode] = useState<RateMode>("sharing");
  const [madinahRateMode, setMadinahRateMode] = useState<RateMode>("sharing");

  // Auto-select sharing type based on rate mode
  // When mode is "sharing" → type is "Sharing", when mode is "room" → type is "Quad"
  const handleMakkahRateModeChange = (mode: RateMode) => {
    setMakkahRateMode(mode);
    if (mode === "sharing") {
      setMakkahSharingType("Sharing");
    } else if (mode === "room") {
      setMakkahSharingType("Quad");
    }
  };

  const handleMadinahRateModeChange = (mode: RateMode) => {
    setMadinahRateMode(mode);
    if (mode === "sharing") {
      setMadinahSharingType("Sharing");
    } else if (mode === "room") {
      setMadinahSharingType("Quad");
    }
  };
  
  // NEW: Preset support
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [isPresetLocked, setIsPresetLocked] = useState(false);
  const [customPresets, setCustomPresets] = useState<PresetPackage[]>([]);
  const [showAddPresetDialog, setShowAddPresetDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  // Load custom presets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("umrah_custom_presets");
    if (saved) {
      try {
        setCustomPresets(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load custom presets", e);
      }
    }
  }, []);

  // Charges - DEFAULT visa fee is 0
  const [visaFee, setVisaFee] = useState("0");
  const [visaCurrency, setVisaCurrency] = useState("SAR");
  const [ticketCost, setTicketCost] = useState("");
  const [ticketCurrency, setTicketCurrency] = useState("PKR");
  // DEFAULT values: transport, ziyarat, food = "0"
  const [transport, setTransport] = useState("0");
  const [transportCurrency, setTransportCurrency] = useState("SAR");
  const [ziyarat, setZiyarat] = useState("0");
  const [ziyaratCurrency, setZiyaratCurrency] = useState("SAR");
  const [food, setFood] = useState("0");
  const [foodCurrency, setFoodCurrency] = useState("SAR");
  const [serviceCharges, setServiceCharges] = useState("");
  const [serviceChargesCurrency, setServiceChargesCurrency] = useState("PKR");

  // Passenger Types
  const [adultCount, setAdultCount] = useState("");
  const [childCount, setChildCount] = useState("");
  const [infantCount, setInfantCount] = useState("");

  // Profit
  const [profitType, setProfitType] = useState<"percentage" | "fixed">("percentage");
  const [profitPercent, setProfitPercent] = useState("");
  const [profitFixed, setProfitFixed] = useState("");

  // Results
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    const draft = sessionStorage.getItem("umrah_calculator_draft");
    if (draft) {
      setHasDraft(true);
    }
  }, []);

  const parseValue = (value: string): number => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  const convertToPKR = (amount: number, currency: string): number => {
    if (currency === "PKR") return amount;
    if (currency === "SAR") return amount * parseValue(sarToPkrRate);
    return amount;
  };

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Multi-hotel handlers
  const addMakkahHotel = () => {
    if (!useMultiHotel) {
      // First time enabling multi-hotel, migrate existing data
      const existingHotel: HotelEntry = {
        id: generateId(),
        name: "Hotel Makkah",
        sharingType: makkahSharingType,
        rateMode: makkahRateMode,
        rate: makkahRate,
        nights: makkahNights,
      };
      setMakkahHotels(makkahRate || makkahNights ? [existingHotel] : []);
      setUseMultiHotel(true);
    }
    setMakkahHotels(prev => [...prev, {
      id: generateId(),
      name: "",
      sharingType: "Sharing",
      rateMode: "sharing",
      rate: "",
      nights: "",
    }]);
  };

  const addMadinahHotel = () => {
    if (!useMultiHotel) {
      const existingHotel: HotelEntry = {
        id: generateId(),
        name: "Hotel Madinah",
        sharingType: madinahSharingType,
        rateMode: madinahRateMode,
        rate: madinahRate,
        nights: madinahNights,
      };
      setMadinahHotels(madinahRate || madinahNights ? [existingHotel] : []);
      setUseMultiHotel(true);
    }
    setMadinahHotels(prev => [...prev, {
      id: generateId(),
      name: "",
      sharingType: "Sharing",
      rateMode: "sharing",
      rate: "",
      nights: "",
    }]);
  };

  const updateMakkahHotel = (id: string, field: keyof HotelEntry, value: string) => {
    setMakkahHotels(prev => prev.map(h => h.id === id ? { ...h, [field]: value } : h));
  };

  const updateMadinahHotel = (id: string, field: keyof HotelEntry, value: string) => {
    setMadinahHotels(prev => prev.map(h => h.id === id ? { ...h, [field]: value } : h));
  };

  const removeMakkahHotel = (id: string) => {
    setMakkahHotels(prev => {
      const newList = prev.filter(h => h.id !== id);
      if (newList.length === 0 && madinahHotels.length === 0) {
        setUseMultiHotel(false);
      }
      return newList;
    });
  };

  const removeMadinahHotel = (id: string) => {
    setMadinahHotels(prev => {
      const newList = prev.filter(h => h.id !== id);
      if (newList.length === 0 && makkahHotels.length === 0) {
        setUseMultiHotel(false);
      }
      return newList;
    });
  };

  // Get all presets (default + custom)
  const allPresets = [...DEFAULT_PRESETS, ...customPresets];

  // Preset handler
  const applyPreset = (presetId: string) => {
    if (presetId === "none") {
      setSelectedPreset("none");
      setIsPresetLocked(false);
      setUseMultiHotel(false);
      setMakkahHotels([]);
      setMadinahHotels([]);
      return;
    }
    
    const preset = allPresets.find(p => p.id === presetId);
    if (!preset) return;

    // Apply preset values
    setUseMultiHotel(true);
    setMakkahHotels(preset.makkahHotels.map(h => ({ ...h, id: generateId() })));
    setMadinahHotels(preset.madinahHotels.map(h => ({ ...h, id: generateId() })));
    
    if (preset.visaFee) setVisaFee(preset.visaFee);
    if (preset.transport) setTransport(preset.transport);
    if (preset.ziyarat) setZiyarat(preset.ziyarat);
    if (preset.food) setFood(preset.food);
    
    setSelectedPreset(presetId);
    setIsPresetLocked(true);
    toast.success(`${preset.name} applied! Ticket, Service Charges & Profit remain editable.`);
  };

  const unlockPreset = () => {
    setIsPresetLocked(false);
    setSelectedPreset("");
    toast.info("Preset unlocked - all fields are now editable");
  };

  // Save current configuration as a new preset
  const saveAsPreset = () => {
    if (!newPresetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }

    const newPreset: PresetPackage = {
      id: `custom_${Date.now()}`,
      name: newPresetName.trim(),
      makkahHotels: useMultiHotel 
        ? makkahHotels.map(h => ({ name: h.name, sharingType: h.sharingType, rateMode: h.rateMode, rate: h.rate, nights: h.nights }))
        : [{ name: "Makkah Hotel", sharingType: makkahSharingType, rateMode: makkahRateMode, rate: makkahRate, nights: makkahNights }],
      madinahHotels: useMultiHotel
        ? madinahHotels.map(h => ({ name: h.name, sharingType: h.sharingType, rateMode: h.rateMode, rate: h.rate, nights: h.nights }))
        : [{ name: "Madinah Hotel", sharingType: madinahSharingType, rateMode: madinahRateMode, rate: madinahRate, nights: madinahNights }],
      visaFee: visaFee || undefined,
      transport: transport || undefined,
      ziyarat: ziyarat || undefined,
      food: food || undefined,
    };

    const updatedPresets = [...customPresets, newPreset];
    setCustomPresets(updatedPresets);
    localStorage.setItem("umrah_custom_presets", JSON.stringify(updatedPresets));
    setNewPresetName("");
    setShowAddPresetDialog(false);
    toast.success(`Preset "${newPreset.name}" saved successfully!`);
  };

  const deleteCustomPreset = (presetId: string) => {
    const updatedPresets = customPresets.filter(p => p.id !== presetId);
    setCustomPresets(updatedPresets);
    localStorage.setItem("umrah_custom_presets", JSON.stringify(updatedPresets));
    if (selectedPreset === presetId) {
      setSelectedPreset("none");
      setIsPresetLocked(false);
    }
    toast.success("Preset deleted");
  };

  // ORIGINAL calculation logic - unchanged
  // Calculate per-person cost for a hotel based on rate mode
  const getHotelCostPerPerson = (rate: number, nights: number, rateMode: RateMode, sharingType: string): number => {
    if (rateMode === "room") {
      // Room Rate mode: divide by occupancy to get per-person cost
      const divisor = OCCUPANCY_DIVISORS[sharingType] || 1;
      return (rate / divisor) * nights;
    }
    // Sharing mode: rate is already per person
    return rate * nights;
  };

  const handleCalculate = () => {
    let makkahNightsCount: number;
    let madinahNightsCount: number;
    let makkahCostPerPerson: number;
    let madinahCostPerPerson: number;

    if (useMultiHotel) {
      // Multi-hotel calculation: sum all hotels with rate mode support
      makkahNightsCount = makkahHotels.reduce((sum, h) => sum + parseValue(h.nights), 0);
      madinahNightsCount = madinahHotels.reduce((sum, h) => sum + parseValue(h.nights), 0);
      
      makkahCostPerPerson = makkahHotels.reduce((sum, h) => 
        sum + convertToPKR(getHotelCostPerPerson(parseValue(h.rate), parseValue(h.nights), h.rateMode, h.sharingType), hotelCurrency), 0);
      madinahCostPerPerson = madinahHotels.reduce((sum, h) => 
        sum + convertToPKR(getHotelCostPerPerson(parseValue(h.rate), parseValue(h.nights), h.rateMode, h.sharingType), hotelCurrency), 0);
    } else {
      // Single hotel calculation with rate mode support
      makkahNightsCount = parseValue(makkahNights);
      madinahNightsCount = parseValue(madinahNights);
      makkahCostPerPerson = convertToPKR(getHotelCostPerPerson(parseValue(makkahRate), makkahNightsCount, makkahRateMode, makkahSharingType), hotelCurrency);
      madinahCostPerPerson = convertToPKR(getHotelCostPerPerson(parseValue(madinahRate), madinahNightsCount, madinahRateMode, madinahSharingType), hotelCurrency);
    }

    const totalNights = makkahNightsCount + madinahNightsCount;
    const totalPassengers = parseValue(adultCount) + parseValue(childCount) + parseValue(infantCount);
    const passengerMultiplier = totalPassengers > 0 ? totalPassengers : 1;

    const costPerPerson =
      convertToPKR(parseValue(visaFee), visaCurrency) +
      convertToPKR(parseValue(ticketCost), ticketCurrency) +
      makkahCostPerPerson +
      madinahCostPerPerson +
      convertToPKR(parseValue(transport), transportCurrency) +
      convertToPKR(parseValue(ziyarat), ziyaratCurrency) +
      convertToPKR(parseValue(food), foodCurrency) +
      convertToPKR(parseValue(serviceCharges), serviceChargesCurrency);

    const baseTotal = costPerPerson * passengerMultiplier;

    let profitAmount = 0;
    if (profitType === "percentage") {
      profitAmount = baseTotal * (parseValue(profitPercent) / 100);
    } else {
      profitAmount = parseValue(profitFixed);
    }

    const finalTotal = baseTotal + profitAmount;
    const perPerson = costPerPerson + (profitAmount / passengerMultiplier);

    setResult({
      nights: totalNights,
      makkahCost: makkahCostPerPerson * passengerMultiplier,
      madinahCost: madinahCostPerPerson * passengerMultiplier,
      baseTotal,
      profitAmount,
      finalTotal,
      perPerson,
      totalPassengers,
    });
  };

  const handleReset = () => {
    setSarToPkrRate("77.50");
    setArrivalDate(undefined);
    setDepartureDate(undefined);
    setMakkahNights("12");
    setMadinahNights("8");
    setMakkahRate("");
    setMadinahRate("");
    setHotelCurrency("SAR");
    setMakkahSharingType("Sharing");
    setMadinahSharingType("Sharing");
    setMakkahRateMode("sharing");
    setMadinahRateMode("sharing");
    setUseMultiHotel(false);
    setMakkahHotels([]);
    setMadinahHotels([]);
    setSelectedPreset("none");
    setIsPresetLocked(false);
    setVisaFee("0");
    setVisaCurrency("SAR");
    setTicketCost("");
    setTicketCurrency("PKR");
    setTransport("0");
    setTransportCurrency("SAR");
    setZiyarat("0");
    setZiyaratCurrency("SAR");
    setFood("0");
    setFoodCurrency("SAR");
    setServiceCharges("");
    setServiceChargesCurrency("PKR");
    setAdultCount("");
    setChildCount("");
    setInfantCount("");
    setProfitType("percentage");
    setProfitPercent("");
    setProfitFixed("");
    setResult(null);
    sessionStorage.removeItem("umrah_calculator_draft");
    setHasDraft(false);
    toast.success("Calculator reset successfully");
  };

  const handleSaveDraft = () => {
    const draft = {
      sarToPkrRate,
      arrivalDate: arrivalDate?.toISOString(),
      departureDate: departureDate?.toISOString(),
      makkahNights,
      madinahNights,
      makkahRate,
      madinahRate,
      hotelCurrency,
      makkahSharingType,
      madinahSharingType,
      useMultiHotel,
      makkahHotels,
      madinahHotels,
      selectedPreset,
      visaFee,
      visaCurrency,
      ticketCost,
      ticketCurrency,
      transport,
      transportCurrency,
      ziyarat,
      ziyaratCurrency,
      food,
      foodCurrency,
      serviceCharges,
      serviceChargesCurrency,
      adultCount,
      childCount,
      infantCount,
      profitType,
      profitPercent,
      profitFixed,
      result,
      savedAt: new Date().toISOString(),
    };

    sessionStorage.setItem("umrah_calculator_draft", JSON.stringify(draft));
    setHasDraft(true);
    toast.success("Draft saved to session");
  };

  const handleLoadDraft = () => {
    const draft = sessionStorage.getItem("umrah_calculator_draft");
    if (!draft) {
      toast.error("No draft found");
      return;
    }

    try {
      const data = JSON.parse(draft);
      setSarToPkrRate(data.sarToPkrRate || "77.50");
      if (data.arrivalDate) setArrivalDate(new Date(data.arrivalDate));
      if (data.departureDate) setDepartureDate(new Date(data.departureDate));
      setMakkahNights(data.makkahNights || "");
      setMadinahNights(data.madinahNights || "");
      setMakkahRate(data.makkahRate || "");
      setMadinahRate(data.madinahRate || "");
      setHotelCurrency(data.hotelCurrency || "SAR");
      setMakkahSharingType(data.makkahSharingType || "Double");
      setMadinahSharingType(data.madinahSharingType || "Double");
      setUseMultiHotel(data.useMultiHotel || false);
      setMakkahHotels(data.makkahHotels || []);
      setMadinahHotels(data.madinahHotels || []);
      setSelectedPreset(data.selectedPreset || "");
      setVisaFee(data.visaFee || "");
      setVisaCurrency(data.visaCurrency || "SAR");
      setTicketCost(data.ticketCost || "");
      setTicketCurrency(data.ticketCurrency || "PKR");
      setTransport(data.transport || "");
      setTransportCurrency(data.transportCurrency || "SAR");
      setZiyarat(data.ziyarat || "");
      setZiyaratCurrency(data.ziyaratCurrency || "SAR");
      setFood(data.food || "");
      setFoodCurrency(data.foodCurrency || "SAR");
      setServiceCharges(data.serviceCharges || "");
      setServiceChargesCurrency(data.serviceChargesCurrency || "PKR");
      setAdultCount(data.adultCount || "");
      setChildCount(data.childCount || "");
      setInfantCount(data.infantCount || "");
      setProfitType(data.profitType || "percentage");
      setProfitPercent(data.profitPercent || "");
      setProfitFixed(data.profitFixed || "");
      setResult(data.result || null);

      const savedDate = new Date(data.savedAt);
      toast.success(`Draft loaded from ${format(savedDate, "PPp")}`);
    } catch (error) {
      toast.error("Failed to load draft");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = {
      SAR: "ر.س",
      PKR: "Rs",
      USD: "$",
      EUR: "€",
      AED: "د.إ",
    };
    return symbols[currency] || currency;
  };

  // Calculate row totals for live preview with rate mode support
  const getRowTotal = (amount: string, nights: string, currency: string): number => {
    const amt = parseValue(amount);
    const nts = parseValue(nights) || 1;
    return convertToPKR(amt * (nights ? nts : 1), currency);
  };

  // Calculate hotel row total with rate mode support
  const getHotelRowTotal = (hotel: HotelEntry): number => {
    const rate = parseValue(hotel.rate);
    const nights = parseValue(hotel.nights);
    if (hotel.rateMode === "room") {
      const divisor = OCCUPANCY_DIVISORS[hotel.sharingType] || 1;
      return convertToPKR((rate / divisor) * nights, hotelCurrency);
    }
    return convertToPKR(rate * nights, hotelCurrency);
  };

  // Calculate single hotel row total with rate mode support  
  const getSingleHotelRowTotal = (rate: string, nights: string, rateMode: RateMode, sharingType: string): number => {
    const r = parseValue(rate);
    const n = parseValue(nights);
    if (rateMode === "room") {
      const divisor = OCCUPANCY_DIVISORS[sharingType] || 1;
      return convertToPKR((r / divisor) * n, hotelCurrency);
    }
    return convertToPKR(r * n, hotelCurrency);
  };

  const CurrencySelect = ({ value, onChange, className = "" }: { value: string; onChange: (v: string) => void; className?: string }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-8 text-xs", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="SAR">SAR</SelectItem>
        <SelectItem value="PKR">PKR</SelectItem>
        <SelectItem value="USD">USD</SelectItem>
        <SelectItem value="EUR">EUR</SelectItem>
        <SelectItem value="AED">AED</SelectItem>
      </SelectContent>
    </Select>
  );

  const SharingTypeSelect = ({ value, onChange, disabled = false }: { value: string; onChange: (v: string) => void; disabled?: boolean }) => (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-7 text-xs w-20">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SHARING_TYPES.map(type => (
          <SelectItem key={type} value={type}>{type}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // Rate Mode Selector Component
  const RateModeSelect = ({ value, onChange, disabled = false }: { value: RateMode; onChange: (v: RateMode) => void; disabled?: boolean }) => (
    <Select value={value} onValueChange={(v) => onChange(v as RateMode)} disabled={disabled}>
      <SelectTrigger className="h-7 text-xs w-[70px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="sharing">
          <span title="Rate is per person">Sharing</span>
        </SelectItem>
        <SelectItem value="room">
          <span title="Room rate divided by occupancy">Room</span>
        </SelectItem>
      </SelectContent>
    </Select>
  );

  const totalPassengers = parseValue(adultCount) + parseValue(childCount) + parseValue(infantCount);

  // Calculate multi-hotel totals for display
  const makkahMultiTotal = makkahHotels.reduce((sum, h) => sum + getHotelRowTotal(h), 0);
  const madinahMultiTotal = madinahHotels.reduce((sum, h) => sum + getHotelRowTotal(h), 0);
  const makkahMultiNights = makkahHotels.reduce((sum, h) => sum + parseValue(h.nights), 0);
  const madinahMultiNights = madinahHotels.reduce((sum, h) => sum + parseValue(h.nights), 0);

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header with Calculator Mode Toggle */}
        <div className="flex flex-col gap-4 pb-3 border-b border-border">
          {/* Title Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                {calculatorMode === "umrah" ? (
                  <Calculator className="w-6 h-6 text-primary" />
                ) : (
                  <Ticket className="w-6 h-6 text-primary" />
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {calculatorMode === "umrah" ? "Umrah Package Calculator" : "Ticket Payable Calculator"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {calculatorMode === "umrah" 
                    ? "All costs per person • Auto-multiplied by passengers" 
                    : "Calculate vendor share and ticket payable amounts"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {calculatorMode === "umrah" && hasDraft && (
                <Button onClick={handleLoadDraft} variant="secondary" size="sm" className="h-8 gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Load Draft</span>
                </Button>
              )}
            </div>
          </div>
          
          {/* Calculator Mode Toggle Buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCalculatorMode("umrah")}
              variant={calculatorMode === "umrah" ? "default" : "outline"}
              size="sm"
              className="gap-2 h-9"
            >
              <Calculator className="w-4 h-4" />
              Umrah Package
            </Button>
            <Button
              onClick={() => setCalculatorMode("ticket")}
              variant={calculatorMode === "ticket" ? "default" : "outline"}
              size="sm"
              className="gap-2 h-9"
            >
              <Ticket className="w-4 h-4" />
              Ticket Payable
            </Button>
          </div>
        </div>

        {/* Conditional Content Based on Mode */}
        {calculatorMode === "ticket" ? (
          <TicketPayableCalculator />
        ) : (
          <>
            {/* Preset Selector - UMRAH CALCULATOR ONLY */}
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-accent/30 border border-accent/50">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-accent-foreground" />
                <span className="text-sm font-medium">Quick Preset:</span>
              </div>
          <Select value={selectedPreset} onValueChange={applyPreset}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Select package..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (Manual Entry)</SelectItem>
              {allPresets.map(preset => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                  {preset.id.startsWith('custom_') && ' ⭐'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={() => setShowAddPresetDialog(true)} 
            variant="outline" 
            size="sm" 
            className="h-8 gap-1.5 text-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Preset</span>
          </Button>
          {isPresetLocked && (
            <Button onClick={unlockPreset} variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
              🔓 Unlock to Edit
            </Button>
          )}
          {selectedPreset && selectedPreset.startsWith('custom_') && (
            <Button 
              onClick={() => deleteCustomPreset(selectedPreset)} 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs text-destructive hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Delete
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto hidden md:block">
            Presets auto-fill hotels & services. Ticket/Profit remain editable.
          </span>
        </div>

        {/* Add Preset Dialog */}
        <Dialog open={showAddPresetDialog} onOpenChange={setShowAddPresetDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Save as New Preset</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="preset-name">Preset Name</Label>
                <Input
                  id="preset-name"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="e.g., Package 5, Economy Special..."
                  className="h-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This will save your current hotel configurations, visa, transport, ziyarat, and food values as a reusable preset. Each hotel's Type and rates will be preserved.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddPresetDialog(false)}>
                Cancel
              </Button>
              <Button onClick={saveAsPreset}>
                Save Preset
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Exchange Rate & Dates - Inline Bar */}
        <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary">1 SAR =</span>
            <Input
              type="number"
              value={sarToPkrRate}
              onChange={(e) => setSarToPkrRate(e.target.value)}
              className="w-20 h-8 text-sm font-semibold"
              placeholder="77.50"
            />
            <span className="text-sm font-medium">PKR</span>
          </div>
          <div className="h-6 w-px bg-border hidden md:block" />
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs w-[130px] justify-start">
                  {arrivalDate ? format(arrivalDate, "MMM dd, yyyy") : "Arrival"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={arrivalDate} onSelect={setArrivalDate} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">→</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs w-[130px] justify-start">
                  {departureDate ? format(departureDate, "MMM dd, yyyy") : "Departure"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={departureDate} onSelect={setDepartureDate} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="h-6 w-px bg-border hidden md:block" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Hotel Currency:</span>
            <CurrencySelect value={hotelCurrency} onChange={setHotelCurrency} className="w-20" />
          </div>
        </div>

        {/* Main Cost Section - Table on desktop, Cards on mobile */}
        {isMobile ? (
          <MobileUmrahCostCards
            useMultiHotel={useMultiHotel}
            makkahHotels={makkahHotels}
            madinahHotels={madinahHotels}
            makkahNights={makkahNights}
            madinahNights={madinahNights}
            makkahRate={makkahRate}
            madinahRate={madinahRate}
            makkahSharingType={makkahSharingType}
            madinahSharingType={madinahSharingType}
            makkahRateMode={makkahRateMode}
            madinahRateMode={madinahRateMode}
            hotelCurrency={hotelCurrency}
            isPresetLocked={isPresetLocked}
            setMakkahNights={setMakkahNights}
            setMadinahNights={setMadinahNights}
            setMakkahRate={setMakkahRate}
            setMadinahRate={setMadinahRate}
            setMakkahSharingType={setMakkahSharingType}
            setMadinahSharingType={setMadinahSharingType}
            handleMakkahRateModeChange={handleMakkahRateModeChange}
            handleMadinahRateModeChange={handleMadinahRateModeChange}
            addMakkahHotel={addMakkahHotel}
            addMadinahHotel={addMadinahHotel}
            updateMakkahHotel={updateMakkahHotel}
            updateMadinahHotel={updateMadinahHotel}
            removeMakkahHotel={removeMakkahHotel}
            removeMadinahHotel={removeMadinahHotel}
            ticketCost={ticketCost}
            setTicketCost={setTicketCost}
            ticketCurrency={ticketCurrency}
            setTicketCurrency={setTicketCurrency}
            visaFee={visaFee}
            setVisaFee={setVisaFee}
            visaCurrency={visaCurrency}
            setVisaCurrency={setVisaCurrency}
            transport={transport}
            setTransport={setTransport}
            transportCurrency={transportCurrency}
            setTransportCurrency={setTransportCurrency}
            ziyarat={ziyarat}
            setZiyarat={setZiyarat}
            ziyaratCurrency={ziyaratCurrency}
            setZiyaratCurrency={setZiyaratCurrency}
            food={food}
            setFood={setFood}
            foodCurrency={foodCurrency}
            setFoodCurrency={setFoodCurrency}
            serviceCharges={serviceCharges}
            setServiceCharges={setServiceCharges}
            serviceChargesCurrency={serviceChargesCurrency}
            setServiceChargesCurrency={setServiceChargesCurrency}
            parseValue={parseValue}
            convertToPKR={convertToPKR}
            formatCurrency={formatCurrency}
            getCurrencySymbol={getCurrencySymbol}
            getSingleHotelRowTotal={getSingleHotelRowTotal}
            getHotelRowTotal={getHotelRowTotal}
            makkahMultiTotal={makkahMultiTotal}
            madinahMultiTotal={madinahMultiTotal}
            makkahMultiNights={makkahMultiNights}
            madinahMultiNights={madinahMultiNights}
          />
        ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[180px] font-semibold">Description</TableHead>
                <TableHead className="w-[80px] text-center font-semibold">Type</TableHead>
                <TableHead className="w-[70px] text-center font-semibold">Rate Mode</TableHead>
                <TableHead className="w-[90px] text-center font-semibold">Nights</TableHead>
                <TableHead className="w-[100px] text-center font-semibold">Rate/Amount</TableHead>
                <TableHead className="w-[70px] text-center font-semibold">Currency</TableHead>
                <TableHead className="w-[120px] text-right font-semibold">Per Person (PKR)</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Makkah Hotels Section */}
              {!useMultiHotel ? (
                <TableRow className="hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>🕋</span>
                      <span>Makkah Hotel</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <SharingTypeSelect 
                      value={makkahSharingType} 
                      onChange={(v) => setMakkahSharingType(v as HotelEntry['sharingType'])}
                      disabled={isPresetLocked}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <RateModeSelect
                      value={makkahRateMode}
                      onChange={handleMakkahRateModeChange}
                      disabled={isPresetLocked}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      value={makkahNights}
                      onChange={(e) => setMakkahNights(e.target.value)}
                      className="h-8 w-16 mx-auto text-center text-sm"
                      placeholder="0"
                      disabled={isPresetLocked}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      value={makkahRate}
                      onChange={(e) => setMakkahRate(e.target.value)}
                      className="h-8 w-20 mx-auto text-center text-sm"
                      placeholder="0.00"
                      disabled={isPresetLocked}
                    />
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {getCurrencySymbol(hotelCurrency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {makkahNights && makkahRate ? (
                      <div className="flex flex-col items-end">
                        <span>Rs {formatCurrency(getSingleHotelRowTotal(makkahRate, makkahNights, makkahRateMode, makkahSharingType))}</span>
                        {makkahRateMode === "room" && (
                          <span className="text-[10px] text-muted-foreground">
                            ÷{OCCUPANCY_DIVISORS[makkahSharingType]}
                          </span>
                        )}
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={addMakkahHotel}
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      title="Add another Makkah hotel"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {makkahHotels.map((hotel, index) => (
                    <TableRow key={hotel.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>🕋</span>
                          <Input
                            type="text"
                            value={hotel.name}
                            onChange={(e) => updateMakkahHotel(hotel.id, 'name', e.target.value)}
                            className="h-7 text-xs w-28"
                            placeholder={`Makkah Hotel ${index + 1}`}
                            disabled={isPresetLocked}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <SharingTypeSelect 
                          value={hotel.sharingType} 
                          onChange={(v) => updateMakkahHotel(hotel.id, 'sharingType', v)}
                          disabled={isPresetLocked}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <RateModeSelect
                          value={hotel.rateMode}
                          onChange={(v) => updateMakkahHotel(hotel.id, 'rateMode', v)}
                          disabled={isPresetLocked}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          value={hotel.nights}
                          onChange={(e) => updateMakkahHotel(hotel.id, 'nights', e.target.value)}
                          className="h-8 w-16 mx-auto text-center text-sm"
                          placeholder="0"
                          disabled={isPresetLocked}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          value={hotel.rate}
                          onChange={(e) => updateMakkahHotel(hotel.id, 'rate', e.target.value)}
                          className="h-8 w-20 mx-auto text-center text-sm"
                          placeholder="0.00"
                          disabled={isPresetLocked}
                        />
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {getCurrencySymbol(hotelCurrency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {hotel.nights && hotel.rate ? (
                          <div className="flex flex-col items-end">
                            <span>Rs {formatCurrency(getHotelRowTotal(hotel))}</span>
                            {hotel.rateMode === "room" && (
                              <span className="text-[10px] text-muted-foreground">
                                ÷{OCCUPANCY_DIVISORS[hotel.sharingType]}
                              </span>
                            )}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={() => removeMakkahHotel(hotel.id)}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          disabled={isPresetLocked}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {makkahHotels.length > 0 && (
                    <TableRow className="bg-muted/20">
                      <TableCell colSpan={2} className="text-right text-xs font-medium text-muted-foreground">
                        Makkah Total ({makkahHotels.length} hotel{makkahHotels.length > 1 ? 's' : ''})
                      </TableCell>
                      <TableCell className="text-center text-xs font-semibold">{makkahMultiNights} nights</TableCell>
                      <TableCell colSpan={2}></TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                        Rs {formatCurrency(makkahMultiTotal)}
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={addMakkahHotel}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Add another Makkah hotel"
                          disabled={isPresetLocked}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}

              {/* Madinah Hotels Section */}
              {!useMultiHotel ? (
                <TableRow className="hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>🕌</span>
                      <span>Madinah Hotel</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <SharingTypeSelect 
                      value={madinahSharingType} 
                      onChange={(v) => setMadinahSharingType(v as HotelEntry['sharingType'])}
                      disabled={isPresetLocked}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <RateModeSelect
                      value={madinahRateMode}
                      onChange={handleMadinahRateModeChange}
                      disabled={isPresetLocked}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      value={madinahNights}
                      onChange={(e) => setMadinahNights(e.target.value)}
                      className="h-8 w-16 mx-auto text-center text-sm"
                      placeholder="0"
                      disabled={isPresetLocked}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      value={madinahRate}
                      onChange={(e) => setMadinahRate(e.target.value)}
                      className="h-8 w-20 mx-auto text-center text-sm"
                      placeholder="0.00"
                      disabled={isPresetLocked}
                    />
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {getCurrencySymbol(hotelCurrency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {madinahNights && madinahRate ? (
                      <div className="flex flex-col items-end">
                        <span>Rs {formatCurrency(getSingleHotelRowTotal(madinahRate, madinahNights, madinahRateMode, madinahSharingType))}</span>
                        {madinahRateMode === "room" && (
                          <span className="text-[10px] text-muted-foreground">
                            ÷{OCCUPANCY_DIVISORS[madinahSharingType]}
                          </span>
                        )}
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={addMadinahHotel}
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      title="Add another Madinah hotel"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {madinahHotels.map((hotel, index) => (
                    <TableRow key={hotel.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>🕌</span>
                          <Input
                            type="text"
                            value={hotel.name}
                            onChange={(e) => updateMadinahHotel(hotel.id, 'name', e.target.value)}
                            className="h-7 text-xs w-28"
                            placeholder={`Madinah Hotel ${index + 1}`}
                            disabled={isPresetLocked}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <SharingTypeSelect 
                          value={hotel.sharingType} 
                          onChange={(v) => updateMadinahHotel(hotel.id, 'sharingType', v)}
                          disabled={isPresetLocked}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <RateModeSelect
                          value={hotel.rateMode}
                          onChange={(v) => updateMadinahHotel(hotel.id, 'rateMode', v)}
                          disabled={isPresetLocked}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          value={hotel.nights}
                          onChange={(e) => updateMadinahHotel(hotel.id, 'nights', e.target.value)}
                          className="h-8 w-16 mx-auto text-center text-sm"
                          placeholder="0"
                          disabled={isPresetLocked}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          value={hotel.rate}
                          onChange={(e) => updateMadinahHotel(hotel.id, 'rate', e.target.value)}
                          className="h-8 w-20 mx-auto text-center text-sm"
                          placeholder="0.00"
                          disabled={isPresetLocked}
                        />
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {getCurrencySymbol(hotelCurrency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {hotel.nights && hotel.rate ? (
                          <div className="flex flex-col items-end">
                            <span>Rs {formatCurrency(getHotelRowTotal(hotel))}</span>
                            {hotel.rateMode === "room" && (
                              <span className="text-[10px] text-muted-foreground">
                                ÷{OCCUPANCY_DIVISORS[hotel.sharingType]}
                              </span>
                            )}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={() => removeMadinahHotel(hotel.id)}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          disabled={isPresetLocked}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {madinahHotels.length > 0 && (
                    <TableRow className="bg-muted/20">
                      <TableCell colSpan={2} className="text-right text-xs font-medium text-muted-foreground">
                        Madinah Total ({madinahHotels.length} hotel{madinahHotels.length > 1 ? 's' : ''})
                      </TableCell>
                      <TableCell className="text-center text-xs font-semibold">{madinahMultiNights} nights</TableCell>
                      <TableCell colSpan={2}></TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                        Rs {formatCurrency(madinahMultiTotal)}
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={addMadinahHotel}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Add another Madinah hotel"
                          disabled={isPresetLocked}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}

              {/* Airline Ticket */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>✈️</span>
                    <span>Airline Ticket</span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-center text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number"
                    value={ticketCost}
                    onChange={(e) => setTicketCost(e.target.value)}
                    className="h-8 w-24 mx-auto text-center text-sm"
                    placeholder="0.00"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <CurrencySelect value={ticketCurrency} onChange={setTicketCurrency} className="w-16 mx-auto" />
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {ticketCost ? `Rs ${formatCurrency(convertToPKR(parseValue(ticketCost), ticketCurrency))}` : "-"}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>

              {/* Visa Fee */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>📋</span>
                    <span>Visa Fee</span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-center text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number"
                    value={visaFee}
                    onChange={(e) => setVisaFee(e.target.value)}
                    className="h-8 w-24 mx-auto text-center text-sm"
                    placeholder="0.00"
                    disabled={isPresetLocked}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <CurrencySelect value={visaCurrency} onChange={setVisaCurrency} className="w-16 mx-auto" />
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {visaFee ? `Rs ${formatCurrency(convertToPKR(parseValue(visaFee), visaCurrency))}` : "-"}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>

              {/* Transport */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>🚌</span>
                    <span>Transport</span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-center text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number"
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    className="h-8 w-24 mx-auto text-center text-sm"
                    placeholder="0.00"
                    disabled={isPresetLocked}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <CurrencySelect value={transportCurrency} onChange={setTransportCurrency} className="w-16 mx-auto" />
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {transport ? `Rs ${formatCurrency(convertToPKR(parseValue(transport), transportCurrency))}` : "-"}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>

              {/* Ziyarat */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>🕌</span>
                    <span>Ziyarat</span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-center text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number"
                    value={ziyarat}
                    onChange={(e) => setZiyarat(e.target.value)}
                    className="h-8 w-24 mx-auto text-center text-sm"
                    placeholder="0.00"
                    disabled={isPresetLocked}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <CurrencySelect value={ziyaratCurrency} onChange={setZiyaratCurrency} className="w-16 mx-auto" />
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {ziyarat ? `Rs ${formatCurrency(convertToPKR(parseValue(ziyarat), ziyaratCurrency))}` : "-"}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>

              {/* Food/Add-ons */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>🍽️</span>
                    <span>Food/Add-ons</span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-center text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number"
                    value={food}
                    onChange={(e) => setFood(e.target.value)}
                    className="h-8 w-24 mx-auto text-center text-sm"
                    placeholder="0.00"
                    disabled={isPresetLocked}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <CurrencySelect value={foodCurrency} onChange={setFoodCurrency} className="w-16 mx-auto" />
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {food ? `Rs ${formatCurrency(convertToPKR(parseValue(food), foodCurrency))}` : "-"}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>

              {/* Service Charges */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>💼</span>
                    <span>Service Charges</span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-center text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number"
                    value={serviceCharges}
                    onChange={(e) => setServiceCharges(e.target.value)}
                    className="h-8 w-24 mx-auto text-center text-sm"
                    placeholder="0.00"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <CurrencySelect value={serviceChargesCurrency} onChange={setServiceChargesCurrency} className="w-16 mx-auto" />
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {serviceCharges ? `Rs ${formatCurrency(convertToPKR(parseValue(serviceCharges), serviceChargesCurrency))}` : "-"}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        )}

        {/* Bottom Section: Passengers + Profit + Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Passengers */}
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span>👥</span> Passengers
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Adults</label>
                <Input
                  type="number"
                  value={adultCount}
                  onChange={(e) => setAdultCount(e.target.value)}
                  className="h-8 text-center text-sm"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Children</label>
                <Input
                  type="number"
                  value={childCount}
                  onChange={(e) => setChildCount(e.target.value)}
                  className="h-8 text-center text-sm"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Infants</label>
                <Input
                  type="number"
                  value={infantCount}
                  onChange={(e) => setInfantCount(e.target.value)}
                  className="h-8 text-center text-sm"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
            {totalPassengers > 0 && (
              <div className="mt-2 text-xs text-center text-muted-foreground bg-muted/50 py-1 rounded">
                Total: <span className="font-semibold">{totalPassengers}</span> passengers
              </div>
            )}
          </div>

          {/* Profit Settings - Always editable */}
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span>💰</span> Profit Settings
            </h3>
            <div className="space-y-3">
              <RadioGroup
                value={profitType}
                onValueChange={(v) => setProfitType(v as "percentage" | "fixed")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-1.5">
                  <RadioGroupItem value="percentage" id="percentage" />
                  <label htmlFor="percentage" className="text-xs cursor-pointer">Percentage</label>
                </div>
                <div className="flex items-center space-x-1.5">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <label htmlFor="fixed" className="text-xs cursor-pointer">Fixed Amount</label>
                </div>
              </RadioGroup>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Percentage (%)</label>
                  <Input
                    type="number"
                    value={profitPercent}
                    onChange={(e) => setProfitPercent(e.target.value)}
                    className="h-8 text-sm"
                    placeholder="0"
                    disabled={profitType === "fixed"}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Fixed (PKR)</label>
                  <Input
                    type="number"
                    value={profitFixed}
                    onChange={(e) => setProfitFixed(e.target.value)}
                    className="h-8 text-sm"
                    placeholder="0.00"
                    disabled={profitType === "percentage"}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
              <Calculator className="w-4 h-4" /> Summary
            </h3>
            {result ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nights</span>
                  <span className="font-medium">{result.nights}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base Total</span>
                  <span className="font-mono">Rs {formatCurrency(result.baseTotal)}</span>
                </div>
                {result.profitAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>+ Profit</span>
                    <span className="font-mono">Rs {formatCurrency(result.profitAmount)}</span>
                  </div>
                )}
                <div className="border-t border-border pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Final Total</span>
                    <span className="font-mono text-primary">Rs {formatCurrency(result.finalTotal)}</span>
                  </div>
                  {result.totalPassengers > 0 && (
                    <div className="flex justify-between mt-1.5 p-2 bg-primary/10 rounded">
                      <span className="text-xs">Per Person ({result.totalPassengers})</span>
                      <span className="font-mono font-bold text-primary">Rs {formatCurrency(result.perPerson)}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-xs">
                Click Calculate to see results
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons - Inline */}
        <div className="flex flex-wrap justify-center gap-2 pt-2 pb-4">
          <Button onClick={handleCalculate} size="sm" className="gap-1.5 min-w-[120px]">
            <Calculator className="w-4 h-4" />
            Calculate
          </Button>
          <Button
            onClick={() => {
              if (!result) {
                toast.error("Please click Calculate first");
                return;
              }
              const hotels = useMultiHotel
                ? [
                    ...makkahHotels.map(h => ({ city: "Makkah" as const, name: h.name, sharingType: h.sharingType, rateMode: h.rateMode, rate: h.rate, nights: h.nights, currency: hotelCurrency })),
                    ...madinahHotels.map(h => ({ city: "Madinah" as const, name: h.name, sharingType: h.sharingType, rateMode: h.rateMode, rate: h.rate, nights: h.nights, currency: hotelCurrency })),
                  ]
                : [
                    { city: "Makkah" as const, name: "Makkah Hotel", sharingType: makkahSharingType, rateMode: makkahRateMode, rate: makkahRate, nights: makkahNights, currency: hotelCurrency },
                    { city: "Madinah" as const, name: "Madinah Hotel", sharingType: madinahSharingType, rateMode: madinahRateMode, rate: madinahRate, nights: madinahNights, currency: hotelCurrency },
                  ];
              const presetName = allPresets.find(p => p.id === selectedPreset)?.name;
              try {
                exportUmrahSummaryPdf({
                  agencyName: agency?.name,
                  agencyPhone: (agency as any)?.phone || (agency as any)?.contact_number || agency?.contact_info,
                  agencyEmail: agency?.email || agency?.contact_email,
                  agencyAddress: (agency as any)?.address,
                  packageName: presetName,
                  arrivalDate: arrivalDate || null,
                  departureDate: departureDate || null,
                  sarToPkrRate,
                  hotels,
                  visaFee, visaCurrency,
                  ticketCost, ticketCurrency,
                  transport, transportCurrency,
                  ziyarat, ziyaratCurrency,
                  food, foodCurrency,
                  serviceCharges, serviceChargesCurrency,
                  adultCount, childCount, infantCount,
                  result,
                });
                toast.success("Summary PDF downloaded");
              } catch (e) {
                console.error(e);
                toast.error("Failed to generate PDF");
              }
            }}
            variant="default"
            size="sm"
            className="gap-1.5 min-w-[150px] bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <FileDown className="w-4 h-4" />
            Download Summary
          </Button>
          <Button onClick={handleSaveDraft} variant="outline" size="sm" className="gap-1.5 min-w-[110px]">
            <Save className="w-4 h-4" />
            Save Draft
          </Button>
          <Button
            onClick={() => {
              if (!result) { toast.error("Calculate first to create a quotation"); return; }
              const perPerson = Math.round(result.perPerson);
              navigate("/app/quotations", {
                state: {
                  prefill: {
                    service_type: "umrah",
                    title: `Umrah Package — ${result.nights} Nights`,
                    description: `${result.totalPassengers} passenger(s). Per person: Rs ${perPerson.toLocaleString()}.`,
                    currency: "PKR",
                    items: [
                      {
                        description: `Umrah Package (per person) — ${result.nights} nights`,
                        qty: result.totalPassengers,
                        unit_price: perPerson,
                        amount: perPerson * result.totalPassengers,
                      },
                    ],
                    source: "umrah-calculator",
                  },
                },
              });
            }}
            size="sm"
            className="gap-1.5 min-w-[160px] bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <FileText className="w-4 h-4" />
            Create Quotation
          </Button>
          <Button onClick={handleReset} variant="outline" size="sm" className="gap-1.5 min-w-[100px]">
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
