import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { formatPdfEditedNote } from "@/lib/documentEditHelpers";
import {
  getServiceDisplayLabel,
  normalizeServiceType,
} from "@/lib/serviceDefinitions";
import {
  DEFAULT_BRAND_COLOR,
  drawBrandLogo,
  drawPlaneIcon,
  ensureReadableOnWhite,
  formatBrandingContactParts,
  getContrastTextRgb,
  hexToRgb,
  resolveAgencyBrandingFromRecords,
  tintRgb,
  type AgencyBranding,
  type RgbTuple,
} from "@/lib/pdf/agencyBranding";
import { drawAirlineHeaderLogo } from "@/lib/pdf/airlineLogos";

export interface BookingPassengerInput {
  name: string;
  passport?: string;
  passport_number?: string;
  passportNo?: string;
  cnic?: string;
  ticketNo?: string;
  ticket_number?: string;
  type?: string;
  gender?: string;
  dob?: string;
  nationality?: string;
  meal?: string;
  meal_plan?: string;
  mealPreference?: string;
  baggage?: string;
  baggage_allowance?: string;
  status?: string;
}

export interface BookingPdfData {
  invoiceNo: string;
  bookingRef?: string;
  invoiceDate: string;
  service: string;
  clientName: string;
  clientPhone?: string;
  clientAddress?: string;
  pnr?: string;
  ticketNo?: string;
  passportNo?: string;
  passengers?: BookingPassengerInput[];
  moreDetails?: Record<string, any> | null;
  paymentStatus?: string;
  isVoid?: boolean;
  clientAmount: number;
  paidAmount: number;
  balanceDue: number;
  currency?: string;
  notes?: string;
  isEdited?: boolean;
  lastEditedAt?: string | null;
  branding?: AgencyBranding;
  agency?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    logo?: string | null;
    brandColor?: string;
  };
}

export interface FlightLegCard {
  index: number;
  origin: string;
  destination: string;
  airline: string;
  flightNo: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  baggage: string;
  pnr: string;
}

const TEXT_DARK: RgbTuple = [15, 23, 42];
const TEXT_BODY: RgbTuple = [30, 41, 59];
const TEXT_MUTED: RgbTuple = [100, 116, 139];
const BORDER_LIGHT: RgbTuple = [226, 232, 240];
const ROW_ALT: RgbTuple = [248, 250, 252];

function cleanStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function isNonEmptyDisplay(val: unknown): boolean {
  const s = cleanStr(val);
  return Boolean(s && s !== "-" && s !== "—" && s.toLowerCase() !== "n/a");
}

function formatHumanDate(raw?: string | null): string {
  const s = cleanStr(raw);
  if (!s) return "";
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    try {
      const dt = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
      if (!Number.isNaN(dt.getTime())) {
        return format(dt, "dd MMM yyyy");
      }
    } catch {
      return s;
    }
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return format(parsed, "dd MMM yyyy");
  }
  return s;
}

function formatTimeDisplay(raw?: string | null): string {
  const s = cleanStr(raw);
  if (!s) return "";
  const match = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2]}`;
  }
  return s;
}

function computeNightDiff(checkIn?: string | null, checkOut?: string | null): number | null {
  const inMatch = cleanStr(checkIn).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const outMatch = cleanStr(checkOut).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!inMatch || !outMatch) return null;
  const inUtc = Date.UTC(Number(inMatch[1]), Number(inMatch[2]) - 1, Number(inMatch[3]));
  const outUtc = Date.UTC(Number(outMatch[1]), Number(outMatch[2]) - 1, Number(outMatch[3]));
  const diff = Math.round((outUtc - inUtc) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

function resolveEffectiveBranding(data: BookingPdfData): AgencyBranding {
  if (data.branding) {
    return data.branding;
  }
  if (data.agency) {
    return resolveAgencyBrandingFromRecords({
      signupAgencyName: data.agency.name || null,
      invoiceTemplate: {
        agencyName: data.agency.name,
        phone: data.agency.phone,
        email: data.agency.email,
        address: data.agency.address,
        logo: data.agency.logo,
        themeColor: data.agency.brandColor || DEFAULT_BRAND_COLOR,
      },
    });
  }
  return resolveAgencyBrandingFromRecords({});
}

export function buildBookingPdfDataFromInvoice(
  inv: any,
  branding: AgencyBranding
): BookingPdfData {
  const clientAmount = Number(inv?.client_amount) || 0;
  const paidAmount = Number(inv?.paid_amount) || 0;
  const balanceDue =
    inv?.remaining_amount !== undefined && inv?.remaining_amount !== null
      ? Number(inv.remaining_amount) || 0
      : Math.max(0, clientAmount - paidAmount);

  return {
    invoiceNo: cleanStr(inv?.invoice_no || inv?.invoice_number || inv?.booking_ref),
    bookingRef: cleanStr(inv?.booking_ref || inv?.invoice_no || inv?.invoice_number),
    invoiceDate: cleanStr(inv?.invoice_date || inv?.created_at),
    service: cleanStr(inv?.service || inv?.travel_type || "Ticket"),
    clientName:
      cleanStr(inv?.party?.name || inv?.client_name || inv?.more_details?.client_name) ||
      "Traveler",
    clientPhone: cleanStr(inv?.party?.phone || inv?.contact_number) || undefined,
    clientAddress: cleanStr(inv?.party?.address || inv?.party?.city) || undefined,
    pnr: cleanStr(inv?.pnr || inv?.more_details?.pnr) || undefined,
    ticketNo: cleanStr(inv?.ticket_no || inv?.more_details?.ticket_no) || undefined,
    passportNo: cleanStr(inv?.passport_no) || undefined,
    passengers: Array.isArray(inv?.passengers)
      ? inv.passengers
      : Array.isArray(inv?.passengers_data)
        ? inv.passengers_data
        : [],
    moreDetails:
      inv?.more_details && typeof inv.more_details === "object"
        ? inv.more_details
        : null,
    paymentStatus: cleanStr(inv?.payment_status) || undefined,
    isVoid: Boolean(inv?.is_void),
    clientAmount,
    paidAmount,
    balanceDue,
    currency: cleanStr(inv?.currency) || "PKR",
    notes: cleanStr(inv?.notes) || undefined,
    isEdited: Boolean(inv?.is_edited),
    lastEditedAt: inv?.last_edited_at || null,
    branding,
  };
}

export function extractBookingConfirmationTitle(service?: string | null): string {
  const raw = cleanStr(service);
  const norm = normalizeServiceType(raw);
  switch (norm) {
    case "Ticket":
      return "ELECTRONIC TICKET";
    case "Umrah":
      return "UMRAH BOOKING";
    case "Insurance":
      return "TRAVEL INSURANCE";
    case "Hotel":
      return "HOTEL BOOKING";
    case "Visa":
      return "VISA BOOKING";
    case "Other": {
      const upper = raw.toUpperCase();
      if (upper && upper !== "OTHER" && upper !== "OTHER SERVICES" && upper !== "CUSTOM") {
        return upper.includes("BOOKING") ? upper : `${upper} BOOKING`;
      }
      return "BOOKING CONFIRMATION";
    }
    default:
      return "BOOKING CONFIRMATION";
  }
}

export function extractUserRemarks(rawNotes?: string | null): string {
  const text = cleanStr(rawNotes);
  if (!text) return "";
  const lines = text.split("\n");
  const remarksIdx = lines.findIndex((line) => /^Remarks:\s*/i.test(line.trim()));
  if (remarksIdx !== -1) {
    return lines
      .slice(remarksIdx)
      .join("\n")
      .replace(/^Remarks:\s*/i, "")
      .trim();
  }
  const filtered = lines.filter(
    (line) =>
      !/^\[(Air Ticket|Umrah Package|Visa|Hotel|Insurance|Other Service)/i.test(
        line.trim()
      )
  );
  return filtered.join("\n").trim();
}

function parseLegacyTicketNotes(notes?: string | null): Partial<{
  tripType: string;
  origin: string;
  destination: string;
  flightDate: string;
  flightTime: string;
  pnr: string;
  airline: string;
}> {
  const text = cleanStr(notes);
  if (!text) return {};
  const match = text.match(
    /\[Air Ticket\s*-\s*([^\]]+)\]\s*([^->|\s]+)\s*->\s*([^|\s]+)(?:\s*\|\s*Date:\s*([0-9-]*)\s*([0-9:]*))?(?:\s*\|\s*PNR:\s*([^|]*))?(?:\s*\|\s*Airline:\s*(.*))?/i
  );
  if (!match) return {};
  return {
    tripType: cleanStr(match[1]),
    origin: cleanStr(match[2]).toUpperCase(),
    destination: cleanStr(match[3]).toUpperCase(),
    flightDate: cleanStr(match[4]),
    flightTime: cleanStr(match[5]),
    pnr: cleanStr(match[6]),
    airline: cleanStr(match[7]),
  };
}

export function extractFlightLegs(data: BookingPdfData): FlightLegCard[] {
  const md = data.moreDetails && typeof data.moreDetails === "object" ? data.moreDetails : {};
  const normService = normalizeServiceType(data.service);
  const fallbackFromNotes = parseLegacyTicketNotes(data.notes);
  const defaultPnr = cleanStr(data.pnr || md.pnr || fallbackFromNotes.pnr);
  const defaultBaggage = cleanStr(
    md.baggage ||
      md.baggage_allowance ||
      (data.passengers || []).find((p) => isNonEmptyDisplay(p?.baggage || p?.baggage_allowance))
        ?.baggage ||
      (data.passengers || []).find((p) => isNonEmptyDisplay(p?.baggage_allowance))
        ?.baggage_allowance
  );

  if (normService === "Umrah") {
    const depCity = cleanStr(md.umrah_departure_city || md.departure_city || md.origin);
    const arrCity = cleanStr(md.umrah_arrival_city || md.arrival_city || md.destination);
    const umrahAirline = cleanStr(md.umrah_airline || md.airline);
    const depDate = cleanStr(md.umrah_flight_date || md.flight_date);
    const depTime = cleanStr(md.umrah_flight_time || md.flight_time);
    const retDate = cleanStr(md.umrah_return_date || md.return_date);
    const retTime = cleanStr(md.umrah_return_time || md.return_time);
    const flightNo = cleanStr(md.flight_number || md.flight_no);

    if (!depCity && !arrCity && !depDate && !umrahAirline && !retDate) {
      return [];
    }

    const legs: FlightLegCard[] = [
      {
        index: 1,
        origin: depCity.toUpperCase() || "DEPARTURE",
        destination: arrCity.toUpperCase() || "ARRIVAL",
        airline: umrahAirline,
        flightNo,
        departureDate: depDate,
        departureTime: depTime,
        arrivalDate: cleanStr(md.umrah_arrival_date || md.arrival_date),
        arrivalTime: cleanStr(md.umrah_arrival_time || md.arrival_time),
        baggage: defaultBaggage,
        pnr: defaultPnr,
      },
    ];

    if (retDate || retTime) {
      legs.push({
        index: 2,
        origin: arrCity.toUpperCase() || "DEPARTURE",
        destination: depCity.toUpperCase() || "RETURN",
        airline: cleanStr(md.umrah_return_airline) || umrahAirline,
        flightNo: cleanStr(md.return_flight_number || md.return_flight_no),
        departureDate: retDate,
        departureTime: retTime,
        arrivalDate: cleanStr(md.return_arrival_date),
        arrivalTime: cleanStr(md.return_arrival_time),
        baggage: cleanStr(md.return_baggage) || defaultBaggage,
        pnr: defaultPnr,
      });
    }
    return legs;
  }

  if (normService !== "Ticket") {
    return [];
  }

  const tripType = cleanStr(md.trip_type || fallbackFromNotes.tripType || "One Way");
  const rawLegs = Array.isArray(md.multicity_legs)
    ? md.multicity_legs
    : Array.isArray(md.multicityLegs)
      ? md.multicityLegs
      : [];
  const validMultiLegs = rawLegs.filter(
    (leg: any) =>
      leg &&
      (cleanStr(leg.from || leg.origin || leg.departure_city) ||
        cleanStr(leg.to || leg.destination || leg.arrival_city) ||
        cleanStr(leg.date || leg.flight_date || leg.departure_date) ||
        cleanStr(leg.airline) ||
        cleanStr(leg.pnr || leg.flight_number))
  );

  if (tripType.toLowerCase() === "multicity" && validMultiLegs.length > 0) {
    return validMultiLegs.map((leg: any, idx: number) => ({
      index: idx + 1,
      origin: cleanStr(leg.from || leg.origin || leg.departure_city).toUpperCase(),
      destination: cleanStr(leg.to || leg.destination || leg.arrival_city).toUpperCase(),
      airline: cleanStr(leg.airline || md.airline),
      flightNo: cleanStr(leg.flight_number || leg.flight_no || leg.flightNumber),
      departureDate: cleanStr(leg.date || leg.flight_date || leg.departure_date),
      departureTime: cleanStr(leg.time || leg.flight_time || leg.departure_time),
      arrivalDate: cleanStr(leg.arrival_date),
      arrivalTime: cleanStr(leg.arrival_time),
      baggage: cleanStr(leg.baggage) || defaultBaggage,
      pnr: cleanStr(leg.pnr) || defaultPnr,
    }));
  }

  const origin = cleanStr(md.origin || fallbackFromNotes.origin).toUpperCase();
  const destination = cleanStr(
    md.destination || fallbackFromNotes.destination
  ).toUpperCase();
  const airline = cleanStr(md.airline || fallbackFromNotes.airline);
  const flightNo = cleanStr(md.flight_number || md.flight_no || md.flightNumber);
  const flightDate = cleanStr(md.flight_date || fallbackFromNotes.flightDate);
  const flightTime = cleanStr(md.flight_time || fallbackFromNotes.flightTime);
  const returnDate = cleanStr(md.return_date);
  const returnTime = cleanStr(md.return_time);

  if (!origin && !destination && !flightDate && !airline) {
    return [];
  }

  const legs: FlightLegCard[] = [
    {
      index: 1,
      origin,
      destination,
      airline,
      flightNo,
      departureDate: flightDate,
      departureTime: flightTime,
      arrivalDate: cleanStr(md.arrival_date),
      arrivalTime: cleanStr(md.arrival_time),
      baggage: defaultBaggage,
      pnr: defaultPnr,
    },
  ];

  const isReturn =
    tripType.toLowerCase() === "return" || Boolean(returnDate || returnTime);
  if (isReturn && (origin || destination || returnDate || returnTime)) {
    legs.push({
      index: 2,
      origin: destination,
      destination: origin,
      airline: cleanStr(md.return_airline) || airline,
      flightNo: cleanStr(md.return_flight_number || md.return_flight_no),
      departureDate: returnDate,
      departureTime: returnTime,
      arrivalDate: cleanStr(md.return_arrival_date),
      arrivalTime: cleanStr(md.return_arrival_time),
      baggage: cleanStr(md.return_baggage) || defaultBaggage,
      pnr: defaultPnr,
    });
  }

  return legs;
}

function resolveBookingStatusLabel(data: BookingPdfData): string {
  const raw = cleanStr(data.paymentStatus).toLowerCase();
  if (data.isVoid || raw === "void") return "Voided";
  if (raw === "cancelled") return "Cancelled";
  if (raw === "refunded") return "Refunded";
  return "Confirmed";
}

function drawFlightCards(
  doc: jsPDF,
  legs: FlightLegCard[],
  startY: number,
  primaryRgb: RgbTuple,
  readablePrimary: RgbTuple,
  softTint: RgbTuple
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const cardW = pageWidth - marginX * 2;
  const bottomLimit = pageHeight - 26;
  let y = startY;

  if (y + 38 > bottomLimit) {
    doc.addPage();
    y = 14;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...readablePrimary);
  doc.text("FLIGHT DETAILS", marginX, y);
  y += 4;

  for (const leg of legs) {
    const cardH = 30;
    if (y + cardH > bottomLimit) {
      doc.addPage();
      y = 14;
    }

    // Outer rounded card
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...BORDER_LIGHT);
    doc.setLineWidth(0.4);
    doc.roundedRect(marginX, y, cardW, cardH, 2.2, 2.2, "FD");

    // Top header strip
    const headerH = 7.5;
    doc.setFillColor(...softTint);
    doc.roundedRect(marginX, y, cardW, headerH, 2.2, 2.2, "F");
    doc.rect(marginX, y + headerH - 2.2, cardW, 2.2, "F");
    doc.setDrawColor(...BORDER_LIGHT);
    doc.line(marginX, y + headerH, marginX + cardW, y + headerH);

    // Left header: Flight - N ORIGIN TO DESTINATION
    const routeLabel =
      leg.origin && leg.destination
        ? `${leg.origin} TO ${leg.destination}`
        : leg.origin || leg.destination || "ITINERARY";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...readablePrimary);
    doc.text(`Flight - ${leg.index}   ${routeLabel}`, marginX + 4, y + 5.1);

    // Right header: Airline / Flight # / Baggage
    const rightHeaderParts = [
      leg.airline,
      leg.flightNo ? `Flight ${leg.flightNo}` : "",
      leg.baggage ? `Baggage: ${leg.baggage}` : "",
    ].filter(Boolean);
    if (rightHeaderParts.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(...TEXT_BODY);
      doc.text(rightHeaderParts.join("  •  "), marginX + cardW - 4, y + 5.1, {
        align: "right",
      });
    }

    const bodyTop = y + headerH;
    const bodyCenterY = bodyTop + (cardH - headerH) / 2;

    // Left: Departure (Time, City, Date)
    const depX = marginX + 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("DEPARTURE", depX, bodyTop + 4.3);

    const depPrimary = formatTimeDisplay(leg.departureTime) || leg.origin || "Scheduled";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_DARK);
    doc.text(depPrimary, depX, bodyTop + 10.2);

    const depSubParts: string[] = [];
    if (formatTimeDisplay(leg.departureTime) && leg.origin) {
      depSubParts.push(leg.origin);
    }
    const depDateFmt = formatHumanDate(leg.departureDate);
    if (depDateFmt) {
      depSubParts.push(depDateFmt);
    }
    if (depSubParts.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(...TEXT_BODY);
      doc.text(depSubParts.join("  •  "), depX, bodyTop + 15.6);
    }

    // Center: Dashed route line + vector airplane icon + optional flight/PNR tag
    const centerX = pageWidth / 2;
    const lineLeft = centerX - 24;
    const lineRight = centerX + 24;
    doc.setDrawColor(...primaryRgb);
    doc.setLineWidth(0.35);
    doc.line(lineLeft, bodyCenterY - 0.5, centerX - 6.5, bodyCenterY - 0.5);
    doc.line(centerX + 6.5, bodyCenterY - 0.5, lineRight, bodyCenterY - 0.5);
    doc.setFillColor(...primaryRgb);
    doc.circle(lineLeft, bodyCenterY - 0.5, 0.9, "F");
    doc.circle(lineRight, bodyCenterY - 0.5, 0.9, "F");

    drawPlaneIcon(doc, centerX, bodyCenterY - 0.5, 7.5, primaryRgb);

    const midMeta = [
      leg.flightNo ? `#${leg.flightNo}` : "",
      leg.pnr ? `PNR: ${leg.pnr}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    if (midMeta) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(midMeta, centerX, bodyCenterY + 6.4, { align: "center" });
    }

    // Right: Arrival (Time, City, Date)
    const arrX = marginX + cardW - 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("ARRIVAL", arrX, bodyTop + 4.3, { align: "right" });

    const arrTimeFmt = formatTimeDisplay(leg.arrivalTime);
    const arrPrimary = arrTimeFmt || leg.destination || "Confirmed";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_DARK);
    doc.text(arrPrimary, arrX, bodyTop + 10.2, { align: "right" });

    const arrSubParts: string[] = [];
    if (arrTimeFmt && leg.destination) {
      arrSubParts.push(leg.destination);
    }
    const arrDateFmt = formatHumanDate(leg.arrivalDate);
    if (arrDateFmt) {
      arrSubParts.push(arrDateFmt);
    }
    if (arrSubParts.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(...TEXT_BODY);
      doc.text(arrSubParts.join("  •  "), arrX, bodyTop + 15.6, { align: "right" });
    }

    y += cardH + 4;
  }

  return y;
}

function buildServiceDetailRows(
  data: BookingPdfData,
  statusLabel: string
): { sectionTitle: string; rows: Array<[string, string]> } {
  const normService = normalizeServiceType(data.service);
  const md = data.moreDetails && typeof data.moreDetails === "object" ? data.moreDetails : {};
  const customService = (data.passengers?.[0] as any)?.custom_service;
  const rows: Array<[string, string]> = [];

  const pushIf = (label: string, val?: unknown) => {
    if (isNonEmptyDisplay(val)) {
      rows.push([label, cleanStr(val)]);
    }
  };

  if (normService === "Umrah") {
    pushIf("Package", md.package_name || md.package);
    const makkahHotel = cleanStr(md.makkah_hotel);
    const makkahNights = cleanStr(md.makkah_nights);
    if (makkahHotel && makkahNights) {
      rows.push(["Makkah Hotel", `${makkahHotel} (${makkahNights} Nights)`]);
    } else if (makkahHotel) {
      rows.push(["Makkah Hotel", makkahHotel]);
    } else if (makkahNights) {
      rows.push(["Makkah Nights", `${makkahNights} Nights`]);
    }

    const madinahHotel = cleanStr(md.madinah_hotel);
    const madinahNights = cleanStr(md.madinah_nights);
    if (madinahHotel && madinahNights) {
      rows.push(["Madinah Hotel", `${madinahHotel} (${madinahNights} Nights)`]);
    } else if (madinahHotel) {
      rows.push(["Madinah Hotel", madinahHotel]);
    } else if (madinahNights) {
      rows.push(["Madinah Nights", `${madinahNights} Nights`]);
    }

    const computedNights =
      (Number(makkahNights) || 0) + (Number(madinahNights) || 0);
    if (isNonEmptyDisplay(md.nights)) {
      pushIf("Total Nights", `${cleanStr(md.nights)} Nights`);
    } else if (computedNights > 0 && (makkahNights || madinahNights)) {
      rows.push(["Total Nights", `${computedNights} Nights`]);
    }

    pushIf("Visa Status", md.visa_status || (md.visa_included ? "Included" : ""));
    pushIf("Transport", md.umrah_transport || md.transport_details);
    if (typeof md.ziyarat_included === "boolean") {
      rows.push(["Ziyarat", md.ziyarat_included ? "Included" : "Excluded"]);
    }
    pushIf("Room Type", md.room_type);
    pushIf("Meal Plan", md.meal_plan);
    pushIf("Confirmation Code", md.hotel_confirmation_code);

    return { sectionTitle: "UMRAH PACKAGE DETAILS", rows };
  }

  if (normService === "Insurance") {
    pushIf("Insurance Plan", md.insurance_plan || md.plan_name);
    const covStart = formatHumanDate(md.coverage_start || md.start_date || customService?.start_date);
    const covEnd = formatHumanDate(md.coverage_end || md.end_date || customService?.end_date);
    const durDays = cleanStr(md.insurance_duration || md.duration);
    if (covStart && covEnd) {
      rows.push([
        "Coverage Period",
        `${covStart} to ${covEnd}${durDays ? ` (${durDays} Days)` : ""}`,
      ]);
    } else if (isNonEmptyDisplay(md.coverage_period)) {
      rows.push(["Coverage Period", cleanStr(md.coverage_period)]);
    } else if (durDays) {
      rows.push(["Coverage Period", `${durDays} Days`]);
    }
    pushIf("Policy No", md.policy_no || md.policy_number || data.ticketNo || data.pnr || customService?.reference);
    pushIf("Destination", md.destination || md.country || customService?.location);
    return { sectionTitle: "TRAVEL INSURANCE DETAILS", rows };
  }

  if (normService === "Hotel") {
    pushIf("Hotel", md.hotel_name || md.hotel);
    pushIf("City", md.hotel_city || md.city || customService?.location);
    const checkInRaw = cleanStr(md.hotel_check_in || md.check_in);
    const checkOutRaw = cleanStr(md.hotel_check_out || md.check_out);
    const checkInFmt = formatHumanDate(checkInRaw);
    const checkOutFmt = formatHumanDate(checkOutRaw);
    const computedNights = computeNightDiff(checkInRaw, checkOutRaw);
    if (checkInFmt) {
      rows.push(["Check-In", checkInFmt]);
    }
    if (checkOutFmt) {
      rows.push([
        "Check-Out",
        computedNights !== null ? `${checkOutFmt} (${computedNights} Night${computedNights === 1 ? "" : "s"})` : checkOutFmt,
      ]);
    }
    pushIf("Room Type", md.hotel_room_type || md.room_type);
    const guestCount =
      cleanStr(md.guests) ||
      (Array.isArray(data.passengers) && data.passengers.some((p) => cleanStr(p?.name))
        ? `${data.passengers.filter((p) => cleanStr(p?.name)).length} Guest${
            data.passengers.filter((p) => cleanStr(p?.name)).length === 1 ? "" : "s"
          }`
        : "");
    pushIf("Guests", guestCount);
    pushIf("Confirmation #", md.hotel_confirmation_code || data.pnr || customService?.reference);
    return { sectionTitle: "HOTEL BOOKING DETAILS", rows };
  }

  if (normService === "Visa") {
    pushIf("Country", md.visa_country || md.country || customService?.location);
    pushIf("Visa Type", md.visa_type);
    pushIf("Validity", md.visa_validity || md.validity);
    pushIf("Status", md.visa_status || statusLabel);
    pushIf("Reference #", md.reference || data.pnr || customService?.reference);
    return { sectionTitle: "VISA DETAILS", rows };
  }

  // Other / Custom Service
  pushIf("Description", md.general_description || md.description || customService?.description);
  pushIf("Location", md.location || customService?.location);
  pushIf("Start Date", formatHumanDate(md.start_date || customService?.start_date));
  pushIf("End Date", formatHumanDate(md.end_date || customService?.end_date));
  pushIf("Reference", md.reference || customService?.reference || data.pnr);

  const skipKeys = new Set([
    "remaining_due_date",
    "due_date",
    "selected_bank",
    "client_name",
    "trip_type",
    "general_description",
    "description",
    "location",
    "start_date",
    "end_date",
    "reference",
    "pnr",
    "ticket_no",
    "multicity_legs",
    "multicityLegs",
  ]);
  for (const [key, val] of Object.entries(md)) {
    if (skipKeys.has(key)) continue;
    if (typeof val === "object" && val !== null) continue;
    if (!isNonEmptyDisplay(val)) continue;
    const prettyLabel = key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    rows.push([prettyLabel, cleanStr(val)]);
  }

  return { sectionTitle: "SERVICE DETAILS", rows };
}

// 1. BOOKING CONFIRMATION PDF (PIA E-Ticket Style — Multi-Page & Service-Aware)
export function buildBookingConfirmationPdfDoc(data: BookingPdfData): jsPDF {
  const branding = resolveEffectiveBranding(data);
  const primaryRgb = hexToRgb(branding.brandColor);
  const readablePrimary = ensureReadableOnWhite(primaryRgb);
  const contrastOnPrimary = getContrastTextRgb(primaryRgb);
  const softTint = tintRgb(primaryRgb, 0.92);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentW = pageWidth - marginX * 2;
  const normService = normalizeServiceType(data.service);
  const statusLabel = resolveBookingStatusLabel(data);
  const legs = extractFlightLegs(data);

  const drawTopBar = () => {
    doc.setFillColor(...primaryRgb);
    doc.rect(0, 0, pageWidth, 2.5, "F");
  };

  drawTopBar();

  // -------------------------------------------------------------------------
  // TOP HEADER: Left (Title + PNR) | Center (Logo + Agency Name) | Right (Airline Logo for Tickets)
  // -------------------------------------------------------------------------
  const docTitle = extractBookingConfirmationTitle(data.service);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...readablePrimary);
  const titleLines = doc.splitTextToSize(docTitle, 56).slice(0, 2);
  doc.text(titleLines, marginX, 11.5);

  const effectivePnr = cleanStr(data.pnr || data.moreDetails?.pnr || legs[0]?.pnr);
  if (effectivePnr) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT_DARK);
    doc.text(`PNR: ${effectivePnr.toUpperCase()}`, marginX, titleLines.length > 1 ? 21 : 17.5);
  }

  // Center Top: Bold Agency Name FIRST, with Uploaded Agency Logo JUST BELOW IT
  const centerX = pageWidth / 2;
  const agencyNameY = 10.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...TEXT_DARK);
  const agencyLines = doc
    .splitTextToSize(branding.agencyName.toUpperCase(), 68)
    .slice(0, 2);
  doc.text(agencyLines, centerX, agencyNameY, { align: "center" });

  const logoTopY = agencyNameY + (agencyLines.length - 1) * 4.6 + 2.2;
  const logoResult = branding.logo
    ? drawBrandLogo(doc, branding.logo, centerX - 22, logoTopY, 44, 15, "center")
    : { rendered: false, width: 0, height: 0 };

  // Right Top: Airline Name text only (Tickets only — no airline logo box)
  if (normService === "Ticket") {
    const primaryAirline = cleanStr(
      legs[0]?.airline || data.moreDetails?.airline
    );
    const primaryFlightNo = cleanStr(
      legs[0]?.flightNo || data.moreDetails?.flight_number || data.moreDetails?.flight_no
    );
    drawAirlineHeaderLogo(doc, primaryAirline, primaryFlightNo, pageWidth - marginX, 6, 48, 17);
  }

  // -------------------------------------------------------------------------
  // INFO BOX (Colored Rounded Bar — ONLY 4 allowed fields)
  // -------------------------------------------------------------------------
  const headerBottomY = logoResult.rendered
    ? logoTopY + logoResult.height + 3.5
    : agencyNameY + (agencyLines.length - 1) * 4.6 + 5;
  let y = Math.max(29, headerBottomY);
  const boxH = 16.5;

  doc.setFillColor(...primaryRgb);
  doc.roundedRect(marginX, y, contentW, boxH, 2.5, 2.5, "F");

  const bookingRefValue =
    cleanStr(data.bookingRef || data.invoiceNo || effectivePnr) || "Confirmed";
  const issueDateValue = formatHumanDate(data.invoiceDate) || format(new Date(), "dd MMM yyyy");
  const serviceTypeValue =
    normService === "Other" && isNonEmptyDisplay(data.service) && data.service.toLowerCase() !== "other"
      ? cleanStr(data.service)
      : getServiceDisplayLabel(normService);

  const infoColumns = [
    { label: "TRAVELER / CONTACT", value: cleanStr(data.clientName) || "Traveler", width: 54 },
    { label: "BOOKING REFERENCE", value: bookingRefValue, width: 44 },
    { label: "ISSUE DATE", value: issueDateValue, width: 38 },
    { label: "SERVICE TYPE", value: serviceTypeValue, width: contentW - 136 },
  ];

  let colX = marginX;
  infoColumns.forEach((col, idx) => {
    if (idx > 0) {
      doc.setDrawColor(...tintRgb(primaryRgb, 0.35));
      doc.setLineWidth(0.25);
      doc.line(colX, y + 3, colX, y + boxH - 3);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.6);
    doc.setTextColor(...contrastOnPrimary);
    doc.text(col.label, colX + 3.5, y + 5.8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const valLines = doc.splitTextToSize(col.value, col.width - 7).slice(0, 1);
    doc.text(valLines, colX + 3.5, y + 12.2);

    colX += col.width;
  });

  y += boxH + 8;

  // -------------------------------------------------------------------------
  // PASSENGER TABLE (Group-safe, Unlimited Rows, Dynamic Column Hiding)
  // -------------------------------------------------------------------------
  const rawPassengers: BookingPassengerInput[] =
    Array.isArray(data.passengers) && data.passengers.length > 0
      ? data.passengers.filter(
          (p) =>
            p &&
            (isNonEmptyDisplay(p.name) ||
              isNonEmptyDisplay(p.passport) ||
              isNonEmptyDisplay(p.passport_number) ||
              isNonEmptyDisplay(p.passportNo) ||
              isNonEmptyDisplay(p.cnic))
        )
      : [];

  const normalizedPax =
    rawPassengers.length > 0
      ? rawPassengers.map((p, idx) => ({
          sr: idx + 1,
          name: cleanStr(p.name) || cleanStr(data.clientName) || `Passenger ${idx + 1}`,
          passport: cleanStr(p.passport || p.passport_number || p.passportNo || p.cnic),
          meal: cleanStr(p.meal || p.meal_plan || p.mealPreference),
          baggage: cleanStr(p.baggage || p.baggage_allowance),
          status: cleanStr(p.status) || statusLabel,
        }))
      : [
          {
            sr: 1,
            name: cleanStr(data.clientName) || "Traveler",
            passport: isNonEmptyDisplay(data.passportNo) ? cleanStr(data.passportNo) : "",
            meal: "",
            baggage: "",
            status: statusLabel,
          },
        ];

  const hasPassport = normalizedPax.some((p) => isNonEmptyDisplay(p.passport));
  const hasMeal = normalizedPax.some((p) => isNonEmptyDisplay(p.meal));
  const hasBaggage = normalizedPax.some((p) => isNonEmptyDisplay(p.baggage));
  const hasStatus = normalizedPax.some((p) => isNonEmptyDisplay(p.status));

  const tableCols: Array<{
    key: "sr" | "name" | "passport" | "meal" | "baggage" | "status";
    header: string;
    halign?: "left" | "center" | "right";
    cellWidth?: number;
  }> = [
    { key: "sr", header: "Sr #", halign: "center", cellWidth: 13 },
    { key: "name", header: "Passenger Name", halign: "left" },
  ];
  if (hasPassport) tableCols.push({ key: "passport", header: "Passport", halign: "left", cellWidth: 34 });
  if (hasMeal) tableCols.push({ key: "meal", header: "Meal", halign: "left", cellWidth: 26 });
  if (hasBaggage) tableCols.push({ key: "baggage", header: "Baggage", halign: "left", cellWidth: 26 });
  if (hasStatus) tableCols.push({ key: "status", header: "Status", halign: "center", cellWidth: 26 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...readablePrimary);
  doc.text(
    normalizedPax.length > 1
      ? `PASSENGER DETAILS (${normalizedPax.length})`
      : "PASSENGER DETAILS",
    marginX,
    y
  );
  y += 3;

  const statusColIndex = tableCols.findIndex((c) => c.key === "status");
  const columnStyles: Record<number, any> = {};
  tableCols.forEach((col, idx) => {
    columnStyles[idx] = {
      halign: col.halign || "left",
      ...(col.cellWidth ? { cellWidth: col.cellWidth } : {}),
      ...(col.key === "name" ? { fontStyle: "bold" } : {}),
    };
  });

  autoTable(doc, {
    startY: y,
    head: [tableCols.map((c) => c.header)],
    body: normalizedPax.map((pax) =>
      tableCols.map((col) => {
        const val = pax[col.key];
        if (col.key === "sr") return String(val);
        return isNonEmptyDisplay(val) ? String(val) : "—";
      })
    ),
    showHead: "everyPage",
    theme: "grid",
    headStyles: {
      fillColor: primaryRgb,
      textColor: contrastOnPrimary,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: 2.8,
    },
    bodyStyles: {
      textColor: TEXT_BODY,
      fontSize: 8.5,
      cellPadding: 2.6,
      lineColor: BORDER_LIGHT,
      lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles,
    margin: { left: marginX, right: marginX, top: 14, bottom: 26 },
    didDrawPage: (hookData) => {
      if (hookData.pageNumber > 1) {
        drawTopBar();
      }
    },
    didParseCell: (cellData) => {
      if (cellData.section === "body" && cellData.column.index === statusColIndex) {
        const val = String(cellData.cell.raw || "").toLowerCase();
        cellData.cell.styles.fontStyle = "bold";
        if (val.includes("void") || val.includes("cancel") || val.includes("refund")) {
          cellData.cell.styles.textColor = [220, 38, 38];
        } else {
          cellData.cell.styles.textColor = [5, 150, 105];
        }
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 9;

  // -------------------------------------------------------------------------
  // MIDDLE SECTION: Service-Specific Details & Flight Cards
  // -------------------------------------------------------------------------
  if (normService === "Ticket") {
    if (legs.length > 0) {
      y = drawFlightCards(doc, legs, y, primaryRgb, readablePrimary, softTint);
    }

    const ticketNum = cleanStr(data.ticketNo || data.moreDetails?.ticket_no);
    if (isNonEmptyDisplay(ticketNum)) {
      if (y + 12 > pageHeight - 26) {
        doc.addPage();
        drawTopBar();
        y = 14;
      }
      doc.setFillColor(...softTint);
      doc.setDrawColor(...BORDER_LIGHT);
      doc.roundedRect(marginX, y, contentW, 9, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.2);
      doc.setTextColor(...readablePrimary);
      doc.text("E-Ticket Number:", marginX + 4, y + 5.8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_DARK);
      doc.text(ticketNum, marginX + 36, y + 5.8);
      y += 13;
    }
  } else {
    const { sectionTitle, rows } = buildServiceDetailRows(data, statusLabel);
    if (rows.length > 0) {
      if (y + 24 > pageHeight - 26) {
        doc.addPage();
        drawTopBar();
        y = 14;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...readablePrimary);
      doc.text(sectionTitle, marginX, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        body: rows,
        theme: "grid",
        styles: {
          fontSize: 8.5,
          cellPadding: 2.8,
          textColor: TEXT_BODY,
          lineColor: BORDER_LIGHT,
          lineWidth: 0.2,
        },
        columnStyles: {
          0: {
            fontStyle: "bold",
            cellWidth: 48,
            fillColor: softTint,
            textColor: TEXT_DARK,
          },
          1: { cellWidth: "auto" },
        },
        margin: { left: marginX, right: marginX, top: 14, bottom: 26 },
        didDrawPage: (hookData) => {
          if (hookData.pageNumber > 1) {
            drawTopBar();
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    if (normService === "Umrah" && legs.length > 0) {
      y = drawFlightCards(doc, legs, y, primaryRgb, readablePrimary, softTint);
    }
  }

  // Optional user remarks (NO Terms & Conditions anywhere!)
  const userRemarks = extractUserRemarks(data.notes);
  if (userRemarks) {
    const remarkLines = doc.splitTextToSize(userRemarks, contentW - 8);
    const boxHeight = Math.max(12, remarkLines.length * 4.2 + 8);
    if (y + boxHeight > pageHeight - 26) {
      doc.addPage();
      drawTopBar();
      y = 14;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...readablePrimary);
    doc.text("REMARKS", marginX, y);
    y += 3;

    doc.setFillColor(...ROW_ALT);
    doc.setDrawColor(...BORDER_LIGHT);
    doc.roundedRect(marginX, y, contentW, boxHeight, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_BODY);
    doc.text(remarkLines, marginX + 4, y + 5.5);
  }

  // -------------------------------------------------------------------------
  // FOOTER (Every Page: Branding Email/Phone/Address + Thank You Message)
  // -------------------------------------------------------------------------
  const pageCount = doc.getNumberOfPages();
  const contactLine = formatBrandingContactParts(branding).join("  |  ");
  const editedNote = formatPdfEditedNote(data.isEdited, data.lastEditedAt);

  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    drawTopBar();

    doc.setDrawColor(...BORDER_LIGHT);
    doc.setLineWidth(0.4);
    doc.line(marginX, pageHeight - 20, pageWidth - marginX, pageHeight - 20);

    if (contactLine) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...TEXT_MUTED);
      const contactLines = doc.splitTextToSize(contactLine, contentW).slice(0, 1);
      doc.text(contactLines, pageWidth / 2, pageHeight - 15, { align: "center" });
    }

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...readablePrimary);
    doc.text(
      `Thank you for choosing ${branding.agencyName}. Have a safe journey!`,
      pageWidth / 2,
      contactLine ? pageHeight - 9.5 : pageHeight - 12,
      { align: "center" }
    );

    if (editedNote) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(editedNote, marginX, pageHeight - 5);
    }

    if (pageCount > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - marginX, pageHeight - 5, {
        align: "right",
      });
    }
  }

  return doc;
}

export function generateBookingConfirmationPdf(data: BookingPdfData) {
  const doc = buildBookingConfirmationPdfDoc(data);
  const refSlug = cleanStr(data.bookingRef || data.invoiceNo || "Booking").replace(
    /[^a-zA-Z0-9_-]/g,
    "_"
  );
  doc.save(`Confirmation_${refSlug}.pdf`);
}

// 2. FORMAL INVOICE PDF (Financial Invoice — NO Payment Terms & Conditions)
export function buildBookingInvoicePdfDoc(data: BookingPdfData): jsPDF {
  const branding = resolveEffectiveBranding(data);
  const primaryRgb = hexToRgb(branding.brandColor);
  const contrastOnPrimary = getContrastTextRgb(primaryRgb);
  const accentRgb = ensureReadableOnWhite(primaryRgb);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Top Header Bar (Agency Brand Color)
  doc.setFillColor(...primaryRgb);
  doc.rect(0, 0, pageWidth, 30, "F");

  let leftTextX = 14;
  if (branding.logo) {
    const logoRes = drawBrandLogo(doc, branding.logo, 14, 5, 22, 18, "left", {
      backing: "white-pill",
    });
    if (logoRes.rendered) {
      leftTextX = 14 + logoRes.width + 4;
    }
  }

  doc.setTextColor(...contrastOnPrimary);
  doc.setFontSize(14.5);
  doc.setFont("helvetica", "bold");
  doc.text(branding.agencyName, leftTextX, 13);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("TAX & SALES INVOICE", leftTextX, 20.5);

  // Branding Contact Details (Right side of header bar, strictly from Branding settings)
  const brandingLines: string[] = [];
  if (branding.phone) brandingLines.push(branding.phone);
  if (branding.email) brandingLines.push(branding.email);
  if (branding.address) {
    const addrParts = doc.splitTextToSize(branding.address, 68).slice(0, 2);
    brandingLines.push(...addrParts);
  }
  if (brandingLines.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...contrastOnPrimary);
    let hdrY = 9.5;
    brandingLines.slice(0, 4).forEach((line) => {
      doc.text(line, pageWidth - 14, hdrY, { align: "right" });
      hdrY += 4.3;
    });
  }

  // Accent Line
  doc.setFillColor(...accentRgb);
  doc.rect(0, 29, pageWidth, 1.5, "F");

  let y = 40;
  // Invoice Meta
  doc.setTextColor(...TEXT_BODY);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`INVOICE NO: ${data.invoiceNo}`, 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${data.invoiceDate}`, 14, y + 5.5);
  doc.text(`Currency: ${data.currency || "PKR"}`, 14, y + 11);

  // Bill To (Right aligned)
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO:", 120, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.clientName, 120, y + 5.5);
  if (data.clientPhone) doc.text(`Phone: ${data.clientPhone}`, 120, y + 11);
  if (data.clientAddress) doc.text(`Address: ${data.clientAddress}`, 120, y + 16.5);

  y += 26;

  // Invoice Items Table
  const paxCount = data.passengers?.length || 1;
  const curr = data.currency || "PKR";
  const items = [
    [
      1,
      `${data.service} Service - ${data.pnr ? `PNR: ${data.pnr}` : "Booking"}`,
      paxCount,
      (data.clientAmount / paxCount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
      }),
      data.clientAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }),
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [["#", "Description", "Qty", `Rate (${curr})`, `Total (${curr})`]],
    body: items,
    headStyles: {
      fillColor: primaryRgb,
      textColor: contrastOnPrimary,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { textColor: TEXT_BODY, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 12 },
      2: { halign: "center", cellWidth: 16 },
      3: { halign: "right", cellWidth: 35 },
      4: { halign: "right", cellWidth: 40 },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Financial Summary Box
  const summaryX = 110;
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_BODY);
  doc.text("Invoice Total:", summaryX, y);
  doc.text(`${curr} ${data.clientAmount.toLocaleString()}`, 196, y, {
    align: "right",
  });

  doc.text("Amount Received:", summaryX, y + 6);
  doc.text(`${curr} ${data.paidAmount.toLocaleString()}`, 196, y + 6, {
    align: "right",
  });

  doc.setDrawColor(...accentRgb);
  doc.setLineWidth(0.5);
  doc.line(summaryX, y + 9, 196, y + 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_DARK);
  doc.text("Balance Due:", summaryX, y + 15);
  doc.text(`${curr} ${data.balanceDue.toLocaleString()}`, 196, y + 15, {
    align: "right",
  });

  // Footer (Agency Branding ONLY — Payment Terms & Conditions completely removed!)
  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.4);
  doc.line(14, pageHeight - 18, pageWidth - 14, pageHeight - 18);

  const footerContact = formatBrandingContactParts(branding).join("  |  ");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    footerContact ? `${branding.agencyName}  |  ${footerContact}` : branding.agencyName,
    14,
    pageHeight - 11
  );

  const editedNote = formatPdfEditedNote(data.isEdited, data.lastEditedAt);
  if (editedNote) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.text(editedNote, pageWidth - 14, pageHeight - 11, { align: "right" });
    doc.setFont("helvetica", "normal");
  }

  return doc;
}

export function generateBookingInvoicePdf(data: BookingPdfData) {
  const doc = buildBookingInvoicePdfDoc(data);
  doc.save(`Invoice_${data.invoiceNo}.pdf`);
}
