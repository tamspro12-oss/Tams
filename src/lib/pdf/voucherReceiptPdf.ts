import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface VoucherPdfData {
  voucherNo: string;
  voucherDate: string;
  direction: "received" | "paid";
  paymentMode: "cash" | "bank" | "transfer";
  partyName: string;
  partyPhone?: string;
  amount: number;
  accountName: string;
  referenceNo?: string;
  notes?: string;
  isAdjustment?: boolean;
  allocations?: { invoiceNo: string; amount: number }[];
  agency?: {
    name?: string;
    phone?: string;
    address?: string;
  };
}

const BRAND = {
  navy: [11, 25, 44] as [number, number, number],
  teal: [13, 148, 136] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
};

export function generateVoucherPdf(data: VoucherPdfData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top Navy Bar
  doc.setFillColor(...BRAND.navy);
  doc.rect(0, 0, pageWidth, 28, "F");

  const title =
    data.direction === "received"
      ? "CASH / BANK RECEIPT VOUCHER (CRV)"
      : "PAYMENT VOUCHER (CPV)";

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.agency?.name || "TAMS PRO TRAVEL AGENCY", 14, 13);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(title, 14, 20);

  // Teal line
  doc.setFillColor(...BRAND.teal);
  doc.rect(0, 27, pageWidth, 2, "F");

  let y = 38;
  doc.setTextColor(...BRAND.text);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`VOUCHER NO: ${data.voucherNo}`, 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${data.voucherDate}`, 14, y + 6);
  doc.text(`Mode: ${data.paymentMode.toUpperCase()} (${data.accountName})`, 14, y + 12);

  // Party box
  doc.setFont("helvetica", "bold");
  doc.text(data.direction === "received" ? "RECEIVED FROM:" : "PAID TO:", 120, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.partyName, 120, y + 6);
  if (data.partyPhone) doc.text(`Contact: ${data.partyPhone}`, 120, y + 12);
  if (data.referenceNo) doc.text(`Ref / Chq No: ${data.referenceNo}`, 120, y + 18);

  y += 28;

  // Amount in Numbers & Words Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, pageWidth - 28, 24, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.navy);
  doc.text(`AMOUNT: PKR ${data.amount.toLocaleString()}`, 20, y + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.muted);
  doc.text(`Payment allocated via ${data.paymentMode} account: ${data.accountName}`, 20, y + 18);

  y += 32;

  // Allocations Table if available
  if (data.allocations && data.allocations.length > 0) {
    const allocRows = data.allocations.map((a, i) => [
      i + 1,
      a.invoiceNo,
      `PKR ${a.amount.toLocaleString()}`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [["#", "Invoice Matched", "Allocated Amount"]],
      body: allocRows,
      headStyles: { fillColor: BRAND.navy, textColor: [255, 255, 255], fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (data.notes) {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.text);
    doc.text("Description / Remarks:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.notes, 14, y + 5);
    y += 18;
  }

  // Signatures
  y = Math.max(y + 20, 240);
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, 64, y);
  doc.line(140, y, 190, y);

  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text("Prepared By", 14, y + 5);
  doc.text("Received / Authorized By", 140, y + 5);

  doc.save(`Voucher_${data.voucherNo}.pdf`);
}

