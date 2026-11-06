import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

interface HotelLine {
  city: "Makkah" | "Madinah";
  name: string;
  sharingType: string;
  rateMode: "sharing" | "room";
  rate: string | number;
  nights: string | number;
  currency: string;
}

export interface UmrahSummaryData {
  agencyName?: string;
  agencyPhone?: string;
  agencyEmail?: string;
  agencyAddress?: string;
  packageName?: string;
  arrivalDate?: Date | null;
  departureDate?: Date | null;
  sarToPkrRate: string | number;
  hotels: HotelLine[];
  visaFee: string | number; visaCurrency: string;
  ticketCost: string | number; ticketCurrency: string;
  transport: string | number; transportCurrency: string;
  ziyarat: string | number; ziyaratCurrency: string;
  food: string | number; foodCurrency: string;
  serviceCharges: string | number; serviceChargesCurrency: string;
  adultCount: string | number;
  childCount: string | number;
  infantCount: string | number;
  result: {
    nights: number;
    makkahCost: number;
    madinahCost: number;
    baseTotal: number;
    profitAmount: number;
    finalTotal: number;
    perPerson: number;
    totalPassengers: number;
  };
}

const fmt = (n: number) =>
  `PKR ${Math.round(n).toLocaleString("en-PK")}`;

const num = (v: string | number) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
};

export function exportUmrahSummaryPdf(d: UmrahSummaryData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(d.agencyName || "Travel Agency", 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const contactLine = [d.agencyPhone, d.agencyEmail].filter(Boolean).join("  |  ");
  if (contactLine) doc.text(contactLine, 14, 19);
  if (d.agencyAddress) doc.text(d.agencyAddress, 14, 24);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Umrah Package Quotation", 14, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")}`, 14, 46);
  if (d.packageName) doc.text(`Package: ${d.packageName}`, pageWidth - 14, 46, { align: "right" });

  let y = 54;

  // Trip info
  if (d.arrivalDate || d.departureDate || d.result.totalPassengers > 0) {
    const info: string[][] = [];
    if (d.arrivalDate) info.push(["Arrival", format(d.arrivalDate, "dd MMM yyyy")]);
    if (d.departureDate) info.push(["Departure", format(d.departureDate, "dd MMM yyyy")]);
    info.push(["Total Nights", String(d.result.nights)]);
    const pax = `${num(d.adultCount)} Adult, ${num(d.childCount)} Child, ${num(d.infantCount)} Infant`;
    info.push(["Passengers", pax]);
    info.push(["SAR → PKR Rate", String(d.sarToPkrRate)]);

    autoTable(doc, {
      startY: y,
      body: info,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 1.5, textColor: [30, 41, 59] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 45, textColor: [71, 85, 105] } },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Hotels
  if (d.hotels.length > 0) {
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Accommodation", 14, y);
    y += 2;
    autoTable(doc, {
      startY: y + 2,
      head: [["City", "Hotel", "Type", "Rate Mode", "Rate", "Nights"]],
      body: d.hotels.map(h => [
        h.city,
        h.name || "-",
        h.sharingType,
        h.rateMode === "room" ? "Room" : "Per Person",
        `${h.currency} ${num(h.rate).toLocaleString()}`,
        String(h.nights),
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Other charges
  const charges: string[][] = [];
  const addCharge = (label: string, val: string | number, curr: string) => {
    if (num(val) > 0) charges.push([label, `${curr} ${num(val).toLocaleString()}`]);
  };
  addCharge("Visa Fee", d.visaFee, d.visaCurrency);
  addCharge("Air Ticket", d.ticketCost, d.ticketCurrency);
  addCharge("Transport", d.transport, d.transportCurrency);
  addCharge("Ziyarat", d.ziyarat, d.ziyaratCurrency);
  addCharge("Food", d.food, d.foodCurrency);
  addCharge("Service Charges", d.serviceCharges, d.serviceChargesCurrency);

  if (charges.length > 0) {
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Other Charges (Per Person)", 14, y);
    autoTable(doc, {
      startY: y + 2,
      head: [["Item", "Amount"]],
      body: charges,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Summary box
  if (y > 230) { doc.addPage(); y = 20; }
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, pageWidth - 28, 46, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Cost Summary", 20, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let sy = y + 16;
  doc.text(`Makkah Hotel Total:`, 20, sy);
  doc.text(fmt(d.result.makkahCost), pageWidth - 20, sy, { align: "right" });
  sy += 6;
  doc.text(`Madinah Hotel Total:`, 20, sy);
  doc.text(fmt(d.result.madinahCost), pageWidth - 20, sy, { align: "right" });
  sy += 6;
  doc.text(`Base Total:`, 20, sy);
  doc.text(fmt(d.result.baseTotal), pageWidth - 20, sy, { align: "right" });
  if (d.result.profitAmount > 0) {
    sy += 6;
    doc.text(`Service / Markup:`, 20, sy);
    doc.text(fmt(d.result.profitAmount), pageWidth - 20, sy, { align: "right" });
  }

  y = y + 52;
  // Final total card
  doc.setFillColor(15, 23, 42);
  doc.rect(14, y, pageWidth - 28, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Grand Total", 20, y + 9);
  doc.setFontSize(14);
  doc.text(fmt(d.result.finalTotal), pageWidth - 20, y + 9, { align: "right" });
  if (d.result.totalPassengers > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Per Person (${d.result.totalPassengers} pax)`, 20, y + 17);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(d.result.perPerson), pageWidth - 20, y + 17, { align: "right" });
  }

  // Footer note
  const pageHeight = doc.internal.pageSize.height;
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text(
    "Note: This is a draft quotation. Prices may vary based on availability and final confirmation.",
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  const filename = `Umrah_Quotation_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`;
  doc.save(filename);
}
