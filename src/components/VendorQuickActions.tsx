import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Receipt, FileText, Download, Eye } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { toast } from "sonner";
import { useVendorPaymentHistoryLocal } from "@/hooks/useLocalPaymentHistory";
import { useClients } from "@/hooks/useStorage";
import { useAgency } from "@/hooks/useAgency";

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
  const { data: agency } = useAgency();

  // Download vendor statement as PDF (read-only export)
  const handleDownloadStatement = () => {
    const doc = new jsPDF();
    const vendorClients = clients.filter(c => c.vendor_id === vendor.id);

    // Header
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text("Vendor Statement", 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Vendor: ${vendor.name}`, 14, 30);
    if (vendor.contact_person) doc.text(`Contact: ${vendor.contact_person}`, 14, 36);
    if (agency?.name) doc.text(`Agency: ${agency.name}`, 14, vendor.contact_person ? 42 : 36);
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, 14, vendor.contact_person ? 48 : 42);

    // Summary Section
    const summaryStartY = vendor.contact_person ? 58 : 52;
    autoTable(doc, {
      startY: summaryStartY,
      head: [["Summary", "Amount (PKR)"]],
      body: [
        ["Total Payable", `₨ ${vendor.totalPayable.toLocaleString()}`],
        ["Amount Paid", `₨ ${vendor.amountPaid.toLocaleString()}`],
        ["Outstanding", `₨ ${vendor.amountPending.toLocaleString()}`],
        ["Total Bookings", vendor.clientBookingsCount.toString()],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [15, 23, 42] },
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
          `₨ ${(Number(c.purchasing_price) || 0).toLocaleString()}`,
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
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
          `₨ ${Number(p.payment_amount).toLocaleString()}`,
          p.payment_type === "full" ? "Full" : "Partial",
          p.notes || "-",
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [34, 197, 94] },
      });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text("This is a computer-generated statement.", 14, pageHeight - 10);

    // Save
    doc.save(`${vendor.name.replace(/\s+/g, "_")}_Statement_${format(new Date(), "yyyyMMdd")}.pdf`);
    toast.success("Vendor statement downloaded");
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
