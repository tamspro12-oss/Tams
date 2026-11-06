import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useB2BAgents, B2BAgent } from "@/hooks/useB2BAgents";
import { useB2BBookings, B2BBooking } from "@/hooks/useB2BBookings";
import { useB2BLedger, B2BLedgerEntry } from "@/hooks/useB2BLedger";
import { useVendors } from "@/hooks/useStorage";
import { useAgency } from "@/hooks/useAgency";
import { AddB2BBookingDialog } from "@/components/AddB2BBookingDialog";
import { AddB2BLedgerDialog } from "@/components/AddB2BLedgerDialog";
import { Switch } from "@/components/ui/switch";
import { useVouchers } from "@/hooks/useVouchers";
import { CreateVoucherDialog } from "@/components/CreateVoucherDialog";
import { downloadVoucherPdf, printVoucherPdf, generateVoucherWhatsAppText } from "@/lib/voucherPdfGenerator";
import { 
  ArrowLeft,
  Plus,
  TrendingUp,
  Banknote,
  CreditCard,
  AlertCircle,
  Plane,
  Receipt,
  BarChart3,
  Calendar,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  FileText,
  Download,
  ChevronDown,
  FileSpreadsheet,
  Filter,
  Send,
  ShieldCheck,
  Share2,
  Printer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from "sonner";

type DateFilterPreset = 'current_month' | 'last_month' | 'last_3_months' | 'year_to_date' | 'all_time' | 'custom';

const getDateRangeFromPreset = (preset: DateFilterPreset): { from: Date; to: Date } | null => {
  const now = new Date();
  switch (preset) {
    case 'current_month':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'last_month':
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    case 'last_3_months':
      return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) };
    case 'year_to_date':
      return { from: startOfYear(now), to: now };
    case 'all_time':
      return null;
    default:
      return null;
  }
};

const getFilterLabel = (preset: DateFilterPreset, customRange?: DateRange): string => {
  switch (preset) {
    case 'current_month': return 'This Month';
    case 'last_month': return 'Last Month';
    case 'last_3_months': return 'Last 3 Months';
    case 'year_to_date': return 'Year to Date';
    case 'all_time': return 'All Time';
    case 'custom':
      if (customRange?.from) {
        return customRange.to
          ? `${format(customRange.from, 'MMM d')} - ${format(customRange.to, 'MMM d, yyyy')}`
          : format(customRange.from, 'MMM d, yyyy');
      }
      return 'Custom Range';
    default: return 'This Month';
  }
};

export default function B2BAgentDashboard() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [showAddLedger, setShowAddLedger] = useState(false);
  const [editBooking, setEditBooking] = useState<B2BBooking | null>(null);
  const [editLedgerEntry, setEditLedgerEntry] = useState<B2BLedgerEntry | null>(null);
  const [deleteBooking, setDeleteBooking] = useState<B2BBooking | null>(null);
  const [deleteLedgerEntryConfirm, setDeleteLedgerEntryConfirm] = useState<B2BLedgerEntry | null>(null);
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('current_month');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [preselectedBookingId, setPreselectedBookingId] = useState<string | null>(null);
  const [showAgentVoucherModal, setShowAgentVoucherModal] = useState(false);
  
  const { agents, isLoading: agentsLoading, updateAgent } = useB2BAgents();
  const { bookings, isLoading: bookingsLoading, deleteBooking: deleteBookingMutation } = useB2BBookings(agentId);
  const { ledgerEntries, isLoading: ledgerLoading, deleteLedgerEntry } = useB2BLedger(agentId);
  const { vendors } = useVendors();
  const { data: agency } = useAgency();
  const { vouchers, addVoucher } = useVouchers();

  const agent = agents.find(a => a.id === agentId);
  const agentVouchers = useMemo(() => vouchers.filter(v => v.agent_id === agentId), [vouchers, agentId]);

  // Helper to calculate booking service amount (what agent owes)
  const getBookingServiceAmount = (booking: B2BBooking): number => {
    return (booking.selling_price || 0) - (booking.commission_amount || 0);
  };

  // Helper to calculate paid amount for a specific booking from ledger entries
  const getBookingPaidAmount = (booking: B2BBooking): number => {
    const bookingRef = booking.pnr || booking.passenger_name;
    return ledgerEntries
      .filter(e => 
        e.entry_type === 'credit' && 
        e.remarks?.includes(`[Booking: ${bookingRef}]`)
      )
      .reduce((sum, e) => sum + e.amount, 0);
  };

  // Helper to get booking outstanding balance
  const getBookingOutstanding = (booking: B2BBooking): number => {
    const serviceAmount = getBookingServiceAmount(booking);
    const paidAmount = getBookingPaidAmount(booking);
    return serviceAmount - paidAmount;
  };

  // Handle opening ledger dialog with preselected booking
  const handleRecordPayment = (bookingId: string) => {
    setPreselectedBookingId(bookingId);
    setShowAddLedger(true);
  };

  // Get filtered bookings based on date range
  const getFilteredBookings = () => {
    const activeDateRange = getActiveDateRange();
    return bookings.filter(b => {
      if (!activeDateRange) return true;
      const bookingDate = b.created_at ? new Date(b.created_at) : null;
      if (!bookingDate) return true;
      return bookingDate >= activeDateRange.from && bookingDate <= activeDateRange.to;
    });
  };

  // Export helper functions
  const getDateRangeLabel = () => {
    const range = getActiveDateRange();
    if (!range) return 'All_Time';
    return `${format(range.from, 'MMM_dd')}-${format(range.to, 'MMM_dd_yyyy')}`;
  };

  const downloadExcelFile = (data: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, filename);
  };

  // Generate B2B Booking PDF (without purchase price and commission)
  const generateBookingPDF = (booking: B2BBooking) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('Booking Confirmation', 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    if (agency?.name) doc.text(`Agency: ${agency.name}`, 14, 28);
    doc.text(`Date: ${format(new Date(), 'dd MMM yyyy')}`, 14, 35);
    
    // Booking Reference
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`Reference: ${booking.pnr || 'N/A'}`, 14, 48);
    
    // Passenger Details Table
    autoTable(doc, {
      startY: 58,
      head: [['Field', 'Details']],
      body: [
        ['Passenger Name', booking.passenger_name],
        ['Passport Number', booking.passenger_passport || '-'],
        ['Contact', booking.passenger_contact || '-'],
        ['Destination', booking.destination || '-'],
        ['Airline', booking.airline || '-'],
        ['Flight Date', booking.flight_date ? format(new Date(booking.flight_date), 'dd MMM yyyy') : '-'],
        ['PNR', booking.pnr || '-'],
        ['Ticket Amount', `PKR ${(booking.selling_price || 0).toLocaleString()}`],
        ['Status', booking.payment_status || 'Pending'],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [15, 23, 42] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 'auto' }
      }
    });
    
    // Notes section if exists
    if (booking.notes) {
      const finalY = (doc as any).lastAutoTable?.finalY || 150;
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('Notes:', 14, finalY + 15);
      doc.text(booking.notes, 14, finalY + 22);
    }
    
    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text('This is a computer-generated document.', 14, pageHeight - 15);
    if (agency?.contact_email) {
      doc.text(`Contact: ${agency.contact_email}`, 14, pageHeight - 10);
    }
    
    // Download
    doc.save(`Booking_${booking.pnr || booking.passenger_name}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    toast.success('Booking PDF downloaded');
  };
  const exportSalesCSV = () => {
    const filteredBookings = getFilteredBookings();
    const data = filteredBookings.map(b => ({
      'Date': b.created_at ? format(new Date(b.created_at), 'dd MMM yyyy') : '-',
      'PNR': b.pnr || '-',
      'Passenger': b.passenger_name,
      'Destination': b.destination || '-',
      'Airline': b.airline || '-',
      'Vendor': getVendorName(b.vendor_id),
      'Purchase Price (PKR)': b.purchasing_price || 0,
      'Selling Price (PKR)': b.selling_price || 0,
      'Commission (PKR)': b.commission_amount || 0,
      'Profit (PKR)': b.profit || 0,
      'Status': b.payment_status || '-'
    }));
    downloadExcelFile(data, `${agent?.agent_name}_Sales_Report_${getDateRangeLabel()}.xlsx`);
    toast.success('Sales Report exported successfully');
  };

  const exportSalesPDF = () => {
    const doc = new jsPDF();
    const filteredBookings = getFilteredBookings();
    const dateRange = getActiveDateRange();
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('Sales Report', 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Agent: ${agent?.agent_name}`, 14, 28);
    doc.text(`Period: ${dateRange ? `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd, yyyy')}` : 'All Time'}`, 14, 35);
    if (agency?.name) doc.text(`Agency: ${agency.name}`, 14, 42);
    
    // Table
    autoTable(doc, {
      startY: 50,
      head: [['Date', 'PNR', 'Passenger', 'Purchase', 'Selling', 'Commission', 'Profit', 'Status']],
      body: filteredBookings.map(b => [
        b.created_at ? format(new Date(b.created_at), 'dd MMM yy') : '-',
        b.pnr || '-',
        b.passenger_name,
        `PKR ${(b.purchasing_price || 0).toLocaleString()}`,
        `PKR ${(b.selling_price || 0).toLocaleString()}`,
        `PKR ${(b.commission_amount || 0).toLocaleString()}`,
        `PKR ${(b.profit || 0).toLocaleString()}`,
        b.payment_status || '-'
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] }
    });
    
    // Summary
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Total Sales: PKR ${stats.totalSales.toLocaleString()}`, 14, finalY);
    doc.text(`Total Commission: PKR ${stats.totalCommission.toLocaleString()}`, 14, finalY + 6);
    doc.text(`Total Profit: PKR ${stats.totalProfit.toLocaleString()}`, 14, finalY + 12);
    
    doc.save(`${agent?.agent_name}_Sales_Report_${getDateRangeLabel()}.pdf`);
    toast.success('Sales Report PDF exported successfully');
  };

  // Commission Report Export Functions
  const exportCommissionCSV = () => {
    const filteredBookings = getFilteredBookings();
    const data = filteredBookings.map(b => ({
      'Date': b.created_at ? format(new Date(b.created_at), 'dd MMM yyyy') : '-',
      'PNR': b.pnr || '-',
      'Passenger': b.passenger_name,
      'Selling Price (PKR)': b.selling_price || 0,
      'Commission Rate': agent?.commission_type === 'percentage' ? `${agent.commission_value}%` : 'Fixed',
      'Commission Amount (PKR)': b.commission_amount || 0
    }));
    downloadExcelFile(data, `${agent?.agent_name}_Commission_Report_${getDateRangeLabel()}.xlsx`);
    toast.success('Commission Report exported successfully');
  };

  const exportCommissionPDF = () => {
    const doc = new jsPDF();
    const filteredBookings = getFilteredBookings();
    const dateRange = getActiveDateRange();
    
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('Commission Report', 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Agent: ${agent?.agent_name}`, 14, 28);
    doc.text(`Commission Type: ${agent?.commission_type === 'percentage' ? `${agent.commission_value}%` : `PKR ${agent?.commission_value?.toLocaleString()} Fixed`}`, 14, 35);
    doc.text(`Period: ${dateRange ? `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd, yyyy')}` : 'All Time'}`, 14, 42);
    
    autoTable(doc, {
      startY: 50,
      head: [['Date', 'PNR', 'Passenger', 'Selling Price', 'Commission']],
      body: filteredBookings.map(b => [
        b.created_at ? format(new Date(b.created_at), 'dd MMM yy') : '-',
        b.pnr || '-',
        b.passenger_name,
        `PKR ${(b.selling_price || 0).toLocaleString()}`,
        `PKR ${(b.commission_amount || 0).toLocaleString()}`
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] }
    });
    
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Total Commission: PKR ${stats.totalCommission.toLocaleString()}`, 14, finalY);
    
    doc.save(`${agent?.agent_name}_Commission_Report_${getDateRangeLabel()}.pdf`);
    toast.success('Commission Report PDF exported successfully');
  };

  // Outstanding Summary Export Functions
  const exportOutstandingCSV = () => {
    const data = [{
      'Agent Name': agent?.agent_name,
      'Business Name': agent?.business_name || '-',
      'Total Sales (PKR)': stats.totalSales,
      'Total Commission (PKR)': stats.totalCommission,
      'Amount to Collect (PKR)': stats.totalSales - stats.totalCommission,
      'Total Paid (PKR)': stats.totalPaid,
      'Outstanding Amount (PKR)': stats.outstanding,
      'Status': stats.outstanding > 0 ? 'Amount Due' : 'Advance Balance',
      'Report Date': format(new Date(), 'dd MMM yyyy')
    }];
    downloadExcelFile(data, `${agent?.agent_name}_Outstanding_Summary_${getDateRangeLabel()}.xlsx`);
    toast.success('Outstanding Summary exported successfully');
  };

  const exportOutstandingPDF = () => {
    const doc = new jsPDF();
    const dateRange = getActiveDateRange();
    
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('Outstanding Summary', 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Agent: ${agent?.agent_name}`, 14, 28);
    if (agent?.business_name) doc.text(`Business: ${agent.business_name}`, 14, 35);
    doc.text(`Period: ${dateRange ? `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd, yyyy')}` : 'All Time'}`, 14, agent?.business_name ? 42 : 35);
    
    autoTable(doc, {
      startY: agent?.business_name ? 50 : 45,
      head: [['Description', 'Amount (PKR)']],
      body: [
        ['Total Sales', `PKR ${stats.totalSales.toLocaleString()}`],
        ['Less: Agent Commission', `PKR ${stats.totalCommission.toLocaleString()}`],
        ['Amount to Collect from Agent', `PKR ${(stats.totalSales - stats.totalCommission).toLocaleString()}`],
        ['Less: Amount Paid by Agent', `PKR ${stats.totalPaid.toLocaleString()}`],
        [stats.outstanding > 0 ? 'Outstanding Amount' : 'Advance Balance', `PKR ${Math.abs(stats.outstanding).toLocaleString()}`]
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [15, 23, 42] },
      bodyStyles: { lineWidth: 0.1 }
    });
    
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, finalY);
    
    doc.save(`${agent?.agent_name}_Outstanding_Summary_${getDateRangeLabel()}.pdf`);
    toast.success('Outstanding Summary PDF exported successfully');
  };

  // Ledger Statement Export Functions
  const exportLedgerCSV = () => {
    let runningBalance = 0;
    const sortedEntries = [...ledgerEntries].sort((a, b) => 
      new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );
    
    const totalCredits = ledgerEntries.filter(e => e.entry_type === 'credit').reduce((sum, e) => sum + e.amount, 0);
    const totalDebits = ledgerEntries.filter(e => e.entry_type === 'debit').reduce((sum, e) => sum + e.amount, 0);
    const closingBalance = totalCredits - totalDebits;
    
    const data = sortedEntries.map((entry, index) => {
      runningBalance += entry.entry_type === 'credit' ? entry.amount : -entry.amount;
      
      // Extract linked booking info
      const bookingMatch = entry.remarks?.match(/\[Booking: (.+?)\]/);
      const linkedBooking = bookingMatch ? bookingMatch[1] : '-';
      const displayRemarks = entry.remarks?.replace(/\s*\[Booking: .+?\]/, '') || '';
      const description = displayRemarks || (entry.entry_type === 'credit' ? 'Payment Received' : 'Ticket Issued / Service');
      
      return {
        'S/No.': (index + 1).toString(),
        'Date': format(new Date(entry.entry_date), 'dd MMM yyyy'),
        'Description': description,
        'Type': entry.entry_type === 'credit' ? 'Credit' : 'Debit',
        'Linked Booking': linkedBooking,
        'Debit (PKR)': entry.entry_type === 'debit' ? entry.amount.toString() : '',
        'Credit (PKR)': entry.entry_type === 'credit' ? entry.amount.toString() : '',
        'Balance (PKR)': runningBalance.toString()
      };
    });
    
    // Add summary row
    data.push({
      'S/No.': '',
      'Date': '',
      'Description': '--- SUMMARY ---',
      'Type': '',
      'Linked Booking': '',
      'Debit (PKR)': totalDebits.toString(),
      'Credit (PKR)': totalCredits.toString(),
      'Balance (PKR)': closingBalance.toString()
    });
    
    downloadExcelFile(data, `${agent?.agent_name}_Ledger_Statement_${getDateRangeLabel()}.xlsx`);
    toast.success('Ledger Statement exported successfully');
  };

  const exportLedgerPDF = () => {
    const doc = new jsPDF();
    
    let runningBalance = 0;
    const sortedEntries = [...ledgerEntries].sort((a, b) => 
      new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );
    
    const totalCredits = ledgerEntries.filter(e => e.entry_type === 'credit').reduce((sum, e) => sum + e.amount, 0);
    const totalDebits = ledgerEntries.filter(e => e.entry_type === 'debit').reduce((sum, e) => sum + e.amount, 0);
    const closingBalance = totalCredits - totalDebits;
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('LEDGER STATEMENT', 14, 20);
    
    // Agency info (if available)
    if (agency?.name) {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(agency.name, 14, 27);
    }
    
    // Agent info box
    const boxY = agency?.name ? 32 : 27;
    doc.setFillColor(248, 250, 252);
    doc.rect(14, boxY, 182, 22, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, boxY, 182, 22, 'S');
    
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Agent: ${agent?.agent_name}`, 18, boxY + 7);
    if (agent?.business_name) {
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Business: ${agent.business_name}`, 18, boxY + 13);
    }
    
    // Period info
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Period: ${getFilterLabel(datePreset, customRange)}`, 18, boxY + 18);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 120, boxY + 18);
    
    // Summary boxes
    const summaryY = boxY + 28;
    const boxWidth = 44;
    const summaryData = [
      { label: 'Opening Balance', value: 'PKR 0', color: [241, 245, 249] },
      { label: 'Total Credits', value: `+PKR ${totalCredits.toLocaleString()}`, color: [220, 252, 231] },
      { label: 'Total Debits', value: `-PKR ${totalDebits.toLocaleString()}`, color: [254, 226, 226] },
      { label: 'Closing Balance', value: `PKR ${Math.abs(closingBalance).toLocaleString()}${closingBalance < 0 ? ' Dr' : ''}`, color: [219, 234, 254] }
    ];
    
    summaryData.forEach((item, i) => {
      const x = 14 + (i * (boxWidth + 2));
      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.rect(x, summaryY, boxWidth, 14, 'F');
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(item.label, x + 2, summaryY + 5);
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(item.value, x + 2, summaryY + 11);
    });
    
    // Table data
    const tableData = sortedEntries.map((entry, index) => {
      runningBalance += entry.entry_type === 'credit' ? entry.amount : -entry.amount;
      
      const bookingMatch = entry.remarks?.match(/\[Booking: (.+?)\]/);
      const linkedBooking = bookingMatch ? bookingMatch[1] : '-';
      const displayRemarks = entry.remarks?.replace(/\s*\[Booking: .+?\]/, '') || '';
      const description = displayRemarks || (entry.entry_type === 'credit' ? 'Payment Received' : 'Ticket Issued / Service');
      
      return [
        (index + 1).toString(),
        format(new Date(entry.entry_date), 'dd MMM yy'),
        description.substring(0, 25),
        entry.entry_type === 'credit' ? 'Cr' : 'Dr',
        linkedBooking,
        entry.entry_type === 'debit' ? `${entry.amount.toLocaleString()}` : '-',
        entry.entry_type === 'credit' ? `${entry.amount.toLocaleString()}` : '-',
        `${Math.abs(runningBalance).toLocaleString()}${runningBalance < 0 ? ' Dr' : ''}`
      ];
    });
    
    autoTable(doc, {
      startY: summaryY + 18,
      head: [['S/No', 'Date', 'Description', 'Type', 'Linked', 'Debit', 'Credit', 'Balance']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 
        0: { cellWidth: 12, halign: 'center' },
        2: { cellWidth: 35 },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 22 },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right', fontStyle: 'bold' }
      },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });
    
    const finalY = (doc as any).lastAutoTable.finalY + 8;
    
    // Footer note
    doc.setFillColor(248, 250, 252);
    doc.rect(14, finalY, 182, 20, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('Note: Please verify all entries and report discrepancies within 3 days.', 18, finalY + 6);
    doc.text('This is a computer-generated statement.', 18, finalY + 11);
    
    // Signature lines
    doc.setDrawColor(200);
    doc.line(18, finalY + 17, 50, finalY + 17);
    doc.line(120, finalY + 17, 152, finalY + 17);
    doc.setFontSize(7);
    doc.text('Prepared By', 26, finalY + 20);
    doc.text('Approved By', 128, finalY + 20);
    
    doc.save(`${agent?.agent_name}_Ledger_Statement_${getDateRangeLabel()}.pdf`);
    toast.success('Ledger Statement PDF exported successfully');
  };

  const getActiveDateRange = (): { from: Date; to: Date } | null => {
    if (datePreset === 'custom' && customRange?.from) {
      return { from: customRange.from, to: customRange.to || customRange.from };
    }
    return getDateRangeFromPreset(datePreset);
  };

  const handlePresetClick = (preset: DateFilterPreset) => {
    if (preset === 'custom') {
      setShowCustomDialog(true);
    } else {
      setDatePreset(preset);
    }
  };

  const handleCustomApply = () => {
    if (customRange?.from) {
      setDatePreset('custom');
      setShowCustomDialog(false);
    }
  };

  // Calculate statistics - LEDGER IS SOURCE OF TRUTH FOR BALANCES
  const stats = useMemo(() => {
    const activeDateRange = getActiveDateRange();
    
    const filteredBookings = bookings.filter(b => {
      if (!activeDateRange) return true;
      const bookingDate = b.created_at ? new Date(b.created_at) : null;
      if (!bookingDate) return true;
      return bookingDate >= activeDateRange.from && bookingDate <= activeDateRange.to;
    });

    // Booking-derived stats (for operational view)
    const totalSales = filteredBookings.reduce((sum, b) => sum + (b.selling_price || 0), 0);
    const totalPurchase = filteredBookings.reduce((sum, b) => sum + (b.purchasing_price || 0), 0);
    const totalCommission = filteredBookings.reduce((sum, b) => sum + (b.commission_amount || 0), 0);
    const totalProfit = filteredBookings.reduce((sum, b) => sum + (b.profit || 0), 0);
    
    // LEDGER IS SOURCE OF TRUTH for balance calculations
    // Filter ledger entries by date range if applicable
    const filteredLedgerEntries = ledgerEntries.filter(l => {
      if (!activeDateRange) return true;
      const entryDate = new Date(l.entry_date);
      return entryDate >= activeDateRange.from && entryDate <= activeDateRange.to;
    });
    
    // Debit = Agent owes agency (bookings created)
    // Credit = Agent paid agency (payments received)
    const totalDebits = filteredLedgerEntries.filter(l => l.entry_type === 'debit').reduce((sum, l) => sum + l.amount, 0);
    const totalCredits = filteredLedgerEntries.filter(l => l.entry_type === 'credit').reduce((sum, l) => sum + l.amount, 0);
    
    // Outstanding = Total Debits - Total Credits
    // Positive = Agent owes agency
    // Negative = Agency owes agent (advance payment)
    const outstanding = totalDebits - totalCredits;
    const totalPaid = totalCredits;

    return {
      totalSales,
      totalPurchase,
      totalCommission,
      totalProfit,
      totalPaid,
      outstanding,
      bookingsCount: filteredBookings.length,
      // Ledger-derived totals
      totalDebits,
      totalCredits,
    };
  }, [bookings, ledgerEntries, datePreset, customRange]);

  const handleDeleteBooking = async () => {
    if (deleteBooking) {
      await deleteBookingMutation.mutateAsync(deleteBooking.id);
      setDeleteBooking(null);
    }
  };

  const getVendorName = (vendorId: string | null) => {
    if (!vendorId) return '-';
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor?.name || '-';
  };

  if (agentsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Agent Not Found</h2>
        <p className="text-muted-foreground mb-4">The requested agent could not be found.</p>
        <Button onClick={() => navigate('/app/b2b-agents')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Agents
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/b2b-agents')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold">{agent.agent_name}</h1>
              <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                {agent.status}
              </Badge>
            </div>
            {agent.business_name && (
              <p className="text-sm text-muted-foreground">{agent.business_name}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowAddLedger(true)} className="gap-2">
            <Receipt className="w-4 h-4" />
            Add Payment
          </Button>
          <Button onClick={() => setShowAddBooking(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Booking
          </Button>
        </div>
      </div>

      {/* Agent Info Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {agent.phone && (
              <span className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                {agent.phone}
              </span>
            )}
            {agent.email && (
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                {agent.email}
              </span>
            )}
            {(agent.city || agent.country) && (
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                {[agent.city, agent.country].filter(Boolean).join(', ')}
              </span>
            )}
            <span className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-muted-foreground" />
              Commission: {agent.commission_type === 'percentage' 
                ? `${agent.commission_value}%` 
                : `PKR ${agent.commission_value?.toLocaleString()}`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="summary" className="gap-1.5">
            <BarChart3 className="w-4 h-4 hidden sm:block" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-1.5">
            <Plane className="w-4 h-4 hidden sm:block" />
            Bookings
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-1.5">
            <Receipt className="w-4 h-4 hidden sm:block" />
            Ledger
          </TabsTrigger>
          <TabsTrigger value="vouchers" className="gap-1.5">
            <FileText className="w-4 h-4 hidden sm:block" />
            Vouchers ({agentVouchers.length})
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <FileText className="w-4 h-4 hidden sm:block" />
            Reports
          </TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          {/* Date Filter */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Date Range:</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Calendar className="w-4 h-4" />
                      {getFilterLabel(datePreset, customRange)}
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={() => handlePresetClick('current_month')}>
                      This Month
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePresetClick('last_month')}>
                      Last Month
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePresetClick('last_3_months')}>
                      Last 3 Months
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePresetClick('year_to_date')}>
                      Year to Date
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handlePresetClick('all_time')}>
                      All Time
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handlePresetClick('custom')}>
                      Custom Range...
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards - Using LEDGER as source of truth for balance */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-2xl font-bold">PKR {stats.totalDebits.toLocaleString()}</span>
                </div>
                <p className="text-sm text-muted-foreground">Total Debit (Owed)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <CreditCard className="w-5 h-5" />
                  <span className="text-2xl font-bold">PKR {stats.totalCredits.toLocaleString()}</span>
                </div>
                <p className="text-sm text-muted-foreground">Total Credit (Paid)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className={cn(
                  "flex items-center gap-2 mb-2",
                  stats.outstanding > 0 ? "text-red-600" : "text-green-600"
                )}>
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-2xl font-bold">PKR {Math.abs(stats.outstanding).toLocaleString()}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {stats.outstanding > 0 ? 'Balance Due' : 'Advance Balance'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-purple-600 mb-2">
                  <Banknote className="w-5 h-5" />
                  <span className="text-2xl font-bold">PKR {stats.totalCommission.toLocaleString()}</span>
                </div>
                <p className="text-sm text-muted-foreground">Agent Commission</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-amber-600 mb-2">
                  <BarChart3 className="w-5 h-5" />
                  <span className="text-2xl font-bold">PKR {stats.totalProfit.toLocaleString()}</span>
                </div>
                <p className="text-sm text-muted-foreground">Net Profit</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3">
            <Button onClick={() => setShowAddBooking(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Booking
            </Button>
            <Button variant="outline" onClick={() => setShowAddLedger(true)} className="gap-2">
              <Receipt className="w-4 h-4" />
              Add Payment Entry
            </Button>
          </div>
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">B2B Bookings ({bookings.length})</h3>
            <Button onClick={() => setShowAddBooking(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Booking
            </Button>
          </div>

          {bookings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Plane className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No Bookings Yet</h3>
                <p className="text-muted-foreground mb-4">Add the first booking for this agent</p>
                <Button onClick={() => setShowAddBooking(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add First Booking
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PNR</TableHead>
                      <TableHead>Passenger</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Service Amt</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map(booking => {
                      const serviceAmount = getBookingServiceAmount(booking);
                      const paidAmount = getBookingPaidAmount(booking);
                      const outstanding = getBookingOutstanding(booking);
                      
                      return (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium">{booking.pnr || '-'}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{booking.passenger_name}</p>
                              {booking.destination && (
                                <p className="text-xs text-muted-foreground">{booking.destination}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getVendorName(booking.vendor_id)}</TableCell>
                          <TableCell className="text-right">PKR {serviceAmount.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-green-600">PKR {paidAmount.toLocaleString()}</TableCell>
                          <TableCell className={cn(
                            "text-right font-medium",
                            outstanding > 0 ? "text-red-600" : "text-green-600"
                          )}>
                            PKR {outstanding.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-purple-600">PKR {(booking.profit || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={booking.payment_status === 'paid' ? 'default' : booking.payment_status === 'partial' ? 'secondary' : 'destructive'}>
                              {booking.payment_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {outstanding > 0 && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleRecordPayment(booking.id)}
                                  title="Record Payment"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <CreditCard className="w-4 h-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => setEditBooking(booking)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteBooking(booking)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => generateBookingPDF(booking)}
                                title="Download Booking PDF"
                              >
                                <Download className="w-4 h-4 text-blue-600" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                title="Email Booking"
                              >
                                <Send className="w-4 h-4 text-green-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Ledger Tab */}
        <TabsContent value="ledger" className="space-y-4">
          {/* Ledger Header with Agent Info & Summary */}
          <Card className="border border-border/50">
            <CardContent className="pt-4 pb-3">
              {/* Agent Identity */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{agent?.agent_name}</h3>
                  {agent?.business_name && (
                    <p className="text-sm text-muted-foreground">{agent.business_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Download className="w-4 h-4" />
                        Download Ledger
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={exportLedgerCSV} className="gap-2">
                        <FileSpreadsheet className="w-4 h-4" />
                        Download CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportLedgerPDF} className="gap-2">
                        <FileText className="w-4 h-4" />
                        Download PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button 
                    variant="outline" 
                    size="icon"
                    title="Email Statement"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                  <Button onClick={() => setShowAddLedger(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Entry
                  </Button>
                </div>
              </div>

              {/* Date Filter Display */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-border/50">
                <div className="flex items-center gap-2 text-sm">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Filter Applied:</span>
                  <span className="font-medium">{getFilterLabel(datePreset, customRange)}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Calendar className="w-4 h-4" />
                      Change Period
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => handlePresetClick('current_month')}>This Month</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePresetClick('last_month')}>Last Month</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePresetClick('last_3_months')}>Last 3 Months</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePresetClick('year_to_date')}>Year to Date</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handlePresetClick('all_time')}>All Time</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handlePresetClick('custom')}>Custom Range...</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Balance Summary Cards - Using stats from ledger */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Opening Balance</p>
                  <p className="text-lg font-semibold">PKR 0</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 border border-red-200/50 dark:border-red-800/30">
                  <p className="text-xs text-muted-foreground mb-1">Total Debits (Owed)</p>
                  <p className="text-lg font-semibold text-red-600">
                    PKR {stats.totalDebits.toLocaleString()}
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 border border-green-200/50 dark:border-green-800/30">
                  <p className="text-xs text-muted-foreground mb-1">Total Credits (Paid)</p>
                  <p className="text-lg font-semibold text-green-600">
                    PKR {stats.totalCredits.toLocaleString()}
                  </p>
                </div>
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">
                    {stats.outstanding > 0 ? 'Balance Due' : 'Advance Balance'}
                  </p>
                  <p className={cn(
                    "text-lg font-semibold",
                    stats.outstanding > 0 ? "text-red-600" : "text-green-600"
                  )}>
                    PKR {Math.abs(stats.outstanding).toLocaleString()}
                    {stats.outstanding > 0 && ' (Dr)'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {ledgerEntries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Receipt className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No Ledger Entries</h3>
                <p className="text-muted-foreground mb-4">Record payments and adjustments here</p>
                <Button onClick={() => setShowAddLedger(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add First Entry
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-border/50">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-12 text-center font-semibold">S/No.</TableHead>
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Description</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Linked Booking</TableHead>
                      <TableHead className="text-right font-semibold">Debit</TableHead>
                      <TableHead className="text-right font-semibold">Credit</TableHead>
                      <TableHead className="text-right font-semibold">Balance</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      let runningBalance = 0;
                      return ledgerEntries.map((entry, index) => {
                        // Extract linked booking info from remarks
                        const bookingMatch = entry.remarks?.match(/\[Booking: (.+?)\]/);
                        const linkedBookingRef = bookingMatch ? bookingMatch[1] : null;
                        const displayRemarks = entry.remarks?.replace(/\s*\[Booking: .+?\]/, '') || '';
                        
                        // Calculate running balance (DEBIT = Agent owes more, CREDIT = Agent paid)
                        // Positive balance = Agent owes agency
                        // Negative balance = Agency owes agent (advance)
                        if (entry.entry_type === 'debit') {
                          runningBalance += entry.amount;
                        } else {
                          runningBalance -= entry.amount;
                        }
                        
                        // Determine description based on type and remarks
                        const getDescription = () => {
                          if (displayRemarks) return displayRemarks;
                          if (entry.entry_type === 'credit') return 'Payment Received';
                          return 'Ticket Issued / Service';
                        };

                        return (
                          <TableRow key={entry.id} className="border-b border-border/30 hover:bg-muted/20">
                            <TableCell className="text-center text-muted-foreground font-medium">
                              {index + 1}
                            </TableCell>
                            <TableCell className="font-medium">
                              {format(new Date(entry.entry_date), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell className="max-w-[180px]">
                              <span className="truncate block">{getDescription()}</span>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={entry.entry_type === 'credit' ? 'default' : 'destructive'}
                                className="text-xs"
                              >
                                {entry.entry_type === 'credit' ? 'Cr' : 'Dr'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {linkedBookingRef ? (
                                <div className="flex items-center gap-1.5">
                                  <Plane className="w-3 h-3 text-blue-500" />
                                  <span className="text-xs font-medium text-blue-600">{linkedBookingRef}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium text-red-600">
                              {entry.entry_type === 'debit' ? `PKR ${entry.amount.toLocaleString()}` : '—'}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              {entry.entry_type === 'credit' ? `PKR ${entry.amount.toLocaleString()}` : '—'}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-semibold",
                              runningBalance > 0 ? "text-red-600" : "text-green-600"
                            )}>
                              PKR {Math.abs(runningBalance).toLocaleString()}
                              {runningBalance > 0 && ' Dr'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => setEditLedgerEntry(entry)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => setDeleteLedgerEntryConfirm(entry)}
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </div>

              {/* Professional Footer */}
              <div className="border-t border-border/50 px-4 py-4 bg-muted/20">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Note Section */}
                  <div className="text-xs text-muted-foreground max-w-md">
                    <p className="font-medium text-foreground mb-1">Note:</p>
                    <p>Please verify all entries and report discrepancies within 3 days. This is a computer-generated statement.</p>
                  </div>
                  
                  {/* Signature Section */}
                  <div className="flex gap-8 text-xs">
                    <div className="text-center">
                      <div className="w-24 border-b border-border mb-1 h-6"></div>
                      <p className="text-muted-foreground">Prepared By</p>
                    </div>
                    <div className="text-center">
                      <div className="w-24 border-b border-border mb-1 h-6"></div>
                      <p className="text-muted-foreground">Approved By</p>
                    </div>
                  </div>
                </div>

                {/* Timestamp */}
                <div className="mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground text-right">
                  Generated on {format(new Date(), 'dd MMM yyyy, hh:mm a')}
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Export Reports
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Calendar className="w-4 h-4" />
                      {getFilterLabel(datePreset, customRange)}
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => handlePresetClick('current_month')}>
                      This Month
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePresetClick('last_month')}>
                      Last Month
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePresetClick('last_3_months')}>
                      Last 3 Months
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePresetClick('year_to_date')}>
                      Year to Date
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handlePresetClick('all_time')}>
                      All Time
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handlePresetClick('custom')}>
                      Custom Range...
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Sales Report */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-auto py-4 justify-start gap-3 w-full">
                      <Download className="w-5 h-5 text-blue-600" />
                      <div className="text-left flex-1">
                        <p className="font-medium">Sales Report</p>
                        <p className="text-xs text-muted-foreground">All bookings with pricing details</p>
                      </div>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportSalesCSV}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Download CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportSalesPDF}>
                      <FileText className="w-4 h-4 mr-2" />
                      Download PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Commission Report */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-auto py-4 justify-start gap-3 w-full">
                      <Download className="w-5 h-5 text-green-600" />
                      <div className="text-left flex-1">
                        <p className="font-medium">Commission Report</p>
                        <p className="text-xs text-muted-foreground">Commission breakdown by booking</p>
                      </div>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportCommissionCSV}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Download CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportCommissionPDF}>
                      <FileText className="w-4 h-4 mr-2" />
                      Download PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Outstanding Summary */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-auto py-4 justify-start gap-3 w-full">
                      <Download className="w-5 h-5 text-red-600" />
                      <div className="text-left flex-1">
                        <p className="font-medium">Outstanding Summary</p>
                        <p className="text-xs text-muted-foreground">Pending payments overview</p>
                      </div>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportOutstandingCSV}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Download CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportOutstandingPDF}>
                      <FileText className="w-4 h-4 mr-2" />
                      Download PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Ledger Statement */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-auto py-4 justify-start gap-3 w-full">
                      <Download className="w-5 h-5 text-purple-600" />
                      <div className="text-left flex-1">
                        <p className="font-medium">Ledger Statement</p>
                        <p className="text-xs text-muted-foreground">Complete payment history</p>
                      </div>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportLedgerCSV}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Download CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportLedgerPDF}>
                      <FileText className="w-4 h-4 mr-2" />
                      Download PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Vouchers Tab */}
        <TabsContent value="vouchers" className="space-y-4">
          {/* Voucher Permissions Card */}
          <Card className="border">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Agent Voucher Privileges</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Enable or disable this agent's permission to issue vouchers
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-muted/40 px-3 py-2 rounded-lg border">
                  <span className="text-xs font-medium">
                    {agent?.can_create_vouchers ? "Allowed to Issue Vouchers" : "Voucher Issuance Disabled"}
                  </span>
                  <Switch
                    checked={!!agent?.can_create_vouchers}
                    onCheckedChange={(checked) => {
                      if (agent) {
                        updateAgent.mutate({
                          id: agent.id,
                          agent: { can_create_vouchers: checked } as any,
                        });
                      }
                    }}
                  />
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Vouchers List Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  Agent Vouchers ({agentVouchers.length})
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Branded vouchers generated for {agent?.agent_name || "this agent"}'s bookings
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowAgentVoucherModal(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Issue Voucher
              </Button>
            </CardHeader>
            <CardContent>
              {agentVouchers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
                  <FileText className="w-8 h-8 mx-auto text-muted-foreground/50" />
                  <p>No vouchers issued for this agent yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAgentVoucherModal(true)}
                    className="text-xs"
                  >
                    Issue First Voucher
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {agentVouchers.map((v) => (
                    <div
                      key={v.id}
                      className="p-3.5 rounded-lg border bg-card/60 flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-primary">{v.voucher_number}</span>
                            <Badge variant="outline" className="text-[10px]">{v.voucher_type}</Badge>
                            <Badge
                              className={`text-[10px] ${
                                v.status === "Issued"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {v.status}
                            </Badge>
                          </div>
                          <p className="font-semibold text-sm mt-1">{v.passenger_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {v.voucher_type === "Umrah" && (v.makkah_hotel || v.package_name || "Umrah Package")}
                            {v.voucher_type === "Hotel" && (v.hotel_name || "Hotel Booking")}
                            {v.voucher_type === "Ticket" && `${v.airline || ""} ${v.sector || ""}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t text-[11px] text-muted-foreground">
                        <span>{v.created_at ? format(new Date(v.created_at), "dd MMM yyyy") : ""}</span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const text = generateVoucherWhatsAppText(v, agency?.name || "TAMS Pro");
                              const phone = (agent?.phone || v.contact_number || "").replace(/[^0-9]/g, "");
                              const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
                              window.open(url, "_blank");
                            }}
                            className="h-7 px-2 text-[11px] gap-1 text-green-600"
                          >
                            <Share2 className="w-3 h-3" />
                            WhatsApp
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                              downloadVoucherPdf(v, {
                                agencyName: agency?.name || "Travel Agency",
                                agencyEmail: agency?.email || "",
                                agencyPhone: agency?.phone_number || "",
                              })
                            }
                            className="h-7 px-2.5 text-[11px] gap-1"
                          >
                            <Download className="w-3 h-3" />
                            PDF
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Voucher Generation Dialog for Agent */}
      {showAgentVoucherModal && (
        <CreateVoucherDialog
          open={showAgentVoucherModal}
          onOpenChange={setShowAgentVoucherModal}
          initialBookingData={{ agent_id: agentId }}
          onSave={async (voucherData) => {
            await addVoucher.mutateAsync({ ...voucherData, agent_id: agentId });
          }}
        />
      )}

      {/* Custom Date Range Dialog */}
      <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Custom Date Range</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <CalendarComponent
              mode="range"
              selected={customRange}
              onSelect={setCustomRange}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {customRange?.from && (
                  <>
                    {format(customRange.from, "MMM dd, yyyy")}
                    {customRange.to && ` - ${format(customRange.to, "MMM dd, yyyy")}`}
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCustomDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCustomApply} disabled={!customRange?.from}>
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Booking Dialog */}
      {agent && (
        <AddB2BBookingDialog
          open={showAddBooking || !!editBooking}
          onOpenChange={(open) => {
            if (!open) {
              setShowAddBooking(false);
              setEditBooking(null);
            }
          }}
          agent={agent}
          editBooking={editBooking}
        />
      )}

      {/* Add/Edit Ledger Dialog */}
      {agent && (
        <AddB2BLedgerDialog
          open={showAddLedger || !!editLedgerEntry}
          onOpenChange={(open) => {
            if (!open) {
              setShowAddLedger(false);
              setEditLedgerEntry(null);
              setPreselectedBookingId(null);
            }
          }}
          agent={agent}
          editEntry={editLedgerEntry}
          preselectedBookingId={preselectedBookingId}
        />
      )}

      {/* Delete Booking Confirmation */}
      <AlertDialog open={!!deleteBooking} onOpenChange={() => setDeleteBooking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the booking for <strong>{deleteBooking?.passenger_name}</strong>? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBooking} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Ledger Entry Confirmation */}
      <AlertDialog open={!!deleteLedgerEntryConfirm} onOpenChange={() => setDeleteLedgerEntryConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ledger Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {deleteLedgerEntryConfirm?.entry_type === 'credit' ? 'credit' : 'debit'} entry of{' '}
              <strong>PKR {deleteLedgerEntryConfirm?.amount.toLocaleString()}</strong>? 
              This action cannot be undone and will affect the ledger balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                if (deleteLedgerEntryConfirm) {
                  await deleteLedgerEntry.mutateAsync(deleteLedgerEntryConfirm.id);
                  setDeleteLedgerEntryConfirm(null);
                }
              }} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
