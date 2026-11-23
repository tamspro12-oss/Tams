import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { Quotation } from "@/hooks/useQuotations";
import { getServiceDisplayLabel } from "@/lib/serviceDefinitions";
import {
  DEFAULT_BRAND_COLOR,
  drawBrandLogo,
  enrichWithCachedBranding,
  ensureReadableOnWhite,
  formatBrandingContactParts,
  getContrastTextRgb,
  hexToRgb,
  resolveAgencyBrandingFromRecords,
  tintRgb,
  type AgencyBranding,
  type RgbTuple,
} from "@/lib/pdf/agencyBranding";

interface BuildOptions {
  branding?: AgencyBranding;
  agencyName?: string;
  agencyEmail?: string;
  agencyPhone?: string;
  agencyAddress?: string;
  brandColor?: string;
  logo?: string | null;
}

const TEXT_DARK: RgbTuple = [15, 23, 42];
const TEXT_BODY: RgbTuple = [30, 41, 59];
const TEXT_MUTED: RgbTuple = [100, 116, 139];
const BORDER_LIGHT: RgbTuple = [226, 232, 240];
const ROW_ALT: RgbTuple = [248, 250, 252];

function resolveQuotationBranding(opts: BuildOptions): AgencyBranding {
  if (opts.branding) {
    return enrichWithCachedBranding(opts.branding);
  }
  return enrichWithCachedBranding(
    resolveAgencyBrandingFromRecords({
      signupAgencyName: opts.agencyName || null,
      invoiceTemplate: {
        agencyName: opts.agencyName,
        email: opts.agencyEmail,
        phone: opts.agencyPhone,
        address: opts.agencyAddress,
        themeColor: opts.brandColor || DEFAULT_BRAND_COLOR,
        logo: opts.logo || undefined,
      },
    })
  );
}

function formatQuoteDate(raw?: string | null): string {
  if (!raw) return "";
  try {
    const dt = new Date(raw);
    if (!Number.isNaN(dt.getTime())) {
      return format(dt, "dd MMM yyyy");
    }
  } catch {
    // fallback to raw
  }
  return raw;
}

export function buildQuotationPdf(q: Quotation, opts: BuildOptions = {}) {
  const branding = resolveQuotationBranding(opts);
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

  const drawTopBar = () => {
    doc.setFillColor(...primaryRgb);
    doc.rect(0, 0, pageWidth, 2.5, "F");
  };

  drawTopBar();

  // Header: Left (Logo + Agency Name + Branding contact) | Right (QUOTATION + # + Status)
  let leftTextX = marginX;
  if (branding.logo) {
    const logoRes = drawBrandLogo(doc, branding.logo, marginX, 6, 22, 16, "left");
    if (logoRes.rendered) {
      leftTextX = marginX + logoRes.width + 4;
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...TEXT_DARK);
  const agencyNameLines = doc.splitTextToSize(branding.agencyName, 92).slice(0, 2);
  doc.text(agencyNameLines, leftTextX, 12.5);

  const contactParts = formatBrandingContactParts(branding);
  let leftBottomY = 12.5 + agencyNameLines.length * 5.2;
  if (contactParts.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    const contactLines = doc
      .splitTextToSize(contactParts.join("  |  "), 102)
      .slice(0, 2);
    doc.text(contactLines, leftTextX, leftBottomY);
    leftBottomY += contactLines.length * 4;
  }

  // Right: QUOTATION title & number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...readablePrimary);
  doc.text("QUOTATION", pageWidth - marginX, 13, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_DARK);
  doc.text(`#${q.quotation_number}`, pageWidth - marginX, 19, { align: "right" });

  if (q.status) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`Status: ${String(q.status).toUpperCase()}`, pageWidth - marginX, 24, {
      align: "right",
    });
  }

  let y = Math.max(31, leftBottomY + 4);

  // Colored Rounded Info Box (consistent with Booking Confirmation)
  const serviceLabel = getServiceDisplayLabel(q.service_type);
  const serviceTitle = q.title?.trim() || serviceLabel;
  const quoteDateStr = formatQuoteDate(q.quotation_date) || format(new Date(), "dd MMM yyyy");
  const validUntilStr = formatQuoteDate(q.valid_until);

  const infoCols = [
    {
      label: "QUOTATION FOR",
      value: q.client_phone ? `${q.client_name} (${q.client_phone})` : q.client_name,
      width: validUntilStr ? 64 : 80,
    },
    { label: "QUOTATION DATE", value: quoteDateStr, width: validUntilStr ? 36 : 44 },
    ...(validUntilStr
      ? [{ label: "VALID UNTIL", value: validUntilStr, width: 36 }]
      : []),
    {
      label: "SERVICE TYPE",
      value: serviceLabel,
      width: contentW - (validUntilStr ? 136 : 124),
    },
  ];

  const infoBoxH = 16.5;
  doc.setFillColor(...primaryRgb);
  doc.roundedRect(marginX, y, contentW, infoBoxH, 2.5, 2.5, "F");

  let colX = marginX;
  infoCols.forEach((col, idx) => {
    if (idx > 0) {
      doc.setDrawColor(...tintRgb(primaryRgb, 0.35));
      doc.setLineWidth(0.25);
      doc.line(colX, y + 3, colX, y + infoBoxH - 3);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.6);
    doc.setTextColor(...contrastOnPrimary);
    doc.text(col.label, colX + 3.5, y + 5.8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    const valLines = doc.splitTextToSize(col.value || "", col.width - 7).slice(0, 1);
    doc.text(valLines, colX + 3.5, y + 12.2);
    colX += col.width;
  });

  y += infoBoxH + 8;

  // Service Summary Card (Title & Description if present)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...TEXT_DARK);
  const titleLines = doc.splitTextToSize(serviceTitle, contentW);
  doc.text(titleLines, marginX, y);
  y += titleLines.length * 4.8 + 1;

  if (q.description?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    doc.setTextColor(...TEXT_BODY);
    const descLines = doc.splitTextToSize(q.description.trim(), contentW);
    doc.text(descLines, marginX, y);
    y += descLines.length * 4.4 + 3;
  } else {
    y += 2;
  }

  // Items Table
  const curr = q.currency || "PKR";
  const effectiveTotal = Number(q.total ?? (q as any).total_amount ?? 0);
  const items = q.items?.length
    ? q.items
    : [{ description: serviceTitle, qty: 1, unit_price: effectiveTotal, amount: effectiveTotal }];

  autoTable(doc, {
    startY: y,
    head: [["#", "Description", "Qty", `Unit (${curr})`, `Amount (${curr})`]],
    body: items.map((it, i) => {
      const qtyVal = Number(it.qty ?? (it as any).quantity ?? 1);
      const unitVal = Number(it.unit_price ?? (it as any).unitPrice ?? 0);
      const amountVal = Number(it.amount ?? (it as any).total ?? qtyVal * unitVal);
      return [
        String(i + 1),
        it.description || serviceTitle,
        String(qtyVal),
        unitVal.toLocaleString(),
        amountVal.toLocaleString(),
      ];
    }),
    showHead: "everyPage",
    theme: "grid",
    styles: {
      fontSize: 8.8,
      cellPadding: 3,
      textColor: TEXT_BODY,
      lineColor: BORDER_LIGHT,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: primaryRgb,
      textColor: contrastOnPrimary,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { halign: "center", cellWidth: 11 },
      2: { halign: "center", cellWidth: 18 },
      3: { halign: "right", cellWidth: 34 },
      4: { halign: "right", cellWidth: 38, fontStyle: "bold" },
    },
    margin: { left: marginX, right: marginX, top: 14, bottom: 26 },
    didDrawPage: (hookData) => {
      if (hookData.pageNumber > 1) {
        drawTopBar();
      }
    },
  });

  let endY = (doc as any).lastAutoTable.finalY + 8;

  // Totals Card (Right aligned)
  const totalsCardW = 76;
  const totalsX = pageWidth - marginX - totalsCardW;
  const valueX = pageWidth - marginX - 4;
  const labelX = totalsX + 4;
  const hasDiscount = Number(q.discount) > 0;
  const hasTax = Number(q.tax) > 0;
  const totalsRowsCount = 1 + (hasDiscount ? 1 : 0) + (hasTax ? 1 : 0);
  const totalsBoxH = totalsRowsCount * 6.5 + 15;

  if (endY + totalsBoxH > pageHeight - 26) {
    doc.addPage();
    drawTopBar();
    endY = 16;
  }

  doc.setFillColor(...ROW_ALT);
  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.35);
  doc.roundedRect(totalsX, endY, totalsCardW, totalsBoxH, 2, 2, "FD");

  let rowY = endY + 6.5;
  const drawTotalRow = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_BODY);
    doc.text(label, labelX, rowY);
    doc.setFont("helvetica", "bold");
    doc.text(value, valueX, rowY, { align: "right" });
    rowY += 6.5;
  };

  drawTotalRow("Subtotal", `${curr} ${Number(q.subtotal || 0).toLocaleString()}`);
  if (hasDiscount) {
    drawTotalRow("Discount", `- ${curr} ${Number(q.discount).toLocaleString()}`);
  }
  if (hasTax) {
    drawTotalRow("Tax", `${curr} ${Number(q.tax).toLocaleString()}`);
  }

  // Highlighted Grand Total bar inside Totals Card
  const totalBarY = endY + totalsBoxH - 11;
  doc.setFillColor(...primaryRgb);
  doc.roundedRect(totalsX, totalBarY, totalsCardW, 11, 2, 2, "F");
  doc.rect(totalsX, totalBarY, totalsCardW, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...contrastOnPrimary);
  doc.text("TOTAL", labelX, totalBarY + 7.4);
  doc.text(`${curr} ${effectiveTotal.toLocaleString()}`, valueX, totalBarY + 7.4, {
    align: "right",
  });

  endY += totalsBoxH + 8;

  // Notes (only if entered)
  if (q.notes?.trim()) {
    const noteLines = doc.splitTextToSize(q.notes.trim(), contentW - 8);
    const noteH = noteLines.length * 4.2 + 8;
    if (endY + noteH + 6 > pageHeight - 26) {
      doc.addPage();
      drawTopBar();
      endY = 16;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...readablePrimary);
    doc.text("NOTES", marginX, endY);
    endY += 3;

    doc.setFillColor(...softTint);
    doc.setDrawColor(...BORDER_LIGHT);
    doc.roundedRect(marginX, endY, contentW, noteH, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_BODY);
    doc.text(noteLines, marginX + 4, endY + 5.5);
    endY += noteH + 6;
  }

  // Terms & Conditions ONLY when the user explicitly entered them in the quotation
  if (q.terms?.trim()) {
    const termLines = doc.splitTextToSize(q.terms.trim(), contentW);
    if (endY + termLines.length * 4 + 10 > pageHeight - 26) {
      doc.addPage();
      drawTopBar();
      endY = 16;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...readablePrimary);
    doc.text("TERMS & CONDITIONS", marginX, endY);
    endY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...TEXT_BODY);
    doc.text(termLines, marginX, endY);
  }

  // Repeated Footer across all pages
  const pageCount = doc.getNumberOfPages();
  const contactLine = contactParts.join("  |  ");
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
      const lines = doc.splitTextToSize(contactLine, contentW).slice(0, 1);
      doc.text(lines, pageWidth / 2, pageHeight - 15, { align: "center" });
    }

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.2);
    doc.setTextColor(...readablePrimary);
    doc.text(
      `Thank you for considering ${branding.agencyName}!`,
      pageWidth / 2,
      contactLine ? pageHeight - 9.5 : pageHeight - 12,
      { align: "center" }
    );

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

export function downloadQuotationPdf(q: Quotation, opts: BuildOptions = {}) {
  const doc = buildQuotationPdf(q, opts);
  doc.save(`Quotation-${q.quotation_number}.pdf`);
}

export function quotationPdfBase64(q: Quotation, opts: BuildOptions = {}): string {
  const doc = buildQuotationPdf(q, opts);
  const dataUri = doc.output("datauristring");
  return dataUri.split(",")[1] || "";
}
