import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type RateMode = "sharing" | "room";

interface HotelEntry {
  id: string;
  name: string;
  sharingType: "Quint" | "Quad" | "Triple" | "Double" | "Sharing";
  rateMode: RateMode;
  rate: string;
  nights: string;
}

const SHARING_TYPES = ["Sharing", "Quint", "Quad", "Triple", "Double"] as const;
const OCCUPANCY_DIVISORS: Record<string, number> = {
  Quint: 5, Quad: 4, Triple: 3, Double: 2, Sharing: 1,
};

export interface MobileUmrahCostCardsProps {
  // Hotel state
  useMultiHotel: boolean;
  makkahHotels: HotelEntry[];
  madinahHotels: HotelEntry[];
  makkahNights: string;
  madinahNights: string;
  makkahRate: string;
  madinahRate: string;
  makkahSharingType: string;
  madinahSharingType: string;
  makkahRateMode: RateMode;
  madinahRateMode: RateMode;
  hotelCurrency: string;
  isPresetLocked: boolean;
  // Hotel handlers
  setMakkahNights: (v: string) => void;
  setMadinahNights: (v: string) => void;
  setMakkahRate: (v: string) => void;
  setMadinahRate: (v: string) => void;
  setMakkahSharingType: (v: any) => void;
  setMadinahSharingType: (v: any) => void;
  handleMakkahRateModeChange: (v: RateMode) => void;
  handleMadinahRateModeChange: (v: RateMode) => void;
  addMakkahHotel: () => void;
  addMadinahHotel: () => void;
  updateMakkahHotel: (id: string, field: keyof HotelEntry, value: string) => void;
  updateMadinahHotel: (id: string, field: keyof HotelEntry, value: string) => void;
  removeMakkahHotel: (id: string) => void;
  removeMadinahHotel: (id: string) => void;
  // Charges
  ticketCost: string; setTicketCost: (v: string) => void;
  ticketCurrency: string; setTicketCurrency: (v: string) => void;
  visaFee: string; setVisaFee: (v: string) => void;
  visaCurrency: string; setVisaCurrency: (v: string) => void;
  transport: string; setTransport: (v: string) => void;
  transportCurrency: string; setTransportCurrency: (v: string) => void;
  ziyarat: string; setZiyarat: (v: string) => void;
  ziyaratCurrency: string; setZiyaratCurrency: (v: string) => void;
  food: string; setFood: (v: string) => void;
  foodCurrency: string; setFoodCurrency: (v: string) => void;
  // Helpers
  parseValue: (v: string) => number;
  convertToPKR: (amount: number, currency: string) => number;
  formatCurrency: (v: number) => string;
  getCurrencySymbol: (c: string) => string;
  getSingleHotelRowTotal: (rate: string, nights: string, rateMode: RateMode, sharingType: string) => number;
  getHotelRowTotal: (hotel: HotelEntry) => number;
  makkahMultiTotal: number;
  madinahMultiTotal: number;
  makkahMultiNights: number;
  madinahMultiNights: number;
}

const MobileCurrencySelect = ({ value, onChange, disabled = false }: { value: string; onChange: (v: string) => void; disabled?: boolean }) => (
  <Select value={value} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger className="h-11 text-xs w-full min-h-[44px] bg-background">
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

const MobileSharingTypeSelect = ({ value, onChange, disabled = false }: { value: string; onChange: (v: string) => void; disabled?: boolean }) => (
  <Select value={value} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger className="h-11 text-xs w-full min-h-[44px] bg-background">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {SHARING_TYPES.map(type => (
        <SelectItem key={type} value={type}>{type}</SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const MobileRateModeSelect = ({ value, onChange, disabled = false }: { value: RateMode; onChange: (v: RateMode) => void; disabled?: boolean }) => (
  <Select value={value} onValueChange={(v) => onChange(v as RateMode)} disabled={disabled}>
    <SelectTrigger className="h-11 text-xs w-full min-h-[44px] bg-background">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="sharing">Sharing (Per Person)</SelectItem>
      <SelectItem value="room">Room (Divided by Type)</SelectItem>
    </SelectContent>
  </Select>
);

export function MobileUmrahCostCards(props: MobileUmrahCostCardsProps) {
  const {
    useMultiHotel, makkahHotels, madinahHotels,
    makkahNights, madinahNights, makkahRate, madinahRate,
    makkahSharingType, madinahSharingType, makkahRateMode, madinahRateMode,
    hotelCurrency, isPresetLocked,
    setMakkahNights, setMadinahNights, setMakkahRate, setMadinahRate,
    setMakkahSharingType, setMadinahSharingType,
    handleMakkahRateModeChange, handleMadinahRateModeChange,
    addMakkahHotel, addMadinahHotel,
    updateMakkahHotel, updateMadinahHotel,
    removeMakkahHotel, removeMadinahHotel,
    ticketCost, setTicketCost, ticketCurrency, setTicketCurrency,
    visaFee, setVisaFee, visaCurrency, setVisaCurrency,
    transport, setTransport, transportCurrency, setTransportCurrency,
    ziyarat, setZiyarat, ziyaratCurrency, setZiyaratCurrency,
    food, setFood, foodCurrency, setFoodCurrency,
    parseValue, convertToPKR, formatCurrency, getCurrencySymbol,
    getSingleHotelRowTotal, getHotelRowTotal,
    makkahMultiTotal, madinahMultiTotal, makkahMultiNights, madinahMultiNights,
  } = props;

  // Accordion open/close state: hotels expanded by default, others collapsed
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    makkah: true,
    madinah: true,
    ticket: false,
    visa: false,
    transport: false,
    ziyarat: false,
    food: false,
  });

  const toggleItem = (key: string) => {
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const fmtTotal = (v: number) => (v > 0 ? `Rs ${formatCurrency(v)}` : "—");

  // Calculated per-person costs
  const makkahCost = useMultiHotel
    ? makkahMultiTotal
    : (makkahNights && makkahRate ? getSingleHotelRowTotal(makkahRate, makkahNights, makkahRateMode, makkahSharingType) : 0);

  const madinahCost = useMultiHotel
    ? madinahMultiTotal
    : (madinahNights && madinahRate ? getSingleHotelRowTotal(madinahRate, madinahNights, madinahRateMode, madinahSharingType) : 0);

  const ticketPerPerson = ticketCost ? convertToPKR(parseValue(ticketCost), ticketCurrency) : 0;
  const visaPerPerson = visaFee && visaFee !== "0" ? convertToPKR(parseValue(visaFee), visaCurrency) : 0;
  const transportPerPerson = transport && transport !== "0" ? convertToPKR(parseValue(transport), transportCurrency) : 0;
  const ziyaratPerPerson = ziyarat && ziyarat !== "0" ? convertToPKR(parseValue(ziyarat), ziyaratCurrency) : 0;
  const foodPerPerson = food && food !== "0" ? convertToPKR(parseValue(food), foodCurrency) : 0;

  return (
    <div className="space-y-2.5">
      {/* 1. Makkah Hotel Accordion */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs transition-all">
        <button
          type="button"
          onClick={() => toggleItem("makkah")}
          className="w-full min-h-[46px] px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg shrink-0">🕋</span>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-foreground truncate block">Makkah Hotel</span>
              <span className="text-[11px] text-muted-foreground">
                {useMultiHotel ? `${makkahHotels.length} hotel(s) • ${makkahMultiNights} nights` : `${makkahNights || 0} nights • ${makkahSharingType}`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono font-bold text-primary">{fmtTotal(makkahCost)}</span>
            {openItems.makkah ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {openItems.makkah && (
          <div className="p-3.5 pt-1 border-t border-border/60 bg-muted/10 space-y-3">
            {!useMultiHotel ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Type</label>
                    <MobileSharingTypeSelect
                      value={makkahSharingType}
                      onChange={setMakkahSharingType}
                      disabled={isPresetLocked}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Rate Mode</label>
                    <MobileRateModeSelect
                      value={makkahRateMode}
                      onChange={handleMakkahRateModeChange}
                      disabled={isPresetLocked}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Nights</label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={makkahNights}
                      onChange={(e) => setMakkahNights(e.target.value)}
                      className="h-11 min-h-[44px] text-center font-medium bg-background"
                      placeholder="0"
                      disabled={isPresetLocked}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Rate ({hotelCurrency})</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={makkahRate}
                      onChange={(e) => setMakkahRate(e.target.value)}
                      className="h-11 min-h-[44px] text-center font-medium bg-background"
                      placeholder="0.00"
                      disabled={isPresetLocked}
                    />
                  </div>
                </div>

                <Button
                  onClick={addMakkahHotel}
                  variant="outline"
                  size="sm"
                  className="w-full h-9 min-h-[36px] text-xs gap-1.5 mt-1 border-dashed"
                  disabled={isPresetLocked}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Multiple Makkah Hotels
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {makkahHotels.map((hotel, index) => (
                  <div key={hotel.id} className="p-3 rounded-lg border border-border bg-background space-y-2.5 relative">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        type="text"
                        value={hotel.name}
                        onChange={(e) => updateMakkahHotel(hotel.id, "name", e.target.value)}
                        placeholder={`Makkah Hotel ${index + 1}`}
                        className="h-8 text-xs font-semibold"
                        disabled={isPresetLocked}
                      />
                      <Button
                        onClick={() => removeMakkahHotel(hotel.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive shrink-0"
                        disabled={isPresetLocked}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <MobileSharingTypeSelect
                        value={hotel.sharingType}
                        onChange={(v) => updateMakkahHotel(hotel.id, "sharingType", v)}
                        disabled={isPresetLocked}
                      />
                      <MobileRateModeSelect
                        value={hotel.rateMode}
                        onChange={(v) => updateMakkahHotel(hotel.id, "rateMode", v)}
                        disabled={isPresetLocked}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={hotel.nights}
                        onChange={(e) => updateMakkahHotel(hotel.id, "nights", e.target.value)}
                        placeholder="Nights"
                        className="h-10 text-center text-xs"
                        disabled={isPresetLocked}
                      />
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={hotel.rate}
                        onChange={(e) => updateMakkahHotel(hotel.id, "rate", e.target.value)}
                        placeholder={`Rate (${hotelCurrency})`}
                        className="h-10 text-center text-xs"
                        disabled={isPresetLocked}
                      />
                    </div>
                  </div>
                ))}

                <Button
                  onClick={addMakkahHotel}
                  variant="outline"
                  size="sm"
                  className="w-full h-9 text-xs gap-1.5"
                  disabled={isPresetLocked}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Another Makkah Hotel
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Madinah Hotel Accordion */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs transition-all">
        <button
          type="button"
          onClick={() => toggleItem("madinah")}
          className="w-full min-h-[46px] px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg shrink-0">🕌</span>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-foreground truncate block">Madinah Hotel</span>
              <span className="text-[11px] text-muted-foreground">
                {useMultiHotel ? `${madinahHotels.length} hotel(s) • ${madinahMultiNights} nights` : `${madinahNights || 0} nights • ${madinahSharingType}`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono font-bold text-primary">{fmtTotal(madinahCost)}</span>
            {openItems.madinah ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {openItems.madinah && (
          <div className="p-3.5 pt-1 border-t border-border/60 bg-muted/10 space-y-3">
            {!useMultiHotel ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Type</label>
                    <MobileSharingTypeSelect
                      value={madinahSharingType}
                      onChange={setMadinahSharingType}
                      disabled={isPresetLocked}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Rate Mode</label>
                    <MobileRateModeSelect
                      value={madinahRateMode}
                      onChange={handleMadinahRateModeChange}
                      disabled={isPresetLocked}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Nights</label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={madinahNights}
                      onChange={(e) => setMadinahNights(e.target.value)}
                      className="h-11 min-h-[44px] text-center font-medium bg-background"
                      placeholder="0"
                      disabled={isPresetLocked}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Rate ({hotelCurrency})</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={madinahRate}
                      onChange={(e) => setMadinahRate(e.target.value)}
                      className="h-11 min-h-[44px] text-center font-medium bg-background"
                      placeholder="0.00"
                      disabled={isPresetLocked}
                    />
                  </div>
                </div>

                <Button
                  onClick={addMadinahHotel}
                  variant="outline"
                  size="sm"
                  className="w-full h-9 min-h-[36px] text-xs gap-1.5 mt-1 border-dashed"
                  disabled={isPresetLocked}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Multiple Madinah Hotels
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {madinahHotels.map((hotel, index) => (
                  <div key={hotel.id} className="p-3 rounded-lg border border-border bg-background space-y-2.5 relative">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        type="text"
                        value={hotel.name}
                        onChange={(e) => updateMadinahHotel(hotel.id, "name", e.target.value)}
                        placeholder={`Madinah Hotel ${index + 1}`}
                        className="h-8 text-xs font-semibold"
                        disabled={isPresetLocked}
                      />
                      <Button
                        onClick={() => removeMadinahHotel(hotel.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive shrink-0"
                        disabled={isPresetLocked}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <MobileSharingTypeSelect
                        value={hotel.sharingType}
                        onChange={(v) => updateMadinahHotel(hotel.id, "sharingType", v)}
                        disabled={isPresetLocked}
                      />
                      <MobileRateModeSelect
                        value={hotel.rateMode}
                        onChange={(v) => updateMadinahHotel(hotel.id, "rateMode", v)}
                        disabled={isPresetLocked}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={hotel.nights}
                        onChange={(e) => updateMadinahHotel(hotel.id, "nights", e.target.value)}
                        placeholder="Nights"
                        className="h-10 text-center text-xs"
                        disabled={isPresetLocked}
                      />
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={hotel.rate}
                        onChange={(e) => updateMadinahHotel(hotel.id, "rate", e.target.value)}
                        placeholder={`Rate (${hotelCurrency})`}
                        className="h-10 text-center text-xs"
                        disabled={isPresetLocked}
                      />
                    </div>
                  </div>
                ))}

                <Button
                  onClick={addMadinahHotel}
                  variant="outline"
                  size="sm"
                  className="w-full h-9 text-xs gap-1.5"
                  disabled={isPresetLocked}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Another Madinah Hotel
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Airline Ticket Accordion */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs transition-all">
        <button
          type="button"
          onClick={() => toggleItem("ticket")}
          className="w-full min-h-[46px] px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg shrink-0">✈️</span>
            <span className="text-sm font-semibold text-foreground truncate">Airline Ticket</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono font-bold text-primary">{fmtTotal(ticketPerPerson)}</span>
            {openItems.ticket ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {openItems.ticket && (
          <div className="p-3.5 pt-1 border-t border-border/60 bg-muted/10">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Ticket Amount</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={ticketCost}
                  onChange={(e) => setTicketCost(e.target.value)}
                  className="h-11 min-h-[44px] text-center font-medium bg-background"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Currency</label>
                <MobileCurrencySelect value={ticketCurrency} onChange={setTicketCurrency} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Visa Fee Accordion */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs transition-all">
        <button
          type="button"
          onClick={() => toggleItem("visa")}
          className="w-full min-h-[46px] px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg shrink-0">📋</span>
            <span className="text-sm font-semibold text-foreground truncate">Visa Fee</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono font-bold text-primary">{fmtTotal(visaPerPerson)}</span>
            {openItems.visa ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {openItems.visa && (
          <div className="p-3.5 pt-1 border-t border-border/60 bg-muted/10">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Visa Fee Amount</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={visaFee}
                  onChange={(e) => setVisaFee(e.target.value)}
                  className="h-11 min-h-[44px] text-center font-medium bg-background"
                  placeholder="0.00"
                  disabled={isPresetLocked}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Currency</label>
                <MobileCurrencySelect value={visaCurrency} onChange={setVisaCurrency} disabled={isPresetLocked} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Transport Accordion */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs transition-all">
        <button
          type="button"
          onClick={() => toggleItem("transport")}
          className="w-full min-h-[46px] px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg shrink-0">🚌</span>
            <span className="text-sm font-semibold text-foreground truncate">Transport</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono font-bold text-primary">{fmtTotal(transportPerPerson)}</span>
            {openItems.transport ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {openItems.transport && (
          <div className="p-3.5 pt-1 border-t border-border/60 bg-muted/10">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Transport Cost</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={transport}
                  onChange={(e) => setTransport(e.target.value)}
                  className="h-11 min-h-[44px] text-center font-medium bg-background"
                  placeholder="0.00"
                  disabled={isPresetLocked}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Currency</label>
                <MobileCurrencySelect value={transportCurrency} onChange={setTransportCurrency} disabled={isPresetLocked} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. Ziyarat Accordion */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs transition-all">
        <button
          type="button"
          onClick={() => toggleItem("ziyarat")}
          className="w-full min-h-[46px] px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg shrink-0">🕌</span>
            <span className="text-sm font-semibold text-foreground truncate">Ziyarat</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono font-bold text-primary">{fmtTotal(ziyaratPerPerson)}</span>
            {openItems.ziyarat ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {openItems.ziyarat && (
          <div className="p-3.5 pt-1 border-t border-border/60 bg-muted/10">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Ziyarat Amount</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={ziyarat}
                  onChange={(e) => setZiyarat(e.target.value)}
                  className="h-11 min-h-[44px] text-center font-medium bg-background"
                  placeholder="0.00"
                  disabled={isPresetLocked}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Currency</label>
                <MobileCurrencySelect value={ziyaratCurrency} onChange={setZiyaratCurrency} disabled={isPresetLocked} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 7. Food/Add-ons Accordion */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs transition-all">
        <button
          type="button"
          onClick={() => toggleItem("food")}
          className="w-full min-h-[46px] px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg shrink-0">🍽️</span>
            <span className="text-sm font-semibold text-foreground truncate">Food / Add-ons</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono font-bold text-primary">{fmtTotal(foodPerPerson)}</span>
            {openItems.food ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {openItems.food && (
          <div className="p-3.5 pt-1 border-t border-border/60 bg-muted/10">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Food Amount</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={food}
                  onChange={(e) => setFood(e.target.value)}
                  className="h-11 min-h-[44px] text-center font-medium bg-background"
                  placeholder="0.00"
                  disabled={isPresetLocked}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Currency</label>
                <MobileCurrencySelect value={foodCurrency} onChange={setFoodCurrency} disabled={isPresetLocked} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
