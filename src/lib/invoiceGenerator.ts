import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import {
  drawBrandLogo,
  ensureReadableOnWhite,
  formatBrandingContactParts,
  getContrastTextRgb,
  hexToRgb,
  resolveAgencyBrandingFromRecords,
  type AgencyBranding,
  type RgbTuple,
} from "@/lib/pdf/agencyBranding";

const TEXT_DARK: RgbTuple = [15, 23, 42];
const TEXT_BODY: RgbTuple = [30, 41, 59];
const TEXT_MUTED: RgbTuple = [100, 116, 139];
const BORDER_LIGHT: RgbTuple = [226, 232, 240];

function formatCurrency(amount: number): string {
  return `PKR ${Number(amount || 0).toLocaleString("en-PK")}`;
}

export async function generateInvoicePDF(
  client: any,
  agency: any,
  brandingOverride?: AgencyBranding | null
) {
  const branding: AgencyBranding =
    brandingOverride ??
    resolveAgencyBrandingFromRecords({
      agencyId: agency?.id ?? null,
      signupAgencyName: agency?.name || null,
    });

  const primaryRgb = hexToRgb(branding.brandColor);
  const readablePrimary = ensureReadableOnWhite(primaryRgb);
  const contrastOnPrimary = getContrastTextRgb(primaryRgb);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Top Header Bar
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

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...contrastOnPrimary);
  doc.text(branding.agencyName, leftTextX, 13);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("TAX & SALES INVOICE", leftTextX, 20.5);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageWidth - 14, 15, { align: "right" });

  // Branding contact lines right-aligned below INVOICE if present
  const contactParts = formatBrandingContactParts(branding);
  if (contactParts.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    const hdrLine = doc.splitTextToSize(contactParts.join("  |  "), 95).slice(0, 1);
    doc.text(hdrLine, pageWidth - 14, 22.5, { align: "right" });
  }

  let y = 40;
  // Invoice Meta
  doc.setTextColor(...TEXT_BODY);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`INVOICE NO: INV-${client?.id?.slice(0, 8).toUpperCase() || "DRAFT"}`, 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${format(new Date(), "dd MMM yyyy")}`, 14, y + 5.5);
  doc.text("Currency: PKR", 14, y + 11);

  // Bill To (Right aligned)
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO:", 120, y);
  doc.setFont("helvetica", "normal");
  doc.text(client?.name || "Customer", 120, y + 5.5);
  if (client?.contact_number) doc.text(`Phone: ${client.contact_number}`, 120, y + 11);
  const primaryPassenger = client?.passengers_data?.[0];
  if (primaryPassenger?.passport_number) {
    doc.text(`Passport: ${primaryPassenger.passport_number}`, 120, y + 16.5);
  }

  y += 26;

  // Service description
  const customServiceData = primaryPassenger?.custom_service;
  const serviceMeta = [
    client?.destination ? `Sector/Dest: ${client.destination}` : "",
    client?.flight_date ? `Date: ${format(new Date(client.flight_date), "dd MMM yyyy")}` : "",
    client?.airline ? `Airline: ${client.airline}` : "",
    client?.pnr ? `PNR: ${client.pnr}` : "",
    customServiceData?.reference ? `Ref: ${customServiceData.reference}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const description = [client?.travel_type || "Travel Service", serviceMeta]
    .filter(Boolean)
    .join(" — ");

  const sellingPrice = Number(client?.selling_price || client?.payment_amount) || 0;
  const amountPaid = Number(client?.amount_paid) || 0;
  const balance = Math.max(0, sellingPrice - amountPaid);

  autoTable(doc, {
    startY: y,
    head: [["#", "Description", "Qty", "Rate (PKR)", "Total (PKR)"]],
    body: [
      [
        1,
        description,
        1,
        sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }),
      ],
    ],
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
  doc.text(formatCurrency(sellingPrice), 196, y, { align: "right" });

  doc.text("Amount Received:", summaryX, y + 6);
  doc.text(formatCurrency(amountPaid), 196, y + 6, { align: "right" });

  doc.setDrawColor(...readablePrimary);
  doc.setLineWidth(0.5);
  doc.line(summaryX, y + 9, 196, y + 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_DARK);
  doc.text("Balance Due:", summaryX, y + 15);
  doc.text(formatCurrency(balance), 196, y + 15, { align: "right" });

  if (client?.notes) {
    y += 28;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text("Notes:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...TEXT_MUTED);
    const notesLines = doc.splitTextToSize(String(client.notes), pageWidth - 28).slice(0, 4);
    doc.text(notesLines, 14, y + 5);
  }

  // Footer (Agency Branding ONLY — NO Payment Terms & Conditions)
  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.4);
  doc.line(14, pageHeight - 18, pageWidth - 14, pageHeight - 18);

  const footerLine = contactParts.length > 0
    ? `${branding.agencyName}  |  ${contactParts.join("  |  ")}`
    : branding.agencyName;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_MUTED);
  doc.text(footerLine, 14, pageHeight - 11);

  const pdfBlob = doc.output("blob");
  const blobUrl =
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(pdfBlob)
      : "";
  const safeName = String(client?.name || "Invoice").replace(/\s+/g, "_");
  const filename = `Invoice_${safeName}_${format(new Date(), "yyyyMMdd")}.pdf`;

  return { blobUrl, filename, doc };
}
