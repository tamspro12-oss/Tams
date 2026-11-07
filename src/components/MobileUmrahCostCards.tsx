import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type RateMode = "sharing" | "room";

export interface HotelEntry {
  id: string;
  city: "makkah" | "madinah";
  name: string;
  sharingType: "Quint" | "Quad" | "Triple" | "Double" | "Sharing";
  rateMode: RateMode;
  rate: string;
  nights: string;
  currency?: string;
}

const SHARING_TYPES = ["Sharing", "Quint", "Quad", "Triple", "Double"] as const;
const OCCUPANCY_DIVISORS: Record<string, number> = {
  Quint: 5, Quad: 4, Triple: 3, Double: 2, Sharing: 1,
};

export interface MobileUmrahCostCardsProps {
  // Hotel state & handlers
  makkahHotels: HotelEntry[];
  madinahHotels: HotelEntry[];
  hotelCurrency: string;
  isPresetLocked: boolean;
  addMakkahHotel: () => void;
  addMadinahHotel: () => void;
  updateHotel: (id: string, field: keyof HotelEntry, value: any) => void;
  removeHotel: (id: string) => void;
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
  getHotelRowTotal: (hotel: HotelEntry) => number;
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
    <SelectTrigger className={cn("h-11 text-xs w-full min-h-[44px] bg-white ring-1 ring-slate-300 font-medium rounded-lg", className)}>
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
    <SelectTrigger className="h-11 text-xs w-full min-h-[44px] bg-white ring-1 ring-slate-300 font-medium rounded-lg">
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
    <SelectTrigger className="h-11 text-xs w-full min-h-[44px] bg-white ring-1 ring-slate-300 font-medium rounded-lg">
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
    makkahHotels,
    madinahHotels,
    hotelCurrency,
    isPresetLocked,
    addMakkahHotel,
    addMadinahHotel,
    updateHotel,
    removeHotel,
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
    getHotelRowTotal,
  } = props;

  // Hotels expanded by default
  const [makkahExpanded, setMakkahExpanded] = useState(true);
  const [madinahExpanded, setMadinahExpanded] = useState(true);

  const fmtTotal = (v: number) => (v > 0 ? `Rs ${formatCurrency(v)}` : "—");

  const makkahCost = makkahHotels.reduce((sum, h) => sum + getHotelRowTotal(h), 0);
  const madinahCost = madinahHotels.reduce((sum, h) => sum + getHotelRowTotal(h), 0);
  const makkahNights = makkahHotels.reduce((sum, h) => sum + parseValue(h.nights), 0);
  const madinahNights = madinahHotels.reduce((sum, h) => sum + parseValue(h.nights), 0);

  const ticketPerPerson = ticketCost ? convertToPKR(parseValue(ticketCost), ticketCurrency) : 0;
  const visaPerPerson = visaFee ? convertToPKR(parseValue(visaFee), visaCurrency) : 0;
  const transportPerPerson = transport ? convertToPKR(parseValue(transport), transportCurrency) : 0;
  const ziyaratPerPerson = ziyarat ? convertToPKR(parseValue(ziyarat), ziyaratCurrency) : 0;
  const foodPerPerson = food ? convertToPKR(parseValue(food), foodCurrency) : 0;

  return (
    <div className="space-y-2.5">
      {/* 1. Makkah Hotel Card (Rounded emerald-tinted, Expanded by default) */}
      <div className="rounded-xl bg-emerald-50/70 ring-1 ring-emerald-200/80 dark:bg-emerald-950/20 dark:ring-emerald-900/40 overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setMakkahExpanded(prev => !prev)}
          className="w-full min-h-[46px] px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-emerald-100/40 active:bg-emerald-100/60 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm shrink-0">
              🕋
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate block">Makkah Hotel</span>
              <span className="text-[10px] text-slate-600 dark:text-slate-400">
                {makkahHotels.length} hotel{makkahHotels.length > 1 ? "s" : ""} • {makkahNights} nights
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">{fmtTotal(makkahCost)}</span>
            {makkahExpanded ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
          </div>
        </button>

        {makkahExpanded && (
          <div className="p-3 pt-1 border-t border-emerald-200/60 dark:border-emerald-900/40 space-y-2.5">
            {makkahHotels.map((hotel, index) => {
              const defaultLabel = makkahHotels.length > 1 ? `Makkah Hotel ${index + 1}` : "Makkah Hotel";
              return (
                <div key={hotel.id} className="p-2.5 rounded-lg border border-emerald-200 bg-white space-y-2 relative">
                  <div className="flex items-center justify-between gap-2">
                    {makkahHotels.length > 1 ? (
                      <Input
                        type="text"
                        value={hotel.name}
                        onChange={e => updateHotel(hotel.id, "name", e.target.value)}
                        placeholder={defaultLabel}
                        className="h-8 text-xs font-semibold"
                        disabled={isPresetLocked}
                      />
                    ) : (
                      <span className="text-xs font-bold text-slate-900">{hotel.name || defaultLabel}</span>
                    )}
                    {makkahHotels.length > 1 && (
                      <Button
                        onClick={() => removeHotel(hotel.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive shrink-0"
                        disabled={isPresetLocked}
                        title="Remove hotel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase">Type</label>
                      <MobileSharingTypeSelect
                        value={hotel.sharingType}
                        onChange={v => updateHotel(hotel.id, "sharingType", v)}
                        disabled={isPresetLocked}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase">Rate Mode</label>
                      <MobileRateModeSelect
                        value={hotel.rateMode}
                        onChange={v => updateHotel(hotel.id, "rateMode", v)}
                        disabled={isPresetLocked}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase">Nights</label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={hotel.nights}
                        onFocus={e => e.target.select()}
                        onChange={e => updateHotel(hotel.id, "nights", e.target.value)}
                        placeholder="Nights"
                        className="h-11 min-h-[44px] text-center font-bold text-base bg-white ring-1 ring-slate-300 text-slate-900 rounded-lg tabular-nums"
                        disabled={isPresetLocked}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase">Rate & Currency</label>
                      <div className="flex gap-1.5">
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={hotel.rate}
                          onFocus={e => e.target.select()}
                          onChange={e => updateHotel(hotel.id, "rate", e.target.value)}
                          placeholder="0.00"
                          className="h-11 min-h-[44px] text-center font-bold text-base bg-white ring-1 ring-slate-300 text-slate-900 rounded-lg tabular-nums flex-1"
                          disabled={isPresetLocked}
                        />
                        <Select
                          value={hotel.currency || "SAR"}
                          onValueChange={v => updateHotel(hotel.id, "currency", v)}
                          disabled={isPresetLocked}
                        >
                          <SelectTrigger className="h-11 min-h-[44px] w-20 text-xs font-semibold bg-white ring-1 ring-slate-300">
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
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <Button
              onClick={addMakkahHotel}
              variant="outline"
              size="sm"
              className="w-full h-9 min-h-[36px] text-xs gap-1.5 border-dashed border-emerald-300 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100"
              disabled={isPresetLocked}
            >
              <Plus className="w-3.5 h-3.5" />
              {makkahHotels.length === 1 ? "Add Multiple Makkah Hotels" : "Add Another Makkah Hotel"}
            </Button>
          </div>
        )}
      </div>

      {/* 2. Madinah Hotel Card (Rounded emerald-tinted, Expanded by default) */}
      <div className="rounded-xl bg-emerald-50/70 ring-1 ring-emerald-200/80 dark:bg-emerald-950/20 dark:ring-emerald-900/40 overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setMadinahExpanded(prev => !prev)}
          className="w-full min-h-[46px] px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-emerald-100/40 active:bg-emerald-100/60 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm shrink-0">
              🕌
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate block">Madinah Hotel</span>
              <span className="text-[10px] text-slate-600 dark:text-slate-400">
                {madinahHotels.length} hotel{madinahHotels.length > 1 ? "s" : ""} • {madinahNights} nights
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">{fmtTotal(madinahCost)}</span>
            {madinahExpanded ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
          </div>
        </button>

        {madinahExpanded && (
          <div className="p-3 pt-1 border-t border-emerald-200/60 dark:border-emerald-900/40 space-y-2.5">
            {madinahHotels.map((hotel, index) => {
              const defaultLabel = madinahHotels.length > 1 ? `Madinah Hotel ${index + 1}` : "Madinah Hotel";
              return (
                <div key={hotel.id} className="p-2.5 rounded-lg border border-emerald-200 bg-white space-y-2 relative">
                  <div className="flex items-center justify-between gap-2">
                    {madinahHotels.length > 1 ? (
                      <Input
                        type="text"
                        value={hotel.name}
                        onChange={e => updateHotel(hotel.id, "name", e.target.value)}
                        placeholder={defaultLabel}
                        className="h-8 text-xs font-semibold"
                        disabled={isPresetLocked}
                      />
                    ) : (
                      <span className="text-xs font-bold text-slate-900">{hotel.name || defaultLabel}</span>
                    )}
                    {madinahHotels.length > 1 && (
                      <Button
                        onClick={() => removeHotel(hotel.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive shrink-0"
                        disabled={isPresetLocked}
                        title="Remove hotel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase">Type</label>
                      <MobileSharingTypeSelect
                        value={hotel.sharingType}
                        onChange={v => updateHotel(hotel.id, "sharingType", v)}
                        disabled={isPresetLocked}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase">Rate Mode</label>
                      <MobileRateModeSelect
                        value={hotel.rateMode}
                        onChange={v => updateHotel(hotel.id, "rateMode", v)}
                        disabled={isPresetLocked}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase">Nights</label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={hotel.nights}
                        onFocus={e => e.target.select()}
                        onChange={e => updateHotel(hotel.id, "nights", e.target.value)}
                        placeholder="Nights"
                        className="h-11 min-h-[44px] text-center font-bold text-base bg-white ring-1 ring-slate-300 text-slate-900 rounded-lg tabular-nums"
                        disabled={isPresetLocked}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase">Rate & Currency</label>
                      <div className="flex gap-1.5">
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={hotel.rate}
                          onFocus={e => e.target.select()}
                          onChange={e => updateHotel(hotel.id, "rate", e.target.value)}
                          placeholder="0.00"
                          className="h-11 min-h-[44px] text-center font-bold text-base bg-white ring-1 ring-slate-300 text-slate-900 rounded-lg tabular-nums flex-1"
                          disabled={isPresetLocked}
                        />
                        <Select
                          value={hotel.currency || "SAR"}
                          onValueChange={v => updateHotel(hotel.id, "currency", v)}
                          disabled={isPresetLocked}
                        >
                          <SelectTrigger className="h-11 min-h-[44px] w-20 text-xs font-semibold bg-white ring-1 ring-slate-300">
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
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <Button
              onClick={addMadinahHotel}
              variant="outline"
              size="sm"
              className="w-full h-9 min-h-[36px] text-xs gap-1.5 border-dashed border-emerald-300 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100"
              disabled={isPresetLocked}
            >
              <Plus className="w-3.5 h-3.5" />
              {madinahHotels.length === 1 ? "Add Multiple Madinah Hotels" : "Add Another Madinah Hotel"}
            </Button>
          </div>
        )}
      </div>

      {/* 3. Airline Ticket + Visa Fee (2 Columns side by side, sky tinted) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Airline Ticket */}
        <div className="rounded-xl p-3 bg-sky-50/70 ring-1 ring-sky-200/80 dark:bg-sky-950/20 dark:ring-sky-900/40 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate">✈️ Ticket</span>
            <span className="text-[10px] font-mono font-bold text-slate-900 dark:text-slate-100">{fmtTotal(ticketPerPerson)}</span>
          </div>
          <Input
            type="number"
            inputMode="decimal"
            value={ticketCost}
            onFocus={e => e.target.select()}
            onChange={e => setTicketCost(e.target.value)}
            className="h-11 min-h-[44px] text-center font-bold text-base bg-white ring-1 ring-slate-300 text-slate-900 rounded-lg tabular-nums"
            placeholder="0.00"
          />
          <MobileCurrencySelect value={ticketCurrency} onChange={setTicketCurrency} />
        </div>

        {/* Visa Fee */}
        <div className="rounded-xl p-3 bg-sky-50/70 ring-1 ring-sky-200/80 dark:bg-sky-950/20 dark:ring-sky-900/40 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate">📋 Visa</span>
            <span className="text-[10px] font-mono font-bold text-slate-900 dark:text-slate-100">{fmtTotal(visaPerPerson)}</span>
          </div>
          <Input
            type="number"
            inputMode="decimal"
            value={visaFee}
            onFocus={e => e.target.select()}
            onChange={e => setVisaFee(e.target.value)}
            className="h-11 min-h-[44px] text-center font-bold text-base bg-white ring-1 ring-slate-300 text-slate-900 rounded-lg tabular-nums"
            placeholder="0.00"
            disabled={isPresetLocked}
          />
          <MobileCurrencySelect value={visaCurrency} onChange={setVisaCurrency} disabled={isPresetLocked} />
        </div>
      </div>

      {/* 4. Transport + Ziyarat + Food / Add-ons (3 small tiles in ONE row, amber tinted) */}
      <div className="grid grid-cols-3 gap-2">
        {/* Transport */}
        <div className="rounded-xl p-2.5 bg-amber-50/70 ring-1 ring-amber-200/80 dark:bg-amber-950/20 dark:ring-amber-900/40 space-y-1 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 block truncate">🚌 Transport</span>
          <Input
            type="number"
            inputMode="decimal"
            value={transport}
            onFocus={e => e.target.select()}
            onChange={e => setTransport(e.target.value)}
            className="h-10 min-h-[40px] text-center font-bold text-sm bg-white ring-1 ring-slate-300 text-slate-900 rounded-lg tabular-nums p-1"
            placeholder="0.00"
            disabled={isPresetLocked}
          />
          <MobileCurrencySelect
            value={transportCurrency}
            onChange={setTransportCurrency}
            disabled={isPresetLocked}
            className="h-8 min-h-[32px] text-[10px]"
          />
          <span className="text-[10px] font-mono font-semibold text-slate-700 dark:text-slate-300 block text-center truncate">
            {fmtTotal(transportPerPerson)}
          </span>
        </div>

        {/* Ziyarat */}
        <div className="rounded-xl p-2.5 bg-amber-50/70 ring-1 ring-amber-200/80 dark:bg-amber-950/20 dark:ring-amber-900/40 space-y-1 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 block truncate">🕌 Ziyarat</span>
          <Input
            type="number"
            inputMode="decimal"
            value={ziyarat}
            onFocus={e => e.target.select()}
            onChange={e => setZiyarat(e.target.value)}
            className="h-10 min-h-[40px] text-center font-bold text-sm bg-white ring-1 ring-slate-300 text-slate-900 rounded-lg tabular-nums p-1"
            placeholder="0.00"
            disabled={isPresetLocked}
          />
          <MobileCurrencySelect
            value={ziyaratCurrency}
            onChange={setZiyaratCurrency}
            disabled={isPresetLocked}
            className="h-8 min-h-[32px] text-[10px]"
          />
          <span className="text-[10px] font-mono font-semibold text-slate-700 dark:text-slate-300 block text-center truncate">
            {fmtTotal(ziyaratPerPerson)}
          </span>
        </div>

        {/* Food */}
        <div className="rounded-xl p-2.5 bg-amber-50/70 ring-1 ring-amber-200/80 dark:bg-amber-950/20 dark:ring-amber-900/40 space-y-1 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 block truncate">🍽️ Food</span>
          <Input
            type="number"
            inputMode="decimal"
            value={food}
            onFocus={e => e.target.select()}
            onChange={e => setFood(e.target.value)}
            className="h-10 min-h-[40px] text-center font-bold text-sm bg-white ring-1 ring-slate-300 text-slate-900 rounded-lg tabular-nums p-1"
            placeholder="0.00"
            disabled={isPresetLocked}
          />
          <MobileCurrencySelect
            value={foodCurrency}
            onChange={setFoodCurrency}
            disabled={isPresetLocked}
            className="h-8 min-h-[32px] text-[10px]"
          />
          <span className="text-[10px] font-mono font-semibold text-slate-700 dark:text-slate-300 block text-center truncate">
            {fmtTotal(foodPerPerson)}
          </span>
        </div>
      </div>
    </div>
  );
}
