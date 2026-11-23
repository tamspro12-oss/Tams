import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { Voucher } from "@/types/voucher";
import {
  DEFAULT_BRAND_COLOR,
  drawBrandLogo,
  ensureReadableOnWhite,
  formatBrandingContactParts,
  getContrastTextRgb,
  hexToRgb,
  resolveAgencyBrandingFromRecords,
  tintRgb,
  type AgencyBranding,
  type RgbTuple,
} from "@/lib/pdf/agencyBranding";

export interface VoucherPdfOptions {
  branding?: AgencyBranding;
  agencyName?: string;
  agencyEmail?: string;
  agencyPhone?: string;
  agencyAddress?: string;
  brandColor?: string;
  logo?: string | null;
}

const TEXT_BODY: RgbTuple = [30, 41, 59];
const TEXT_MUTED: RgbTuple = [100, 116, 139];
const BORDER_LIGHT: RgbTuple = [226, 232, 240];

function resolveVoucherBranding(opts: VoucherPdfOptions): AgencyBranding {
  if (opts.branding) {
    return opts.branding;
  }
  return resolveAgencyBrandingFromRecords({
    signupAgencyName: opts.agencyName || null,
    invoiceTemplate: {
      agencyName: opts.agencyName,
      email: opts.agencyEmail,
      phone: opts.agencyPhone,
      address: opts.agencyAddress,
      logo: opts.logo || undefined,
      themeColor: opts.brandColor || DEFAULT_BRAND_COLOR,
    },
  });
}

export function generateVoucherPdf(v: Voucher, opts: VoucherPdfOptions = {}) {
  const branding = resolveVoucherBranding(opts);
  const primaryRgb = hexToRgb(branding.brandColor);
  const readablePrimary = ensureReadableOnWhite(primaryRgb);
  const contrastOnPrimary = getContrastTextRgb(primaryRgb);
  const softTint = tintRgb(primaryRgb, 0.93);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 14;

  // Header band
  doc.setFillColor(...primaryRgb);
  doc.rect(0, 0, pageWidth, 32, "F");

  let leftTextX = 14;
  if (branding.logo) {
    const logoRes = drawBrandLogo(doc, branding.logo, 14, 6, 22, 18, "left", {
      backing: "white-pill",
    });
    if (logoRes.rendered) {
      leftTextX = 14 + logoRes.width + 4;
    }
  }

  // Agency branding
  doc.setTextColor(...contrastOnPrimary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(branding.agencyName, leftTextX, 14.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const contactParts = formatBrandingContactParts(branding);
  if (contactParts.length > 0) {
    const line = doc.splitTextToSize(contactParts.join("  |  "), 95).slice(0, 2);
    doc.text(line, leftTextX, 21.5);
  }

  // Voucher Title on right header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${v.voucher_type.toUpperCase()} VOUCHER`, pageWidth - 14, 14.5, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`Voucher #: ${v.voucher_number}`, pageWidth - 14, 21, { align: "right" });
  doc.setFontSize(8);
  const issueDate = v.created_at
    ? format(new Date(v.created_at), "dd MMM yyyy")
    : format(new Date(), "dd MMM yyyy");
  doc.text(`Status: ${v.status.toUpperCase()}  |  Date: ${issueDate}`, pageWidth - 14, 26.5, {
    align: "right",
  });

  doc.setTextColor(...TEXT_BODY);
  y = 40;

  // Primary Passenger & Reservation details
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...BORDER_LIGHT);
  doc.roundedRect(14, y, pageWidth - 28, 25, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...readablePrimary);
  doc.text("GUEST / PASSENGER INFORMATION", 18, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_BODY);
  doc.text(`Lead Guest: ${v.passenger_name}`, 18, y + 13);
  if (v.passenger_passport) {
    doc.text(`Passport: ${v.passenger_passport}`, 18, y + 19.5);
  }

  const col2X = 110;
  if (v.contact_number) {
    doc.text(`Contact: ${v.contact_number}`, col2X, y + 13);
  }
  doc.text(
    v.pnr ? `PNR / Booking Ref: ${v.pnr}` : `Booking Status: ${v.status || "Confirmed"}`,
    col2X,
    y + 19.5
  );

  y += 32;

  // Additional passengers list if present
  if (v.passengers && v.passengers.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [["#", "Passenger Name", "Passport", "Type", "Ticket / Ref"]],
      body: v.passengers.map((p, idx) => [
        idx + 1,
        p.name || "—",
        p.passport || "—",
        p.type || "Adult",
        p.ticket_number || "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: primaryRgb, textColor: contrastOnPrimary, fontSize: 8, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Service Details Section based on Voucher Type (only non-empty fields)
  if (v.voucher_type === "Umrah") {
    const umrahRows: string[][] = [];
    if (v.package_name) umrahRows.push(["Package Name", v.package_name]);
    if (v.makkah_hotel || v.hotel_name) {
      const details = [
        v.makkah_hotel || v.hotel_name,
        v.makkah_nights || v.nights ? `${v.makkah_nights || v.nights} Nights` : "",
        v.makkah_check_in || v.check_in ? `In: ${v.makkah_check_in || v.check_in}` : "",
        v.makkah_check_out || v.check_out ? `Out: ${v.makkah_check_out || v.check_out}` : "",
      ]
        .filter(Boolean)
        .join("  |  ");
      umrahRows.push(["Makkah Hotel", details]);
    }
    if (v.madinah_hotel) {
      const details = [
        v.madinah_hotel,
        v.madinah_nights ? `${v.madinah_nights} Nights` : "",
        v.madinah_check_in ? `In: ${v.madinah_check_in}` : "",
        v.madinah_check_out ? `Out: ${v.madinah_check_out}` : "",
      ]
        .filter(Boolean)
        .join("  |  ");
      umrahRows.push(["Madinah Hotel", details]);
    }
    if (v.room_type || v.meal_plan) {
      const rb = [
        v.room_type ? `Type: ${v.room_type}` : "",
        v.number_of_rooms ? `Rooms: ${v.number_of_rooms}` : "",
        v.meal_plan ? `Meal Plan: ${v.meal_plan}` : "",
      ]
        .filter(Boolean)
        .join("  |  ");
      umrahRows.push(["Room & Board", rb]);
    }
    if (v.hotel_confirmation_code) umrahRows.push(["Hotel Conf Code", v.hotel_confirmation_code]);
    if (v.transport_details) umrahRows.push(["Transport / Transfers", v.transport_details]);
    if (v.ziyarat_details) umrahRows.push(["Ziyarat Services", v.ziyarat_details]);
    if (v.visa_status) umrahRows.push(["Visa Status", v.visa_status]);

    if (umrahRows.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...readablePrimary);
      doc.text("UMRAH PACKAGE & ACCOMMODATION DETAILS", 14, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14 },
        body: umrahRows,
        theme: "grid",
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 46, fillColor: softTint },
        },
        styles: { fontSize: 8.5, cellPadding: 2.5 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  } else if (v.voucher_type === "Hotel") {
    const hotelRows: string[][] = [];
    if (v.hotel_name) hotelRows.push(["Hotel Name", v.hotel_name]);
    if (v.city) hotelRows.push(["Location / City", v.city]);
    if (v.check_in) hotelRows.push(["Check-In Date", format(new Date(v.check_in), "dd MMM yyyy")]);
    if (v.check_out) hotelRows.push(["Check-Out Date", format(new Date(v.check_out), "dd MMM yyyy")]);
    if (v.nights) hotelRows.push(["Duration", `${v.nights} Night(s)`]);
    if (v.room_type) {
      hotelRows.push([
        "Room Configuration",
        `${v.room_type}${v.number_of_rooms ? ` (${v.number_of_rooms} Room(s))` : ""}`,
      ]);
    }
    if (v.meal_plan) hotelRows.push(["Meal Plan", v.meal_plan]);
    if (v.hotel_confirmation_code) hotelRows.push(["Confirmation #", v.hotel_confirmation_code]);

    if (hotelRows.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...readablePrimary);
      doc.text("HOTEL RESERVATION DETAILS", 14, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14 },
        body: hotelRows,
        theme: "grid",
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 46, fillColor: softTint },
        },
        styles: { fontSize: 8.5, cellPadding: 2.5 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  } else if (v.voucher_type === "Ticket") {
    const flightRows: string[][] = [];
    if (v.airline || v.flight_number) {
      flightRows.push([
        "Airline & Flight",
        [v.airline, v.flight_number ? `Flight ${v.flight_number}` : ""].filter(Boolean).join(" - "),
      ]);
    }
    if (v.sector) flightRows.push(["Sector / Route", v.sector]);
    if (v.pnr) flightRows.push(["PNR / Booking Ref", v.pnr]);
    if (v.ticket_number) flightRows.push(["Ticket Number", v.ticket_number]);
    if (v.flight_class) flightRows.push(["Cabin Class", v.flight_class]);
    if (v.baggage) flightRows.push(["Baggage Allowance", v.baggage]);
    if (v.departure_date) {
      flightRows.push(["Departure", format(new Date(v.departure_date), "dd MMM yyyy HH:mm")]);
    }
    if (v.arrival_date) {
      flightRows.push(["Arrival", format(new Date(v.arrival_date), "dd MMM yyyy HH:mm")]);
    }

    if (flightRows.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...readablePrimary);
      doc.text("FLIGHT / TICKET DETAILS", 14, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14 },
        body: flightRows,
        theme: "grid",
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 46, fillColor: softTint },
        },
        styles: { fontSize: 8.5, cellPadding: 2.5 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // Remarks / Instructions
  if (v.remarks) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 16;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_BODY);
    doc.text("SPECIAL INSTRUCTIONS & REMARKS", 14, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const splitRemarks = doc.splitTextToSize(v.remarks, pageWidth - 28);
    doc.text(splitRemarks, 14, y);
    y += splitRemarks.length * 4 + 4;
  }

  // Terms and conditions ONLY if user provided custom terms
  if (v.terms_and_conditions?.trim()) {
    if (y > pageHeight - 45) {
      doc.addPage();
      y = 16;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_BODY);
    doc.text("TERMS & CONDITIONS", 14, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    const splitTerms = doc.splitTextToSize(v.terms_and_conditions.trim(), pageWidth - 28);
    doc.text(splitTerms, 14, y);
    y += splitTerms.length * 3.8 + 8;
  }

  // Signature block
  if (y > pageHeight - 28) {
    doc.addPage();
    y = 16;
  }
  doc.setDrawColor(203, 213, 225);
  doc.line(pageWidth - 70, y + 10, pageWidth - 14, y + 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_BODY);
  doc.text("Authorized Signature & Stamp", pageWidth - 42, y + 14, { align: "center" });

  // Bottom Notice & Branding
  doc.setDrawColor(...BORDER_LIGHT);
  doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    `Thank you for choosing ${branding.agencyName}. Have a pleasant and safe journey!`,
    14,
    pageHeight - 9
  );

  return doc;
}

export function downloadVoucherPdf(v: Voucher, opts: VoucherPdfOptions = {}) {
  const doc = generateVoucherPdf(v, opts);
  const cleanName = (v.passenger_name || "Guest").replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`${v.voucher_number}_${cleanName}_Voucher.pdf`);
}

export function printVoucherPdf(v: Voucher, opts: VoucherPdfOptions = {}) {
  const doc = generateVoucherPdf(v, opts);
  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = blobUrl;
  document.body.appendChild(iframe);
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
}

export function generateVoucherWhatsAppText(v: Voucher, agencyName = "Travel Agency"): string {
  const lines: string[] = [
    `*${agencyName.toUpperCase()} - ${v.voucher_type.toUpperCase()} VOUCHER*`,
    `Voucher No: *${v.voucher_number}*`,
    `Status: *${v.status}*`,
    `Guest Name: *${v.passenger_name}*`,
  ];

  if (v.passenger_passport) {
    lines.push(`Passport: ${v.passenger_passport}`);
  }

  if (v.voucher_type === "Umrah") {
    if (v.makkah_hotel || v.hotel_name) {
      lines.push(`Makkah: *${v.makkah_hotel || v.hotel_name}* (${v.makkah_nights || v.nights || 0}N)`);
      if (v.makkah_check_in) lines.push(`   Check-in: ${v.makkah_check_in}`);
    }
    if (v.madinah_hotel) {
      lines.push(`Madinah: *${v.madinah_hotel}* (${v.madinah_nights || 0}N)`);
      if (v.madinah_check_in) lines.push(`   Check-in: ${v.madinah_check_in}`);
    }
    if (v.transport_details) lines.push(`Transport: ${v.transport_details}`);
    if (v.hotel_confirmation_code) lines.push(`Confirmation Code: ${v.hotel_confirmation_code}`);
  } else if (v.voucher_type === "Hotel") {
    lines.push(`Hotel: *${v.hotel_name || ""}*${v.city ? ` (${v.city})` : ""}`);
    if (v.check_in && v.check_out) lines.push(`Dates: ${v.check_in} to ${v.check_out} (${v.nights || 0}N)`);
    if (v.room_type) lines.push(`Room: ${v.room_type}${v.meal_plan ? ` (${v.meal_plan})` : ""}`);
    if (v.hotel_confirmation_code) lines.push(`Confirmation Code: ${v.hotel_confirmation_code}`);
  } else if (v.voucher_type === "Ticket") {
    lines.push(`Flight: *${v.airline || ""} ${v.flight_number || ""}*`);
    if (v.sector) lines.push(`Sector: ${v.sector}`);
    if (v.pnr) lines.push(`PNR: *${v.pnr}*`);
    if (v.ticket_number) lines.push(`Ticket #: ${v.ticket_number}`);
    if (v.departure_date) lines.push(`Departure: ${v.departure_date}`);
  }

  lines.push(`\nHave a safe and pleasant journey!`);
  return lines.join("\n");
}
