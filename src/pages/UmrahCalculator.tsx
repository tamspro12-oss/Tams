import { useState, useEffect, useMemo, useCallback } from "react";
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
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { exportUmrahSummaryPdf } from "@/lib/umrahSummaryPdf";
import { useAgency } from "@/hooks/useAgency";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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

  // Confirmation & Mobile Sheets
  const [showResetConfirmDialog, setShowResetConfirmDialog] = useState(false);
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

  const convertToPKR = useCallback((amount: number, currency: string): number => {
    if (currency === "PKR") return amount;
    if (currency === "SAR") return amount * parseValue(sarToPkrRate);
    return amount;
  }, [sarToPkrRate]);

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
  const getHotelCostPerPerson = useCallback((rate: number, nights: number, rateMode: RateMode, sharingType: string): number => {
    if (rateMode === "room") {
      const divisor = OCCUPANCY_DIVISORS[sharingType] || 1;
      return (rate / divisor) * nights;
    }
    return rate * nights;
  }, []);

  const calculateUmrah = useCallback((): CalculationResult => {
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
  }, [
    useMultiHotel,
    makkahHotels,
    madinahHotels,
    makkahNights,
    madinahNights,
    makkahRate,
    madinahRate,
    makkahSharingType,
    madinahSharingType,
    makkahRateMode,
    madinahRateMode,
    hotelCurrency,
    convertToPKR,
    getHotelCostPerPerson,
    adultCount,
    childCount,
    infantCount,
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
    profitType,
    profitPercent,
    profitFixed,
  ]);

  // Real-time calculation effect
  useEffect(() => {
    const res = calculateUmrah();
    setResult(res);
    try {
      if (res && res.totalPackageCost > 0) {
        localStorage.setItem(
          "tams_latest_umrah_calc",
          JSON.stringify({
            result: res,
            calculatedAt: new Date().toISOString(),
          })
        );
      }
    } catch (e) {
      console.debug("Failed to cache umrah calculation", e);
    }
  }, [calculateUmrah]);

  const handleCalculate = () => {
    const res = calculateUmrah();
    setResult(res);
    try {
      if (res) {
        localStorage.setItem(
          "tams_latest_umrah_calc",
          JSON.stringify({
            result: res,
            calculatedAt: new Date().toISOString(),
          })
        );
      }
    } catch (e) {
      console.debug("Failed to cache umrah calculation", e);
    }
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

  const handleSaveDraft = useCallback(() => {
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
  }, [
    sarToPkrRate,
    arrivalDate,
    departureDate,
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
  ]);

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

  const handleCreateQuotation = useCallback(() => {
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
  }, [navigate, result]);

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

  // Keyboard Shortcuts: Ctrl/Cmd+S (Draft), Ctrl/Cmd+Enter (Quotation), Ctrl/Cmd+Shift+R (Reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key.toLowerCase() === "s" && !e.shiftKey) {
        e.preventDefault();
        handleSaveDraft();
      } else if (modifier && e.key === "Enter") {
        e.preventDefault();
        handleCreateQuotation();
      } else if (modifier && e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        setShowResetConfirmDialog(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveDraft, handleCreateQuotation]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getHotelRowTotal = useCallback((hotel: HotelEntry): number => {
    const rate = parseValue(hotel.rate);
    const nights = parseValue(hotel.nights);
    if (hotel.rateMode === "room") {
      const divisor = OCCUPANCY_DIVISORS[hotel.sharingType] || 1;
      return convertToPKR((rate / divisor) * nights, hotelCurrency);
    }
    return convertToPKR(rate * nights, hotelCurrency);
  }, [convertToPKR, hotelCurrency]);

  const getSingleHotelRowTotal = useCallback((rate: string, nights: string, rateMode: RateMode, sharingType: string): number => {
    const r = parseValue(rate);
    const n = parseValue(nights);
    if (rateMode === "room") {
      const divisor = OCCUPANCY_DIVISORS[sharingType] || 1;
      return convertToPKR((r / divisor) * n, hotelCurrency);
    }
    return convertToPKR(r * n, hotelCurrency);
  }, [convertToPKR, hotelCurrency]);

  // Stepper helper
  const stepCount = (current: string, delta: number, setter: (val: string) => void) => {
    const curVal = parseInt(current) || 0;
    const newVal = Math.max(0, curVal + delta);
    setter(newVal === 0 ? "" : newVal.toString());
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
      <SelectTrigger className={cn("h-8 text-xs font-medium px-2 py-0 bg-background", className)}>
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
    className = "",
    disabled = false,
  }: {
    value: string;
    onChange: (v: string) => void;
    className?: string;
    disabled?: boolean;
  }) => (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn("h-8 text-xs w-full px-2 py-0 bg-background", className)}>
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
    className = "",
    disabled = false,
  }: {
    value: RateMode;
    onChange: (v: RateMode) => void;
    className?: string;
    disabled?: boolean;
  }) => (
    <Select value={value} onValueChange={v => onChange(v as RateMode)} disabled={disabled}>
      <SelectTrigger className={cn("h-8 text-xs w-full px-2 py-0 bg-background", className)}>
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

  const serviceChargesTotal = serviceCharges
    ? convertToPKR(parseValue(serviceCharges), serviceChargesCurrency) * (result?.totalPassengers || 1)
    : 0;

  return (
    <div className="w-full umrah-calc-wrapper py-1">
      {/* =========================================================================
          DESKTOP LAYOUT (Container query: >= 640px)
          ONE UNIFIED SHEET, TOP TO BOTTOM: Fits in ONE screen with ZERO vertical scroll
         ========================================================================= */}
      <div className="calc-desktop-view flex-col w-full gap-2 bg-background">
        {/* TOP TOOLBAR: KEPT EXACTLY AS IT IS */}
        <div className="shrink-0 space-y-1.5">
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
                onFocus={e => e.target.select()}
                onChange={e => setSarToPkrRate(e.target.value)}
                className="w-16 h-7 text-xs font-semibold px-1 py-0 text-center tabular-nums"
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

        {/* ONE UNIFIED CONTINUOUS SHEET */}
        <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden flex flex-col gap-2 p-2.5">
          {/* =====================================================================
              === 1) HOTEL TABLE (Makkah, Madinah), one shared grid ===
             ===================================================================== */}
          <div className="rounded-xl overflow-hidden border border-border/60 divide-y divide-border/40">
            {/* Header: ONE line, 11px, uppercase, letter-spacing wide, slate-600 text on a soft slate-100 band */}
            <div className="calc-hotel-grid h-9 px-4 bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              <span className="text-left">Description</span>
              <span className="text-center">Type</span>
              <span className="text-center">Rate Mode</span>
              <span className="text-center">Nights</span>
              <span className="text-center">Rate/Amount</span>
              <span className="text-center">Currency</span>
              <span className="text-right pr-2">Per Person (PKR)</span>
            </div>

            {/* Makkah Hotel Row(s) */}
            {!useMultiHotel ? (
              <div className="calc-hotel-grid h-12 px-4 bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100/40 dark:hover:bg-emerald-950/30 transition-colors whitespace-nowrap items-center">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-1 h-7 rounded-full bg-emerald-500 shrink-0" />
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 text-sm">
                    🕋
                  </div>
                  <span className="text-sm font-semibold text-foreground truncate">Makkah Hotel</span>
                </div>
                <div>
                  <SharingTypeSelect
                    value={makkahSharingType}
                    onChange={v => setMakkahSharingType(v as HotelEntry["sharingType"])}
                    disabled={isPresetLocked}
                  />
                </div>
                <div>
                  <RateModeSelect
                    value={makkahRateMode}
                    onChange={handleMakkahRateModeChange}
                    disabled={isPresetLocked}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    value={makkahNights}
                    onFocus={e => e.target.select()}
                    onChange={e => setMakkahNights(e.target.value)}
                    className="h-8 w-full text-center text-xs font-semibold tabular-nums"
                    placeholder="0"
                    disabled={isPresetLocked}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    value={makkahRate}
                    onFocus={e => e.target.select()}
                    onChange={e => setMakkahRate(e.target.value)}
                    className="h-8 w-full text-center text-xs font-semibold tabular-nums"
                    placeholder="0.00"
                    disabled={isPresetLocked}
                  />
                </div>
                <div className="text-center text-xs font-semibold text-muted-foreground">
                  {hotelCurrency}
                </div>
                <div className="flex items-center justify-end gap-1.5 pr-2">
                  <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                    {makkahCostPerPerson > 0 ? `Rs ${formatCurrency(makkahCostPerPerson)}` : "—"}
                  </span>
                  <Button
                    onClick={addMakkahHotel}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-emerald-600 transition-colors"
                    title="Add another Makkah hotel"
                    disabled={isPresetLocked}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {makkahHotels.map((hotel, index) => (
                  <div key={hotel.id} className="calc-hotel-grid h-12 px-4 bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100/40 dark:hover:bg-emerald-950/30 transition-colors whitespace-nowrap items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1 h-7 rounded-full bg-emerald-500 shrink-0" />
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 text-sm">
                        🕋
                      </div>
                      <Input
                        type="text"
                        value={hotel.name}
                        onChange={e => updateMakkahHotel(hotel.id, "name", e.target.value)}
                        className="h-8 text-xs font-semibold flex-1 min-w-0"
                        placeholder={`Makkah ${index + 1}`}
                        disabled={isPresetLocked}
                      />
                    </div>
                    <div>
                      <SharingTypeSelect
                        value={hotel.sharingType}
                        onChange={v => updateMakkahHotel(hotel.id, "sharingType", v)}
                        disabled={isPresetLocked}
                      />
                    </div>
                    <div>
                      <RateModeSelect
                        value={hotel.rateMode}
                        onChange={v => updateMakkahHotel(hotel.id, "rateMode", v)}
                        disabled={isPresetLocked}
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        value={hotel.nights}
                        onFocus={e => e.target.select()}
                        onChange={e => updateMakkahHotel(hotel.id, "nights", e.target.value)}
                        className="h-8 w-full text-center text-xs font-semibold tabular-nums"
                        placeholder="0"
                        disabled={isPresetLocked}
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        value={hotel.rate}
                        onFocus={e => e.target.select()}
                        onChange={e => updateMakkahHotel(hotel.id, "rate", e.target.value)}
                        className="h-8 w-full text-center text-xs font-semibold tabular-nums"
                        placeholder="0.00"
                        disabled={isPresetLocked}
                      />
                    </div>
                    <div className="text-center text-xs font-semibold text-muted-foreground">
                      {hotelCurrency}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 pr-2">
                      <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                        {getHotelRowTotal(hotel) > 0 ? `Rs ${formatCurrency(getHotelRowTotal(hotel))}` : "—"}
                      </span>
                      <Button
                        onClick={() => removeMakkahHotel(hotel.id)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        disabled={isPresetLocked}
                        title="Remove hotel"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-1 bg-emerald-50/40 dark:bg-emerald-950/10 flex justify-end">
                  <Button
                    onClick={addMakkahHotel}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/50 gap-1"
                    disabled={isPresetLocked}
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Makkah Hotel</span>
                  </Button>
                </div>
              </>
            )}

            {/* Madinah Hotel Row(s) */}
            {!useMultiHotel ? (
              <div className="calc-hotel-grid h-12 px-4 bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100/40 dark:hover:bg-emerald-950/30 transition-colors whitespace-nowrap items-center border-t border-emerald-200/50 dark:border-emerald-900/30">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-1 h-7 rounded-full bg-emerald-500 shrink-0" />
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 text-sm">
                    🕌
                  </div>
                  <span className="text-sm font-semibold text-foreground truncate">Madinah Hotel</span>
                </div>
                <div>
                  <SharingTypeSelect
                    value={madinahSharingType}
                    onChange={v => setMadinahSharingType(v as HotelEntry["sharingType"])}
                    disabled={isPresetLocked}
                  />
                </div>
                <div>
                  <RateModeSelect
                    value={madinahRateMode}
                    onChange={handleMadinahRateModeChange}
                    disabled={isPresetLocked}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    value={madinahNights}
                    onFocus={e => e.target.select()}
                    onChange={e => setMadinahNights(e.target.value)}
                    className="h-8 w-full text-center text-xs font-semibold tabular-nums"
                    placeholder="0"
                    disabled={isPresetLocked}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    value={madinahRate}
                    onFocus={e => e.target.select()}
                    onChange={e => setMadinahRate(e.target.value)}
                    className="h-8 w-full text-center text-xs font-semibold tabular-nums"
                    placeholder="0.00"
                    disabled={isPresetLocked}
                  />
                </div>
                <div className="text-center text-xs font-semibold text-muted-foreground">
                  {hotelCurrency}
                </div>
                <div className="flex items-center justify-end gap-1.5 pr-2">
                  <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                    {madinahCostPerPerson > 0 ? `Rs ${formatCurrency(madinahCostPerPerson)}` : "—"}
                  </span>
                  <Button
                    onClick={addMadinahHotel}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-emerald-600 transition-colors"
                    title="Add another Madinah hotel"
                    disabled={isPresetLocked}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {madinahHotels.map((hotel, index) => (
                  <div key={hotel.id} className="calc-hotel-grid h-12 px-4 bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100/40 dark:hover:bg-emerald-950/30 transition-colors whitespace-nowrap items-center border-t border-emerald-200/50 dark:border-emerald-900/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1 h-7 rounded-full bg-emerald-500 shrink-0" />
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 text-sm">
                        🕌
                      </div>
                      <Input
                        type="text"
                        value={hotel.name}
                        onChange={e => updateMadinahHotel(hotel.id, "name", e.target.value)}
                        className="h-8 text-xs font-semibold flex-1 min-w-0"
                        placeholder={`Madinah ${index + 1}`}
                        disabled={isPresetLocked}
                      />
                    </div>
                    <div>
                      <SharingTypeSelect
                        value={hotel.sharingType}
                        onChange={v => updateMadinahHotel(hotel.id, "sharingType", v)}
                        disabled={isPresetLocked}
                      />
                    </div>
                    <div>
                      <RateModeSelect
                        value={hotel.rateMode}
                        onChange={v => updateMadinahHotel(hotel.id, "rateMode", v)}
                        disabled={isPresetLocked}
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        value={hotel.nights}
                        onFocus={e => e.target.select()}
                        onChange={e => updateMadinahHotel(hotel.id, "nights", e.target.value)}
                        className="h-8 w-full text-center text-xs font-semibold tabular-nums"
                        placeholder="0"
                        disabled={isPresetLocked}
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        value={hotel.rate}
                        onFocus={e => e.target.select()}
                        onChange={e => updateMadinahHotel(hotel.id, "rate", e.target.value)}
                        className="h-8 w-full text-center text-xs font-semibold tabular-nums"
                        placeholder="0.00"
                        disabled={isPresetLocked}
                      />
                    </div>
                    <div className="text-center text-xs font-semibold text-muted-foreground">
                      {hotelCurrency}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 pr-2">
                      <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                        {getHotelRowTotal(hotel) > 0 ? `Rs ${formatCurrency(getHotelRowTotal(hotel))}` : "—"}
                      </span>
                      <Button
                        onClick={() => removeMadinahHotel(hotel.id)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        disabled={isPresetLocked}
                        title="Remove hotel"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-1 bg-emerald-50/40 dark:bg-emerald-950/10 flex justify-end">
                  <Button
                    onClick={addMadinahHotel}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/50 gap-1"
                    disabled={isPresetLocked}
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Madinah Hotel</span>
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* =====================================================================
              === 2) OTHER COSTS: 5 EQUAL, PERFECTLY ALIGNED CARDS ===
             ===================================================================== */}
          {/* Row A: 2 equal cards (Airline Ticket | Visa Fee), tinted sky-50 */}
          <div className="grid grid-cols-2 gap-2">
            {/* Airline Ticket */}
            <div className="rounded-xl p-2.5 bg-sky-50/70 dark:bg-sky-950/20 ring-1 ring-sky-200 dark:ring-sky-900/50 flex flex-col justify-between gap-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 flex items-center justify-center text-xs shrink-0">
                    ✈️
                  </div>
                  <span className="text-[13px] font-medium text-foreground truncate">Airline Ticket</span>
                </div>
                <span className="text-[13px] font-semibold font-mono text-foreground tabular-nums shrink-0">
                  {ticketPerPerson > 0 ? `Rs ${formatCurrency(ticketPerPerson)}` : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={ticketCost}
                  onFocus={e => e.target.select()}
                  onChange={e => setTicketCost(e.target.value)}
                  className="flex-1 h-8 text-center text-xs font-semibold tabular-nums bg-background"
                  placeholder="0.00"
                />
                <CurrencySelect value={ticketCurrency} onChange={setTicketCurrency} className="w-20 h-8 shrink-0 bg-background" />
              </div>
            </div>

            {/* Visa Fee */}
            <div className="rounded-xl p-2.5 bg-sky-50/70 dark:bg-sky-950/20 ring-1 ring-sky-200 dark:ring-sky-900/50 flex flex-col justify-between gap-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 flex items-center justify-center text-xs shrink-0">
                    📋
                  </div>
                  <span className="text-[13px] font-medium text-foreground truncate">Visa Fee</span>
                </div>
                <span className="text-[13px] font-semibold font-mono text-foreground tabular-nums shrink-0">
                  {visaPerPerson > 0 ? `Rs ${formatCurrency(visaPerPerson)}` : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={visaFee}
                  onFocus={e => e.target.select()}
                  onChange={e => setVisaFee(e.target.value)}
                  className="flex-1 h-8 text-center text-xs font-semibold tabular-nums bg-background"
                  placeholder="0.00"
                  disabled={isPresetLocked}
                />
                <CurrencySelect value={visaCurrency} onChange={setVisaCurrency} disabled={isPresetLocked} className="w-20 h-8 shrink-0 bg-background" />
              </div>
            </div>
          </div>

          {/* Row B: 3 equal cards (Transport | Ziyarat | Food / Add-ons), tinted amber-50 */}
          <div className="grid grid-cols-3 gap-2">
            {/* Transport */}
            <div className="rounded-xl p-2.5 bg-amber-50/70 dark:bg-amber-950/20 ring-1 ring-amber-200 dark:ring-amber-900/50 flex flex-col justify-between gap-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs shrink-0">
                    🚌
                  </div>
                  <span className="text-[13px] font-medium text-foreground truncate">Transport</span>
                </div>
                <span className="text-[13px] font-semibold font-mono text-foreground tabular-nums shrink-0">
                  {transportPerPerson > 0 ? `Rs ${formatCurrency(transportPerPerson)}` : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={transport}
                  onFocus={e => e.target.select()}
                  onChange={e => setTransport(e.target.value)}
                  className="flex-1 h-8 text-center text-xs font-semibold tabular-nums bg-background"
                  placeholder="0.00"
                  disabled={isPresetLocked}
                />
                <CurrencySelect value={transportCurrency} onChange={setTransportCurrency} disabled={isPresetLocked} className="w-20 h-8 shrink-0 bg-background" />
              </div>
            </div>

            {/* Ziyarat */}
            <div className="rounded-xl p-2.5 bg-amber-50/70 dark:bg-amber-950/20 ring-1 ring-amber-200 dark:ring-amber-900/50 flex flex-col justify-between gap-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs shrink-0">
                    🕌
                  </div>
                  <span className="text-[13px] font-medium text-foreground truncate">Ziyarat</span>
                </div>
                <span className="text-[13px] font-semibold font-mono text-foreground tabular-nums shrink-0">
                  {ziyaratPerPerson > 0 ? `Rs ${formatCurrency(ziyaratPerPerson)}` : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={ziyarat}
                  onFocus={e => e.target.select()}
                  onChange={e => setZiyarat(e.target.value)}
                  className="flex-1 h-8 text-center text-xs font-semibold tabular-nums bg-background"
                  placeholder="0.00"
                  disabled={isPresetLocked}
                />
                <CurrencySelect value={ziyaratCurrency} onChange={setZiyaratCurrency} disabled={isPresetLocked} className="w-20 h-8 shrink-0 bg-background" />
              </div>
            </div>

            {/* Food / Add-ons */}
            <div className="rounded-xl p-2.5 bg-amber-50/70 dark:bg-amber-950/20 ring-1 ring-amber-200 dark:ring-amber-900/50 flex flex-col justify-between gap-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs shrink-0">
                    🍽️
                  </div>
                  <span className="text-[13px] font-medium text-foreground truncate">Food / Add-ons</span>
                </div>
                <span className="text-[13px] font-semibold font-mono text-foreground tabular-nums shrink-0">
                  {foodPerPerson > 0 ? `Rs ${formatCurrency(foodPerPerson)}` : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={food}
                  onFocus={e => e.target.select()}
                  onChange={e => setFood(e.target.value)}
                  className="flex-1 h-8 text-center text-xs font-semibold tabular-nums bg-background"
                  placeholder="0.00"
                  disabled={isPresetLocked}
                />
                <CurrencySelect value={foodCurrency} onChange={setFoodCurrency} disabled={isPresetLocked} className="w-20 h-8 shrink-0 bg-background" />
              </div>
            </div>
          </div>

          {/* =====================================================================
              === 3) TOTAL BAR (under other costs) ===
             ===================================================================== */}
          <div className="h-10 px-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 ring-1 ring-blue-200 dark:ring-blue-800/50 flex items-center justify-between shadow-2xs">
            <span className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wide">
              Total per person (base costs)
            </span>
            <span className="text-base font-bold font-mono text-blue-900 dark:text-blue-100 tabular-nums">
              Rs {formatCurrency(tableBaseCostPerPerson)}
            </span>
          </div>

          {/* =====================================================================
              === 4) PASSENGERS + CHARGES (one single row) ===
             ===================================================================== */}
          <div className="calc-passengers-charges-row min-h-[48px] px-3.5 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3 shadow-2xs">
            {/* Left: Passengers group */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              {/* Adults */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground mr-0.5">Adults</span>
                <div className="flex items-center bg-background rounded-full border border-border p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => stepCount(adultCount, -1, setAdultCount)}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={adultCount}
                    onFocus={e => e.target.select()}
                    onChange={e => setAdultCount(e.target.value)}
                    className="w-9 text-center text-xs font-bold bg-transparent border-0 focus:outline-none p-0 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                    min="0"
                  />
                  <button
                    type="button"
                    onClick={() => stepCount(adultCount, 1, setAdultCount)}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Children */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground mr-0.5">Children</span>
                <div className="flex items-center bg-background rounded-full border border-border p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => stepCount(childCount, -1, setChildCount)}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={childCount}
                    onFocus={e => e.target.select()}
                    onChange={e => setChildCount(e.target.value)}
                    className="w-9 text-center text-xs font-bold bg-transparent border-0 focus:outline-none p-0 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                    min="0"
                  />
                  <button
                    type="button"
                    onClick={() => stepCount(childCount, 1, setChildCount)}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Infants */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground mr-0.5">Infants</span>
                <div className="flex items-center bg-background rounded-full border border-border p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => stepCount(infantCount, -1, setInfantCount)}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={infantCount}
                    onFocus={e => e.target.select()}
                    onChange={e => setInfantCount(e.target.value)}
                    className="w-9 text-center text-xs font-bold bg-transparent border-0 focus:outline-none p-0 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                    min="0"
                  />
                  <button
                    type="button"
                    onClick={() => stepCount(infantCount, 1, setInfantCount)}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Compact "Total: N pax" pill */}
              <div className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-tight whitespace-nowrap">
                Total: {totalPassengers || 1} pax
              </div>
            </div>

            {/* Thin vertical divider */}
            <div className="h-7 w-px bg-slate-300 dark:bg-slate-700 hidden lg:block" />

            {/* Right: Charges group */}
            <div className="flex items-center gap-3 calc-charges-subgroup shrink-0 flex-wrap">
              {/* Service Charges */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">Service Charges:</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={serviceCharges}
                    onFocus={e => e.target.select()}
                    onChange={e => setServiceCharges(e.target.value)}
                    className="h-8 w-20 text-center text-xs font-semibold tabular-nums bg-background"
                    placeholder="0.00"
                  />
                  <CurrencySelect value={serviceChargesCurrency} onChange={setServiceChargesCurrency} className="w-[66px] h-8 bg-background" />
                </div>
              </div>

              {/* Thin divider */}
              <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />

              {/* Profit / Markup */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">Profit:</span>
                <div className="inline-flex rounded-lg p-0.5 bg-background border border-border text-[11px]">
                  <button
                    type="button"
                    onClick={() => setProfitType("percentage")}
                    className={cn(
                      "px-2 py-0.5 rounded-md font-semibold transition-all",
                      profitType === "percentage" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfitType("fixed")}
                    className={cn(
                      "px-2 py-0.5 rounded-md font-semibold transition-all",
                      profitType === "fixed" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    PKR
                  </button>
                </div>

                {profitType === "percentage" ? (
                  <div className="relative">
                    <Input
                      type="number"
                      value={profitPercent}
                      onFocus={e => e.target.select()}
                      onChange={e => setProfitPercent(e.target.value)}
                      className="h-8 w-20 text-center text-xs font-semibold tabular-nums bg-background pr-5"
                      placeholder="0"
                    />
                    <span className="absolute right-2 top-2 text-[10px] font-bold text-muted-foreground pointer-events-none">%</span>
                  </div>
                ) : (
                  <Input
                    type="number"
                    value={profitFixed}
                    onFocus={e => e.target.select()}
                    onChange={e => setProfitFixed(e.target.value)}
                    className="h-8 w-24 text-center text-xs font-semibold tabular-nums bg-background"
                    placeholder="Fixed PKR"
                  />
                )}
              </div>
            </div>
          </div>

          {/* =====================================================================
              === 5) SUMMARY STRIP (below passengers + charges) ===
             ===================================================================== */}
          <div className="rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-md border border-slate-700/50">
            {/* Key figures across one row */}
            <div className="flex items-center gap-4 text-xs min-w-0 flex-wrap sm:flex-nowrap">
              {/* Per Person Cost */}
              <div>
                <span className="text-[10px] font-medium text-slate-400 block uppercase tracking-wider">Per Person</span>
                <span className="font-mono text-sm font-bold text-white tabular-nums">
                  Rs {formatCurrency(result?.perPerson || 0)}
                </span>
              </div>

              <div className="h-6 w-px bg-white/15 hidden sm:block" />

              {/* Total Passengers */}
              <div>
                <span className="text-[10px] font-medium text-slate-400 block uppercase tracking-wider">Passengers</span>
                <span className="text-xs font-semibold text-slate-200 tabular-nums">
                  {result?.totalPassengers || 1} pax
                </span>
              </div>

              <div className="h-6 w-px bg-white/15 hidden sm:block" />

              {/* Nights */}
              <div>
                <span className="text-[10px] font-medium text-slate-400 block uppercase tracking-wider">Duration</span>
                <span className="text-xs font-semibold text-slate-200 tabular-nums">
                  {result?.nights || 0} Nights
                </span>
              </div>

              <div className="h-6 w-px bg-white/15 hidden sm:block" />

              {/* Base Package Total */}
              <div>
                <span className="text-[10px] font-medium text-slate-400 block uppercase tracking-wider">Base Total</span>
                <span className="font-mono text-xs font-semibold text-slate-200 tabular-nums">
                  Rs {formatCurrency(result?.baseTotal || 0)}
                </span>
              </div>

              <div className="h-6 w-px bg-white/15 hidden sm:block" />

              {/* Service Charges */}
              <div>
                <span className="text-[10px] font-medium text-slate-400 block uppercase tracking-wider">Services</span>
                <span className="font-mono text-xs font-semibold text-slate-200 tabular-nums">
                  Rs {formatCurrency(serviceChargesTotal)}
                </span>
              </div>
            </div>

            {/* FINAL TOTAL (largest, bold, emerald-400, tabular-nums) */}
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">
                FINAL TOTAL (PKR)
              </span>
              <span className="text-xl xl:text-2xl font-black text-emerald-400 font-mono tracking-tight tabular-nums leading-none">
                Rs {formatCurrency(result?.finalTotal || 0)}
              </span>
            </div>
          </div>

          {/* =====================================================================
              === 6) ACTION BUTTONS (all h-10) ===
             ===================================================================== */}
          <div className="flex items-center justify-between gap-2.5 pt-0.5">
            <div className="flex items-center gap-2">
              {/* Calculate Button */}
              <Button
                onClick={handleCalculate}
                className="h-10 px-4 gap-2 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
              >
                <Calculator className="w-4 h-4" />
                <span>Calculate</span>
              </Button>

              {/* Create Quotation (PRIMARY, solid dark blue, white text) */}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleCreateQuotation}
                      className="h-10 px-5 gap-2 font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white dark:bg-primary dark:text-primary-foreground shadow-sm"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Create Quotation</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Create Quotation (Ctrl+Enter or ⌘Enter)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Download Summary (solid green, white text) */}
              <Button
                onClick={handleDownloadPdf}
                className="h-10 px-4 gap-2 font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                <FileDown className="w-4 h-4" />
                <span>Download Summary</span>
              </Button>

              {/* Save Draft (outlined, dark text, visible border) */}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleSaveDraft}
                      variant="outline"
                      className="h-10 px-4 gap-2 font-semibold text-xs border-border/90 hover:bg-muted text-foreground shadow-2xs"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Draft</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Save Draft (Ctrl+S or ⌘S)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Copy Quote Button */}
              <Button
                onClick={handleCopyQuote}
                variant="outline"
                className="h-10 px-3.5 gap-1.5 font-semibold text-xs border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Copy formatted quotation text"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Quote</span>
              </Button>
            </div>

            {/* Reset Button (outlined RED/destructive style, asks for confirmation) */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowResetConfirmDialog(true)}
                    variant="outline"
                    className="h-10 px-4 gap-2 font-bold text-xs border-red-500/80 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 shadow-2xs"
                  >
                    <RotateCcw className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span>Reset</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Reset Calculator (Ctrl+Shift+R or ⌘⇧R)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MOBILE LAYOUT (Container query: < 640px)
          Compact app screen, separate layout, same state, no horizontal scroll
         ========================================================================= */}
      <div className="calc-mobile-view flex-col space-y-3 pb-44 px-1 w-full">
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
              onClick={() => setShowResetConfirmDialog(true)}
              variant="outline"
              size="sm"
              className="h-9 px-2 text-xs border-red-500/70 text-red-600 min-h-[44px]"
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
                onFocus={e => e.target.select()}
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

        {/* Compact Cost Cards: Hotels (expanded), Airline+Visa (2 cols), Transport+Ziyarat+Food (3 tiles) */}
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
          getCurrencySymbol={() => "Rs"}
          getSingleHotelRowTotal={getSingleHotelRowTotal}
          getHotelRowTotal={getHotelRowTotal}
          makkahMultiTotal={makkahMultiTotal}
          madinahMultiTotal={madinahMultiTotal}
          makkahMultiNights={makkahMultiNights}
          madinahMultiNights={madinahMultiNights}
        />

        {/* Passengers: Adults / Children / Infants as 3 compact steppers in ONE row */}
        <div className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground uppercase tracking-wide">
              👥 Passengers
            </span>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
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
                  onFocus={e => e.target.select()}
                  onChange={e => setAdultCount(e.target.value)}
                  className="w-full text-center text-base font-bold bg-transparent border-0 focus:outline-none p-0"
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
                  onFocus={e => e.target.select()}
                  onChange={e => setChildCount(e.target.value)}
                  className="w-full text-center text-base font-bold bg-transparent border-0 focus:outline-none p-0"
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
                  onFocus={e => e.target.select()}
                  onChange={e => setInfantCount(e.target.value)}
                  className="w-full text-center text-base font-bold bg-transparent border-0 focus:outline-none p-0"
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

        {/* Service Charges and Profit / Markup in ONE row (2 columns) */}
        <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
          <div className="grid grid-cols-2 gap-2.5">
            {/* Service Charges */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Service Charges</label>
              <div className="space-y-1">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={serviceCharges}
                  onFocus={e => e.target.select()}
                  onChange={e => setServiceCharges(e.target.value)}
                  className="h-11 min-h-[44px] text-center font-bold text-base bg-background"
                  placeholder="0.00"
                />
                <Select value={serviceChargesCurrency} onValueChange={setServiceChargesCurrency}>
                  <SelectTrigger className="h-10 text-xs font-semibold bg-background">
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

            {/* Profit / Markup (segmented toggle % | PKR + single input) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">Profit / Markup</label>
                <div className="inline-flex rounded-lg p-0.5 bg-muted border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setProfitType("percentage")}
                    className={cn(
                      "px-2 py-0.5 rounded font-semibold transition-all",
                      profitType === "percentage" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                    )}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfitType("fixed")}
                    className={cn(
                      "px-2 py-0.5 rounded font-semibold transition-all",
                      profitType === "fixed" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
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
                    inputMode="decimal"
                    value={profitPercent}
                    onFocus={e => e.target.select()}
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
                  onFocus={e => e.target.select()}
                  onChange={e => setProfitFixed(e.target.value)}
                  className="h-11 min-h-[44px] text-center font-bold text-base bg-background"
                  placeholder="e.g. 15000"
                />
              )}
            </div>
          </div>
        </div>

        {/* Mobile Action Buttons */}
        <div className="space-y-2 pt-1">
          {/* Calculate Button (full-width solid blue) */}
          <Button
            onClick={handleCalculate}
            className="w-full h-11 min-h-[44px] font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
          >
            <Calculator className="w-4 h-4 mr-1.5" />
            <span>Calculate</span>
          </Button>

          {/* Create Quotation (full-width primary, 48px) */}
          <Button
            onClick={handleCreateQuotation}
            className="w-full h-12 font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white dark:bg-primary dark:text-primary-foreground rounded-xl shadow-sm"
          >
            <FileText className="w-4 h-4 mr-2" />
            <span>Create Quotation</span>
          </Button>

          {/* Row of three equal buttons: Save Draft | Download | Reset */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={handleSaveDraft}
              variant="outline"
              className="h-11 min-h-[44px] text-xs font-semibold gap-1 px-1 rounded-xl"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Draft</span>
            </Button>
            <Button
              onClick={handleDownloadPdf}
              variant="outline"
              className="h-11 min-h-[44px] text-xs font-semibold gap-1 px-1 rounded-xl text-emerald-600 border-emerald-500/50"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Download</span>
            </Button>
            <Button
              onClick={() => setShowResetConfirmDialog(true)}
              variant="outline"
              className="h-11 min-h-[44px] text-xs font-semibold gap-1 px-1 rounded-xl border-red-500/70 text-red-600"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </Button>
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
                    Rs {formatCurrency(serviceChargesTotal)}
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

              {/* Action Buttons inside Mobile Details */}
              <div className="space-y-2 pt-2">
                <Button
                  onClick={() => {
                    setMobileSummaryOpen(false);
                    handleCreateQuotation();
                  }}
                  className="w-full h-11 min-h-[44px] text-xs font-semibold gap-2 bg-slate-900 hover:bg-slate-800 text-white"
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

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    onClick={handleDownloadPdf}
                    variant="outline"
                    className="h-11 min-h-[44px] text-xs gap-1"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </Button>
                  <Button
                    onClick={handleCopyQuote}
                    variant="outline"
                    className="h-11 min-h-[44px] text-xs gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Quote</span>
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

      {/* Save as New Preset Dialog */}
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
                onFocus={e => e.target.select()}
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

      {/* Reset Confirmation Dialog (Desktop & Mobile) */}
      <Dialog open={showResetConfirmDialog} onOpenChange={setShowResetConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <span>Reset Umrah Calculator?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Are you sure you want to reset all hotel configurations, tickets, visas, transports, and passengers back to default values? Any unsaved draft will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setShowResetConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowResetConfirmDialog(false);
                handleReset();
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              Yes, Reset Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
