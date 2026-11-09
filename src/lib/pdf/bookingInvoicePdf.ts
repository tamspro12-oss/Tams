import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface BookingPdfData {
  invoiceNo: string;
  invoiceDate: string;
  service: string;
  clientName: string;
  clientPhone?: string;
  clientAddress?: string;
  pnr?: string;
  ticketNo?: string;
  passportNo?: string;
  passengers?: { name: string; passport?: string; type?: string }[];
  clientAmount: number;
  paidAmount: number;
  balanceDue: number;
  currency?: string;
  notes?: string;
  agency?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    logo?: string;
  };
}

// Dark Navy and Teal Brand Colors
const BRAND = {
  navy: [11, 25, 44] as [number, number, number],
  teal: [13, 148, 136] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
};

// 1. BOOKING CONFIRMATION PDF (Itinerary & Traveler Confirmation)
export function generateBookingConfirmationPdf(data: BookingPdfData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top Navy Header Bar
  doc.setFillColor(...BRAND.navy);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Agency Title & Doc Type
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.agency?.name || "TAMS PRO TRAVEL AGENCY", 14, 13);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("BOOKING CONFIRMATION & ITINERARY", 14, 20);

  // Teal Accent Line
  doc.setFillColor(...BRAND.teal);
  doc.rect(0, 27, pageWidth, 2, "F");

  // Meta Information Box
  let y = 38;
  doc.setTextColor(...BRAND.text);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Booking Details", 14, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Booking Ref: ${data.invoiceNo}`, 14, y + 6);
  doc.text(`Issue Date: ${data.invoiceDate}`, 14, y + 12);
  doc.text(`Service: ${data.service}`, 14, y + 18);

  // Client Box (Right aligned)
  doc.setFont("helvetica", "bold");
  doc.text("Traveler / Contact", 120, y);
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${data.clientName}`, 120, y + 6);
  if (data.clientPhone) doc.text(`Phone: ${data.clientPhone}`, 120, y + 12);
  if (data.pnr) doc.text(`PNR: ${data.pnr}`, 120, y + 18);

  y += 28;

  // Passenger Table
  const paxRows = (data.passengers && data.passengers.length > 0)
    ? data.passengers.map((p, i) => [i + 1, p.name, p.passport || "—", p.type || "Adult"])
    : [[1, data.clientName, data.passportNo || "—", "Primary Traveler"]];

  autoTable(doc, {
    startY: y,
    head: [["#", "Passenger Name", "Passport No", "Type"]],
    body: paxRows,
    headStyles: { fillColor: BRAND.navy, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { textColor: BRAND.text, fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // Service Details Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Service Specifications", 14, y);

  const serviceRows = [
    ["Service Category", data.service],
    ["PNR / Ticket", `${data.pnr || "—"} / ${data.ticketNo || "—"}`],
    ["Passport Number", data.passportNo || "—"],
    ["Booking Status", "Confirmed"],
  ];

  autoTable(doc, {
    startY: y + 4,
    body: serviceRows,
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: BRAND.text },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 45, textColor: BRAND.muted } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  if (data.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Important Notice & Instructions:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(data.notes, pageWidth - 28), 14, y + 5);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text("Thank you for choosing our travel services. Have a safe journey!", 14, 280);

  doc.save(`Confirmation_${data.invoiceNo}.pdf`);
}

// 2. FORMAL INVOICE PDF (Financial Invoice)
export function generateBookingInvoicePdf(data: BookingPdfData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top Navy Bar
  doc.setFillColor(...BRAND.navy);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(data.agency?.name || "TAMS PRO TRAVEL AGENCY", 14, 13);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("TAX & SALES INVOICE", 14, 20);

  // Teal Accent Line
  doc.setFillColor(...BRAND.teal);
  doc.rect(0, 27, pageWidth, 2, "F");

  let y = 38;
  // Invoice Meta
  doc.setTextColor(...BRAND.text);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`INVOICE NO: ${data.invoiceNo}`, 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${data.invoiceDate}`, 14, y + 5);
  doc.text(`Currency: ${data.currency || "PKR"}`, 14, y + 10);

  // Bill To (Right aligned)
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO:", 120, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.clientName, 120, y + 5);
  if (data.clientPhone) doc.text(`Phone: ${data.clientPhone}`, 120, y + 10);
  if (data.clientAddress) doc.text(`Address: ${data.clientAddress}`, 120, y + 15);

  y += 24;

  // Invoice Items Table
  const items = [
    [
      1,
      `${data.service} Service - ${data.pnr ? `PNR: ${data.pnr}` : "Booking"}`,
      (data.passengers?.length || 1),
      (data.clientAmount / (data.passengers?.length || 1)).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      data.clientAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }),
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [["#", "Description", "Qty", "Rate (PKR)", "Total (PKR)"]],
    body: items,
    headStyles: { fillColor: BRAND.navy, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { textColor: BRAND.text, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 12 },
      2: { halign: "center", cellWidth: 16 },
      3: { halign: "right", cellWidth: 35 },
      4: { halign: "right", cellWidth: 40 },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Financial Summary Box
  const summaryX = 110;
  const curr = data.currency || "PKR";

  doc.setFontSize(9);
  doc.text("Invoice Total:", summaryX, y);
  doc.text(`${curr} ${data.clientAmount.toLocaleString()}`, 196, y, { align: "right" });

  doc.text("Amount Received:", summaryX, y + 6);
  doc.text(`${curr} ${data.paidAmount.toLocaleString()}`, 196, y + 6, { align: "right" });

  // Teal line
  doc.setDrawColor(...BRAND.teal);
  doc.setLineWidth(0.5);
  doc.line(summaryX, y + 9, 196, y + 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Balance Due:", summaryX, y + 15);
  doc.text(`${curr} ${data.balanceDue.toLocaleString()}`, 196, y + 15, { align: "right" });

  y += 30;

  // Terms and Bank info
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Terms & Conditions:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.muted);
  doc.text("1. All tickets and vouchers are subject to airline/supplier cancellation & refund policies.", 14, y + 5);
  doc.text("2. Please verify passenger names and passport numbers on ticket before travel.", 14, y + 9);
  doc.text("3. Computer generated invoice; requires no physical signature.", 14, y + 13);

  // Bottom Footer
  doc.text("TAMS Pro Travel Management System", 14, 280);

  doc.save(`Invoice_${data.invoiceNo}.pdf`);
}

