import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import {
  DEFAULT_BRAND_COLOR,
  drawBrandLogo,
  enrichWithCachedBranding,
  formatBrandingContactParts,
  getContrastTextRgb,
  hexToRgb,
  resolveAgencyBrandingFromRecords,
  type AgencyBranding,
} from "@/lib/pdf/agencyBranding";

export function exportRowsToExcel(
  rows: Record<string, any>[],
  fileName: string,
  sheetName = "Sheet1"
) {
  if (!rows.length) {
    rows = [{ Info: "No data" }];
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${fileName}-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`);
}

export function exportRowsToPDF(
  title: string,
  rows: Record<string, any>[],
  fileName: string,
  brandingOrName?: AgencyBranding | string
) {
  const branding: AgencyBranding = enrichWithCachedBranding(
    brandingOrName && typeof brandingOrName === "object"
      ? brandingOrName
      : resolveAgencyBrandingFromRecords({
          signupAgencyName: typeof brandingOrName === "string" ? brandingOrName : null,
          invoiceTemplate: { themeColor: DEFAULT_BRAND_COLOR },
        })
  );

  const primaryRgb = hexToRgb(branding.brandColor);
  const contrastRgb = getContrastTextRgb(primaryRgb);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...primaryRgb);
  doc.rect(0, 0, pageWidth, 24, "F");

  let leftX = 14;
  if (branding.logo) {
    const logoRes = drawBrandLogo(doc, branding.logo, 14, 4, 16, 16, "left", {
      backing: "white-pill",
    });
    if (logoRes.rendered) leftX = 14 + logoRes.width + 3;
  }

  doc.setTextColor(...contrastRgb);
  doc.setFontSize(13.5);
  doc.setFont("helvetica", "bold");
  doc.text(branding.agencyName, leftX, 11);

  const contactLine = formatBrandingContactParts(branding).join("  |  ");
  if (contactLine) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(contactLine, 105).slice(0, 1), leftX, 17.5);
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth - 14, 11, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")}`, pageWidth - 14, 17.5, {
    align: "right",
  });

  doc.setTextColor(30, 41, 59);
  const y = 32;

  if (!rows.length) {
    doc.setFontSize(11);
    doc.text("No data to display.", 14, y + 6);
  } else {
    const headers = Object.keys(rows[0]);
    autoTable(doc, {
      startY: y,
      head: [headers],
      body: rows.map((r) => headers.map((h) => String(r[h] ?? ""))),
      styles: { fontSize: 9 },
      headStyles: { fillColor: primaryRgb, textColor: contrastRgb, fontStyle: "bold" },
    });
  }
  doc.save(`${fileName}-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
}
