import { getTodayDateString } from "@/components/ui/LockedDateField";

export type ServiceType = "Ticket" | "Umrah" | "Visa" | "Insurance" | "Hotel" | "Other";
export type TripType = "One Way" | "Return" | "Multicity";
export type PassengerType = "Adult" | "Child" | "Infant";
export type GenderType = "Male" | "Female";
export type UmrahTransportType =
  | "Shared Bus"
  | "Private Car / GMC"
  | "Haramain High-Speed Train"
  | "Self Arranged";

export interface Passenger {
  name: string;
  passport: string;
  ticketNo?: string;
  type: PassengerType;
  gender: GenderType | "Other";
  dob: string;
  nationality?: string;
}

export interface FlightLeg {
  from: string;
  to: string;
  date: string;
  time: string;
  airline: string;
  pnr: string;
}

export interface ServiceDetailsState {
  // Air Ticket
  tripType: TripType;
  origin: string;
  destination: string;
  flightDate: string;
  flightTime: string;
  airline: string;
  pnr: string;
  ticketNo: string;
  returnDate: string;
  returnTime: string;
  multicityLegs: FlightLeg[];

  // Umrah Package
  ziyaratIncluded: boolean;
  umrahDepartureCity: string;
  umrahArrivalCity: string;
  umrahAirline: string;
  umrahFlightDate: string;
  umrahFlightTime: string;
  umrahReturnDate: string;
  umrahReturnTime: string;
  umrahTransport: string;
  makkahHotel: string;
  makkahNights: string;
  madinahHotel: string;
  madinahNights: string;

  // Visa
  visaCountry: string;
  visaType: string;
  visaValidity: string;

  // Insurance
  insurancePlan: string;
  insuranceDuration: string;

  // Hotel
  hotelName: string;
  hotelCity: string;
  hotelCheckIn: string;
  hotelCheckOut: string;
  hotelRoomType: string;

  // Other
  generalDescription: string;
}

/**
 * Single shared Service Type list used by both Booking Invoice and Quotations.
 */
export const SERVICE_TYPE_OPTIONS: ReadonlyArray<{ value: ServiceType; label: string }> = [
  { value: "Ticket", label: "Air Ticket" },
  { value: "Umrah", label: "Umrah Package" },
  { value: "Visa", label: "Visa Services" },
  { value: "Hotel", label: "Hotel Booking" },
  { value: "Insurance", label: "Travel Insurance" },
  { value: "Other", label: "Other Services" },
] as const;

export const TRIP_TYPE_OPTIONS: ReadonlyArray<{ value: TripType; label: string }> = [
  { value: "One Way", label: "One Way" },
  { value: "Return", label: "Return" },
  { value: "Multicity", label: "Multicity" },
] as const;

export const UMRAH_TRANSPORT_OPTIONS: ReadonlyArray<{ value: UmrahTransportType; label: string }> = [
  { value: "Shared Bus", label: "Shared Bus" },
  { value: "Private Car / GMC", label: "Private GMC" },
  { value: "Haramain High-Speed Train", label: "Haramain Train" },
  { value: "Self Arranged", label: "Self Arranged" },
] as const;

export const PASSENGER_TYPE_OPTIONS: ReadonlyArray<{ value: PassengerType; label: string }> = [
  { value: "Adult", label: "Adult" },
  { value: "Child", label: "Child" },
  { value: "Infant", label: "Infant" },
] as const;

export const GENDER_OPTIONS: ReadonlyArray<{ value: GenderType; label: string }> = [
  { value: "Male", label: "M" },
  { value: "Female", label: "F" },
] as const;

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  Ticket: "Air Ticket",
  Umrah: "Umrah Package",
  Visa: "Visa Services",
  Hotel: "Hotel Booking",
  Insurance: "Travel Insurance",
  Other: "Other Services",
  // Legacy quotation service_type keys preserved for previously saved records
  client_booking: "Client Booking",
  b2b: "B2B Service",
  umrah: "Umrah Package",
  custom: "Custom",
};

export function createDefaultFlightLeg(): FlightLeg {
  return { from: "", to: "", date: "", time: "", airline: "", pnr: "" };
}

export function createDefaultPassenger(): Passenger {
  return {
    name: "",
    passport: "",
    type: "Adult",
    gender: "Male",
    dob: "",
    nationality: "Pakistani",
  };
}

export function createDefaultServiceDetails(defaultDate?: string): ServiceDetailsState {
  const today = defaultDate || getTodayDateString();
  return {
    tripType: "One Way",
    origin: "KHI",
    destination: "DXB",
    flightDate: today,
    flightTime: "",
    airline: "",
    pnr: "",
    ticketNo: "",
    returnDate: "",
    returnTime: "",
    multicityLegs: [createDefaultFlightLeg()],

    ziyaratIncluded: true,
    umrahDepartureCity: "Karachi",
    umrahArrivalCity: "Jeddah",
    umrahAirline: "Saudia",
    umrahFlightDate: today,
    umrahFlightTime: "",
    umrahReturnDate: "",
    umrahReturnTime: "",
    umrahTransport: "Shared Bus",
    makkahHotel: "",
    makkahNights: "7",
    madinahHotel: "",
    madinahNights: "7",

    visaCountry: "Saudi Arabia",
    visaType: "Tourist / E-Visa",
    visaValidity: "30 Days",

    insurancePlan: "Standard Travel Care",
    insuranceDuration: "30",

    hotelName: "",
    hotelCity: "",
    hotelCheckIn: today,
    hotelCheckOut: "",
    hotelRoomType: "Standard Double",

    generalDescription: "",
  };
}

/**
 * Normalize legacy or query service strings into one of the canonical ServiceType values.
 */
export function normalizeServiceType(value?: string | null): ServiceType {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return "Ticket";
  if (raw === "ticket" || raw.includes("air ticket") || raw === "flight" || raw === "client_booking") {
    return "Ticket";
  }
  if (raw === "umrah" || raw.includes("umrah")) {
    return "Umrah";
  }
  if (raw === "visa" || raw.includes("visa")) {
    return "Visa";
  }
  if (raw === "hotel" || raw.includes("hotel")) {
    return "Hotel";
  }
  if (raw === "insurance" || raw.includes("insurance")) {
    return "Insurance";
  }
  if (raw === "other" || raw === "custom" || raw === "b2b") {
    return "Other";
  }
  return "Ticket";
}

export function getServiceDisplayLabel(serviceType?: string | null): string {
  if (!serviceType) return "Air Ticket";
  return SERVICE_TYPE_LABELS[serviceType] || serviceType;
}

/**
 * Build a concise, human-readable title derived from the selected Service Type and its details.
 * Used as the Quotation title across screen, PDF, and Quotations list.
 */
export function buildServiceTitle(
  serviceType: ServiceType,
  details: ServiceDetailsState
): string {
  const baseLabel = getServiceDisplayLabel(serviceType);

  switch (serviceType) {
    case "Ticket": {
      const sector =
        details.origin && details.destination
          ? `${details.origin} → ${details.destination}`
          : details.origin || details.destination;
      const parts = [sector, details.tripType, details.airline].filter(Boolean);
      return parts.length > 0 ? `${baseLabel} — ${parts.join(" · ")}` : baseLabel;
    }
    case "Umrah": {
      const route =
        details.umrahDepartureCity && details.umrahArrivalCity
          ? `${details.umrahDepartureCity} → ${details.umrahArrivalCity}`
          : "";
      const nightsParts: string[] = [];
      if (details.makkahHotel || details.makkahNights) {
        nightsParts.push(`Makkah ${details.makkahNights || 0}N`);
      }
      if (details.madinahHotel || details.madinahNights) {
        nightsParts.push(`Madinah ${details.madinahNights || 0}N`);
      }
      const extra = [route, nightsParts.join(" / ")].filter(Boolean).join(" · ");
      return extra ? `${baseLabel} — ${extra}` : baseLabel;
    }
    case "Visa": {
      const extra = [details.visaCountry, details.visaType].filter(Boolean).join(" · ");
      return extra ? `${baseLabel} — ${extra}` : baseLabel;
    }
    case "Hotel": {
      const extra = [details.hotelName, details.hotelCity].filter(Boolean).join(", ");
      return extra ? `${baseLabel} — ${extra}` : baseLabel;
    }
    case "Insurance": {
      const extra = [
        details.insurancePlan,
        details.insuranceDuration ? `${details.insuranceDuration} Days` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return extra ? `${baseLabel} — ${extra}` : baseLabel;
    }
    case "Other": {
      const trimmed = details.generalDescription.trim();
      return trimmed ? `${baseLabel} — ${trimmed.slice(0, 60)}` : baseLabel;
    }
    default:
      return baseLabel;
  }
}

/**
 * Build concise key-value summary lines of the selected service details for PDF & preview display.
 */
export function buildServiceSummaryLines(
  serviceType: ServiceType,
  details: ServiceDetailsState,
  passengers?: Passenger[]
): string[] {
  const lines: string[] = [];

  if (serviceType === "Ticket") {
    lines.push(
      `Trip: ${details.tripType}${
        details.origin || details.destination
          ? ` | Sector: ${details.origin || "—"} → ${details.destination || "—"}`
          : ""
      }${details.airline ? ` | Airline: ${details.airline}` : ""}`
    );
    if (details.flightDate) {
      lines.push(
        `Departure: ${details.flightDate}${details.flightTime ? ` at ${details.flightTime}` : ""}${
          details.tripType === "Return" && details.returnDate
            ? ` | Return: ${details.returnDate}${details.returnTime ? ` at ${details.returnTime}` : ""}`
            : ""
        }`
      );
    }
    if (details.tripType === "Multicity" && details.multicityLegs?.length) {
      details.multicityLegs.forEach((leg, i) => {
        if (leg.from || leg.to || leg.date) {
          lines.push(
            `Leg ${i + 1}: ${leg.from || "—"} → ${leg.to || "—"}${leg.date ? ` (${leg.date})` : ""}${
              leg.airline ? ` · ${leg.airline}` : ""
            }`
          );
        }
      });
    }
  } else if (serviceType === "Umrah") {
    lines.push(
      `Route: ${details.umrahDepartureCity || "—"} → ${details.umrahArrivalCity || "—"}${
        details.umrahAirline ? ` | Airline: ${details.umrahAirline}` : ""
      } | Transport: ${details.umrahTransport} | Ziyarat: ${details.ziyaratIncluded ? "Included" : "Excluded"}`
    );
    if (details.umrahFlightDate || details.umrahReturnDate) {
      lines.push(
        `Departure: ${details.umrahFlightDate || "—"}${details.umrahFlightTime ? ` ${details.umrahFlightTime}` : ""}${
          details.umrahReturnDate
            ? ` | Return: ${details.umrahReturnDate}${details.umrahReturnTime ? ` ${details.umrahReturnTime}` : ""}`
            : ""
        }`
      );
    }
    lines.push(
      `Makkah: ${details.makkahHotel || "—"} (${details.makkahNights || "0"} Nights) | Madinah: ${
        details.madinahHotel || "—"
      } (${details.madinahNights || "0"} Nights)`
    );
  } else if (serviceType === "Visa") {
    lines.push(
      `Country: ${details.visaCountry || "—"} | Type: ${details.visaType || "—"} | Validity: ${
        details.visaValidity || "—"
      }`
    );
  } else if (serviceType === "Hotel") {
    lines.push(
      `Hotel: ${details.hotelName || "—"}${details.hotelCity ? `, ${details.hotelCity}` : ""} | Room: ${
        details.hotelRoomType || "—"
      }`
    );
    if (details.hotelCheckIn || details.hotelCheckOut) {
      lines.push(
        `Check-In: ${details.hotelCheckIn || "—"} | Check-Out: ${details.hotelCheckOut || "—"}`
      );
    }
  } else if (serviceType === "Insurance") {
    lines.push(
      `Plan: ${details.insurancePlan || "—"} | Duration: ${details.insuranceDuration || "0"} Days`
    );
  } else if (serviceType === "Other" && details.generalDescription.trim()) {
    lines.push(details.generalDescription.trim());
  }

  const namedPassengers = (passengers || []).filter((p) => p.name.trim());
  if (namedPassengers.length > 0) {
    lines.push(
      `Passengers (${namedPassengers.length}): ${namedPassengers
        .map((p) => `${p.name.trim()}${p.passport ? ` (${p.passport})` : ""} [${p.type}]`)
        .join(", ")}`
    );
  }

  return lines;
}

/**
 * Format an ISO YYYY-MM-DD date string to dd/mm/yyyy for UI/PDF consistency.
 */
export function formatDateDmy(dateStr?: string | null): string {
  if (!dateStr) return "";
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return dateStr;
}

/**
 * Shared validation for service dates (Air Ticket Return/Multicity, Umrah, Hotel, Insurance)
 * and passenger rows (passport format, DOB bounds, type, gender). Returns an error string or null.
 */
export function validateServiceAndPassengers(
  serviceType: ServiceType,
  details: ServiceDetailsState,
  passengers: Passenger[]
): string | null {
  const today = getTodayDateString();

  if (serviceType === "Ticket") {
    if (
      details.tripType === "Return" &&
      details.returnDate &&
      details.flightDate &&
      details.returnDate < details.flightDate
    ) {
      return "Return flight date cannot be earlier than departure flight date.";
    }
    if (details.tripType === "Multicity" && Array.isArray(details.multicityLegs)) {
      for (let i = 0; i < details.multicityLegs.length; i += 1) {
        const leg = details.multicityLegs[i];
        if (leg.date && details.flightDate && leg.date < details.flightDate) {
          return `Multicity segment #${i + 1} date cannot be earlier than departure flight date.`;
        }
      }
    }
  } else if (serviceType === "Umrah") {
    if (
      details.umrahReturnDate &&
      details.umrahFlightDate &&
      details.umrahReturnDate < details.umrahFlightDate
    ) {
      return "Umrah return date cannot be earlier than departure date.";
    }
    const makkahN = details.makkahNights ? Number(details.makkahNights) : 0;
    const madinahN = details.madinahNights ? Number(details.madinahNights) : 0;
    if (Number.isNaN(makkahN) || makkahN < 0 || Number.isNaN(madinahN) || madinahN < 0) {
      return "Umrah hotel nights cannot be negative.";
    }
  } else if (serviceType === "Hotel") {
    if (
      details.hotelCheckOut &&
      details.hotelCheckIn &&
      details.hotelCheckOut < details.hotelCheckIn
    ) {
      return "Hotel check-out date cannot be earlier than check-in date.";
    }
  } else if (serviceType === "Insurance") {
    const dur = details.insuranceDuration ? Number(details.insuranceDuration) : 0;
    if (Number.isNaN(dur) || dur < 0) {
      return "Insurance duration cannot be negative.";
    }
  }

  for (let i = 0; i < passengers.length; i += 1) {
    const pax = passengers[i];
    const hasAny = Boolean(pax.name?.trim() || pax.passport?.trim() || pax.dob?.trim());
    if (!hasAny) continue;

    if (pax.passport?.trim() && !/^[A-Z0-9\-/]{3,20}$/i.test(pax.passport.trim())) {
      return `Passenger #${i + 1}: Passport # must be 3–20 alphanumeric characters.`;
    }
    if (pax.dob?.trim()) {
      const m = pax.dob.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) {
        return `Passenger #${i + 1}: Date of birth must be a valid date.`;
      }
      const parsed = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
      if (
        Number.isNaN(parsed.getTime()) ||
        pax.dob.trim() < "1900-01-01" ||
        pax.dob.trim() > today
      ) {
        return `Passenger #${i + 1}: Date of birth cannot be in the future.`;
      }
    }
    if (pax.type && !["Adult", "Child", "Infant"].includes(pax.type)) {
      return `Passenger #${i + 1}: Invalid passenger type.`;
    }
    if (pax.gender && !["Male", "Female"].includes(pax.gender)) {
      return `Passenger #${i + 1}: Invalid gender selection.`;
    }
  }

  return null;
}
