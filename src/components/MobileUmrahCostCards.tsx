import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
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

interface MobileUmrahCostCardsProps {
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
  serviceCharges: string; setServiceCharges: (v: string) => void;
  serviceChargesCurrency: string; setServiceChargesCurrency: (v: string) => void;
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

const CurrencySelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="h-9 text-xs w-full">
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
    <SelectTrigger className="h-9 text-xs w-full">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {SHARING_TYPES.map(type => (
        <SelectItem key={type} value={type}>{type}</SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const RateModeSelect = ({ value, onChange, disabled = false }: { value: RateMode; onChange: (v: RateMode) => void; disabled?: boolean }) => (
  <Select value={value} onValueChange={(v) => onChange(v as RateMode)} disabled={disabled}>
    <SelectTrigger className="h-9 text-xs w-full">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="sharing">Sharing</SelectItem>
      <SelectItem value="room">Room</SelectItem>
    </SelectContent>
  </Select>
);

// A single hotel card (for both single and multi-hotel mode)
function HotelCard({
  icon,
  label,
  sharingType,
  rateMode,
  nights,
  rate,
  disabled,
  total,
  rateModeLabel,
  onSharingChange,
  onRateModeChange,
  onNightsChange,
  onRateChange,
  onAdd,
  onRemove,
  nameInput,
}: {
  icon: string;
  label: string;
  sharingType: string;
  rateMode: RateMode;
  nights: string;
  rate: string;
  disabled: boolean;
  total: string;
  rateModeLabel?: string;
  onSharingChange: (v: string) => void;
  onRateModeChange: (v: RateMode) => void;
  onNightsChange: (v: string) => void;
  onRateChange: (v: string) => void;
  onAdd?: () => void;
  onRemove?: () => void;
  nameInput?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          {nameInput || <span className="text-sm font-semibold text-foreground">{label}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {onAdd && (
            <Button onClick={onAdd} variant="ghost" size="sm" className="h-7 w-7 p-0">
              <Plus className="w-4 h-4" />
            </Button>
          )}
          {onRemove && (
            <Button onClick={onRemove} variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Type</label>
          <SharingTypeSelect value={sharingType} onChange={onSharingChange} disabled={disabled} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Rate Mode</label>
          <RateModeSelect value={rateMode} onChange={onRateModeChange} disabled={disabled} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Nights</label>
          <Input
            type="number"
            value={nights}
            onChange={(e) => onNightsChange(e.target.value)}
            className="h-9 text-sm text-center"
            placeholder="0"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Rate</label>
          <Input
            type="number"
            value={rate}
            onChange={(e) => onRateChange(e.target.value)}
            className="h-9 text-sm text-center"
            placeholder="0"
            disabled={disabled}
          />
        </div>
      </div>

      {total !== "-" && (
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-[11px] text-muted-foreground">Per Person (PKR)</span>
          <span className="text-sm font-bold font-mono text-primary">{total}</span>
        </div>
      )}
    </div>
  );
}

// Simple charge card (no type/rate mode)
function ChargeCard({
  icon,
  label,
  amount,
  currency,
  disabled,
  total,
  onAmountChange,
  onCurrencyChange,
}: {
  icon: string;
  label: string;
  amount: string;
  currency: string;
  disabled?: boolean;
  total: string;
  onAmountChange: (v: string) => void;
  onCurrencyChange: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-base">{icon}</span>
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Amount</label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="h-9 text-sm text-center"
            placeholder="0"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Currency</label>
          <CurrencySelect value={currency} onChange={onCurrencyChange} />
        </div>
      </div>
      {total !== "-" && (
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/50">
          <span className="text-[11px] text-muted-foreground">PKR</span>
          <span className="text-sm font-bold font-mono text-primary">{total}</span>
        </div>
      )}
    </div>
  );
}

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
    serviceCharges, setServiceCharges, serviceChargesCurrency, setServiceChargesCurrency,
    parseValue, convertToPKR, formatCurrency, getCurrencySymbol,
    getSingleHotelRowTotal, getHotelRowTotal,
    makkahMultiTotal, madinahMultiTotal, makkahMultiNights, madinahMultiNights,
  } = props;

  const fmtTotal = (v: number) => v ? `Rs ${formatCurrency(v)}` : "-";

  return (
    <div className="space-y-3">
      {/* Section Label */}
      <div className="flex items-center gap-2 px-1">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Hotels</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Makkah Hotels */}
      {!useMultiHotel ? (
        <HotelCard
          icon="🕋"
          label="Makkah Hotel"
          sharingType={makkahSharingType}
          rateMode={makkahRateMode}
          nights={makkahNights}
          rate={makkahRate}
          disabled={isPresetLocked}
          total={makkahNights && makkahRate ? fmtTotal(getSingleHotelRowTotal(makkahRate, makkahNights, makkahRateMode, makkahSharingType)) : "-"}
          onSharingChange={(v) => setMakkahSharingType(v)}
          onRateModeChange={handleMakkahRateModeChange}
          onNightsChange={setMakkahNights}
          onRateChange={setMakkahRate}
          onAdd={addMakkahHotel}
        />
      ) : (
        <>
          {makkahHotels.map((hotel, index) => (
            <HotelCard
              key={hotel.id}
              icon="🕋"
              label={`Makkah Hotel ${index + 1}`}
              nameInput={
                <Input
                  type="text"
                  value={hotel.name}
                  onChange={(e) => updateMakkahHotel(hotel.id, 'name', e.target.value)}
                  className="h-7 text-xs w-32"
                  placeholder={`Makkah Hotel ${index + 1}`}
                  disabled={isPresetLocked}
                />
              }
              sharingType={hotel.sharingType}
              rateMode={hotel.rateMode}
              nights={hotel.nights}
              rate={hotel.rate}
              disabled={isPresetLocked}
              total={hotel.nights && hotel.rate ? fmtTotal(getHotelRowTotal(hotel)) : "-"}
              onSharingChange={(v) => updateMakkahHotel(hotel.id, 'sharingType', v)}
              onRateModeChange={(v) => updateMakkahHotel(hotel.id, 'rateMode', v)}
              onNightsChange={(v) => updateMakkahHotel(hotel.id, 'nights', v)}
              onRateChange={(v) => updateMakkahHotel(hotel.id, 'rate', v)}
              onRemove={() => removeMakkahHotel(hotel.id)}
            />
          ))}
          {makkahHotels.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30">
              <span className="text-xs text-muted-foreground">Makkah Total ({makkahMultiNights} nights)</span>
              <span className="text-sm font-bold font-mono text-primary">Rs {formatCurrency(makkahMultiTotal)}</span>
            </div>
          )}
          <Button onClick={addMakkahHotel} variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" disabled={isPresetLocked}>
            <Plus className="w-3.5 h-3.5" /> Add Makkah Hotel
          </Button>
        </>
      )}

      {/* Madinah Hotels */}
      {!useMultiHotel ? (
        <HotelCard
          icon="🕌"
          label="Madinah Hotel"
          sharingType={madinahSharingType}
          rateMode={madinahRateMode}
          nights={madinahNights}
          rate={madinahRate}
          disabled={isPresetLocked}
          total={madinahNights && madinahRate ? fmtTotal(getSingleHotelRowTotal(madinahRate, madinahNights, madinahRateMode, madinahSharingType)) : "-"}
          onSharingChange={(v) => setMadinahSharingType(v)}
          onRateModeChange={handleMadinahRateModeChange}
          onNightsChange={setMadinahNights}
          onRateChange={setMadinahRate}
          onAdd={addMadinahHotel}
        />
      ) : (
        <>
          {madinahHotels.map((hotel, index) => (
            <HotelCard
              key={hotel.id}
              icon="🕌"
              label={`Madinah Hotel ${index + 1}`}
              nameInput={
                <Input
                  type="text"
                  value={hotel.name}
                  onChange={(e) => updateMadinahHotel(hotel.id, 'name', e.target.value)}
                  className="h-7 text-xs w-32"
                  placeholder={`Madinah Hotel ${index + 1}`}
                  disabled={isPresetLocked}
                />
              }
              sharingType={hotel.sharingType}
              rateMode={hotel.rateMode}
              nights={hotel.nights}
              rate={hotel.rate}
              disabled={isPresetLocked}
              total={hotel.nights && hotel.rate ? fmtTotal(getHotelRowTotal(hotel)) : "-"}
              onSharingChange={(v) => updateMadinahHotel(hotel.id, 'sharingType', v)}
              onRateModeChange={(v) => updateMadinahHotel(hotel.id, 'rateMode', v)}
              onNightsChange={(v) => updateMadinahHotel(hotel.id, 'nights', v)}
              onRateChange={(v) => updateMadinahHotel(hotel.id, 'rate', v)}
              onRemove={() => removeMadinahHotel(hotel.id)}
            />
          ))}
          {madinahHotels.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30">
              <span className="text-xs text-muted-foreground">Madinah Total ({madinahMultiNights} nights)</span>
              <span className="text-sm font-bold font-mono text-primary">Rs {formatCurrency(madinahMultiTotal)}</span>
            </div>
          )}
          <Button onClick={addMadinahHotel} variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" disabled={isPresetLocked}>
            <Plus className="w-3.5 h-3.5" /> Add Madinah Hotel
          </Button>
        </>
      )}

      {/* Section Label */}
      <div className="flex items-center gap-2 px-1 pt-1">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Charges</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Charges Grid - 2 per row for compact layout */}
      <div className="grid grid-cols-1 gap-3">
        <ChargeCard
          icon="✈️"
          label="Airline Ticket"
          amount={ticketCost}
          currency={ticketCurrency}
          total={ticketCost ? fmtTotal(convertToPKR(parseValue(ticketCost), ticketCurrency)) : "-"}
          onAmountChange={setTicketCost}
          onCurrencyChange={setTicketCurrency}
        />
        <ChargeCard
          icon="📋"
          label="Visa Fee"
          amount={visaFee}
          currency={visaCurrency}
          disabled={isPresetLocked}
          total={visaFee && visaFee !== "0" ? fmtTotal(convertToPKR(parseValue(visaFee), visaCurrency)) : "-"}
          onAmountChange={setVisaFee}
          onCurrencyChange={setVisaCurrency}
        />
        <ChargeCard
          icon="🚌"
          label="Transport"
          amount={transport}
          currency={transportCurrency}
          disabled={isPresetLocked}
          total={transport && transport !== "0" ? fmtTotal(convertToPKR(parseValue(transport), transportCurrency)) : "-"}
          onAmountChange={setTransport}
          onCurrencyChange={setTransportCurrency}
        />
        <ChargeCard
          icon="🕌"
          label="Ziyarat"
          amount={ziyarat}
          currency={ziyaratCurrency}
          disabled={isPresetLocked}
          total={ziyarat && ziyarat !== "0" ? fmtTotal(convertToPKR(parseValue(ziyarat), ziyaratCurrency)) : "-"}
          onAmountChange={setZiyarat}
          onCurrencyChange={setZiyaratCurrency}
        />
        <ChargeCard
          icon="🍽️"
          label="Food/Add-ons"
          amount={food}
          currency={foodCurrency}
          disabled={isPresetLocked}
          total={food && food !== "0" ? fmtTotal(convertToPKR(parseValue(food), foodCurrency)) : "-"}
          onAmountChange={setFood}
          onCurrencyChange={setFoodCurrency}
        />
        <ChargeCard
          icon="💼"
          label="Service Charges"
          amount={serviceCharges}
          currency={serviceChargesCurrency}
          total={serviceCharges ? fmtTotal(convertToPKR(parseValue(serviceCharges), serviceChargesCurrency)) : "-"}
          onAmountChange={setServiceCharges}
          onCurrencyChange={setServiceChargesCurrency}
        />
      </div>
    </div>
  );
}
