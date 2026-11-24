import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { FileText, FileSpreadsheet, Download, ChevronDown } from "lucide-react";
import { useVendors, useClients } from "@/hooks/useStorage";
import { useAgency } from "@/hooks/useAgency";
import { useAgencyBranding } from "@/hooks/useAgencyBranding";
import {
  drawBrandLogo,
  formatBrandingContactParts,
  getContrastTextRgb,
  hexToRgb,
} from "@/lib/pdf/agencyBranding";
import { openPdfInNewTab } from "@/lib/pdf/openPdfInNewTab";
import { format, differenceInDays, parseISO } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface AgingData {
  vendorId: string;
  vendorName: string;
  serviceType: string;
  bucket0to7: number;
  bucket8to15: number;
  bucket16to30: number;
  bucket30plus: number;
  totalOutstanding: number;
  bookingsCount: number;
}

export function VendorAgingReport() {
  const { vendors } = useVendors();
  const { clients } = useClients();
  const { data: agency } = useAgency();
  const { getBrandingAsync } = useAgencyBranding();

  // Calculate aging data for all vendors (read-only from existing data)
  const agingData = useMemo((): AgingData[] => {
    const today = new Date();

    return vendors.map(vendor => {
      const vendorClients = clients.filter(c => c.vendor_id === vendor.id);
      
      const buckets = {
        "0-7": 0,
        "8-15": 0,
        "16-30": 0,
        "30+": 0,
      };

      let totalFromBookings = 0;

      vendorClients.forEach(client => {
        const purchasingPrice = Number(client.purchasing_price) || 0;
        if (purchasingPrice <= 0) return;

        totalFromBookings += purchasingPrice;

        const referenceDate = client.flight_date || client.created_at;
        if (!referenceDate) return;

        const daysSince = differenceInDays(today, parseISO(referenceDate));

        if (daysSince <= 7) {
          buckets["0-7"] += purchasingPrice;
        } else if (daysSince <= 15) {
          buckets["8-15"] += purchasingPrice;
        } else if (daysSince <= 30) {
          buckets["16-30"] += purchasingPrice;
        } else {
          buckets["30+"] += purchasingPrice;
        }
      });

      const vendorDirectAmount = Number(vendor.payment_amount) || 0;
      const totalPayable = totalFromBookings + vendorDirectAmount;
      const amountPaid = Number(vendor.amount_paid) || 0;
      const totalOutstanding = totalPayable - amountPaid;

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        serviceType: vendor.service_type || "-",
        bucket0to7: buckets["0-7"],
        bucket8to15: buckets["8-15"],
        bucket16to30: buckets["16-30"],
        bucket30plus: buckets["30+"],
        totalOutstanding: Math.max(0, totalOutstanding),
        bookingsCount: vendorClients.length,
      };
    }).filter(v => v.totalOutstanding > 0 || v.bookingsCount > 0);
  }, [vendors, clients]);

  // Calculate grand totals
  const grandTotals = useMemo(() => {
    return {
      bucket0to7: agingData.reduce((sum, v) => sum + v.bucket0to7, 0),
      bucket8to15: agingData.reduce((sum, v) => sum + v.bucket8to15, 0),
      bucket16to30: agingData.reduce((sum, v) => sum + v.bucket16to30, 0),
      bucket30plus: agingData.reduce((sum, v) => sum + v.bucket30plus, 0),
      totalOutstanding: agingData.reduce((sum, v) => sum + v.totalOutstanding, 0),
      totalBookings: agingData.reduce((sum, v) => sum + v.bookingsCount, 0),
    };
  }, [agingData]);

  const exportPDF = async () => {
    const branding = await getBrandingAsync();
    const primaryRgb = hexToRgb(branding.brandColor);
    const contrastRgb = getContrastTextRgb(primaryRgb);
    const doc = new jsPDF("landscape");
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(...primaryRgb);
    doc.rect(0, 0, pageWidth, 4, "F");

    let leftX = 14;
    if (branding.logo) {
      const logoRes = drawBrandLogo(doc, branding.logo, 14, 7, 14, 14, "left");
      if (logoRes.rendered) leftX = 14 + logoRes.width + 3;
    }

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(branding.agencyName, leftX, 14);

    const contactParts = formatBrandingContactParts(branding);
    if (contactParts.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(contactParts.join("  |  "), leftX, 19);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text("Vendor Aging Report", pageWidth - 14, 14, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, pageWidth - 14, 20, { align: "right" });

    // Summary Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Summary", 14, 30);

    autoTable(doc, {
      startY: 34,
      head: [["Metric", "Value"]],
      body: [
        ["Total Vendors with Outstanding", agingData.length.toString()],
        ["Total Outstanding Amount", `PKR ${grandTotals.totalOutstanding.toLocaleString()}`],
        ["0-7 Days", `PKR ${grandTotals.bucket0to7.toLocaleString()}`],
        ["8-15 Days", `PKR ${grandTotals.bucket8to15.toLocaleString()}`],
        ["16-30 Days", `PKR ${grandTotals.bucket16to30.toLocaleString()}`],
        ["30+ Days (Overdue)", `PKR ${grandTotals.bucket30plus.toLocaleString()}`],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: primaryRgb, textColor: contrastRgb },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 50 } },
    });

    // Detail Table
    const detailStartY = (doc as any).lastAutoTable.finalY + 12;
    doc.text("Vendor Details", 14, detailStartY);

    autoTable(doc, {
      startY: detailStartY + 4,
      head: [["Vendor", "Service Type", "Bookings", "0-7 Days", "8-15 Days", "16-30 Days", "30+ Days", "Total Outstanding"]],
      body: agingData.map(v => [
        v.vendorName,
        v.serviceType,
        v.bookingsCount.toString(),
        `PKR ${v.bucket0to7.toLocaleString()}`,
        `PKR ${v.bucket8to15.toLocaleString()}`,
        `PKR ${v.bucket16to30.toLocaleString()}`,
        `PKR ${v.bucket30plus.toLocaleString()}`,
        `PKR ${v.totalOutstanding.toLocaleString()}`,
      ]),
      foot: [[
        "TOTAL",
        "",
        grandTotals.totalBookings.toString(),
        `PKR ${grandTotals.bucket0to7.toLocaleString()}`,
        `PKR ${grandTotals.bucket8to15.toLocaleString()}`,
        `PKR ${grandTotals.bucket16to30.toLocaleString()}`,
        `PKR ${grandTotals.bucket30plus.toLocaleString()}`,
        `PKR ${grandTotals.totalOutstanding.toLocaleString()}`,
      ]],
      styles: { fontSize: 8 },
      headStyles: { fillColor: primaryRgb, textColor: contrastRgb },
      footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
    });

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`${branding.agencyName} • Vendor Aging Report`, 14, pageHeight - 8);

    openPdfInNewTab(doc, `Vendor_Aging_Report_${format(new Date(), "yyyyMMdd")}.pdf`);
    toast.success("Vendor Aging Report PDF opened in a new tab");
  };

  const exportExcel = () => {
    // Summary sheet data
    const summaryData = [
      ["Vendor Aging Report"],
      [`Agency: ${agency?.name || "-"}`],
      [`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`],
      [],
      ["Summary"],
      ["Metric", "Value"],
      ["Total Vendors with Outstanding", agingData.length],
      ["Total Outstanding Amount (PKR)", grandTotals.totalOutstanding],
      ["0-7 Days (PKR)", grandTotals.bucket0to7],
      ["8-15 Days (PKR)", grandTotals.bucket8to15],
      ["16-30 Days (PKR)", grandTotals.bucket16to30],
      ["30+ Days Overdue (PKR)", grandTotals.bucket30plus],
    ];

    // Detail sheet data
    const detailData = [
      ["Vendor", "Service Type", "Bookings", "0-7 Days (PKR)", "8-15 Days (PKR)", "16-30 Days (PKR)", "30+ Days (PKR)", "Total Outstanding (PKR)"],
      ...agingData.map(v => [
        v.vendorName,
        v.serviceType,
        v.bookingsCount,
        v.bucket0to7,
        v.bucket8to15,
        v.bucket16to30,
        v.bucket30plus,
        v.totalOutstanding,
      ]),
      [], // Empty row before totals
      [
        "TOTAL",
        "",
        grandTotals.totalBookings,
        grandTotals.bucket0to7,
        grandTotals.bucket8to15,
        grandTotals.bucket16to30,
        grandTotals.bucket30plus,
        grandTotals.totalOutstanding,
      ],
    ];

    // Create workbook with two sheets
    const wb = XLSX.utils.book_new();
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, detailSheet, "Vendor Details");

    XLSX.writeFile(wb, `Vendor_Aging_Report_${format(new Date(), "yyyyMMdd")}.xlsx`);
    toast.success("Vendor Aging Report Excel downloaded");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Aging Report
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportPDF}>
          <FileText className="w-4 h-4 mr-2" />
          Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportExcel}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Download Excel
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {agingData.length} vendors • ₨ {grandTotals.totalOutstanding.toLocaleString()} outstanding
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
