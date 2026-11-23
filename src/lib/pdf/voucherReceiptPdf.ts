import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatPdfEditedNote } from "@/lib/documentEditHelpers";
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

export interface VoucherPdfData {
  voucherNo: string;
  voucherDate: string;
  direction: "received" | "paid";
  paymentMode: string;
  partyName: string;
  partyPhone?: string;
  amount: number;
  accountName: string;
  referenceNo?: string;
  notes?: string;
  isAdjustment?: boolean;
  isEdited?: boolean;
  lastEditedAt?: string | null;
  allocations?: { invoiceNo: string; amount: number }[];
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

const TEXT_BODY: RgbTuple = [30, 41, 59];
const TEXT_MUTED: RgbTuple = [100, 116, 139];
const BORDER_LIGHT: RgbTuple = [226, 232, 240];

export function buildVoucherReceiptPdfDoc(data: VoucherPdfData): jsPDF {
  const branding: AgencyBranding =
    data.branding ??
    resolveAgencyBrandingFromRecords({
      signupAgencyName: data.agency?.name || null,
      invoiceTemplate: data.agency
        ? {
            agencyName: data.agency.name,
            phone: data.agency.phone,
            email: data.agency.email,
            address: data.agency.address,
            logo: data.agency.logo,
            themeColor: data.agency.brandColor || DEFAULT_BRAND_COLOR,
          }
        : null,
    });

  const primaryRgb = hexToRgb(branding.brandColor);
  const readablePrimary = ensureReadableOnWhite(primaryRgb);
  const contrastOnPrimary = getContrastTextRgb(primaryRgb);
  const softTint = tintRgb(primaryRgb, 0.93);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Top Header Bar
  doc.setFillColor(...primaryRgb);
  doc.rect(0, 0, pageWidth, 30, "F");

  let leftTextX = 14;
  if (branding.logo) {
    const logoRes = drawBrandLogo(doc, branding.logo, 14, 5, 22, 18, "left");
    if (logoRes.rendered) {
      leftTextX = 14 + logoRes.width + 4;
    }
  }

  const title =
    data.direction === "received"
      ? "CASH / BANK RECEIPT VOUCHER (CRV)"
      : "PAYMENT VOUCHER (CPV)";

  doc.setTextColor(...contrastOnPrimary);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(branding.agencyName, leftTextX, 13);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(title, leftTextX, 20.5);

  const contactParts = formatBrandingContactParts(branding);
  if (contactParts.length > 0) {
    doc.setFontSize(7.5);
    const hdrLine = doc.splitTextToSize(contactParts.join("  |  "), 78).slice(0, 2);
    doc.text(hdrLine, pageWidth - 14, 13, { align: "right" });
  }

  // Accent line
  doc.setFillColor(...readablePrimary);
  doc.rect(0, 29, pageWidth, 1.5, "F");

  let y = 40;
  doc.setTextColor(...TEXT_BODY);
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
  doc.setFillColor(...softTint);
  doc.setDrawColor(...BORDER_LIGHT);
  doc.roundedRect(14, y, pageWidth - 28, 24, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...readablePrimary);
  doc.text(`AMOUNT: PKR ${Number(data.amount || 0).toLocaleString()}`, 20, y + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_MUTED);
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
      headStyles: { fillColor: primaryRgb, textColor: contrastOnPrimary, fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (data.notes) {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_BODY);
    doc.text("Description / Remarks:", 14, y);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(data.notes, pageWidth - 28);
    doc.text(noteLines, 14, y + 5);
    y += noteLines.length * 4.5 + 12;
  }

  // Signatures
  y = Math.max(y + 18, 236);
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, 64, y);
  doc.line(140, y, 190, y);

  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Prepared By", 14, y + 5);
  doc.text("Received / Authorized By", 140, y + 5);

  // Footer
  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.35);
  doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    contactParts.length > 0
      ? `${branding.agencyName}  |  ${contactParts.join("  |  ")}`
      : branding.agencyName,
    14,
    pageHeight - 10
  );

  const editedNote = formatPdfEditedNote(data.isEdited, data.lastEditedAt);
  if (editedNote) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.text(editedNote, pageWidth - 14, pageHeight - 10, { align: "right" });
    doc.setFont("helvetica", "normal");
  }

  return doc;
}

export function generateVoucherPdf(data: VoucherPdfData) {
  const doc = buildVoucherReceiptPdfDoc(data);
  doc.save(`Voucher_${data.voucherNo}.pdf`);
}
