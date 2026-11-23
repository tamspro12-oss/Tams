import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, startOfDay, endOfDay } from "date-fns";
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

function resolveExportBranding(
  brandingOrName?: AgencyBranding | string | null
): AgencyBranding {
  if (brandingOrName && typeof brandingOrName === "object") {
    return enrichWithCachedBranding(brandingOrName);
  }
  return enrichWithCachedBranding(
    resolveAgencyBrandingFromRecords({
      signupAgencyName: typeof brandingOrName === "string" ? brandingOrName : null,
      invoiceTemplate: { themeColor: DEFAULT_BRAND_COLOR },
    })
  );
}

function drawExportHeader(
  doc: jsPDF,
  branding: AgencyBranding,
  title: string,
  subtitle?: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const primaryRgb = hexToRgb(branding.brandColor);
  const contrastRgb = getContrastTextRgb(primaryRgb);

  doc.setFillColor(...primaryRgb);
  doc.rect(0, 0, pageWidth, 24, "F");

  let leftX = 14;
  if (branding.logo) {
    const res = drawBrandLogo(doc, branding.logo, 14, 4, 16, 16, "left", {
      backing: "white-pill",
    });
    if (res.rendered) leftX = 14 + res.width + 3;
  }

  doc.setTextColor(...contrastRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.text(branding.agencyName, leftX, 11);

  const contactLine = formatBrandingContactParts(branding).join("  |  ");
  if (contactLine) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(contactLine, 110).slice(0, 1), leftX, 17.5);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, pageWidth - 14, 11, { align: "right" });
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(subtitle, pageWidth - 14, 17.5, { align: "right" });
  }

  doc.setTextColor(30, 41, 59);
  return 32;
}

export async function exportClientsReport(
  clients: any[],
  startDate: Date | null,
  endDate: Date | null,
  brandingOrName?: AgencyBranding | string
) {
  const branding = resolveExportBranding(brandingOrName);
  const primaryRgb = hexToRgb(branding.brandColor);
  const contrastRgb = getContrastTextRgb(primaryRgb);
  const doc = new jsPDF();

  let filteredClients = clients;
  if (startDate && endDate) {
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);
    filteredClients = clients.filter((c) => {
      const date = new Date(c.flight_date || c.created_at);
      return date >= start && date <= end;
    });
  }

  const dateRange =
    startDate && endDate
      ? `${format(startDate, "dd MMM yyyy")} - ${format(endDate, "dd MMM yyyy")}`
      : "All Time";

  let y = drawExportHeader(doc, branding, "Client Bookings Report", `Period: ${dateRange}`);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")}`, 14, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    head: [["#", "Name", "Passport", "Service", "Selling", "Paid", "Pending", "Status"]],
    body: filteredClients.map((c, index) => {
      const selling = Number(c.selling_price) || 0;
      const paid = Number(c.amount_paid) || 0;
      const pending = selling - paid;

      return [
        (index + 1).toString(),
        c.name || "—",
        c.passport_number || "—",
        c.travel_type || "—",
        selling > 0 ? `PKR ${selling.toLocaleString()}` : "—",
        paid > 0 ? `PKR ${paid.toLocaleString()}` : "—",
        pending > 0 ? `PKR ${pending.toLocaleString()}` : "—",
        c.payment_status || "—",
      ];
    }),
    styles: { fontSize: 8.5, cellPadding: 2.8 },
    headStyles: { fillColor: primaryRgb, textColor: contrastRgb, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 11 },
      1: { cellWidth: 35 },
      2: { cellWidth: 27 },
      3: { cellWidth: 24 },
      4: { cellWidth: 26 },
      5: { cellWidth: 25 },
      6: { cellWidth: 25 },
      7: { cellWidth: 19 },
    },
  });

  const yPos = (doc as any).lastAutoTable.finalY + 12;
  const totalSelling = filteredClients.reduce((sum, c) => sum + (Number(c.selling_price) || 0), 0);
  const totalPaid = filteredClients.reduce((sum, c) => sum + (Number(c.amount_paid) || 0), 0);
  const totalPending = totalSelling - totalPaid;
  const fullyPaidCount = filteredClients.filter((c) => {
    const selling = Number(c.selling_price) || 0;
    const paid = Number(c.amount_paid) || 0;
    return paid >= selling;
  }).length;

  doc.setFillColor(240, 242, 245);
  doc.rect(14, yPos - 5, 182, 35, "F");

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Summary", 20, yPos + 3);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const leftCol = 20;
  const rightCol = 110;

  doc.text(`Total Bookings: ${filteredClients.length}`, leftCol, yPos + 12);
  doc.text(`Total Selling Price: PKR ${totalSelling.toLocaleString()}`, leftCol, yPos + 20);

  doc.text(`Amount Collected: PKR ${totalPaid.toLocaleString()}`, rightCol, yPos + 12);
  doc.text(`Pending Payment: PKR ${totalPending.toLocaleString()}`, rightCol, yPos + 20);

  doc.setFont("helvetica", "bold");
  doc.text(`Fully Paid: ${fullyPaidCount} of ${filteredClients.length}`, rightCol, yPos + 28);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${branding.agencyName} • Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }

  doc.save(`ClientBookings_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`);
}

export async function exportExpensesReport(
  expenses: any[],
  startDate: Date | null,
  endDate: Date | null,
  brandingOrName?: AgencyBranding | string
) {
  const branding = resolveExportBranding(brandingOrName);
  const primaryRgb = hexToRgb(branding.brandColor);
  const contrastRgb = getContrastTextRgb(primaryRgb);
  const doc = new jsPDF();

  let filteredExpenses = expenses;
  if (startDate && endDate) {
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);
    filteredExpenses = expenses.filter((e) => {
      const date = new Date(e.expense_date);
      return date >= start && date <= end;
    });
  }

  const dateRange =
    startDate && endDate
      ? `${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`
      : "All Time";

  const y = drawExportHeader(doc, branding, "Expenses Report", `Period: ${dateRange}`);

  autoTable(doc, {
    startY: y + 4,
    head: [["Type", "Amount (PKR)", "Date", "Notes"]],
    body: filteredExpenses.map((e) => [
      e.expense_type || "—",
      e.amount ? `PKR ${Number(e.amount).toLocaleString()}` : "—",
      e.expense_date ? format(new Date(e.expense_date), "dd/MM/yyyy") : "—",
      e.notes || "—",
    ]),
    headStyles: { fillColor: primaryRgb, textColor: contrastRgb, fontStyle: "bold" },
    styles: { fontSize: 9 },
  });

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const yPos = (doc as any).lastAutoTable.finalY + 12;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Expenses: PKR ${totalExpenses.toLocaleString()}`, 14, yPos);

  doc.save(`Expenses_${format(new Date(), "yyyy_MM_dd_HHmmss")}.pdf`);
}

export async function exportMonthlyReport(
  month: Date,
  clients: any[],
  bookings: any[],
  expenses: any[],
  brandingOrName?: AgencyBranding | string
) {
  const branding = resolveExportBranding(brandingOrName);
  const primaryRgb = hexToRgb(branding.brandColor);
  const contrastRgb = getContrastTextRgb(primaryRgb);
  const doc = new jsPDF();
  const monthStr = format(month, "MMMM yyyy");

  let yPos = drawExportHeader(doc, branding, "Monthly Report", monthStr);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Clients", 14, yPos);
  yPos += 4;

  autoTable(doc, {
    startY: yPos,
    head: [["Name", "Contact", "Passport", "CNIC", "Travel Type"]],
    body: clients.map((c) => [
      c.name || "—",
      c.contact_number || "—",
      c.passport_number || "—",
      c.cnic || "—",
      c.travel_type || "—",
    ]),
    headStyles: { fillColor: primaryRgb, textColor: contrastRgb, fontStyle: "bold" },
    styles: { fontSize: 8.5 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;
  doc.setFontSize(12);
  doc.text("Bookings", 14, yPos);
  yPos += 4;

  autoTable(doc, {
    startY: yPos,
    head: [["PNR", "Flight Date", "Class", "Type", "Payment Status"]],
    body: bookings.map((b) => [
      b.pnr || "—",
      b.flight_date ? format(new Date(b.flight_date), "dd/MM/yyyy") : "—",
      b.seat_class || "—",
      b.booking_type || "—",
      b.payment_status || "—",
    ]),
    headStyles: { fillColor: primaryRgb, textColor: contrastRgb, fontStyle: "bold" },
    styles: { fontSize: 8.5 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(12);
  doc.text("Expenses", 14, yPos);
  yPos += 4;

  autoTable(doc, {
    startY: yPos,
    head: [["Type", "Amount (PKR)", "Date", "Notes"]],
    body: expenses.map((e) => [
      e.expense_type || "—",
      e.amount ? `PKR ${Number(e.amount).toLocaleString()}` : "—",
      e.expense_date ? format(new Date(e.expense_date), "dd/MM/yyyy") : "—",
      e.notes || "—",
    ]),
    headStyles: { fillColor: primaryRgb, textColor: contrastOn(primaryRgb), fontStyle: "bold" },
    styles: { fontSize: 8.5 },
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  yPos = (doc as any).lastAutoTable.finalY + 12;

  if (yPos > 265) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Clients: ${clients.length}`, 14, yPos);
  doc.text(`Total Bookings: ${bookings.length}`, 14, yPos + 7);
  doc.text(`Total Expenses: PKR ${totalExpenses.toLocaleString()}`, 14, yPos + 14);

  const safeAgencySlug = branding.agencyName.replace(/[^a-zA-Z0-9_-]/g, "_") || "Agency";
  doc.save(`${safeAgencySlug}_Monthly_Report_${format(month, "yyyy_MM")}.pdf`);
}

function contrastOn(rgb: [number, number, number]) {
  return getContrastTextRgb(rgb);
}

export async function exportAllMonthlyReports(
  clients: any[],
  bookings: any[],
  expenses: any[],
  brandingOrName?: AgencyBranding | string
) {
  const months = new Set<string>();

  [...clients, ...bookings, ...expenses].forEach((item) => {
    const date = new Date(item.created_at || item.expense_date || item.flight_date);
    if (!isNaN(date.getTime())) {
      months.add(format(date, "yyyy-MM"));
    }
  });

  for (const monthStr of Array.from(months).sort()) {
    const [year, month] = monthStr.split("-").map(Number);
    const monthDate = new Date(year, month - 1, 1);

    const monthClients = clients.filter((c) => {
      const d = new Date(c.created_at);
      return format(d, "yyyy-MM") === monthStr;
    });

    const monthBookings = bookings.filter((b) => {
      const d = new Date(b.created_at || b.flight_date);
      return format(d, "yyyy-MM") === monthStr;
    });

    const monthExpenses = expenses.filter((e) => {
      const d = new Date(e.created_at || e.expense_date);
      return format(d, "yyyy-MM") === monthStr;
    });

    await exportMonthlyReport(monthDate, monthClients, monthBookings, monthExpenses, brandingOrName);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
