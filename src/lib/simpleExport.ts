import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

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
  agencyName?: string
) {
  const doc = new jsPDF();
  let y = 14;
  if (agencyName) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(agencyName, 14, y);
    y += 8;
  }
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")}`, 14, y);
  y += 6;

  if (!rows.length) {
    doc.setFontSize(11);
    doc.text("No data to display.", 14, y + 6);
  } else {
    const headers = Object.keys(rows[0]);
    autoTable(doc, {
      startY: y + 4,
      head: [headers],
      body: rows.map((r) => headers.map((h) => String(r[h] ?? ""))),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [10, 37, 64] },
    });
  }
  doc.save(`${fileName}-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
}
