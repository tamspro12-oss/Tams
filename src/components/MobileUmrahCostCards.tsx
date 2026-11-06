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

const MobileCurrencySelect = ({
  value,
  onChange,
  disabled = false,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}) => (
  <Select value={value} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger className={cn("h-11 text-xs w-full min-h-[44px] bg-background font-medium", className)}>
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

const MobileSharingTypeSelect = ({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) => (
  <Select value={value} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger className="h-11 text-xs w-full min-h-[44px] bg-background font-medium">
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

const MobileRateModeSelect = ({
  value,
  onChange,
  disabled = false,
}: {
  value: RateMode;
  onChange: (v: RateMode) => void;
  disabled?: boolean;
}) => (
  <Select value={value} onValueChange={v => onChange(v as RateMode)} disabled={disabled}>
    <SelectTrigger className="h-11 text-xs w-full min-h-[44px] bg-background font-medium">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="sharing" className="text-xs">
        Sharing (Per Person)
      </SelectItem>
      <SelectItem value="room" className="text-xs">
        Room (Divided by Type)
      </SelectItem>
    </SelectContent>
  </Select>
);

export function MobileUmrahCostCards(props: MobileUmrahCostCardsProps) {
  const {
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
    isPresetLocked,
    setMakkahNights,
    setMadinahNights,
    setMakkahRate,
    setMadinahRate,
    setMakkahSharingType,
    setMadinahSharingType,
    handleMakkahRateModeChange,
    handleMadinahRateModeChange,
    addMakkahHotel,
    addMadinahHotel,
    updateMakkahHotel,
    updateMadinahHotel,
    removeMakkahHotel,
    removeMadinahHotel,
    ticketCost,
    setTicketCost,
    ticketCurrency,
    setTicketCurrency,
    visaFee,
    setVisaFee,
    visaCurrency,
    setVisaCurrency,
    transport,
    setTransport,
    transportCurrency,
    setTransportCurrency,
    ziyarat,
    setZiyarat,
    ziyaratCurrency,
    setZiyaratCurrency,
    food,
    setFood,
    foodCurrency,
    setFoodCurrency,
    parseValue,
    convertToPKR,
    formatCurrency,
    getSingleHotelRowTotal,
    getHotelRowTotal,
    makkahMultiTotal,
    madinahMultiTotal,
    makkahMultiNights,
    madinahMultiNights,
  } = props;

  // Hotels expanded by default
  const [makkahExpanded, setMakkahExpanded] = useState(true);
  const [madinahExpanded, setMadinahExpanded] = useState(true);

  const fmtTotal = (v: number) => (v > 0 ? `Rs ${formatCurrency(v)}` : "—");

  const makkahCost = useMultiHotel
    ? makkahMultiTotal
    : makkahNights && makkahRate
    ? getSingleHotelRowTotal(makkahRate, makkahNights, makkahRateMode, makkahSharingType)
    : 0;

  const madinahCost = useMultiHotel
    ? madinahMultiTotal
    : madinahNights && madinahRate
    ? getSingleHotelRowTotal(madinahRate, madinahNights, madinahRateMode, madinahSharingType)
    : 0;

  const ticketPerPerson = ticketCost ? convertToPKR(parseValue(ticketCost), ticketCurrency) : 0;
  const visaPerPerson = visaFee ? convertToPKR(parseValue(visaFee), visaCurrency) : 0;
  const transportPerPerson = transport ? convertToPKR(parseValue(transport), transportCurrency) : 0;
  const ziyaratPerPerson = ziyarat ? convertToPKR(parseValue(ziyarat), ziyaratCurrency) : 0;
  const foodPerPerson = food ? convertToPKR(parseValue(food), foodCurrency) : 0;

  return (
    <div className="space-y-2.5">
      {/* 1. Makkah Hotel Card (Expanded by default) */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setMakkahExpanded(prev => !prev)}
          className="w-full min-h-[46px] px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">🕋</span>
            <div className="min-w-0">
              <span className="text-xs font-bold text-foreground truncate block">Makkah Hotel</span>
              <span className="text-[10px] text-muted-foreground">
                {useMultiHotel ? `${makkahHotels.length} hotel(s) • ${makkahMultiNights} nights` : `${makkahNights || 0} nights • ${makkahSharingType}`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-mono font-bold text-primary">{fmtTotal(makkahCost)}</span>
            {makkahExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {makkahExpanded && (
          <div className="p-3 pt-1 border-t border-border/60 bg-muted/10 space-y-2.5">
            {!useMultiHotel ? (
              <div className="space-y-2">
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
                      onFocus={e => e.target.select()}
                      onChange={e => setMakkahNights(e.target.value)}
                      className="h-11 min-h-[44px] text-center font-bold text-base bg-background"
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
                      onFocus={e => e.target.select()}
                      onChange={e => setMakkahRate(e.target.value)}
                      className="h-11 min-h-[44px] text-center font-bold text-base bg-background"
                      placeholder="0.00"
                      disabled={isPresetLocked}
                    />
                  </div>
                </div>

                <Button
                  onClick={addMakkahHotel}
                  variant="outline"
                  size="sm"
                  className="w-full h-9 min-h-[36px] text-xs gap-1.5 border-dashed"
                  disabled={isPresetLocked}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Multiple Makkah Hotels
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {makkahHotels.map((hotel, index) => (
                  <div key={hotel.id} className="p-2.5 rounded-lg border border-border bg-background space-y-2 relative">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        type="text"
                        value={hotel.name}
                        onChange={e => updateMakkahHotel(hotel.id, "name", e.target.value)}
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
                        onChange={v => updateMakkahHotel(hotel.id, "sharingType", v)}
                        disabled={isPresetLocked}
                      />
                      <MobileRateModeSelect
                        value={hotel.rateMode}
                        onChange={v => updateMakkahHotel(hotel.id, "rateMode", v)}
                        disabled={isPresetLocked}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={hotel.nights}
                        onFocus={e => e.target.select()}
                        onChange={e => updateMakkahHotel(hotel.id, "nights", e.target.value)}
                        placeholder="Nights"
                        className="h-11 text-center text-base font-semibold"
                        disabled={isPresetLocked}
                      />
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={hotel.rate}
                        onFocus={e => e.target.select()}
                        onChange={e => updateMakkahHotel(hotel.id, "rate", e.target.value)}
                        placeholder={`Rate (${hotelCurrency})`}
                        className="h-11 text-center text-base font-semibold"
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

      {/* 2. Madinah Hotel Card (Expanded by default) */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setMadinahExpanded(prev => !prev)}
          className="w-full min-h-[46px] px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">🕌</span>
            <div className="min-w-0">
              <span className="text-xs font-bold text-foreground truncate block">Madinah Hotel</span>
              <span className="text-[10px] text-muted-foreground">
                {useMultiHotel ? `${madinahHotels.length} hotel(s) • ${madinahMultiNights} nights` : `${madinahNights || 0} nights • ${madinahSharingType}`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-mono font-bold text-primary">{fmtTotal(madinahCost)}</span>
            {madinahExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {madinahExpanded && (
          <div className="p-3 pt-1 border-t border-border/60 bg-muted/10 space-y-2.5">
            {!useMultiHotel ? (
              <div className="space-y-2">
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
                      onFocus={e => e.target.select()}
                      onChange={e => setMadinahNights(e.target.value)}
                      className="h-11 min-h-[44px] text-center font-bold text-base bg-background"
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
                      onFocus={e => e.target.select()}
                      onChange={e => setMadinahRate(e.target.value)}
                      className="h-11 min-h-[44px] text-center font-bold text-base bg-background"
                      placeholder="0.00"
                      disabled={isPresetLocked}
                    />
                  </div>
                </div>

                <Button
                  onClick={addMadinahHotel}
                  variant="outline"
                  size="sm"
                  className="w-full h-9 min-h-[36px] text-xs gap-1.5 border-dashed"
                  disabled={isPresetLocked}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Multiple Madinah Hotels
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {madinahHotels.map((hotel, index) => (
                  <div key={hotel.id} className="p-2.5 rounded-lg border border-border bg-background space-y-2 relative">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        type="text"
                        value={hotel.name}
                        onChange={e => updateMadinahHotel(hotel.id, "name", e.target.value)}
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
                        onChange={v => updateMadinahHotel(hotel.id, "sharingType", v)}
                        disabled={isPresetLocked}
                      />
                      <MobileRateModeSelect
                        value={hotel.rateMode}
                        onChange={v => updateMadinahHotel(hotel.id, "rateMode", v)}
                        disabled={isPresetLocked}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={hotel.nights}
                        onFocus={e => e.target.select()}
                        onChange={e => updateMadinahHotel(hotel.id, "nights", e.target.value)}
                        placeholder="Nights"
                        className="h-11 text-center text-base font-semibold"
                        disabled={isPresetLocked}
                      />
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={hotel.rate}
                        onFocus={e => e.target.select()}
                        onChange={e => updateMadinahHotel(hotel.id, "rate", e.target.value)}
                        placeholder={`Rate (${hotelCurrency})`}
                        className="h-11 text-center text-base font-semibold"
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

      {/* 3. Airline Ticket + Visa Fee (2 Columns Side by Side in One Compact Card) */}
      <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
        <div className="grid grid-cols-2 gap-2.5">
          {/* Airline Ticket */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-foreground truncate">✈️ Airline Ticket</span>
              <span className="text-[10px] font-mono font-bold text-primary">{fmtTotal(ticketPerPerson)}</span>
            </div>
            <Input
              type="number"
              inputMode="decimal"
              value={ticketCost}
              onFocus={e => e.target.select()}
              onChange={e => setTicketCost(e.target.value)}
              className="h-11 min-h-[44px] text-center font-bold text-base bg-background"
              placeholder="0.00"
            />
            <MobileCurrencySelect value={ticketCurrency} onChange={setTicketCurrency} />
          </div>

          {/* Visa Fee */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-foreground truncate">📋 Visa Fee</span>
              <span className="text-[10px] font-mono font-bold text-primary">{fmtTotal(visaPerPerson)}</span>
            </div>
            <Input
              type="number"
              inputMode="decimal"
              value={visaFee}
              onFocus={e => e.target.select()}
              onChange={e => setVisaFee(e.target.value)}
              className="h-11 min-h-[44px] text-center font-bold text-base bg-background"
              placeholder="0.00"
              disabled={isPresetLocked}
            />
            <MobileCurrencySelect value={visaCurrency} onChange={setVisaCurrency} disabled={isPresetLocked} />
          </div>
        </div>
      </div>

      {/* 4. Transport + Ziyarat + Food / Add-ons (3 Compact Tiles in ONE Row) */}
      <div className="rounded-xl border border-border bg-card p-2.5 shadow-2xs">
        <div className="grid grid-cols-3 gap-2">
          {/* Transport */}
          <div className="space-y-1 bg-muted/20 p-2 rounded-lg border border-border/50">
            <span className="text-[10px] font-bold text-foreground block truncate">🚌 Transport</span>
            <Input
              type="number"
              inputMode="decimal"
              value={transport}
              onFocus={e => e.target.select()}
              onChange={e => setTransport(e.target.value)}
              className="h-10 min-h-[40px] text-center font-bold text-sm bg-background p-1"
              placeholder="0.00"
              disabled={isPresetLocked}
            />
            <MobileCurrencySelect
              value={transportCurrency}
              onChange={setTransportCurrency}
              disabled={isPresetLocked}
              className="h-9 min-h-[36px] text-[11px]"
            />
            <span className="text-[10px] font-mono text-muted-foreground block text-center truncate">
              {fmtTotal(transportPerPerson)}
            </span>
          </div>

          {/* Ziyarat */}
          <div className="space-y-1 bg-muted/20 p-2 rounded-lg border border-border/50">
            <span className="text-[10px] font-bold text-foreground block truncate">🕌 Ziyarat</span>
            <Input
              type="number"
              inputMode="decimal"
              value={ziyarat}
              onFocus={e => e.target.select()}
              onChange={e => setZiyarat(e.target.value)}
              className="h-10 min-h-[40px] text-center font-bold text-sm bg-background p-1"
              placeholder="0.00"
              disabled={isPresetLocked}
            />
            <MobileCurrencySelect
              value={ziyaratCurrency}
              onChange={setZiyaratCurrency}
              disabled={isPresetLocked}
              className="h-9 min-h-[36px] text-[11px]"
            />
            <span className="text-[10px] font-mono text-muted-foreground block text-center truncate">
              {fmtTotal(ziyaratPerPerson)}
            </span>
          </div>

          {/* Food */}
          <div className="space-y-1 bg-muted/20 p-2 rounded-lg border border-border/50">
            <span className="text-[10px] font-bold text-foreground block truncate">🍽️ Food</span>
            <Input
              type="number"
              inputMode="decimal"
              value={food}
              onFocus={e => e.target.select()}
              onChange={e => setFood(e.target.value)}
              className="h-10 min-h-[40px] text-center font-bold text-sm bg-background p-1"
              placeholder="0.00"
              disabled={isPresetLocked}
            />
            <MobileCurrencySelect
              value={foodCurrency}
              onChange={setFoodCurrency}
              disabled={isPresetLocked}
              className="h-9 min-h-[36px] text-[11px]"
            />
            <span className="text-[10px] font-mono text-muted-foreground block text-center truncate">
              {fmtTotal(foodPerPerson)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
