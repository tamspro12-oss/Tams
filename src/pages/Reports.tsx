import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRange } from "react-day-picker";
import { useClients } from "@/hooks/useStorage";
import { useExpenses } from "@/hooks/useStorage";
import { useVendors } from "@/hooks/useStorage";
import { parseISO, isWithinInterval, format, startOfMonth, endOfMonth, startOfYear, subMonths } from "date-fns";
import { TrendingUp, TrendingDown, Banknote, Users, Receipt, Building2, Calendar, ChevronDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { useAgency } from "@/hooks/useAgency";

export default function Reports() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [filterPreset, setFilterPreset] = useState<string>("current_month");
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  
  const { clients } = useClients();
  const { expenses } = useExpenses();
  const { vendors } = useVendors();
  const agencyQuery = useAgency();

  const exportCSV = () => {
    try {
      const summaryData = [
        { Metric: "Report Period", Value: `${format(dateRange.from, "MMM dd, yyyy")} - ${format(dateRange.to, "MMM dd, yyyy")}` },
        { Metric: "Total Revenue", Value: reportData.totalRevenue },
        { Metric: "Total Cost", Value: reportData.totalCost },
        { Metric: "Gross Profit", Value: reportData.grossProfit },
        { Metric: "Total Expenses", Value: reportData.totalExpenses },
        { Metric: "Net Profit", Value: reportData.netProfit },
        { Metric: "Profit Margin %", Value: reportData.profitMargin },
        { Metric: "Total Bookings", Value: reportData.totalBookings },
        { Metric: "Paid Bookings", Value: reportData.paidBookings },
        { Metric: "Pending Bookings", Value: reportData.pendingBookings },
        { Metric: "Client Pending Payment", Value: reportData.clientPendingPayment },
        { Metric: "Vendor Pending Payment", Value: reportData.vendorPendingPayment },
        { Metric: "Generated On", Value: format(new Date(), "MMM dd, yyyy HH:mm") }
      ];

      const wb = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

      const blob = new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Financial_Report_${format(new Date(), "yyyyMMdd")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success("CSV report exported successfully");
    } catch (error) {
      toast.error("Failed to export CSV report");
    }
  };

  const exportPDF = () => {
    try {
      const doc = new jsPDF();
      const agencyName = agencyQuery.data?.name || "Travel Agency";
      
      // Header
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text("Financial Report", 14, 20);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(agencyName, 14, 28);
      doc.text(`Period: ${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd, yyyy")}`, 14, 35);
      doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`, 14, 42);

      // Summary Table
      autoTable(doc, {
        startY: 50,
        head: [["Metric", "Value"]],
        body: [
          ["Total Revenue", `PKR ${reportData.totalRevenue.toLocaleString()}`],
          ["Total Cost", `PKR ${reportData.totalCost.toLocaleString()}`],
          ["Gross Profit", `PKR ${reportData.grossProfit.toLocaleString()}`],
          ["Total Expenses", `PKR ${reportData.totalExpenses.toLocaleString()}`],
          ["Net Profit", `PKR ${reportData.netProfit.toLocaleString()}`],
          ["Profit Margin", `${reportData.profitMargin}%`],
        ],
        styles: { fontSize: 10 },
        headStyles: { fillColor: [15, 23, 42] }
      });

      // Bookings Table
      const finalY = (doc as any).lastAutoTable.finalY || 50;
      autoTable(doc, {
        startY: finalY + 10,
        head: [["Bookings Overview", "Count"]],
        body: [
          ["Total Bookings", reportData.totalBookings.toString()],
          ["Paid Bookings", reportData.paidBookings.toString()],
          ["Pending Bookings", reportData.pendingBookings.toString()],
        ],
        styles: { fontSize: 10 },
        headStyles: { fillColor: [15, 23, 42] }
      });

      // Payments Table
      const finalY2 = (doc as any).lastAutoTable.finalY || 50;
      autoTable(doc, {
        startY: finalY2 + 10,
        head: [["Payment Status", "Amount (PKR)"]],
        body: [
          ["Client Pending Payment", reportData.clientPendingPayment.toLocaleString()],
          ["Vendor Pending Payment", reportData.vendorPendingPayment.toLocaleString()],
        ],
        styles: { fontSize: 10 },
        headStyles: { fillColor: [15, 23, 42] }
      });

      doc.save(`Financial_Report_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("PDF report exported successfully");
    } catch (error) {
      toast.error("Failed to export PDF report");
    }
  };

  const handlePresetChange = (preset: string) => {
    const now = new Date();
    let from: Date, to: Date;
    
    switch (preset) {
      case "current_month":
        from = startOfMonth(now);
        to = endOfMonth(now);
        break;
      case "last_month":
        const lastMonth = subMonths(now, 1);
        from = startOfMonth(lastMonth);
        to = endOfMonth(lastMonth);
        break;
      case "last_3_months":
        from = startOfMonth(subMonths(now, 2));
        to = endOfMonth(now);
        break;
      case "year_to_date":
        from = startOfYear(now);
        to = now;
        break;
      case "all_time":
        from = new Date(2000, 0, 1);
        to = new Date(2099, 11, 31);
        break;
      case "custom":
        setShowCustomDialog(true);
        return;
      default:
        return;
    }
    
    setFilterPreset(preset);
    setDateRange({ from, to });
  };

  const handleApplyCustomRange = () => {
    if (customRange?.from && customRange?.to) {
      setDateRange({ from: customRange.from, to: customRange.to });
      setFilterPreset("custom");
      setShowCustomDialog(false);
    }
  };

  const getPresetLabel = (preset: string) => {
    const labels: Record<string, string> = {
      current_month: "This Month",
      last_month: "Last Month",
      last_3_months: "Last 3 Months",
      year_to_date: "Year to Date",
      all_time: "All Time",
      custom: "Custom Range"
    };
    return labels[preset] || "Select Range";
  };

  const reportData = useMemo(() => {
    const filterByDate = (items: any[], dateField: string) => {
      if (!dateRange?.from) return items;
      return items.filter((item: any) => {
        const itemDate = item[dateField];
        if (!itemDate) return false;
        const checkDate = parseISO(itemDate);
        return isWithinInterval(checkDate, { start: dateRange.from, end: dateRange.to });
      });
    };

    const filteredClients = filterByDate(clients || [], 'flight_date');
    const filteredExpenses = filterByDate(expenses || [], 'expense_date');
    const filteredVendors = filterByDate(vendors || [], 'booking_date');

    const totalRevenue = filteredClients.reduce((sum, c) => sum + (Number(c.selling_price) || 0), 0);
    const totalCost = filteredClients.reduce((sum, c) => sum + (Number(c.purchasing_price) || 0), 0);
    const grossProfit = totalRevenue - totalCost;

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const vendorTotalPayable = filteredVendors.reduce((sum, v) => {
      const vendorClients = (clients || []).filter((c: any) => c.vendor_id === v.id);
      const fromBookingsTotal = vendorClients.reduce((s, c) => s + (Number(c.purchasing_price) || 0), 0);
      const vendorDirectAmount = Number(v.payment_amount) || 0;
      return sum + (fromBookingsTotal + vendorDirectAmount);
    }, 0);
    
    const vendorTotalPaid = filteredVendors.reduce((sum, v) => sum + (Number(v.amount_paid) || 0), 0);
    const vendorPendingPayment = vendorTotalPayable - vendorTotalPaid;

    const clientTotalReceivable = filteredClients.reduce((sum, c) => sum + (Number(c.selling_price) || 0), 0);
    const clientTotalPaid = filteredClients.reduce((sum, c) => sum + (Number(c.amount_paid) || 0), 0);
    const clientPendingPayment = clientTotalReceivable - clientTotalPaid;

    const netProfit = grossProfit - totalExpenses;

    const totalBookings = filteredClients.length;
    const paidBookings = filteredClients.filter((c: any) => c.payment_status === "Paid").length;
    const pendingBookings = totalBookings - paidBookings;

    return {
      totalRevenue,
      totalCost,
      grossProfit,
      totalExpenses,
      vendorPendingPayment,
      clientPendingPayment,
      netProfit,
      totalBookings,
      paidBookings,
      pendingBookings,
      profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0
    };
  }, [clients, expenses, vendors, dateRange]);

  return (
    <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Financial Reports</h1>
            <p className="text-muted-foreground mt-1">
              View comprehensive financial summaries and analytics
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Calendar className="w-4 h-4" />
                  {getPresetLabel(filterPreset)}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover">
              <DropdownMenuItem onClick={() => handlePresetChange("current_month")}>
                This Month
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePresetChange("last_month")}>
                Last Month
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePresetChange("last_3_months")}>
                Last 3 Months
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePresetChange("year_to_date")}>
                Year to Date
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handlePresetChange("all_time")}>
                All Time
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handlePresetChange("custom")}>
                Custom Range...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          Showing data from {format(dateRange.from, "MMM dd, yyyy")} to {format(dateRange.to, "MMM dd, yyyy")}
        </div>

        {/* Revenue & Profit Overview */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Revenue & Profitability</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <Banknote className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₨ {reportData.totalRevenue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">From {reportData.totalBookings} bookings</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                {reportData.grossProfit >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${reportData.grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  ₨ {reportData.grossProfit.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Revenue - Cost</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">₨ {reportData.totalExpenses.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Operating expenses</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                {reportData.netProfit >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${reportData.netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  ₨ {reportData.netProfit.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Margin: {reportData.profitMargin}%</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bookings Overview */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Bookings Overview</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.totalBookings}</div>
                <p className="text-xs text-muted-foreground">All client bookings</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Paid Bookings</CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{reportData.paidBookings}</div>
                <p className="text-xs text-muted-foreground">
                  {reportData.totalBookings > 0 
                    ? `${Math.round((reportData.paidBookings / reportData.totalBookings) * 100)}%` 
                    : '0%'} completion rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
                <TrendingDown className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{reportData.pendingBookings}</div>
                <p className="text-xs text-muted-foreground">Awaiting payment</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Payment Status */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Payment Overview</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clients Pending Payment</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">₨ {reportData.clientPendingPayment.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Amount clients owe to you</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Vendors Pending Payment</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">₨ {reportData.vendorPendingPayment.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Amount you owe to vendors</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Custom Range Dialog */}
        <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Select Custom Date Range</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center py-4">
              <CalendarComponent
                mode="range"
                selected={customRange}
                onSelect={setCustomRange}
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {customRange?.from && customRange?.to ? (
                  `${format(customRange.from, "MMM dd, yyyy")} - ${format(customRange.to, "MMM dd, yyyy")}`
                ) : (
                  "Select start and end dates"
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCustomDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleApplyCustomRange} disabled={!customRange?.from || !customRange?.to}>
                  Apply
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
}
