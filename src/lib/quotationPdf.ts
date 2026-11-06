import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { Quotation } from "@/hooks/useQuotations";

interface BuildOptions {
  agencyName?: string;
  agencyEmail?: string;
  agencyPhone?: string;
}

export function buildQuotationPdf(q: Quotation, opts: BuildOptions = {}) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;

  // Header band
  doc.setFillColor(10, 37, 64);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(opts.agencyName || "Quotation", 14, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const contactLine = [opts.agencyEmail, opts.agencyPhone].filter(Boolean).join("  |  ");
  if (contactLine) doc.text(contactLine, 14, 22);

  doc.setTextColor(0, 0, 0);
  y = 38;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("QUOTATION", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`#${q.quotation_number}`, pageWidth - 14, y, { align: "right" });
  y += 8;

  doc.setFontSize(10);
  doc.text(`Date: ${format(new Date(q.quotation_date), "dd MMM yyyy")}`, 14, y);
  if (q.valid_until) {
    doc.text(`Valid Until: ${format(new Date(q.valid_until), "dd MMM yyyy")}`, pageWidth - 14, y, { align: "right" });
  }
  y += 8;

  // Client block
  doc.setFont("helvetica", "bold");
  doc.text("Quotation For:", 14, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(q.client_name, 14, y); y += 5;
  if (q.client_email) { doc.text(q.client_email, 14, y); y += 5; }
  if (q.client_phone) { doc.text(q.client_phone, 14, y); y += 5; }

  doc.setFont("helvetica", "bold");
  doc.text(
    `Service: ${({ client_booking: "Client Booking", b2b: "B2B Service", umrah: "Umrah Package", custom: "Custom" } as any)[q.service_type] || q.service_type}`,
    pageWidth - 14,
    y - (q.client_phone ? 10 : q.client_email ? 5 : 0),
    { align: "right" }
  );
  doc.setFont("helvetica", "normal");
  y += 2;

  if (q.title) {
    doc.setFont("helvetica", "bold");
    doc.text(q.title, 14, y); y += 6;
    doc.setFont("helvetica", "normal");
  }
  if (q.description) {
    const lines = doc.splitTextToSize(q.description, pageWidth - 28);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 2;
  }

  // Items
  const items = q.items?.length
    ? q.items
    : [{ description: q.title || "Service", qty: 1, unit_price: q.total, amount: q.total }];

  autoTable(doc, {
    startY: y + 2,
    head: [["#", "Description", "Qty", `Unit (${q.currency})`, `Amount (${q.currency})`]],
    body: items.map((it, i) => [
      String(i + 1),
      it.description || "-",
      String(it.qty || 0),
      Number(it.unit_price || 0).toLocaleString(),
      Number(it.amount || 0).toLocaleString(),
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [10, 37, 64], textColor: 255 },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      2: { halign: "center", cellWidth: 18 },
      3: { halign: "right", cellWidth: 35 },
      4: { halign: "right", cellWidth: 38 },
    },
  });

  let endY = (doc as any).lastAutoTable.finalY + 6;

  // Totals
  const totalsX = pageWidth - 80;
  const valueX = pageWidth - 14;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, totalsX, endY);
    doc.text(value, valueX, endY, { align: "right" });
    endY += 6;
  };
  doc.setFontSize(10);
  row("Subtotal", `${q.currency} ${Number(q.subtotal).toLocaleString()}`);
  if (q.discount) row("Discount", `- ${q.currency} ${Number(q.discount).toLocaleString()}`);
  if (q.tax) row("Tax", `${q.currency} ${Number(q.tax).toLocaleString()}`);
  doc.setDrawColor(200);
  doc.line(totalsX, endY - 4, valueX, endY - 4);
  doc.setFontSize(12);
  row("TOTAL", `${q.currency} ${Number(q.total).toLocaleString()}`, true);

  // Notes / terms
  doc.setFontSize(9);
  if (q.notes) {
    endY += 4;
    doc.setFont("helvetica", "bold");
    doc.text("Notes", 14, endY); endY += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(q.notes, pageWidth - 28);
    doc.text(lines, 14, endY);
    endY += lines.length * 4 + 2;
  }
  if (q.terms) {
    endY += 2;
    doc.setFont("helvetica", "bold");
    doc.text("Terms & Conditions", 14, endY); endY += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(q.terms, pageWidth - 28);
    doc.text(lines, 14, endY);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `Generated ${format(new Date(), "dd MMM yyyy, HH:mm")} • ${opts.agencyName || ""}`.trim(),
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );

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
