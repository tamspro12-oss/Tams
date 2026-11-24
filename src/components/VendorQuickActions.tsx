import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Receipt, FileText, Download, Eye } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { toast } from "sonner";
import { useVendorPaymentHistoryLocal } from "@/hooks/useLocalPaymentHistory";
import { useClients } from "@/hooks/useStorage";
import { useAgencyBranding } from "@/hooks/useAgencyBranding";
import {
  drawBrandLogo,
  formatBrandingContactParts,
  getContrastTextRgb,
  hexToRgb,
} from "@/lib/pdf/agencyBranding";
import { openPdfInNewTab } from "@/lib/pdf/openPdfInNewTab";

interface VendorQuickActionsProps {
  vendor: {
    id: string;
    name: string;
    totalPayable: number;
    amountPaid: number;
    amountPending: number;
    clientBookingsCount: number;
    contact_person?: string;
    contact_number?: string;
    email?: string;
  };
  onViewLedger?: () => void;
  onViewBookings?: () => void;
}

export function VendorQuickActions({ vendor, onViewLedger, onViewBookings }: VendorQuickActionsProps) {
  const { history } = useVendorPaymentHistoryLocal(vendor.id);
  const { clients } = useClients();
  const { getBrandingAsync } = useAgencyBranding();

  // Download vendor statement as PDF (read-only export)
  const handleDownloadStatement = async () => {
    const branding = await getBrandingAsync();
    const primaryRgb = hexToRgb(branding.brandColor);
    const contrastRgb = getContrastTextRgb(primaryRgb);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const vendorClients = clients.filter(c => c.vendor_id === vendor.id);

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
    doc.text("Vendor Statement", pageWidth - 14, 14, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(100);
    doc.text(`Vendor: ${vendor.name}`, 14, 28);
    if (vendor.contact_person) doc.text(`Contact: ${vendor.contact_person}`, 14, 34);
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, pageWidth - 14, 28, { align: "right" });

    // Summary Section
    const summaryStartY = vendor.contact_person ? 42 : 36;
    autoTable(doc, {
      startY: summaryStartY,
      head: [["Summary", "Amount (PKR)"]],
      body: [
        ["Total Payable", `PKR ${vendor.totalPayable.toLocaleString()}`],
        ["Amount Paid", `PKR ${vendor.amountPaid.toLocaleString()}`],
        ["Outstanding", `PKR ${vendor.amountPending.toLocaleString()}`],
        ["Total Bookings", vendor.clientBookingsCount.toString()],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: primaryRgb, textColor: contrastRgb },
    });

    // Bookings Section
    if (vendorClients.length > 0) {
      const bookingsStartY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("Associated Bookings", 14, bookingsStartY);

      autoTable(doc, {
        startY: bookingsStartY + 5,
        head: [["Client", "PNR", "Destination", "Flight Date", "Amount"]],
        body: vendorClients.map(c => [
          c.name,
          c.pnr || "-",
          c.destination || "-",
          c.flight_date ? format(new Date(c.flight_date), "dd MMM yyyy") : "-",
          `PKR ${(Number(c.purchasing_price) || 0).toLocaleString()}`,
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: primaryRgb, textColor: contrastRgb },
      });
    }

    // Payment History Section
    if (history.length > 0) {
      const historyStartY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("Payment History", 14, historyStartY);

      autoTable(doc, {
        startY: historyStartY + 5,
        head: [["Date", "Amount", "Type", "Notes"]],
        body: history.map(p => [
          format(new Date(p.payment_date), "dd MMM yyyy"),
          `PKR ${Number(p.payment_amount).toLocaleString()}`,
          p.payment_type === "full" ? "Full" : "Partial",
          p.notes || "-",
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [34, 197, 94] },
      });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`${branding.agencyName} • Vendor Statement`, 14, pageHeight - 8);

    // Open in new tab
    openPdfInNewTab(doc, `${vendor.name.replace(/\s+/g, "_")}_Statement_${format(new Date(), "yyyyMMdd")}.pdf`);
    toast.success("Vendor statement PDF opened in a new tab");
  };

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider>
        {onViewLedger && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onViewLedger}
              >
                <Receipt className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View Ledger</p>
            </TooltipContent>
          </Tooltip>
        )}

        {onViewBookings && vendor.clientBookingsCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onViewBookings}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View Bookings</p>
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleDownloadStatement}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Download Statement</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
