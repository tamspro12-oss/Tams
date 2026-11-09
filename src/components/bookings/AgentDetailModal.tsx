import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  X,
  Plus,
  Pencil,
  FileText,
  DollarSign,
  Download,
  Users,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Search,
  Eye,
  CheckCircle,
  Banknote,
  Percent,
  TrendingUp,
  Receipt,
  Trash2,
} from "lucide-react";
import { B2BAgent, useB2BAgents } from "@/hooks/useB2BAgents";
import { useB2BBookings, B2BBooking } from "@/hooks/useB2BBookings";
import { useB2BLedger } from "@/hooks/useB2BLedger";
import { useAgency } from "@/hooks/useAgency";
import { useVendors } from "@/hooks/useStorage";
import { AgentLumpSumPaymentDialog } from "./AgentLumpSumPaymentDialog";
import { AddB2BAgentDialog } from "@/components/AddB2BAgentDialog";
import { PartyLedgerAndStatement } from "./PartyLedgerAndStatement";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scale } from "lucide-react";
import { format, parseISO, isSameDay, isSameMonth, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

interface AgentDetailModalProps {
  agent: B2BAgent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddBookingForAgent: (agentId: string) => void;
  onEditBooking?: (booking: B2BBooking) => void;
}

export function AgentDetailModal({
  agent,
  open,
  onOpenChange,
  onAddBookingForAgent,
  onEditBooking,
}: AgentDetailModalProps) {
  const [cardSubTab, setCardSubTab] = useState<"bookings" | "ledger" | "statement" | "add_payment">("bookings");
  const [datePeriod, setDatePeriod] = useState<"all" | "today" | "this_month" | "last_month">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showEditAgentDialog, setShowEditAgentDialog] = useState(false);
  const [selectedBookingForView, setSelectedBookingForView] = useState<B2BBooking | null>(null);
  const [bookingToDelete, setBookingToDelete] = useState<B2BBooking | null>(null);

  const { bookings, deleteBooking } = useB2BBookings(agent?.id);
  const { ledgerEntries } = useB2BLedger(agent?.id);
  const { data: agency } = useAgency();
  const { vendors } = useVendors();

  // Calculate agent stats
  const agentStats = useMemo(() => {
    const bList = bookings || [];
    const lList = ledgerEntries || [];
    const totalSales = bList.reduce((sum, b) => sum + (b.selling_price || 0), 0);
    const totalCommission = bList.reduce((sum, b) => sum + (b.commission_amount || 0), 0);
    const totalDebits = lList
      .filter((l) => l.entry_type === "debit")
      .reduce((sum, l) => sum + l.amount, 0);
    const totalCredits = lList
      .filter((l) => l.entry_type === "credit")
      .reduce((sum, l) => sum + l.amount, 0);
    const outstanding = totalDebits - totalCredits;

    return {
      totalSales,
      totalCommission,
      totalCredits,
      totalDebits,
      outstanding,
    };
  }, [bookings, ledgerEntries]);

  // Calculate paid & pending for each booking
  const getBookingPaid = (b: B2BBooking): number => {
    const bookingRef = b.pnr || b.passenger_name;
    return (ledgerEntries || [])
      .filter(
        (l) =>
          l.entry_type === "credit" &&
          l.remarks?.includes(`[Booking: ${bookingRef}]`)
      )
      .reduce((sum, l) => sum + l.amount, 0);
  };

  // Filter bookings by day / month / search
  const filteredBookings = useMemo(() => {
    const now = new Date();
    return (bookings || []).filter((b) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = b.passenger_name.toLowerCase().includes(q);
        const matchesPnr = b.pnr?.toLowerCase().includes(q);
        const matchesPassport = b.passenger_passport?.toLowerCase().includes(q);
        const matchesAirline = b.airline?.toLowerCase().includes(q);
        if (!matchesName && !matchesPnr && !matchesPassport && !matchesAirline) {
          return false;
        }
      }

      // Date Period filter
      if (datePeriod !== "all") {
        const dateToCheck = b.flight_date ? parseISO(b.flight_date) : b.created_at ? parseISO(b.created_at) : null;
        if (!dateToCheck) return false;

        if (datePeriod === "today") {
          return isSameDay(dateToCheck, now);
        } else if (datePeriod === "this_month") {
          return isSameMonth(dateToCheck, now);
        } else if (datePeriod === "last_month") {
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          return isSameMonth(dateToCheck, lastMonth);
        }
      }

      return true;
    });
  }, [bookings, searchQuery, datePeriod]);

  // Guard after all hooks have executed unconditionally
  if (!open || !agent) return null;

  // Export Statement PDF
  const handleExportStatementPdf = () => {
    try {
      const doc = new jsPDF();
      let runningBalance = 0;

      // Header
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text("B2B AGENT STATEMENT", 14, 20);

      if (agency?.name) {
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(agency.name, 14, 27);
      }

      // Agent Info Box
      const boxY = agency?.name ? 32 : 27;
      doc.setFillColor(248, 250, 252);
      doc.rect(14, boxY, 182, 22, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(14, boxY, 182, 22, "S");

      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`Agent: ${agent.agent_name}`, 18, boxY + 7);
      if (agent.business_name) {
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Business: ${agent.business_name}`, 18, boxY + 13);
      }

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, hh:mm a")}`, 18, boxY + 18);

      // Financial Summary
      autoTable(doc, {
        startY: boxY + 28,
        head: [["Description", "Amount (PKR)"]],
        body: [
          ["Total Sales", `PKR ${agentStats.totalSales.toLocaleString()}`],
          ["Less: Agent Commission", `PKR ${agentStats.totalCommission.toLocaleString()}`],
          ["Amount Billed to Agent (Debits)", `PKR ${agentStats.totalDebits.toLocaleString()}`],
          ["Total Payments Received (Credits)", `PKR ${agentStats.totalCredits.toLocaleString()}`],
          [
            agentStats.outstanding > 0 ? "Outstanding Due (Debit)" : "Advance Credit",
            `PKR ${Math.abs(agentStats.outstanding).toLocaleString()} ${agentStats.outstanding > 0 ? "DR" : "CR"
            }`,
          ],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [15, 23, 42] },
      });

      // Bookings List Table
      const bookingsStartY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("Bookings Summary", 14, bookingsStartY);

      const tableData = filteredBookings.map((b, i) => {
        const total = b.selling_price || 0;
        const paid = getBookingPaid(b);
        const due = Math.max(0, total - (b.commission_amount || 0) - paid);
        return [
          (i + 1).toString(),
          b.flight_date || b.created_at?.split("T")[0] || "-",
          b.passenger_name,
          b.pnr || "-",
          b.airline || "-",
          `PKR ${total.toLocaleString()}`,
          `PKR ${paid.toLocaleString()}`,
          `PKR ${due.toLocaleString()}`,
          b.payment_status || "pending",
        ];
      });

      autoTable(doc, {
        startY: bookingsStartY + 5,
        head: [["#", "Date", "Passenger", "PNR", "Airline", "Total", "Paid", "Due", "Status"]],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [79, 70, 229] },
      });

      doc.save(`${agent.agent_name}_Statement_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("Statement PDF downloaded successfully");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate statement PDF");
    }
  };

  const handleDeleteBooking = async () => {
    if (!bookingToDelete) return;
    try {
      await deleteBooking.mutateAsync(bookingToDelete.id);
      toast.success("Booking deleted successfully");
      setBookingToDelete(null);
      if (selectedBookingForView?.id === bookingToDelete.id) {
        setSelectedBookingForView(null);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete booking");
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background flex flex-col h-screen w-screen overflow-hidden text-foreground animate-in fade-in duration-200">
        {/* ===================== TOP HEADER ===================== */}
        <div className="h-14 border-b border-border px-4 sm:px-6 flex items-center justify-between shrink-0 bg-muted/40">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="gap-1.5 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            <div className="h-4 w-px bg-border" />

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-purple-600/10 text-purple-600 flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate max-w-[200px] sm:max-w-md">
                  {agent.agent_name}
                </h2>
                {agent.business_name && (
                  <span className="text-xs text-muted-foreground block -mt-1">
                    {agent.business_name}
                  </span>
                )}
              </div>
              <Badge variant="secondary" className="bg-purple-600/10 text-purple-700 dark:text-purple-300 border-purple-500/20 text-xs">
                B2B Agent
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  agent.status === "active"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-gray-500/10 text-gray-600"
                )}
              >
                {agent.status === "active" ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportStatementPdf}
              className="text-xs h-8 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Statement PDF</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => setCardSubTab("add_payment")}
              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Receive Payment
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onAddBookingForAgent(agent.id);
              }}
              className="text-xs h-8 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Booking
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditAgentDialog(true)}
              className="text-xs h-8 gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit Agent</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 text-muted-foreground ml-1"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ===================== BODY CONTENT ===================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Top Info & Totals Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-card border rounded-lg p-3">
              <span className="text-xs text-muted-foreground block">Total Bookings</span>
              <span className="text-base sm:text-lg font-bold text-foreground">
                {bookings.length} Bookings
              </span>
            </div>
            <div className="bg-card border rounded-lg p-3">
              <span className="text-xs text-muted-foreground block">Total Sales</span>
              <span className="text-base sm:text-lg font-bold text-foreground">
                PKR {agentStats.totalSales.toLocaleString()}
              </span>
            </div>
            <div className="bg-card border rounded-lg p-3">
              <span className="text-xs text-muted-foreground block">Total Commission</span>
              <span className="text-base sm:text-lg font-bold text-purple-600">
                PKR {agentStats.totalCommission.toLocaleString()}
              </span>
            </div>
            <div className="bg-card border rounded-lg p-3">
              <span className="text-xs text-muted-foreground block">Paid by Agent</span>
              <span className="text-base sm:text-lg font-bold text-emerald-600">
                PKR {agentStats.totalCredits.toLocaleString()}
              </span>
            </div>
            <div className="bg-card border rounded-lg p-3">
              <span className="text-xs text-muted-foreground block">Net Balance</span>
              <span
                className={cn(
                  "text-base sm:text-lg font-bold",
                  agentStats.outstanding > 0
                    ? "text-destructive"
                    : agentStats.outstanding < 0
                      ? "text-emerald-600"
                      : "text-muted-foreground"
                )}
              >
                PKR {Math.abs(agentStats.outstanding).toLocaleString()}{" "}
                <span className="text-xs font-semibold">
                  {agentStats.outstanding > 0 ? "DR" : agentStats.outstanding < 0 ? "CR" : ""}
                </span>
              </span>
            </div>
          </div>

          {/* Agent Contact Details Strip */}
          <div className="bg-muted/30 border rounded-lg p-3 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
              {agent.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-primary" />
                  <b className="text-foreground">{agent.phone}</b>
                </span>
              )}
              {agent.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-primary" />
                  <b className="text-foreground">{agent.email}</b>
                </span>
              )}
              {(agent.city || agent.country) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <b className="text-foreground">
                    {[agent.city, agent.country].filter(Boolean).join(", ")}
                  </b>
                </span>
              )}
              <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-700 dark:text-purple-300">
                Commission: {agent.commission_type === "percentage" ? `${agent.commission_value}%` : `PKR ${agent.commission_value}`}
              </Badge>
            </div>
          </div>

          {/* Sub-Tabs: Bookings | Ledger | Statement | Add Payment */}
          <div className="flex items-center justify-between border-b pb-2">
            <Tabs value={cardSubTab} onValueChange={(val: any) => setCardSubTab(val)} className="w-full sm:w-auto">
              <TabsList className="grid grid-cols-4 w-full sm:w-auto h-9 p-0.5 bg-muted/60 border">
                <TabsTrigger value="bookings" className="text-xs font-semibold gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-primary" />
                  Bookings
                </TabsTrigger>
                <TabsTrigger value="ledger" className="text-xs font-semibold gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-purple-600" />
                  Ledger
                </TabsTrigger>
                <TabsTrigger value="statement" className="text-xs font-semibold gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Statement
                </TabsTrigger>
                <TabsTrigger value="add_payment" className="text-xs font-semibold gap-1.5 text-emerald-600">
                  <DollarSign className="w-3.5 h-3.5" />
                  Add Payment
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {cardSubTab === "bookings" && (
            <Card>
              <CardHeader className="py-3 px-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-primary" />
                    Agent Bookings Manifest ({filteredBookings.length})
                  </CardTitle>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    (Click any row to open full view)
                  </span>
                </div>

                {/* Filters: Day/Month & Search */}
                <div className="flex items-center gap-2">
                  <div className="relative w-44 sm:w-56">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search passenger, PNR..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 text-xs pl-8"
                    />
                  </div>

                  <Select
                    value={datePeriod}
                    onValueChange={(val: any) => setDatePeriod(val)}
                  >
                    <SelectTrigger className="h-8 text-xs w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dates</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b text-muted-foreground">
                    <tr>
                      <th className="p-2.5 text-left">Date</th>
                      <th className="p-2.5 text-left">Passenger Name</th>
                      <th className="p-2.5 text-left">PNR</th>
                      <th className="p-2.5 text-left">Airline / Service</th>
                      <th className="p-2.5 text-right">Total</th>
                      <th className="p-2.5 text-right">Paid</th>
                      <th className="p-2.5 text-right">Pending</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-center w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredBookings.length > 0 ? (
                      filteredBookings.map((b) => {
                        const total = b.selling_price || 0;
                        const paid = getBookingPaid(b);
                        const due = Math.max(0, total - (b.commission_amount || 0) - paid);
                        return (
                          <tr
                            key={b.id}
                            onClick={() => setSelectedBookingForView(b)}
                            className="hover:bg-muted/30 cursor-pointer transition-colors"
                          >
                            <td className="p-2.5 text-muted-foreground whitespace-nowrap">
                              {b.flight_date || b.created_at?.split("T")[0] || "-"}
                            </td>
                            <td className="p-2.5 font-bold uppercase text-foreground">
                              {b.passenger_name}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-primary">
                              {b.pnr || "-"}
                            </td>
                            <td className="p-2.5">
                              {b.airline || b.destination || "Ticket"}
                            </td>
                            <td className="p-2.5 text-right font-medium">
                              PKR {total.toLocaleString()}
                            </td>
                            <td className="p-2.5 text-right font-medium text-emerald-600">
                              PKR {paid.toLocaleString()}
                            </td>
                            <td className="p-2.5 text-right font-bold text-amber-600">
                              PKR {due.toLocaleString()}
                            </td>
                            <td className="p-2.5 text-center">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] h-4.5 px-1.5 capitalize",
                                  b.payment_status === "paid"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                    : b.payment_status === "partial"
                                      ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                      : "bg-red-500/10 text-red-600 border-red-500/30"
                                )}
                              >
                                {b.payment_status || "pending"}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setBookingToDelete(b)}
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-muted-foreground italic">
                          No bookings found for the selected filter
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {cardSubTab !== "bookings" && (
            <PartyLedgerAndStatement
              partyId={agent.id}
              partyType="agent"
              partyName={agent.agent_name}
              defaultSubTab={cardSubTab === "add_payment" ? "payment" : cardSubTab === "statement" ? "statement" : "ledger"}
              outstandingBalance={agentStats.outstanding}
            />
          )}
        </div>
      </div>

      {/* Lump Sum Payment Dialog */}
      {showPaymentDialog && (
        <AgentLumpSumPaymentDialog
          agent={agent}
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
        />
      )}

      {/* Edit Agent Dialog */}
      {showEditAgentDialog && (
        <AddB2BAgentDialog
          editAgent={agent}
          open={showEditAgentDialog}
          onOpenChange={setShowEditAgentDialog}
        />
      )}

      {/* Single Booking Detail Modal when row is clicked */}
      {selectedBookingForView && (
        <div className="fixed inset-0 z-60 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border rounded-lg shadow-xl w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">{selectedBookingForView.passenger_name}</h3>
                <Badge variant="outline" className="text-xs">
                  {selectedBookingForView.pnr || "No PNR"}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedBookingForView(null)}
                className="h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 bg-muted/30 rounded border">
                  <span className="text-muted-foreground block">Selling Price</span>
                  <span className="font-bold text-sm">
                    PKR {(selectedBookingForView.selling_price || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 bg-muted/30 rounded border">
                  <span className="text-muted-foreground block">Commission</span>
                  <span className="font-bold text-sm text-purple-600">
                    PKR {(selectedBookingForView.commission_amount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 bg-muted/30 rounded border">
                  <span className="text-muted-foreground block">Purchase Cost</span>
                  <span className="font-bold text-sm">
                    PKR {(selectedBookingForView.purchasing_price || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 bg-muted/30 rounded border">
                  <span className="text-muted-foreground block">Status</span>
                  <span className="font-bold text-sm capitalize text-emerald-600">
                    {selectedBookingForView.payment_status || "Pending"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Flight Date</span>
                  <span className="font-semibold text-foreground">
                    {selectedBookingForView.flight_date || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Airline</span>
                  <span className="font-semibold text-foreground">
                    {selectedBookingForView.airline || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Destination</span>
                  <span className="font-semibold text-foreground">
                    {selectedBookingForView.destination || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Passport Number</span>
                  <span className="font-semibold text-foreground font-mono">
                    {selectedBookingForView.passenger_passport || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Passenger Contact</span>
                  <span className="font-semibold text-foreground">
                    {selectedBookingForView.passenger_contact || "-"}
                  </span>
                </div>
              </div>

              {selectedBookingForView.notes && (
                <div className="p-3 bg-muted/20 border rounded text-xs">
                  <span className="font-semibold block mb-1">Notes / Manifest:</span>
                  <pre className="text-[11px] whitespace-pre-wrap font-sans text-muted-foreground">
                    {selectedBookingForView.notes}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-3 border-t bg-muted/40 flex items-center justify-between">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBookingToDelete(selectedBookingForView)}
                className="text-xs h-8 gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Booking
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const b = selectedBookingForView;
                    setSelectedBookingForView(null);
                    onOpenChange(false);
                    onEditBooking?.(b);
                  }}
                  className="text-xs h-8 gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Booking
                </Button>
                <Button
                  size="sm"
                  onClick={() => setSelectedBookingForView(null)}
                  className="text-xs h-8"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={Boolean(bookingToDelete)}
        onOpenChange={(val) => !val && setBookingToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this booking for{" "}
              <b>{bookingToDelete?.passenger_name}</b>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBooking}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

