import React, { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Users } from "lucide-react";
import { cleanPastedSearch } from "@/lib/searchUtils";
import {
  ServiceType,
  TripType,
  Passenger,
  FlightLeg,
  ServiceDetailsState,
  SERVICE_TYPE_OPTIONS,
  TRIP_TYPE_OPTIONS,
  UMRAH_TRANSPORT_OPTIONS,
  PASSENGER_TYPE_OPTIONS,
  GENDER_OPTIONS,
  createDefaultFlightLeg,
  createDefaultPassenger,
} from "@/lib/serviceDefinitions";

interface ServiceTypeSelectProps {
  value: ServiceType;
  onChange: (value: ServiceType) => void;
  triggerRef?: React.RefObject<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
}

export const ServiceTypeSelect: React.FC<ServiceTypeSelectProps> = ({
  value,
  onChange,
  triggerRef,
  disabled,
  className = "h-8 text-xs font-medium bg-background",
}) => (
  <Select
    value={value}
    onValueChange={(val) => onChange(val as ServiceType)}
    disabled={disabled}
  >
    <SelectTrigger ref={triggerRef} className={className}>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {SERVICE_TYPE_OPTIONS.map((opt) => (
        <SelectItem key={opt.value} value={opt.value}>
          {opt.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

interface TripTypeSelectProps {
  value: TripType;
  onChange: (value: TripType) => void;
  disabled?: boolean;
  className?: string;
}

export const TripTypeSelect: React.FC<TripTypeSelectProps> = ({
  value,
  onChange,
  disabled,
  className = "h-8 text-xs bg-background",
}) => (
  <Select
    value={value}
    onValueChange={(val) => onChange(val as TripType)}
    disabled={disabled}
  >
    <SelectTrigger className={className}>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {TRIP_TYPE_OPTIONS.map((opt) => (
        <SelectItem key={opt.value} value={opt.value}>
          {opt.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

interface ZiyaratToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const ZiyaratToggle: React.FC<ZiyaratToggleProps> = ({
  checked,
  onCheckedChange,
}) => (
  <div className="h-8 flex items-center justify-between px-2 rounded-md border bg-background">
    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
      {checked ? "Included" : "Excluded"}
    </span>
    <Switch
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="scale-75 data-[state=checked]:bg-teal-600"
    />
  </div>
);

interface ServiceSpecificFieldsProps {
  service: ServiceType;
  details: ServiceDetailsState;
  onDetailChange: <K extends keyof ServiceDetailsState>(
    field: K,
    value: ServiceDetailsState[K]
  ) => void;
  showInlineTripType?: boolean;
  showInlineZiyarat?: boolean;
  showIssuanceFields?: boolean;
  containerClassName?: string;
}

export const ServiceSpecificFields: React.FC<ServiceSpecificFieldsProps> = ({
  service,
  details,
  onDetailChange,
  showInlineTripType = false,
  showInlineZiyarat = false,
  showIssuanceFields = true,
  containerClassName = "bg-slate-50/70 dark:bg-slate-900/40 rounded-lg border p-2.5 space-y-2.5",
}) => {
  const multicityRef = useRef<HTMLDivElement>(null);
  const focusNewLegRef = useRef(false);

  useEffect(() => {
    if (!focusNewLegRef.current) return;
    focusNewLegRef.current = false;
    const targetIdx = details.multicityLegs.length - 1;
    const nextRow = multicityRef.current?.querySelector<HTMLInputElement>(
      `[data-repeatable-row="${targetIdx}"] input`
    );
    nextRow?.focus();
  }, [details.multicityLegs.length]);

  const handleLegChange = (
    index: number,
    field: keyof FlightLeg,
    value: string
  ) => {
    const next = [...details.multicityLegs];
    next[index] = { ...next[index], [field]: value };
    onDetailChange("multicityLegs", next);
  };

  const handleAddMulticityLeg = () => {
    focusNewLegRef.current = true;
    onDetailChange("multicityLegs", [
      ...details.multicityLegs,
      createDefaultFlightLeg(),
    ]);
  };

  const handleRemoveMulticityLeg = (index: number) => {
    if (details.multicityLegs.length <= 1) return;
    onDetailChange(
      "multicityLegs",
      details.multicityLegs.filter((_, i) => i !== index)
    );
  };

  return (
    <div className={containerClassName}>
      {/* A. AIR TICKET */}
      {service === "Ticket" && (
        <div className="space-y-2.5">
          {showInlineTripType && (
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Trip Type
                </Label>
                <TripTypeSelect
                  value={details.tripType}
                  onChange={(val) => onDetailChange("tripType", val)}
                />
              </div>
            </div>
          )}

          {details.tripType !== "Multicity" ? (
            <>
              <div
                className={`grid grid-cols-2 sm:grid-cols-3 ${
                  showIssuanceFields ? "md:grid-cols-6" : "md:grid-cols-4"
                } gap-2 items-end`}
              >
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Flight Date
                  </Label>
                  <Input
                    type="date"
                    value={details.flightDate}
                    onChange={(e) => onDetailChange("flightDate", e.target.value)}
                    className="h-8 text-xs px-2 bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Flight Time
                  </Label>
                  <Input
                    type="time"
                    value={details.flightTime}
                    onChange={(e) => onDetailChange("flightTime", e.target.value)}
                    className="h-8 text-xs px-2 bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Sector
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      value={details.origin}
                      onChange={(e) =>
                        onDetailChange("origin", e.target.value.toUpperCase())
                      }
                      placeholder="KHI"
                      className="h-8 text-xs uppercase px-1.5 text-center font-mono bg-background"
                    />
                    <span className="text-xs text-muted-foreground">→</span>
                    <Input
                      value={details.destination}
                      onChange={(e) =>
                        onDetailChange(
                          "destination",
                          e.target.value.toUpperCase()
                        )
                      }
                      placeholder="DXB"
                      className="h-8 text-xs uppercase px-1.5 text-center font-mono bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Airline
                  </Label>
                  <Input
                    value={details.airline}
                    onChange={(e) => onDetailChange("airline", e.target.value)}
                    placeholder="e.g. PIA / Emirates"
                    className="h-8 text-xs bg-background"
                  />
                </div>

                {showIssuanceFields && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        PNR
                      </Label>
                      <Input
                        value={details.pnr}
                        onChange={(e) =>
                          onDetailChange("pnr", e.target.value.toUpperCase())
                        }
                        onPaste={(e) => {
                          const pasted = e.clipboardData.getData("text");
                          if (pasted) {
                            e.preventDefault();
                            onDetailChange(
                              "pnr",
                              cleanPastedSearch(pasted).toUpperCase()
                            );
                          }
                        }}
                        placeholder="PNR Code"
                        className="h-8 text-xs uppercase font-mono bg-background"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Ticket No
                      </Label>
                      <Input
                        value={details.ticketNo}
                        onChange={(e) =>
                          onDetailChange("ticketNo", e.target.value)
                        }
                        onPaste={(e) => {
                          const pasted = e.clipboardData.getData("text");
                          if (pasted) {
                            e.preventDefault();
                            onDetailChange(
                              "ticketNo",
                              cleanPastedSearch(pasted)
                            );
                          }
                        }}
                        placeholder="214-89765432"
                        className="h-8 text-xs font-mono bg-background"
                      />
                    </div>
                  </>
                )}
              </div>

              {details.tripType === "Return" && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end bg-blue-50/40 dark:bg-blue-950/20 p-2 rounded border border-blue-100 dark:border-blue-900/40">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-blue-900 dark:text-blue-300">
                      Return Flight Date
                    </Label>
                    <Input
                      type="date"
                      value={details.returnDate}
                      onChange={(e) =>
                        onDetailChange("returnDate", e.target.value)
                      }
                      className="h-8 text-xs px-2 bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-blue-900 dark:text-blue-300">
                      Return Flight Time
                    </Label>
                    <Input
                      type="time"
                      value={details.returnTime}
                      onChange={(e) =>
                        onDetailChange("returnTime", e.target.value)
                      }
                      className="h-8 text-xs px-2 bg-background"
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              ref={multicityRef}
              className="space-y-1.5"
              data-repeatable-group="multicity"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Multicity Additional Sectors
                </span>
                <button
                  type="button"
                  data-add-row-btn="true"
                  onClick={handleAddMulticityLeg}
                  className="text-[11px] font-semibold text-teal-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Segment
                </button>
              </div>

              {details.multicityLegs.map((leg, idx) => (
                <div
                  key={idx}
                  data-repeatable-row={idx}
                  className="flex items-center gap-1.5"
                >
                  <span className="text-[10px] font-mono font-bold text-muted-foreground w-4 text-center">
                    #{idx + 1}
                  </span>
                  <Input
                    value={leg.from}
                    onChange={(e) =>
                      handleLegChange(idx, "from", e.target.value.toUpperCase())
                    }
                    placeholder="From"
                    className="h-7 text-xs uppercase font-mono w-16 bg-background"
                  />
                  <Input
                    value={leg.to}
                    onChange={(e) =>
                      handleLegChange(idx, "to", e.target.value.toUpperCase())
                    }
                    placeholder="To"
                    className="h-7 text-xs uppercase font-mono w-16 bg-background"
                  />
                  <Input
                    type="date"
                    value={leg.date}
                    onChange={(e) => handleLegChange(idx, "date", e.target.value)}
                    className="h-7 text-xs w-32 px-1.5 bg-background"
                  />
                  <Input
                    value={leg.airline}
                    onChange={(e) =>
                      handleLegChange(idx, "airline", e.target.value)
                    }
                    placeholder="Airline"
                    className="h-7 text-xs flex-1 bg-background"
                  />
                  {showIssuanceFields && (
                    <Input
                      value={leg.pnr}
                      onChange={(e) =>
                        handleLegChange(
                          idx,
                          "pnr",
                          e.target.value.toUpperCase()
                        )
                      }
                      placeholder="PNR"
                      className="h-7 text-xs uppercase font-mono w-24 bg-background"
                    />
                  )}
                  {details.multicityLegs.length > 1 && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => handleRemoveMulticityLeg(idx)}
                      className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* B. UMRAH PACKAGE */}
      {service === "Umrah" && (
        <div className="space-y-2.5">
          {showInlineZiyarat && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Ziyarat
                </Label>
                <ZiyaratToggle
                  checked={details.ziyaratIncluded}
                  onCheckedChange={(val) =>
                    onDetailChange("ziyaratIncluded", val)
                  }
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Departure City
              </Label>
              <Input
                value={details.umrahDepartureCity}
                onChange={(e) =>
                  onDetailChange("umrahDepartureCity", e.target.value)
                }
                placeholder="Karachi"
                className="h-8 text-xs bg-background"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Arrival City
              </Label>
              <Input
                value={details.umrahArrivalCity}
                onChange={(e) =>
                  onDetailChange("umrahArrivalCity", e.target.value)
                }
                placeholder="Jeddah"
                className="h-8 text-xs bg-background"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Airline
              </Label>
              <Input
                value={details.umrahAirline}
                onChange={(e) => onDetailChange("umrahAirline", e.target.value)}
                placeholder="Saudia"
                className="h-8 text-xs bg-background"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Flight Date
              </Label>
              <Input
                type="date"
                value={details.umrahFlightDate}
                onChange={(e) =>
                  onDetailChange("umrahFlightDate", e.target.value)
                }
                className="h-8 text-xs px-1.5 bg-background"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Flight Time
              </Label>
              <Input
                type="time"
                value={details.umrahFlightTime}
                onChange={(e) =>
                  onDetailChange("umrahFlightTime", e.target.value)
                }
                className="h-8 text-xs px-1.5 bg-background"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Return Date
              </Label>
              <Input
                type="date"
                value={details.umrahReturnDate}
                onChange={(e) =>
                  onDetailChange("umrahReturnDate", e.target.value)
                }
                className="h-8 text-xs px-1.5 bg-background"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Return Time
              </Label>
              <Input
                type="time"
                value={details.umrahReturnTime}
                onChange={(e) =>
                  onDetailChange("umrahReturnTime", e.target.value)
                }
                className="h-8 text-xs px-1.5 bg-background"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Transport
              </Label>
              <Select
                value={details.umrahTransport}
                onValueChange={(val) => onDetailChange("umrahTransport", val)}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UMRAH_TRANSPORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Makkah Hotel
              </Label>
              <Input
                value={details.makkahHotel}
                onChange={(e) => onDetailChange("makkahHotel", e.target.value)}
                placeholder="e.g. Pullman Zamzam"
                className="h-8 text-xs bg-background"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Makkah Nights
              </Label>
              <Input
                type="number"
                value={details.makkahNights}
                onChange={(e) => onDetailChange("makkahNights", e.target.value)}
                placeholder="7"
                className="h-8 text-xs font-mono bg-background"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Madinah Hotel
              </Label>
              <Input
                value={details.madinahHotel}
                onChange={(e) => onDetailChange("madinahHotel", e.target.value)}
                placeholder="e.g. Anwar Al Madinah"
                className="h-8 text-xs bg-background"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Madinah Nights
              </Label>
              <Input
                type="number"
                value={details.madinahNights}
                onChange={(e) =>
                  onDetailChange("madinahNights", e.target.value)
                }
                placeholder="7"
                className="h-8 text-xs font-mono bg-background"
              />
            </div>
          </div>
        </div>
      )}

      {/* C. VISA SERVICES */}
      {service === "Visa" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end pt-0.5">
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Country
            </Label>
            <Input
              value={details.visaCountry}
              onChange={(e) => onDetailChange("visaCountry", e.target.value)}
              placeholder="e.g. Saudi Arabia / UAE"
              className="h-8 text-xs bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Visa Type
            </Label>
            <Input
              value={details.visaType}
              onChange={(e) => onDetailChange("visaType", e.target.value)}
              placeholder="Tourist / E-Visa / 1 Year"
              className="h-8 text-xs bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Validity
            </Label>
            <Input
              value={details.visaValidity}
              onChange={(e) => onDetailChange("visaValidity", e.target.value)}
              placeholder="30 Days / 90 Days"
              className="h-8 text-xs bg-background"
            />
          </div>
        </div>
      )}

      {/* D. HOTEL BOOKING */}
      {service === "Hotel" && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end pt-0.5">
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Hotel Name
            </Label>
            <Input
              value={details.hotelName}
              onChange={(e) => onDetailChange("hotelName", e.target.value)}
              placeholder="Hotel Name"
              className="h-8 text-xs bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              City
            </Label>
            <Input
              value={details.hotelCity}
              onChange={(e) => onDetailChange("hotelCity", e.target.value)}
              placeholder="City"
              className="h-8 text-xs bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Check-In
            </Label>
            <Input
              type="date"
              value={details.hotelCheckIn}
              onChange={(e) => onDetailChange("hotelCheckIn", e.target.value)}
              className="h-8 text-xs px-2 bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Check-Out
            </Label>
            <Input
              type="date"
              value={details.hotelCheckOut}
              onChange={(e) => onDetailChange("hotelCheckOut", e.target.value)}
              className="h-8 text-xs px-2 bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Room Type
            </Label>
            <Input
              value={details.hotelRoomType}
              onChange={(e) => onDetailChange("hotelRoomType", e.target.value)}
              placeholder="Deluxe Double"
              className="h-8 text-xs bg-background"
            />
          </div>
        </div>
      )}

      {/* E. INSURANCE */}
      {service === "Insurance" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end pt-0.5">
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Insurance Provider / Plan
            </Label>
            <Input
              value={details.insurancePlan}
              onChange={(e) => onDetailChange("insurancePlan", e.target.value)}
              placeholder="EFU / Jubilee Travel Care"
              className="h-8 text-xs bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Duration (Days)
            </Label>
            <Input
              type="number"
              value={details.insuranceDuration}
              onChange={(e) =>
                onDetailChange("insuranceDuration", e.target.value)
              }
              placeholder="30"
              className="h-8 text-xs font-mono bg-background"
            />
          </div>
        </div>
      )}

      {/* F. OTHER SERVICE */}
      {service === "Other" && (
        <div className="space-y-1 pt-0.5">
          <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Service Description
          </Label>
          <Input
            value={details.generalDescription}
            onChange={(e) =>
              onDetailChange("generalDescription", e.target.value)
            }
            placeholder="Describe custom service particulars..."
            className="h-8 text-xs bg-background"
          />
        </div>
      )}
    </div>
  );
};

interface PassengersSectionProps {
  passengers: Passenger[];
  onChangePassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  requireFirstPassenger?: boolean;
  rightHeaderSlot?: React.ReactNode;
}

export const PassengersSection: React.FC<PassengersSectionProps> = ({
  passengers,
  onChangePassengers,
  requireFirstPassenger = false,
  rightHeaderSlot,
}) => {
  const paxListRef = useRef<HTMLDivElement>(null);
  const focusNewPaxRef = useRef(false);

  useEffect(() => {
    if (!focusNewPaxRef.current) return;
    focusNewPaxRef.current = false;
    const targetIdx = passengers.length - 1;
    const targetRow = paxListRef.current?.querySelector<HTMLInputElement>(
      `[data-pax-row="${targetIdx}"] input[data-pax-field="name"]`
    );
    if (targetRow) {
      targetRow.focus();
      targetRow.select();
    }
  }, [passengers.length]);

  const handlePassengerChange = (
    index: number,
    field: keyof Passenger,
    value: string
  ) => {
    onChangePassengers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddPassenger = () => {
    focusNewPaxRef.current = true;
    onChangePassengers((prev) => [...prev, createDefaultPassenger()]);
  };

  const handleRemovePassenger = (index: number) => {
    if (passengers.length <= 1) return;
    onChangePassengers((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div
      ref={paxListRef}
      className="space-y-1.5 pt-1 border-t"
      data-repeatable-group="passengers"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
            Passengers ({passengers.length})
          </span>
        </div>
        {rightHeaderSlot}
      </div>

      <div className="space-y-1">
        {passengers.map((pax, idx) => (
          <div key={idx} className="flex items-center gap-1.5" data-pax-row={idx}>
            <span className="text-[10px] font-mono font-bold text-slate-400 w-4 text-center">
              #{idx + 1}
            </span>
            <Input
              data-pax-field="name"
              value={pax.name}
              onChange={(e) =>
                handlePassengerChange(idx, "name", e.target.value)
              }
              placeholder="Passenger Name"
              data-required={requireFirstPassenger && idx === 0 ? "true" : undefined}
              data-required-message="Please select a Client or enter Passenger Name"
              className="h-7 text-xs flex-1 min-w-[130px] bg-background"
            />
            <Input
              data-pax-field="passport"
              value={pax.passport || ""}
              onChange={(e) =>
                handlePassengerChange(
                  idx,
                  "passport",
                  e.target.value.toUpperCase()
                )
              }
              placeholder="Passport #"
              className="h-7 text-xs w-28 uppercase font-mono bg-background"
            />
            <Select
              value={pax.type || "Adult"}
              onValueChange={(val) => handlePassengerChange(idx, "type", val)}
            >
              <SelectTrigger className="h-7 text-[11px] w-20 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PASSENGER_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={pax.gender || "Male"}
              onValueChange={(val) => handlePassengerChange(idx, "gender", val)}
            >
              <SelectTrigger className="h-7 text-[11px] w-16 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={pax.dob || ""}
              onChange={(e) => handlePassengerChange(idx, "dob", e.target.value)}
              data-pax-last-field="true"
              className="h-7 text-xs w-32 bg-background"
            />
            {passengers.length > 1 && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => handleRemovePassenger(idx)}
                className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                aria-label={`Remove Passenger ${idx + 1}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="pt-0.5 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          data-add-passenger-btn="true"
          onClick={handleAddPassenger}
          className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-0.5 px-1.5 py-0.5 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
        >
          <Plus className="w-3 h-3" /> Add Passenger
        </button>
        <span className="text-[10px] text-muted-foreground">
          Enter = next field · Ctrl+Enter = add passenger
        </span>
      </div>
    </div>
  );
};
