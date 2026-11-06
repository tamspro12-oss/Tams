import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calculator,
  RotateCcw,
  Calendar as CalendarIcon,
  Save,
  Upload,
  Plus,
  Minus,
  Trash2,
  Package,
  PlusCircle,
  FileDown,
  FileText,
  CheckCircle2,
  Copy,
  Info,
  Unlock,
  ArrowRight,
  Sparkles,
  ChevronRight,
} from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { MobileUmrahCostCards } from "@/components/MobileUmrahCostCards";

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

interface PresetPackage {
  id: string;
  name: string;
  makkahHotels: Omit<HotelEntry, "id">[];
  madinahHotels: Omit<HotelEntry, "id">[];
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

// Default presets (read-only templates)
const DEFAULT_PRESETS: PresetPackage[] = [
  {
    id: "package1",
    name: "Package 1 (Standard)",
    makkahHotels: [{ name: "Standard Hotel Makkah", sharingType: "Sharing", rateMode: "sharing", rate: "150", nights: "12" }],
    madinahHotels: [{ name: "Standard Hotel Madinah", sharingType: "Sharing", rateMode: "sharing", rate: "120", nights: "8" }],
    visaFee: "0",
    transport: "0",
    ziyarat: "0",
    food: "0",
  },
  {
    id: "package2",
    name: "Package 2 (3-Star)",
    makkahHotels: [{ name: "3-Star Hotel Makkah", sharingType: "Sharing", rateMode: "sharing", rate: "250", nights: "12" }],
    madinahHotels: [{ name: "3-Star Hotel Madinah", sharingType: "Sharing", rateMode: "sharing", rate: "200", nights: "8" }],
    visaFee: "0",
    transport: "0",
    ziyarat: "0",
    food: "0",
  },
  {
    id: "package3",
    name: "Package 3 (4-Star)",
    makkahHotels: [{ name: "4-Star Hotel Makkah", sharingType: "Sharing", rateMode: "sharing", rate: "450", nights: "12" }],
    madinahHotels: [{ name: "4-Star Hotel Madinah", sharingType: "Sharing", rateMode: "sharing", rate: "380", nights: "8" }],
    visaFee: "0",
    transport: "0",
    ziyarat: "0",
    food: "0",
  },
  {
    id: "package4",
    name: "Package 4 (5-Star)",
    makkahHotels: [{ name: "5-Star Hotel Makkah", sharingType: "Sharing", rateMode: "sharing", rate: "800", nights: "12" }],
    madinahHotels: [{ name: "5-Star Hotel Madinah", sharingType: "Sharing", rateMode: "sharing", rate: "650", nights: "8" }],
    visaFee: "0",
    transport: "0",
    ziyarat: "0",
    food: "0",
  },
];

const SHARING_TYPES = ["Sharing", "Quint", "Quad", "Triple", "Double"] as const;

export default function UmrahCalculator() {
  const navigate = useNavigate();
  const { data: agency } = useAgency();

  // Exchange Rate
  const [sarToPkrRate, setSarToPkrRate] = useState("77.50");

  // Travel & Hotels
  const [arrivalDate, setArrivalDate] = useState<Date | undefined>(undefined);
  const [departureDate, setDepartureDate] = useState<Date | undefined>(undefined);
  const [makkahNights, setMakkahNights] = useState("12");
  const [madinahNights, setMadinahNights] = useState("8");
  const [makkahRate, setMakkahRate] = useState("");
  const [madinahRate, setMadinahRate] = useState("");
  const [hotelCurrency, setHotelCurrency] = useState("SAR");

  // Multi-hotel support
  const [useMultiHotel, setUseMultiHotel] = useState(false);
  const [makkahHotels, setMakkahHotels] = useState<HotelEntry[]>([]);
  const [madinahHotels, setMadinahHotels] = useState<HotelEntry[]>([]);

  // Sharing type labels for single hotel mode
  const [makkahSharingType, setMakkahSharingType] = useState<HotelEntry["sharingType"]>("Sharing");
  const [madinahSharingType, setMadinahSharingType] = useState<HotelEntry["sharingType"]>("Sharing");

  // Rate mode for single hotel mode
  const [makkahRateMode, setMakkahRateMode] = useState<RateMode>("sharing");
  const [madinahRateMode, setMadinahRateMode] = useState<RateMode>("sharing");

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

  // Presets
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [isPresetLocked, setIsPresetLocked] = useState(false);
  const [customPresets, setCustomPresets] = useState<PresetPackage[]>([]);
  const [showAddPresetDialog, setShowAddPresetDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  // Mobile Bottom Sheets
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [mobilePresetSheetOpen, setMobilePresetSheetOpen] = useState(false);

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

  // Charges
  const [visaFee, setVisaFee] = useState("0");
  const [visaCurrency, setVisaCurrency] = useState("SAR");
  const [ticketCost, setTicketCost] = useState("");
  const [ticketCurrency, setTicketCurrency] = useState("PKR");
  const [transport, setTransport] = useState("0");
  const [transportCurrency, setTransportCurrency] = useState("SAR");
  const [ziyarat, setZiyarat] = useState("0");
  const [ziyaratCurrency, setZiyaratCurrency] = useState("SAR");
  const [food, setFood] = useState("0");
  const [foodCurrency, setFoodCurrency] = useState("SAR");
  const [serviceCharges, setServiceCharges] = useState("");
  const [serviceChargesCurrency, setServiceChargesCurrency] = useState("PKR");

  // Passengers
  const [adultCount, setAdultCount] = useState("");
  const [childCount, setChildCount] = useState("");
  const [infantCount, setInfantCount] = useState("");

  // Profit
  const [profitType, setProfitType] = useState<"percentage" | "fixed">("percentage");
  const [profitPercent, setProfitPercent] = useState("");
  const [profitFixed, setProfitFixed] = useState("");

  // Results & Draft
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
      const existingHotel: HotelEntry = {
        id: generateId(),
        name: "Hotel Makkah 1",
        sharingType: makkahSharingType,
        rateMode: makkahRateMode,
        rate: makkahRate,
        nights: makkahNights,
      };
      setMakkahHotels(makkahRate || makkahNights ? [existingHotel] : []);
      setUseMultiHotel(true);
    }
    setMakkahHotels(prev => [
      ...prev,
      {
        id: generateId(),
        name: "",
        sharingType: "Sharing",
        rateMode: "sharing",
        rate: "",
        nights: "",
      },
    ]);
  };

  const addMadinahHotel = () => {
    if (!useMultiHotel) {
      const existingHotel: HotelEntry = {
        id: generateId(),
        name: "Hotel Madinah 1",
        sharingType: madinahSharingType,
        rateMode: madinahRateMode,
        rate: madinahRate,
        nights: madinahNights,
      };
      setMadinahHotels(madinahRate || madinahNights ? [existingHotel] : []);
      setUseMultiHotel(true);
    }
    setMadinahHotels(prev => [
      ...prev,
      {
        id: generateId(),
        name: "",
        sharingType: "Sharing",
        rateMode: "sharing",
        rate: "",
        nights: "",
      },
    ]);
  };

  const updateMakkahHotel = (id: string, field: keyof HotelEntry, value: string) => {
    setMakkahHotels(prev => prev.map(h => (h.id === id ? { ...h, [field]: value } : h)));
  };

  const updateMadinahHotel = (id: string, field: keyof HotelEntry, value: string) => {
    setMadinahHotels(prev => prev.map(h => (h.id === id ? { ...h, [field]: value } : h)));
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

  // Presets list
  const allPresets = useMemo(() => [...DEFAULT_PRESETS, ...customPresets], [customPresets]);

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

    setUseMultiHotel(true);
    setMakkahHotels(preset.makkahHotels.map(h => ({ ...h, id: generateId() })));
    setMadinahHotels(preset.madinahHotels.map(h => ({ ...h, id: generateId() })));

    if (preset.visaFee !== undefined) setVisaFee(preset.visaFee);
    if (preset.transport !== undefined) setTransport(preset.transport);
    if (preset.ziyarat !== undefined) setZiyarat(preset.ziyarat);
    if (preset.food !== undefined) setFood(preset.food);

    setSelectedPreset(presetId);
    setIsPresetLocked(true);
    toast.success(`${preset.name} applied! Ticket, profit & passengers remain editable.`);
  };

  const unlockPreset = () => {
    setIsPresetLocked(false);
    setSelectedPreset("");
    toast.info("Preset unlocked - all fields are now editable");
  };

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

  // Calculation formulas (100% UNCHANGED)
  const getHotelCostPerPerson = (rate: number, nights: number, rateMode: RateMode, sharingType: string): number => {
    if (rateMode === "room") {
      const divisor = OCCUPANCY_DIVISORS[sharingType] || 1;
      return (rate / divisor) * nights;
    }
    return rate * nights;
  };

  const calculateUmrah = () => {
    let makkahNightsCount: number;
    let madinahNightsCount: number;
    let makkahCostPerPerson: number;
    let madinahCostPerPerson: number;

    if (useMultiHotel) {
      makkahNightsCount = makkahHotels.reduce((sum, h) => sum + parseValue(h.nights), 0);
      madinahNightsCount = madinahHotels.reduce((sum, h) => sum + parseValue(h.nights), 0);

      makkahCostPerPerson = makkahHotels.reduce(
        (sum, h) =>
          sum + convertToPKR(getHotelCostPerPerson(parseValue(h.rate), parseValue(h.nights), h.rateMode, h.sharingType), hotelCurrency),
        0
      );
      madinahCostPerPerson = madinahHotels.reduce(
        (sum, h) =>
          sum + convertToPKR(getHotelCostPerPerson(parseValue(h.rate), parseValue(h.nights), h.rateMode, h.sharingType), hotelCurrency),
        0
      );
    } else {
      makkahNightsCount = parseValue(makkahNights);
      madinahNightsCount = parseValue(madinahNights);
      makkahCostPerPerson = convertToPKR(
        getHotelCostPerPerson(parseValue(makkahRate), makkahNightsCount, makkahRateMode, makkahSharingType),
        hotelCurrency
      );
      madinahCostPerPerson = convertToPKR(
        getHotelCostPerPerson(parseValue(madinahRate), madinahNightsCount, madinahRateMode, madinahSharingType),
        hotelCurrency
      );
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
    const perPerson = costPerPerson + profitAmount / passengerMultiplier;

    return {
      nights: totalNights,
      makkahCost: makkahCostPerPerson * passengerMultiplier,
      madinahCost: madinahCostPerPerson * passengerMultiplier,
      baseTotal,
      profitAmount,
      finalTotal,
      perPerson,
      totalPassengers,
    };
  };

  // Real-time calculation effect
  useEffect(() => {
    const res = calculateUmrah();
    setResult(res);
  }, [
    sarToPkrRate,
    makkahNights,
    madinahNights,
    makkahRate,
    madinahRate,
    makkahSharingType,
    madinahSharingType,
    makkahRateMode,
    madinahRateMode,
    hotelCurrency,
    useMultiHotel,
    makkahHotels,
    madinahHotels,
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
  ]);

  const handleCalculate = () => {
    const res = calculateUmrah();
    setResult(res);
    toast.success("Package calculated successfully");
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
      setMakkahSharingType(data.makkahSharingType || "Sharing");
      setMadinahSharingType(data.madinahSharingType || "Sharing");
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

  const handleCopyQuote = () => {
    if (!result) return;
    const presetName = allPresets.find(p => p.id === selectedPreset)?.name;
    const lines = [
      `🕋 Umrah Package Quotation ${presetName ? `(${presetName})` : ""}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      arrivalDate && departureDate
        ? `📅 Dates: ${format(arrivalDate, "dd MMM yyyy")} to ${format(departureDate, "dd MMM yyyy")} (${result.nights} Nights)`
        : `📅 Duration: ${result.nights} Nights`,
      `👥 Passengers: ${result.totalPassengers || 1} (${adultCount || 0} Adults, ${childCount || 0} Children${infantCount ? `, ${infantCount} Infants` : ""})`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💰 Total Package: Rs ${formatCurrency(result.finalTotal)}`,
      `👤 Cost Per Person: Rs ${formatCurrency(result.perPerson)}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Includes: Hotels (Makkah & Madinah), Visa, Tickets, Transport, Ziyarat & Services.`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Quote summary copied to clipboard!");
  };

  const handleDownloadPdf = () => {
    if (!result) {
      toast.error("Please calculate first");
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
        result,
      });
      toast.success("Summary PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF");
    }
  };

  const handleCreateQuotation = () => {
    if (!result) {
      toast.error("Calculate first to create a quotation");
      return;
    }
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
  };

  const handleCreateBooking = () => {
    if (!result) {
      toast.error("Calculate first to create a booking");
      return;
    }
    const perPerson = Math.round(result.perPerson);
    navigate("/app/bookings?tab=clients", {
      state: {
        openAddClient: true,
        prefill: {
          travel_type: "Umrah",
          selling_price: result.finalTotal,
          purchasing_price: result.baseTotal,
          group_size: result.totalPassengers,
          group_booking_type: result.totalPassengers > 1 ? "group" : "individual",
          flight_date: arrivalDate || "",
          return_date: departureDate || "",
          notes: `Umrah Package calculation (${result.nights} nights, ${result.totalPassengers} passengers). Cost per person: Rs ${perPerson.toLocaleString()}.`,
        },
      },
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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

  const getHotelRowTotal = (hotel: HotelEntry): number => {
    const rate = parseValue(hotel.rate);
    const nights = parseValue(hotel.nights);
    if (hotel.rateMode === "room") {
      const divisor = OCCUPANCY_DIVISORS[hotel.sharingType] || 1;
      return convertToPKR((rate / divisor) * nights, hotelCurrency);
    }
    return convertToPKR(rate * nights, hotelCurrency);
  };

  const getSingleHotelRowTotal = (rate: string, nights: string, rateMode: RateMode, sharingType: string): number => {
    const r = parseValue(rate);
    const n = parseValue(nights);
    if (rateMode === "room") {
      const divisor = OCCUPANCY_DIVISORS[sharingType] || 1;
      return convertToPKR((r / divisor) * n, hotelCurrency);
    }
    return convertToPKR(r * n, hotelCurrency);
  };

  // Reusable currency select
  const CurrencySelect = ({
    value,
    onChange,
    className = "",
    disabled = false,
  }: {
    value: string;
    onChange: (v: string) => void;
    className?: string;
    disabled?: boolean;
  }) => (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn("h-7 text-xs font-medium px-2 py-0", className)}>
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

  const SharingTypeSelect = ({
    value,
    onChange,
    disabled = false,
  }: {
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
  }) => (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-7 text-xs w-[76px] px-1.5 py-0 mx-auto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SHARING_TYPES.map(type => (
          <SelectItem key={type} value={type} className="text-xs">
            {type}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const RateModeSelect = ({
    value,
    onChange,
    disabled = false,
  }: {
    value: RateMode;
    onChange: (v: RateMode) => void;
    disabled?: boolean;
  }) => (
    <Select value={value} onValueChange={v => onChange(v as RateMode)} disabled={disabled}>
      <SelectTrigger className="h-7 text-xs w-[72px] px-1.5 py-0 mx-auto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="sharing" className="text-xs">
          Sharing
        </SelectItem>
        <SelectItem value="room" className="text-xs">
          Room
        </SelectItem>
      </SelectContent>
    </Select>
  );

  // Stepper helper
  const stepCount = (current: string, delta: number, setter: (val: string) => void) => {
    const curVal = parseInt(current) || 0;
    const newVal = Math.max(0, curVal + delta);
    setter(newVal === 0 ? "" : newVal.toString());
  };

  const totalPassengers = parseValue(adultCount) + parseValue(childCount) + parseValue(infantCount);

  // Totals for table
  const makkahMultiTotal = makkahHotels.reduce((sum, h) => sum + getHotelRowTotal(h), 0);
  const madinahMultiTotal = madinahHotels.reduce((sum, h) => sum + getHotelRowTotal(h), 0);
  const makkahMultiNights = makkahHotels.reduce((sum, h) => sum + parseValue(h.nights), 0);
  const madinahMultiNights = madinahHotels.reduce((sum, h) => sum + parseValue(h.nights), 0);

  const makkahCostPerPerson = useMultiHotel
    ? makkahMultiTotal
    : makkahNights && makkahRate
    ? getSingleHotelRowTotal(makkahRate, makkahNights, makkahRateMode, makkahSharingType)
    : 0;

  const madinahCostPerPerson = useMultiHotel
    ? madinahMultiTotal
    : madinahNights && madinahRate
    ? getSingleHotelRowTotal(madinahRate, madinahNights, madinahRateMode, madinahSharingType)
    : 0;

  const ticketPerPerson = ticketCost ? convertToPKR(parseValue(ticketCost), ticketCurrency) : 0;
  const visaPerPerson = visaFee ? convertToPKR(parseValue(visaFee), visaCurrency) : 0;
  const transportPerPerson = transport ? convertToPKR(parseValue(transport), transportCurrency) : 0;
  const ziyaratPerPerson = ziyarat ? convertToPKR(parseValue(ziyarat), ziyaratCurrency) : 0;
  const foodPerPerson = food ? convertToPKR(parseValue(food), foodCurrency) : 0;

  // Base table sum per person
  const tableBaseCostPerPerson =
    makkahCostPerPerson +
    madinahCostPerPerson +
    ticketPerPerson +
    visaPerPerson +
    transportPerPerson +
    ziyaratPerPerson +
    foodPerPerson;

  return (
    <div className="w-full">
      {/* =========================================================================
          DESKTOP LAYOUT (>= 1024px)
          Fills remaining viewport height with ZERO vertical scroll on 1366x768 & 1440x900
         ========================================================================= */}
      <div className="hidden lg:flex flex-col -m-2 md:-m-4 lg:-m-6 h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] overflow-hidden p-3 lg:p-4 gap-2.5 bg-background">
        {/* 1) TOP TOOLBAR (compact 2 rows, ~84px total) */}
        <div className="shrink-0 space-y-2">
          {/* Row 1: Title on left, Presets on right */}
          <div className="flex items-center justify-between gap-3 h-8">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Calculator className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-foreground truncate">
                Umrah Package Calculator
              </h1>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {hasDraft && (
                <Button
                  onClick={handleLoadDraft}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Load Draft</span>
                </Button>
              )}

              {/* Quick Preset Selector with Tooltip */}
              <div className="flex items-center gap-1.5 bg-card border border-border/80 rounded-lg px-2 py-0.5 shadow-2xs">
                <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-muted-foreground hidden xl:inline">Quick Preset:</span>

                <Select value={selectedPreset} onValueChange={applyPreset}>
                  <SelectTrigger className="h-7 w-[160px] text-xs border-0 bg-transparent shadow-none px-1 focus:ring-0">
                    <SelectValue placeholder="Select package..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Manual Entry)</SelectItem>
                    {allPresets.map(preset => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.name}
                        {preset.id.startsWith("custom_") && " ⭐"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                        aria-label="Preset information"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs max-w-xs">
                      Presets auto-fill hotels & services. Ticket, profit & passengers remain editable.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {isPresetLocked && (
                  <Button
                    onClick={unlockPreset}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[11px] text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 gap-1"
                  >
                    <Unlock className="w-3 h-3" />
                    <span>Unlock</span>
                  </Button>
                )}

                {selectedPreset && selectedPreset.startsWith("custom_") && (
                  <Button
                    onClick={() => deleteCustomPreset(selectedPreset)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    title="Delete preset"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>

              <Button
                onClick={() => setShowAddPresetDialog(true)}
                variant="outline"
                size="sm"
                className="h-7 px-2.5 gap-1.5 text-xs font-medium shadow-2xs"
                title="Save current config as Preset"
              >
                <PlusCircle className="w-3.5 h-3.5 text-primary" />
                <span>Add Preset</span>
              </Button>
            </div>
          </div>

          {/* Row 2: Slim bar containing Exchange Rate, Dates, Hotel Currency */}
          <div className="h-9 px-3 rounded-lg bg-card border border-border/80 flex items-center justify-between gap-3 text-xs shadow-2xs">
            {/* Exchange rate */}
            <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
              <span className="font-semibold text-foreground">1 SAR =</span>
              <Input
                type="number"
                value={sarToPkrRate}
                onChange={e => setSarToPkrRate(e.target.value)}
                className="w-16 h-7 text-xs font-semibold px-1 py-0 text-center"
                placeholder="77.50"
              />
              <span className="font-medium text-muted-foreground">PKR</span>
            </div>

            <div className="h-4 w-px bg-border/80" />

            {/* Dates: Arrival -> Departure */}
            <div className="flex items-center gap-2 shrink-0">
              <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs w-[115px] justify-start px-2 font-normal">
                    {arrivalDate ? format(arrivalDate, "dd MMM yyyy") : "Arrival Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={arrivalDate}
                    onSelect={setArrivalDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs w-[115px] justify-start px-2 font-normal">
                    {departureDate ? format(departureDate, "dd MMM yyyy") : "Departure Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={departureDate}
                    onSelect={setDepartureDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="h-4 w-px bg-border/80" />

            {/* Hotel Currency */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-muted-foreground font-medium">Hotel Currency:</span>
              <CurrencySelect value={hotelCurrency} onChange={setHotelCurrency} className="w-[75px] h-7" />
            </div>
          </div>
        </div>

        {/* 2) MAIN AREA = 2 COLUMNS (fills remaining height, overflow-hidden) */}
        <div className="flex-1 min-h-0 grid grid-cols-12 gap-3 overflow-hidden">
          {/* LEFT COLUMN (~65% / col-span-8): "Costs" table */}
          <div className="col-span-8 flex flex-col h-full rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/70 backdrop-blur-xs z-10">
                  <TableRow className="h-8 border-b border-border/80 hover:bg-transparent">
                    <TableHead className="w-[180px] font-semibold text-xs text-foreground py-1">Description</TableHead>
                    <TableHead className="w-[85px] text-center font-semibold text-xs text-foreground py-1">Type</TableHead>
                    <TableHead className="w-[80px] text-center font-semibold text-xs text-foreground py-1">Rate Mode</TableHead>
                    <TableHead className="w-[70px] text-center font-semibold text-xs text-foreground py-1">Nights</TableHead>
                    <TableHead className="w-[95px] text-center font-semibold text-xs text-foreground py-1">Rate/Amount</TableHead>
                    <TableHead className="w-[75px] text-center font-semibold text-xs text-foreground py-1">Currency</TableHead>
                    <TableHead className="w-[125px] text-right font-semibold text-xs text-foreground py-1 pr-3">Per Person (PKR)</TableHead>
                    <TableHead className="w-[36px] py-1"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* 1. Makkah Hotel */}
                  {!useMultiHotel ? (
                    <TableRow className="h-10 hover:bg-muted/20 border-b border-border/50">
                      <TableCell className="font-medium text-xs py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🕋</span>
                          <span className="font-semibold">Makkah Hotel</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        <SharingTypeSelect
                          value={makkahSharingType}
                          onChange={v => setMakkahSharingType(v as HotelEntry["sharingType"])}
                          disabled={isPresetLocked}
                        />
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        <RateModeSelect
                          value={makkahRateMode}
                          onChange={handleMakkahRateModeChange}
                          disabled={isPresetLocked}
                        />
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        <Input
                          type="number"
                          value={makkahNights}
                          onChange={e => setMakkahNights(e.target.value)}
                          className="h-7 w-14 mx-auto text-center text-xs"
                          placeholder="0"
                          disabled={isPresetLocked}
                        />
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        <Input
                          type="number"
                          value={makkahRate}
                          onChange={e => setMakkahRate(e.target.value)}
                          className="h-7 w-20 mx-auto text-center text-xs"
                          placeholder="0.00"
                          disabled={isPresetLocked}
                        />
                      </TableCell>
                      <TableCell className="text-center py-1.5 text-xs text-muted-foreground font-medium">
                        {hotelCurrency}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold py-1.5 pr-3">
                        {makkahCostPerPerson > 0 ? (
                          <div className="flex flex-col items-end">
                            <span className="text-foreground">Rs {formatCurrency(makkahCostPerPerson)}</span>
                            {makkahRateMode === "room" && (
                              <span className="text-[10px] text-muted-foreground font-normal">
                                ÷{OCCUPANCY_DIVISORS[makkahSharingType]}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5 text-center">
                        <Button
                          onClick={addMakkahHotel}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          title="Add another Makkah hotel"
                          disabled={isPresetLocked}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {makkahHotels.map((hotel, index) => (
                        <TableRow key={hotel.id} className="h-10 hover:bg-muted/20 border-b border-border/50">
                          <TableCell className="font-medium text-xs py-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-base shrink-0">🕋</span>
                              <Input
                                type="text"
                                value={hotel.name}
                                onChange={e => updateMakkahHotel(hotel.id, "name", e.target.value)}
                                className="h-7 text-xs w-28 font-medium"
                                placeholder={`Makkah ${index + 1}`}
                                disabled={isPresetLocked}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-1.5">
                            <SharingTypeSelect
                              value={hotel.sharingType}
                              onChange={v => updateMakkahHotel(hotel.id, "sharingType", v)}
                              disabled={isPresetLocked}
                            />
                          </TableCell>
                          <TableCell className="text-center py-1.5">
                            <RateModeSelect
                              value={hotel.rateMode}
                              onChange={v => updateMakkahHotel(hotel.id, "rateMode", v)}
                              disabled={isPresetLocked}
                            />
                          </TableCell>
                          <TableCell className="text-center py-1.5">
                            <Input
                              type="number"
                              value={hotel.nights}
                              onChange={e => updateMakkahHotel(hotel.id, "nights", e.target.value)}
                              className="h-7 w-14 mx-auto text-center text-xs"
                              placeholder="0"
                              disabled={isPresetLocked}
                            />
                          </TableCell>
                          <TableCell className="text-center py-1.5">
                            <Input
                              type="number"
                              value={hotel.rate}
                              onChange={e => updateMakkahHotel(hotel.id, "rate", e.target.value)}
                              className="h-7 w-20 mx-auto text-center text-xs"
                              placeholder="0.00"
                              disabled={isPresetLocked}
                            />
                          </TableCell>
                          <TableCell className="text-center py-1.5 text-xs text-muted-foreground font-medium">
                            {hotelCurrency}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold py-1.5 pr-3">
                            {getHotelRowTotal(hotel) > 0 ? (
                              <div className="flex flex-col items-end">
                                <span className="text-foreground">Rs {formatCurrency(getHotelRowTotal(hotel))}</span>
                                {hotel.rateMode === "room" && (
                                  <span className="text-[10px] text-muted-foreground font-normal">
                                    ÷{OCCUPANCY_DIVISORS[hotel.sharingType]}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-1.5 text-center">
                            <Button
                              onClick={() => removeMakkahHotel(hotel.id)}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              disabled={isPresetLocked}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {makkahHotels.length > 0 && (
                        <TableRow className="h-8 bg-muted/25 border-b border-border/50 text-[11px]">
                          <TableCell colSpan={3} className="py-1 text-xs font-semibold text-muted-foreground pl-6">
                            Makkah Total ({makkahHotels.length} hotel{makkahHotels.length > 1 ? "s" : ""})
                          </TableCell>
                          <TableCell className="text-center py-1 font-semibold text-foreground">
                            {makkahMultiNights} nts
                          </TableCell>
                          <TableCell colSpan={2}></TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold text-primary py-1 pr-3">
                            Rs {formatCurrency(makkahMultiTotal)}
                          </TableCell>
                          <TableCell className="py-1 text-center">
                            <Button
                              onClick={addMakkahHotel}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-primary"
                              title="Add another Makkah hotel"
                              disabled={isPresetLocked}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )}

                  {/* 2. Madinah Hotel */}
                  {!useMultiHotel ? (
                    <TableRow className="h-10 hover:bg-muted/20 border-b border-border/50">
                      <TableCell className="font-medium text-xs py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🕌</span>
                          <span className="font-semibold">Madinah Hotel</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        <SharingTypeSelect
                          value={madinahSharingType}
                          onChange={v => setMadinahSharingType(v as HotelEntry["sharingType"])}
                          disabled={isPresetLocked}
                        />
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        <RateModeSelect
                          value={madinahRateMode}
                          onChange={handleMadinahRateModeChange}
                          disabled={isPresetLocked}
                        />
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        <Input
                          type="number"
                          value={madinahNights}
                          onChange={e => setMadinahNights(e.target.value)}
                          className="h-7 w-14 mx-auto text-center text-xs"
                          placeholder="0"
                          disabled={isPresetLocked}
                        />
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        <Input
                          type="number"
                          value={madinahRate}
                          onChange={e => setMadinahRate(e.target.value)}
                          className="h-7 w-20 mx-auto text-center text-xs"
                          placeholder="0.00"
                          disabled={isPresetLocked}
                        />
                      </TableCell>
                      <TableCell className="text-center py-1.5 text-xs text-muted-foreground font-medium">
                        {hotelCurrency}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold py-1.5 pr-3">
                        {madinahCostPerPerson > 0 ? (
                          <div className="flex flex-col items-end">
                            <span className="text-foreground">Rs {formatCurrency(madinahCostPerPerson)}</span>
                            {madinahRateMode === "room" && (
                              <span className="text-[10px] text-muted-foreground font-normal">
                                ÷{OCCUPANCY_DIVISORS[madinahSharingType]}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5 text-center">
                        <Button
                          onClick={addMadinahHotel}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          title="Add another Madinah hotel"
                          disabled={isPresetLocked}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {madinahHotels.map((hotel, index) => (
                        <TableRow key={hotel.id} className="h-10 hover:bg-muted/20 border-b border-border/50">
                          <TableCell className="font-medium text-xs py-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-base shrink-0">🕌</span>
                              <Input
                                type="text"
                                value={hotel.name}
                                onChange={e => updateMadinahHotel(hotel.id, "name", e.target.value)}
                                className="h-7 text-xs w-28 font-medium"
                                placeholder={`Madinah ${index + 1}`}
                                disabled={isPresetLocked}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-1.5">
                            <SharingTypeSelect
                              value={hotel.sharingType}
                              onChange={v => updateMadinahHotel(hotel.id, "sharingType", v)}
                              disabled={isPresetLocked}
                            />
                          </TableCell>
                          <TableCell className="text-center py-1.5">
                            <RateModeSelect
                              value={hotel.rateMode}
                              onChange={v => updateMadinahHotel(hotel.id, "rateMode", v)}
                              disabled={isPresetLocked}
                            />
                          </TableCell>
                          <TableCell className="text-center py-1.5">
                            <Input
                              type="number"
                              value={hotel.nights}
                              onChange={e => updateMadinahHotel(hotel.id, "nights", e.target.value)}
                              className="h-7 w-14 mx-auto text-center text-xs"
                              placeholder="0"
                              disabled={isPresetLocked}
                            />
                          </TableCell>
                          <TableCell className="text-center py-1.5">
                            <Input
                              type="number"
                              value={hotel.rate}
                              onChange={e => updateMadinahHotel(hotel.id, "rate", e.target.value)}
                              className="h-7 w-20 mx-auto text-center text-xs"
                              placeholder="0.00"
                              disabled={isPresetLocked}
                            />
                          </TableCell>
                          <TableCell className="text-center py-1.5 text-xs text-muted-foreground font-medium">
                            {hotelCurrency}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold py-1.5 pr-3">
                            {getHotelRowTotal(hotel) > 0 ? (
                              <div className="flex flex-col items-end">
                                <span className="text-foreground">Rs {formatCurrency(getHotelRowTotal(hotel))}</span>
                                {hotel.rateMode === "room" && (
                                  <span className="text-[10px] text-muted-foreground font-normal">
                                    ÷{OCCUPANCY_DIVISORS[hotel.sharingType]}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-1.5 text-center">
                            <Button
                              onClick={() => removeMadinahHotel(hotel.id)}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              disabled={isPresetLocked}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {madinahHotels.length > 0 && (
                        <TableRow className="h-8 bg-muted/25 border-b border-border/50 text-[11px]">
                          <TableCell colSpan={3} className="py-1 text-xs font-semibold text-muted-foreground pl-6">
                            Madinah Total ({madinahHotels.length} hotel{madinahHotels.length > 1 ? "s" : ""})
                          </TableCell>
                          <TableCell className="text-center py-1 font-semibold text-foreground">
                            {madinahMultiNights} nts
                          </TableCell>
                          <TableCell colSpan={2}></TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold text-primary py-1 pr-3">
                            Rs {formatCurrency(madinahMultiTotal)}
                          </TableCell>
                          <TableCell className="py-1 text-center">
                            <Button
                              onClick={addMadinahHotel}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-primary"
                              title="Add another Madinah hotel"
                              disabled={isPresetLocked}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )}

                  {/* 3. Airline Ticket */}
                  <TableRow className="h-10 hover:bg-muted/20 border-b border-border/50">
                    <TableCell className="font-medium text-xs py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">✈️</span>
                        <span>Airline Ticket</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-center py-1.5">
                      <Input
                        type="number"
                        value={ticketCost}
                        onChange={e => setTicketCost(e.target.value)}
                        className="h-7 w-20 mx-auto text-center text-xs"
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell className="text-center py-1.5">
                      <CurrencySelect value={ticketCurrency} onChange={setTicketCurrency} className="w-[68px] mx-auto" />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold py-1.5 pr-3">
                      {ticketPerPerson > 0 ? `Rs ${formatCurrency(ticketPerPerson)}` : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="py-1.5"></TableCell>
                  </TableRow>

                  {/* 4. Visa Fee */}
                  <TableRow className="h-10 hover:bg-muted/20 border-b border-border/50">
                    <TableCell className="font-medium text-xs py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📋</span>
                        <span>Visa Fee</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-center py-1.5">
                      <Input
                        type="number"
                        value={visaFee}
                        onChange={e => setVisaFee(e.target.value)}
                        className="h-7 w-20 mx-auto text-center text-xs"
                        placeholder="0.00"
                        disabled={isPresetLocked}
                      />
                    </TableCell>
                    <TableCell className="text-center py-1.5">
                      <CurrencySelect
                        value={visaCurrency}
                        onChange={setVisaCurrency}
                        className="w-[68px] mx-auto"
                        disabled={isPresetLocked}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold py-1.5 pr-3">
                      {visaPerPerson > 0 ? `Rs ${formatCurrency(visaPerPerson)}` : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="py-1.5"></TableCell>
                  </TableRow>

                  {/* 5. Transport */}
                  <TableRow className="h-10 hover:bg-muted/20 border-b border-border/50">
                    <TableCell className="font-medium text-xs py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🚌</span>
                        <span>Transport</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-center py-1.5">
                      <Input
                        type="number"
                        value={transport}
                        onChange={e => setTransport(e.target.value)}
                        className="h-7 w-20 mx-auto text-center text-xs"
                        placeholder="0.00"
                        disabled={isPresetLocked}
                      />
                    </TableCell>
                    <TableCell className="text-center py-1.5">
                      <CurrencySelect
                        value={transportCurrency}
                        onChange={setTransportCurrency}
                        className="w-[68px] mx-auto"
                        disabled={isPresetLocked}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold py-1.5 pr-3">
                      {transportPerPerson > 0 ? `Rs ${formatCurrency(transportPerPerson)}` : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="py-1.5"></TableCell>
                  </TableRow>

                  {/* 6. Ziyarat */}
                  <TableRow className="h-10 hover:bg-muted/20 border-b border-border/50">
                    <TableCell className="font-medium text-xs py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🕌</span>
                        <span>Ziyarat</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-center py-1.5">
                      <Input
                        type="number"
                        value={ziyarat}
                        onChange={e => setZiyarat(e.target.value)}
                        className="h-7 w-20 mx-auto text-center text-xs"
                        placeholder="0.00"
                        disabled={isPresetLocked}
                      />
                    </TableCell>
                    <TableCell className="text-center py-1.5">
                      <CurrencySelect
                        value={ziyaratCurrency}
                        onChange={setZiyaratCurrency}
                        className="w-[68px] mx-auto"
                        disabled={isPresetLocked}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold py-1.5 pr-3">
                      {ziyaratPerPerson > 0 ? `Rs ${formatCurrency(ziyaratPerPerson)}` : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="py-1.5"></TableCell>
                  </TableRow>

                  {/* 7. Food/Add-ons */}
                  <TableRow className="h-10 hover:bg-muted/20 border-b border-border/50">
                    <TableCell className="font-medium text-xs py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🍽️</span>
                        <span>Food / Add-ons</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground text-xs">—</TableCell>
                    <TableCell className="text-center py-1.5">
                      <Input
                        type="number"
                        value={food}
                        onChange={e => setFood(e.target.value)}
                        className="h-7 w-20 mx-auto text-center text-xs"
                        placeholder="0.00"
                        disabled={isPresetLocked}
                      />
                    </TableCell>
                    <TableCell className="text-center py-1.5">
                      <CurrencySelect
                        value={foodCurrency}
                        onChange={setFoodCurrency}
                        className="w-[68px] mx-auto"
                        disabled={isPresetLocked}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold py-1.5 pr-3">
                      {foodPerPerson > 0 ? `Rs ${formatCurrency(foodPerPerson)}` : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="py-1.5"></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Compact "Total per person" row at the bottom of the table */}
            <div className="h-9 px-4 bg-muted/60 border-t border-border flex items-center justify-between text-xs shrink-0 font-semibold">
              <span className="text-muted-foreground">Total Per Person (Base Costs)</span>
              <div className="font-mono text-sm font-bold text-primary">
                Rs {formatCurrency(tableBaseCostPerPerson)}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (~35% / col-span-4): Sticky Card Stack (no scrolling) */}
          <div className="col-span-4 flex flex-col h-full gap-2.5 justify-between overflow-hidden">
            {/* Card 1: Passengers & Service Charges / Profit */}
            <div className="rounded-xl border border-border/80 bg-card p-3 shadow-xs space-y-2.5 shrink-0">
              {/* Passengers Steppers */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span>👥</span> Passengers
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Total: <strong className="text-foreground">{totalPassengers || 1}</strong> pax
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {/* Adults */}
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-medium text-muted-foreground block text-center">Adults</label>
                    <div className="flex items-center border border-border rounded-lg bg-background overflow-hidden h-7">
                      <button
                        type="button"
                        onClick={() => stepCount(adultCount, -1, setAdultCount)}
                        className="h-full px-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={adultCount}
                        onChange={e => setAdultCount(e.target.value)}
                        className="w-full text-center text-xs font-semibold bg-transparent border-0 focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0"
                        min="0"
                      />
                      <button
                        type="button"
                        onClick={() => stepCount(adultCount, 1, setAdultCount)}
                        className="h-full px-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Children */}
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-medium text-muted-foreground block text-center">Children</label>
                    <div className="flex items-center border border-border rounded-lg bg-background overflow-hidden h-7">
                      <button
                        type="button"
                        onClick={() => stepCount(childCount, -1, setChildCount)}
                        className="h-full px-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={childCount}
                        onChange={e => setChildCount(e.target.value)}
                        className="w-full text-center text-xs font-semibold bg-transparent border-0 focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0"
                        min="0"
                      />
                      <button
                        type="button"
                        onClick={() => stepCount(childCount, 1, setChildCount)}
                        className="h-full px-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Infants */}
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-medium text-muted-foreground block text-center">Infants</label>
                    <div className="flex items-center border border-border rounded-lg bg-background overflow-hidden h-7">
                      <button
                        type="button"
                        onClick={() => stepCount(infantCount, -1, setInfantCount)}
                        className="h-full px-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={infantCount}
                        onChange={e => setInfantCount(e.target.value)}
                        className="w-full text-center text-xs font-semibold bg-transparent border-0 focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0"
                        min="0"
                      />
                      <button
                        type="button"
                        onClick={() => stepCount(infantCount, 1, setInfantCount)}
                        className="h-full px-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Charges & Profit (Compact Inputs) */}
              <div className="pt-2 border-t border-border/60 grid grid-cols-2 gap-2">
                {/* Service Charges */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground block">Service Charges</label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={serviceCharges}
                      onChange={e => setServiceCharges(e.target.value)}
                      className="h-7 text-xs font-medium text-center"
                      placeholder="0.00"
                    />
                    <CurrencySelect
                      value={serviceChargesCurrency}
                      onChange={setServiceChargesCurrency}
                      className="w-[60px]"
                    />
                  </div>
                </div>

                {/* Profit */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-medium text-muted-foreground">Profit / Markup</label>
                    <div className="inline-flex rounded-md p-0.5 bg-muted/60 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setProfitType("percentage")}
                        className={cn(
                          "px-1.5 py-0.2 rounded font-medium transition-all",
                          profitType === "percentage" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"
                        )}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfitType("fixed")}
                        className={cn(
                          "px-1.5 py-0.2 rounded font-medium transition-all",
                          profitType === "fixed" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"
                        )}
                      >
                        PKR
                      </button>
                    </div>
                  </div>

                  {profitType === "percentage" ? (
                    <div className="relative">
                      <Input
                        type="number"
                        value={profitPercent}
                        onChange={e => setProfitPercent(e.target.value)}
                        className="h-7 text-xs font-medium pr-5 text-center"
                        placeholder="0"
                      />
                      <span className="absolute right-2 top-1.5 text-xs text-muted-foreground pointer-events-none">%</span>
                    </div>
                  ) : (
                    <Input
                      type="number"
                      value={profitFixed}
                      onChange={e => setProfitFixed(e.target.value)}
                      className="h-7 text-xs font-medium text-center"
                      placeholder="Fixed PKR"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: SUMMARY card (highlighted, dark/gradient card, no scrolling) */}
            <div className="rounded-xl border border-slate-700/60 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white dark:from-slate-950 dark:via-card dark:to-slate-900 shadow-md p-3.5 flex flex-col justify-between flex-1 min-h-0">
              {/* Top part: Key breakdown */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Package Summary
                  </span>
                  <span className="text-[11px] font-medium text-slate-300 bg-white/10 px-2 py-0.5 rounded-full">
                    {result?.nights || 0} Nights
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-white/10">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Per Person Cost</span>
                    <span className="font-mono font-bold text-white text-sm">
                      Rs {formatCurrency(result?.perPerson || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Total Passengers</span>
                    <span className="font-semibold text-white">
                      {result?.totalPassengers || 1} passenger{result?.totalPassengers !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Base Package Total</span>
                    <span className="font-mono text-slate-200">
                      Rs {formatCurrency(result?.baseTotal || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Profit / Markup</span>
                    <span className="font-mono text-emerald-300">
                      + Rs {formatCurrency(result?.profitAmount || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Center part: FINAL TOTAL in large bold text */}
              <div className="my-2 p-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">
                    Final Total (PKR)
                  </span>
                  <span className="text-2xl xl:text-3xl font-black text-emerald-400 font-mono tracking-tight">
                    Rs {formatCurrency(result?.finalTotal || 0)}
                  </span>
                </div>
                <Button
                  onClick={handleCalculate}
                  size="sm"
                  variant="secondary"
                  className="h-8 px-2.5 text-xs gap-1 font-semibold bg-emerald-500 hover:bg-emerald-600 text-slate-950"
                  title="Recalculate package"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Calc</span>
                </Button>
              </div>

              {/* Bottom part: Action buttons */}
              <div className="space-y-1.5 pt-1">
                {/* Primary actions */}
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    onClick={handleCreateQuotation}
                    size="sm"
                    className="h-8 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Create Quotation</span>
                  </Button>
                  <Button
                    onClick={handleCreateBooking}
                    size="sm"
                    className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Create Booking</span>
                  </Button>
                </div>

                {/* Secondary utilities */}
                <div className="grid grid-cols-4 gap-1 pt-0.5">
                  <Button
                    onClick={handleDownloadPdf}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1 text-[11px] text-slate-300 hover:text-white hover:bg-white/10 gap-1"
                    title="Download Summary PDF"
                  >
                    <FileDown className="w-3 h-3" />
                    <span>PDF</span>
                  </Button>
                  <Button
                    onClick={handleSaveDraft}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1 text-[11px] text-slate-300 hover:text-white hover:bg-white/10 gap-1"
                    title="Save Draft"
                  >
                    <Save className="w-3 h-3" />
                    <span>Save</span>
                  </Button>
                  <Button
                    onClick={handleCopyQuote}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1 text-[11px] text-slate-300 hover:text-white hover:bg-white/10 gap-1"
                    title="Copy Quote text"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1 text-[11px] text-slate-300 hover:text-white hover:bg-white/10 gap-1"
                    title="Reset Calculator"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MOBILE LAYOUT (< 1024px)
          Thumb-friendly, min touch target 44px, sticky bottom bar, accordion items
         ========================================================================= */}
      <div className="lg:hidden flex flex-col space-y-3 pb-44 px-1">
        {/* Mobile Top Bar */}
        <div className="flex items-center justify-between gap-2 pt-1 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">Umrah Calculator</h1>
              <p className="text-[11px] text-muted-foreground">Instant Per Person Package</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {hasDraft && (
              <Button
                onClick={handleLoadDraft}
                variant="outline"
                size="sm"
                className="h-9 px-2.5 text-xs min-h-[44px]"
                title="Load Draft"
              >
                <Upload className="w-3.5 h-3.5" />
              </Button>
            )}

            <Button
              onClick={() => setMobilePresetSheetOpen(true)}
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs gap-1.5 min-h-[44px] font-medium"
            >
              <Package className="w-3.5 h-3.5 text-primary" />
              <span>Presets</span>
            </Button>

            <Button
              onClick={handleReset}
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-muted-foreground min-h-[44px]"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 2-Column Compact Grid: Exchange Rate, Currency, Dates */}
        <div className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2.5">
          {/* Row 1: Rate + Currency */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">1 SAR (in PKR)</label>
              <Input
                type="number"
                inputMode="decimal"
                value={sarToPkrRate}
                onChange={e => setSarToPkrRate(e.target.value)}
                className="h-11 min-h-[44px] text-center font-bold text-base bg-background"
                placeholder="77.50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Hotel Currency</label>
              <Select value={hotelCurrency} onValueChange={setHotelCurrency}>
                <SelectTrigger className="h-11 min-h-[44px] text-xs font-semibold bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAR">SAR (Saudi Riyal)</SelectItem>
                  <SelectItem value="PKR">PKR (Pak Rupee)</SelectItem>
                  <SelectItem value="USD">USD (US Dollar)</SelectItem>
                  <SelectItem value="EUR">EUR (Euro)</SelectItem>
                  <SelectItem value="AED">AED (Dirham)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Arrival + Departure */}
          <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-border/50">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Arrival Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11 min-h-[44px] w-full text-xs font-medium justify-between px-2.5 bg-background">
                    <span>{arrivalDate ? format(arrivalDate, "dd MMM yyyy") : "Arrival"}</span>
                    <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={arrivalDate}
                    onSelect={setArrivalDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Departure Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11 min-h-[44px] w-full text-xs font-medium justify-between px-2.5 bg-background">
                    <span>{departureDate ? format(departureDate, "dd MMM yyyy") : "Departure"}</span>
                    <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={departureDate}
                    onSelect={setDepartureDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Cost items accordion list */}
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

        {/* Passengers & Service Charges & Profit in one compact card */}
        <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs space-y-3.5">
          {/* Passengers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                <span>👥</span> Passengers
              </span>
              <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {totalPassengers || 1} Total Pax
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Adults */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase block text-center">Adults</label>
                <div className="flex items-center border border-border rounded-xl bg-background overflow-hidden h-11 min-h-[44px]">
                  <button
                    type="button"
                    onClick={() => stepCount(adultCount, -1, setAdultCount)}
                    className="h-full px-3 hover:bg-muted text-muted-foreground active:scale-95"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={adultCount}
                    onChange={e => setAdultCount(e.target.value)}
                    className="w-full text-center text-sm font-bold bg-transparent border-0 focus:outline-none p-0"
                    placeholder="0"
                  />
                  <button
                    type="button"
                    onClick={() => stepCount(adultCount, 1, setAdultCount)}
                    className="h-full px-3 hover:bg-muted text-muted-foreground active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Children */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase block text-center">Children</label>
                <div className="flex items-center border border-border rounded-xl bg-background overflow-hidden h-11 min-h-[44px]">
                  <button
                    type="button"
                    onClick={() => stepCount(childCount, -1, setChildCount)}
                    className="h-full px-3 hover:bg-muted text-muted-foreground active:scale-95"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={childCount}
                    onChange={e => setChildCount(e.target.value)}
                    className="w-full text-center text-sm font-bold bg-transparent border-0 focus:outline-none p-0"
                    placeholder="0"
                  />
                  <button
                    type="button"
                    onClick={() => stepCount(childCount, 1, setChildCount)}
                    className="h-full px-3 hover:bg-muted text-muted-foreground active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Infants */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase block text-center">Infants</label>
                <div className="flex items-center border border-border rounded-xl bg-background overflow-hidden h-11 min-h-[44px]">
                  <button
                    type="button"
                    onClick={() => stepCount(infantCount, -1, setInfantCount)}
                    className="h-full px-3 hover:bg-muted text-muted-foreground active:scale-95"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={infantCount}
                    onChange={e => setInfantCount(e.target.value)}
                    className="w-full text-center text-sm font-bold bg-transparent border-0 focus:outline-none p-0"
                    placeholder="0"
                  />
                  <button
                    type="button"
                    onClick={() => stepCount(infantCount, 1, setInfantCount)}
                    className="h-full px-3 hover:bg-muted text-muted-foreground active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Service Charges & Profit */}
          <div className="pt-3 border-t border-border/60 space-y-3">
            {/* Service Charges */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Service Charges (Per Person)</label>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={serviceCharges}
                    onChange={e => setServiceCharges(e.target.value)}
                    className="h-11 min-h-[44px] text-center font-bold bg-background"
                    placeholder="0.00"
                  />
                </div>
                <Select value={serviceChargesCurrency} onValueChange={setServiceChargesCurrency}>
                  <SelectTrigger className="h-11 min-h-[44px] text-xs font-semibold bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PKR">PKR</SelectItem>
                    <SelectItem value="SAR">SAR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="AED">AED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Profit Settings */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">Profit / Markup</label>
                <div className="inline-flex rounded-lg p-0.5 bg-muted border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setProfitType("percentage")}
                    className={cn(
                      "px-3 py-1 rounded-md font-semibold transition-all",
                      profitType === "percentage" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                    )}
                  >
                    % Percent
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfitType("fixed")}
                    className={cn(
                      "px-3 py-1 rounded-md font-semibold transition-all",
                      profitType === "fixed" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                    )}
                  >
                    Fixed PKR
                  </button>
                </div>
              </div>

              {profitType === "percentage" ? (
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={profitPercent}
                    onChange={e => setProfitPercent(e.target.value)}
                    className="h-11 min-h-[44px] text-center font-bold text-base bg-background pr-8"
                    placeholder="e.g. 10"
                  />
                  <span className="absolute right-3.5 top-3 text-sm font-bold text-muted-foreground pointer-events-none">%</span>
                </div>
              ) : (
                <Input
                  type="number"
                  inputMode="decimal"
                  value={profitFixed}
                  onChange={e => setProfitFixed(e.target.value)}
                  className="h-11 min-h-[44px] text-center font-bold text-base bg-background"
                  placeholder="e.g. 15000"
                />
              )}
            </div>
          </div>
        </div>

        {/* STICKY BOTTOM BAR (always visible on mobile) */}
        <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-40 bg-slate-900 text-white dark:bg-card dark:text-foreground border-t border-border shadow-2xl px-4 py-2.5 flex items-center justify-between safe-area-bottom">
          <div className="min-w-0">
            <span className="text-[10px] font-medium text-slate-300 block">
              Total ({totalPassengers || 1} pax)
            </span>
            <div className="text-lg font-black text-emerald-400 font-mono tracking-tight leading-tight truncate">
              Rs {formatCurrency(result?.finalTotal || 0)}
            </div>
            <span className="text-[10px] text-slate-400 block truncate">
              Rs {formatCurrency(result?.perPerson || 0)} / person
            </span>
          </div>

          <Button
            onClick={() => setMobileSummaryOpen(true)}
            size="sm"
            className="h-11 min-h-[44px] px-4 font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 gap-1.5 shadow-md active:scale-95"
          >
            <span>Details</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Mobile Summary Bottom Sheet */}
        <Sheet open={mobileSummaryOpen} onOpenChange={setMobileSummaryOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto p-4 safe-area-bottom">
            <SheetHeader className="text-left pb-3 border-b">
              <SheetTitle className="text-base font-bold flex items-center justify-between">
                <span>Umrah Package Breakdown</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {result?.nights || 0} Nights
                </span>
              </SheetTitle>
            </SheetHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Makkah Hotel</span>
                <span className="font-mono font-medium">Rs {formatCurrency(result?.makkahCost || 0)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Madinah Hotel</span>
                <span className="font-mono font-medium">Rs {formatCurrency(result?.madinahCost || 0)}</span>
              </div>
              {ticketCost && (
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Airline Ticket</span>
                  <span className="font-mono font-medium">
                    Rs {formatCurrency(ticketPerPerson * (result?.totalPassengers || 1))}
                  </span>
                </div>
              )}
              {visaFee && visaFee !== "0" && (
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Visa Fee</span>
                  <span className="font-mono font-medium">
                    Rs {formatCurrency(visaPerPerson * (result?.totalPassengers || 1))}
                  </span>
                </div>
              )}
              {transport && transport !== "0" && (
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Transport</span>
                  <span className="font-mono font-medium">
                    Rs {formatCurrency(transportPerPerson * (result?.totalPassengers || 1))}
                  </span>
                </div>
              )}
              {ziyarat && ziyarat !== "0" && (
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Ziyarat</span>
                  <span className="font-mono font-medium">
                    Rs {formatCurrency(ziyaratPerPerson * (result?.totalPassengers || 1))}
                  </span>
                </div>
              )}
              {food && food !== "0" && (
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Food</span>
                  <span className="font-mono font-medium">
                    Rs {formatCurrency(foodPerPerson * (result?.totalPassengers || 1))}
                  </span>
                </div>
              )}
              {serviceCharges && (
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Service Charges</span>
                  <span className="font-mono font-medium">
                    Rs {formatCurrency(convertToPKR(parseValue(serviceCharges), serviceChargesCurrency) * (result?.totalPassengers || 1))}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-border/50 text-muted-foreground">
                <span>Base Total</span>
                <span className="font-mono">Rs {formatCurrency(result?.baseTotal || 0)}</span>
              </div>
              {result && result.profitAmount > 0 && (
                <div className="flex justify-between py-1 border-b border-border/50 text-emerald-600 font-medium">
                  <span>+ Profit / Markup</span>
                  <span className="font-mono">+ Rs {formatCurrency(result.profitAmount)}</span>
                </div>
              )}

              {/* Final Totals Box */}
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-foreground">Final Total ({totalPassengers || 1} pax)</span>
                  <span className="text-lg font-black font-mono text-primary">
                    Rs {formatCurrency(result?.finalTotal || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Per Person</span>
                  <span className="font-bold font-mono text-primary">
                    Rs {formatCurrency(result?.perPerson || 0)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <Button
                  onClick={() => {
                    setMobileSummaryOpen(false);
                    handleCreateQuotation();
                  }}
                  className="w-full h-11 min-h-[44px] text-xs font-semibold gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <FileText className="w-4 h-4" />
                  <span>Create Quotation</span>
                </Button>

                <Button
                  onClick={() => {
                    setMobileSummaryOpen(false);
                    handleCreateBooking();
                  }}
                  className="w-full h-11 min-h-[44px] text-xs font-semibold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Create Booking</span>
                </Button>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Button
                    onClick={handleDownloadPdf}
                    variant="outline"
                    className="h-11 min-h-[44px] text-xs gap-1 px-1"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </Button>
                  <Button
                    onClick={handleCopyQuote}
                    variant="outline"
                    className="h-11 min-h-[44px] text-xs gap-1 px-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </Button>
                  <Button
                    onClick={handleSaveDraft}
                    variant="outline"
                    className="h-11 min-h-[44px] text-xs gap-1 px-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Mobile Preset Selector Bottom Sheet */}
        <Sheet open={mobilePresetSheetOpen} onOpenChange={setMobilePresetSheetOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto p-4 safe-area-bottom">
            <SheetHeader className="text-left pb-3 border-b">
              <SheetTitle className="text-base font-bold flex items-center justify-between">
                <span>Select Package Preset</span>
                <Button
                  onClick={() => {
                    setMobilePresetSheetOpen(false);
                    setShowAddPresetDialog(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-primary" />
                  <span>New</span>
                </Button>
              </SheetTitle>
            </SheetHeader>

            <div className="space-y-2 py-3">
              <button
                type="button"
                onClick={() => {
                  applyPreset("none");
                  setMobilePresetSheetOpen(false);
                }}
                className={cn(
                  "w-full min-h-[44px] p-3 rounded-xl border text-left flex items-center justify-between transition-colors",
                  selectedPreset === "none" || !selectedPreset ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                )}
              >
                <div>
                  <p className="font-semibold text-xs">Manual Entry (No Preset)</p>
                  <p className="text-[11px] text-muted-foreground">Custom hotel rates & services</p>
                </div>
              </button>

              {allPresets.map(preset => (
                <div
                  key={preset.id}
                  className={cn(
                    "w-full min-h-[44px] p-3 rounded-xl border flex items-center justify-between transition-colors",
                    selectedPreset === preset.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      applyPreset(preset.id);
                      setMobilePresetSheetOpen(false);
                    }}
                    className="flex-1 text-left"
                  >
                    <p className="font-semibold text-xs text-foreground">
                      {preset.name}
                      {preset.id.startsWith("custom_") && " ⭐"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Makkah: {preset.makkahHotels?.[0]?.nights || 0}n • Madinah: {preset.madinahHotels?.[0]?.nights || 0}n
                    </p>
                  </button>

                  {preset.id.startsWith("custom_") && (
                    <Button
                      onClick={() => deleteCustomPreset(preset.id)}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Save as New Preset Dialog (Desktop & Mobile) */}
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
                onChange={e => setNewPresetName(e.target.value)}
                placeholder="e.g., Package 5, Economy Special..."
                className="h-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This will save your current hotel configurations, visa, transport, ziyarat, and food values as a reusable preset.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPresetDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveAsPreset}>Save Preset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
