import { format } from "date-fns";
import {
  DEFAULT_BRAND_COLOR,
  resolveAgencyBrandingFromRecords,
  type AgencyBranding,
} from "@/lib/pdf/agencyBranding";
import {
  buildBookingConfirmationPdfDoc,
  type BookingPassengerInput,
  type BookingPdfData,
} from "@/lib/pdf/bookingInvoicePdf";

interface LegacyTemplateOrBranding {
  logo?: string | null;
  agencyName?: string;
  phone?: string;
  email?: string;
  address?: string;
  themeColor?: string;
  brandColor?: string;
  agencyId?: string | null;
}

function isAgencyBranding(input: any): input is AgencyBranding {
  return (
    Boolean(input) &&
    typeof input === "object" &&
    "agencyName" in input &&
    "brandColor" in input &&
    "agencyId" in input
  );
}

function parsePassengersList(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapLegacyServiceName(rawTravelType?: string | null): string {
  const raw = (rawTravelType || "").trim();
  const lower = raw.toLowerCase();
  if (!lower || lower.startsWith("ticket")) return "Ticket";
  if (lower.includes("umrah")) return "Umrah";
  if (lower.includes("hotel")) return "Hotel";
  if (lower.includes("visa")) return "Visa";
  if (lower.includes("insurance")) return "Insurance";
  return raw;
}

function parseLegacyDestination(rawDest?: string | null): {
  origin: string;
  destination: string;
} {
  const text = (rawDest || "").trim();
  if (!text) return { origin: "", destination: "" };
  const splitMatch = text.match(/^(.+?)\s*(?:->|→|to|-)\s*(.+)$/i);
  if (splitMatch) {
    return {
      origin: splitMatch[1].trim().toUpperCase(),
      destination: splitMatch[2].trim().toUpperCase(),
    };
  }
  return { origin: "", destination: text.toUpperCase() };
}

export async function generateBookingConfirmationPDF(
  client: any,
  _vendor: any | null,
  templateOrBranding?: LegacyTemplateOrBranding | AgencyBranding | null
) {
  const branding: AgencyBranding = isAgencyBranding(templateOrBranding)
    ? templateOrBranding
    : resolveAgencyBrandingFromRecords({
        agencyId: templateOrBranding?.agencyId ?? null,
        invoiceTemplate: templateOrBranding
          ? {
              logo: templateOrBranding.logo,
              agencyName: templateOrBranding.agencyName,
              phone: templateOrBranding.phone,
              email: templateOrBranding.email,
              address: templateOrBranding.address,
              themeColor:
                templateOrBranding.brandColor ||
                templateOrBranding.themeColor ||
                DEFAULT_BRAND_COLOR,
            }
          : null,
      });

  const parsedPassengers = parsePassengersList(client?.passengers_data);
  const customServiceData = parsedPassengers[0]?.custom_service;
  const service = mapLegacyServiceName(client?.travel_type);
  const isReturn =
    typeof client?.travel_type === "string" &&
    client.travel_type.toLowerCase().includes("return");
  const { origin, destination } = parseLegacyDestination(client?.destination);

  const passengers: BookingPassengerInput[] =
    parsedPassengers.length > 0
      ? parsedPassengers.map((p: any) => ({
          name: p?.name || client?.name || "",
          passport: p?.passport || p?.passport_number || p?.cnic || "",
          meal: p?.meal || p?.meal_plan || "",
          baggage: p?.baggage || p?.baggage_allowance || "",
          status: p?.status || "",
          type: p?.type || "Adult",
          gender: p?.gender || "",
          dob: p?.dob || "",
          nationality: p?.nationality || "",
          ...(p?.custom_service ? { custom_service: p.custom_service } : {}),
        }))
      : [
          {
            name: client?.name || "Traveler",
            passport: client?.passport_number || client?.cnic || "",
            type: "Adult",
          },
        ];

  const totalAmount = Number(client?.selling_price || client?.payment_amount) || 0;
  const paidAmount = Number(client?.amount_paid) || 0;
  const bookingRef =
    customServiceData?.reference ||
    client?.pnr ||
    (client?.id ? String(client.id).slice(0, 8).toUpperCase() : "CONFIRMED");

  const pdfData: BookingPdfData = {
    invoiceNo: bookingRef,
    bookingRef,
    invoiceDate: client?.created_at || new Date().toISOString().slice(0, 10),
    service,
    clientName: client?.name || "Traveler",
    clientPhone: client?.contact_number || undefined,
    pnr: client?.pnr || undefined,
    passportNo: client?.passport_number || undefined,
    passengers,
    paymentStatus: client?.payment_status || undefined,
    moreDetails: {
      trip_type: isReturn ? "Return" : "One Way",
      origin,
      destination,
      flight_date: client?.flight_date || customServiceData?.start_date || "",
      airline: client?.airline || "",
      pnr: client?.pnr || "",
      location: customServiceData?.location || client?.destination || "",
      start_date: customServiceData?.start_date || client?.flight_date || "",
      end_date: customServiceData?.end_date || "",
      reference: customServiceData?.reference || client?.pnr || "",
    },
    clientAmount: totalAmount,
    paidAmount,
    balanceDue: Math.max(0, totalAmount - paidAmount),
    currency: "PKR",
    notes: client?.notes || undefined,
    branding,
  };

  const doc = buildBookingConfirmationPdfDoc(pdfData);
  const pdfBlob = doc.output("blob");
  const blobUrl =
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(pdfBlob)
      : "";
  const safeName = String(client?.name || "Booking").replace(/\s+/g, "_");
  const filename = `Booking_${safeName}_${format(new Date(), "yyyyMMdd")}.pdf`;

  return { blobUrl, filename, doc };
}
