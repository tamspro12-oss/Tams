import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { Voucher } from "@/types/voucher";

interface VoucherPdfOptions {
  agencyName?: string;
  agencyEmail?: string;
  agencyPhone?: string;
  agencyAddress?: string;
}

export function generateVoucherPdf(v: Voucher, opts: VoucherPdfOptions = {}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 14;

  // Header band
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 32, "F");

  // Agency branding
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(opts.agencyName || "TRAVEL AGENCY", 14, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const contactParts = [opts.agencyPhone, opts.agencyEmail].filter(Boolean);
  if (contactParts.length > 0) {
    doc.text(contactParts.join("  |  "), 14, 22);
  }
  if (opts.agencyAddress) {
    doc.text(opts.agencyAddress, 14, 27);
  }

  // Voucher Title on right header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`${v.voucher_type.toUpperCase()} VOUCHER`, pageWidth - 14, 15, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Voucher #: ${v.voucher_number}`, pageWidth - 14, 22, { align: "right" });
  doc.setFontSize(8);
  const issueDate = v.created_at ? format(new Date(v.created_at), "dd MMM yyyy") : format(new Date(), "dd MMM yyyy");
  doc.text(`Status: ${v.status.toUpperCase()}  |  Date: ${issueDate}`, pageWidth - 14, 27, { align: "right" });

  doc.setTextColor(30, 41, 59);
  y = 40;

  // Primary Passenger & Reservation details (2 column layout)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, pageWidth - 28, 26, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("GUEST / PASSENGER INFORMATION", 18, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Lead Guest: ${v.passenger_name}`, 18, y + 13);
  doc.text(`Passport: ${v.passenger_passport || "N/A"}`, 18, y + 20);

  const col2X = 110;
  doc.text(`Contact: ${v.contact_number || "N/A"}`, col2X, y + 13);
  if (v.b2b_agents?.agency_name) {
    doc.text(`Booking Agent: ${v.b2b_agents.agency_name}`, col2X, y + 20);
  } else if (v.pnr) {
    doc.text(`PNR / Booking Ref: ${v.pnr}`, col2X, y + 20);
  } else {
    doc.text(`Booking Status: Confirmed & Issued`, col2X, y + 20);
  }

  y += 32;

  // Additional passengers list if present
  if (v.passengers && v.passengers.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [["#", "Passenger Name", "Passport", "Type", "Ticket / Ref"]],
      body: v.passengers.map((p, idx) => [
        idx + 1,
        p.name || "-",
        p.passport || "-",
        p.type || "Adult",
        p.ticket_number || "-",
      ]),
      theme: "striped",
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Service Details Section based on Voucher Type
  if (v.voucher_type === "Umrah") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("UMRAH PACKAGE & ACCOMMODATION DETAILS", 14, y);
    y += 4;

    const umrahRows: string[][] = [];

    if (v.package_name) {
      umrahRows.push(["Package Name", v.package_name]);
    }
    if (v.makkah_hotel || v.hotel_name) {
      const checkInStr = v.makkah_check_in || v.check_in || "N/A";
      const checkOutStr = v.makkah_check_out || v.check_out || "N/A";
      const nights = v.makkah_nights || v.nights || "-";
      umrahRows.push([
        "Makkah Hotel",
        `${v.makkah_hotel || v.hotel_name} (${nights} Nights)  |  Check-In: ${checkInStr}  |  Check-Out: ${checkOutStr}`,
      ]);
    }
    if (v.madinah_hotel) {
      const checkInStr = v.madinah_check_in || "N/A";
      const checkOutStr = v.madinah_check_out || "N/A";
      const nights = v.madinah_nights || "-";
      umrahRows.push([
        "Madinah Hotel",
        `${v.madinah_hotel} (${nights} Nights)  |  Check-In: ${checkInStr}  |  Check-Out: ${checkOutStr}`,
      ]);
    }
    if (v.room_type || v.meal_plan) {
      umrahRows.push([
        "Room & Board",
        `Type: ${v.room_type || "Standard"}  |  Rooms: ${v.number_of_rooms || 1}  |  Meal Plan: ${v.meal_plan || "Room Only"}`,
      ]);
    }
    if (v.hotel_confirmation_code) {
      umrahRows.push(["Hotel Conf Code", v.hotel_confirmation_code]);
    }
    if (v.transport_details) {
      umrahRows.push(["Transport / Transfers", v.transport_details]);
    }
    if (v.ziyarat_details) {
      umrahRows.push(["Ziyarat Services", v.ziyarat_details]);
    }
    if (v.visa_status) {
      umrahRows.push(["Visa Status", v.visa_status]);
    }

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      body: umrahRows,
      theme: "grid",
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 46, fillColor: [241, 245, 249] },
      },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else if (v.voucher_type === "Hotel") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("HOTEL RESERVATION DETAILS", 14, y);
    y += 4;

    const hotelRows: string[][] = [
      ["Hotel Name", v.hotel_name || "N/A"],
      ["Location / City", v.city || "N/A"],
      ["Check-In Date", v.check_in ? format(new Date(v.check_in), "dd MMM yyyy") : "N/A"],
      ["Check-Out Date", v.check_out ? format(new Date(v.check_out), "dd MMM yyyy") : "N/A"],
      ["Duration", `${v.nights || 0} Night(s)`],
      ["Room Configuration", `${v.room_type || "Standard Room"} (${v.number_of_rooms || 1} Room(s))`],
      ["Meal Plan", v.meal_plan || "Room Only"],
      ["Confirmation #", v.hotel_confirmation_code || "Pending / Guaranteed"],
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      body: hotelRows,
      theme: "grid",
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 46, fillColor: [241, 245, 249] },
      },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else if (v.voucher_type === "Ticket") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("FLIGHT / TICKET DETAILS", 14, y);
    y += 4;

    const flightRows: string[][] = [
      ["Airline & Flight", `${v.airline || "Airline"} - Flight ${v.flight_number || "TBD"}`],
      ["Sector / Route", v.sector || "N/A"],
      ["PNR / Booking Ref", v.pnr || "N/A"],
      ["Ticket Number", v.ticket_number || "N/A"],
      ["Cabin Class", v.flight_class || "Economy"],
      ["Baggage Allowance", v.baggage || "Standard Airline Baggage Allowance"],
    ];

    if (v.departure_date) {
      flightRows.push(["Departure", format(new Date(v.departure_date), "dd MMM yyyy HH:mm")]);
    }
    if (v.arrival_date) {
      flightRows.push(["Arrival", format(new Date(v.arrival_date), "dd MMM yyyy HH:mm")]);
    }

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      body: flightRows,
      theme: "grid",
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 46, fillColor: [241, 245, 249] },
      },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Remarks / Instructions
  if (v.remarks) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 16;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("SPECIAL INSTRUCTIONS & REMARKS", 14, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const splitRemarks = doc.splitTextToSize(v.remarks, pageWidth - 28);
    doc.text(splitRemarks, 14, y);
    y += splitRemarks.length * 4 + 4;
  }

  // Terms and conditions
  const termsText =
    v.terms_and_conditions ||
    "1. This voucher must be presented upon check-in/service arrival along with valid original passports.\n" +
    "2. Standard hotel check-in time is usually 14:00 - 16:00 and check-out is 12:00 noon.\n" +
    "3. Any incidentals, telephone calls, room service, or mini-bar charges are the responsibility of the guest.\n" +
    "4. For flight departures, passengers are required to report at least 3-4 hours prior to scheduled departure.\n" +
    "5. Cancellations or amendments are subject to supplier and airline policies.";

  if (y > pageHeight - 45) {
    doc.addPage();
    y = 16;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("TERMS & CONDITIONS", 14, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const splitTerms = doc.splitTextToSize(termsText, pageWidth - 28);
  doc.text(splitTerms, 14, y);
  y += splitTerms.length * 3.5 + 8;

  // Signature block
  if (y > pageHeight - 28) {
    doc.addPage();
    y = 16;
  }
  doc.setDrawColor(203, 213, 225);
  doc.line(pageWidth - 70, y + 10, pageWidth - 14, y + 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text("Authorized Signature & Stamp", pageWidth - 42, y + 14, { align: "center" });

  // Bottom Notice
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Thank you for choosing our travel services. Have a pleasant and blessed journey!", 14, pageHeight - 8);

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

export function generateVoucherWhatsAppText(v: Voucher, agencyName = "TAMS Pro"): string {
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
      lines.push(`🕋 Makkah: *${v.makkah_hotel || v.hotel_name}* (${v.makkah_nights || v.nights || 0}N)`);
      if (v.makkah_check_in) lines.push(`   Check-in: ${v.makkah_check_in}`);
    }
    if (v.madinah_hotel) {
      lines.push(`🕌 Madinah: *${v.madinah_hotel}* (${v.madinah_nights || 0}N)`);
      if (v.madinah_check_in) lines.push(`   Check-in: ${v.madinah_check_in}`);
    }
    if (v.transport_details) lines.push(`🚗 Transport: ${v.transport_details}`);
    if (v.hotel_confirmation_code) lines.push(`Confirmation Code: ${v.hotel_confirmation_code}`);
  } else if (v.voucher_type === "Hotel") {
    lines.push(`🏨 Hotel: *${v.hotel_name || "N/A"}* (${v.city || ""})`);
    if (v.check_in && v.check_out) lines.push(`Dates: ${v.check_in} to ${v.check_out} (${v.nights || 0}N)`);
    if (v.room_type) lines.push(`Room: ${v.room_type} (${v.meal_plan || "Room Only"})`);
    if (v.hotel_confirmation_code) lines.push(`Confirmation Code: ${v.hotel_confirmation_code}`);
  } else if (v.voucher_type === "Ticket") {
    lines.push(`✈️ Flight: *${v.airline || ""} ${v.flight_number || ""}*`);
    if (v.sector) lines.push(`Sector: ${v.sector}`);
    if (v.pnr) lines.push(`PNR: *${v.pnr}*`);
    if (v.ticket_number) lines.push(`Ticket #: ${v.ticket_number}`);
    if (v.departure_date) lines.push(`Departure: ${v.departure_date}`);
  }

  lines.push(`\nHave a safe and pleasant journey! If you have any questions, please contact our support.`);
  return lines.join("\n");
}
