import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  X,
  Pencil,
  Trash2,
  DollarSign,
  Download,
  Ticket,
  FileText,
  User,
  Users,
  Plane,
  Building2,
  Calendar,
  Clock,
  Phone,
  Mail,
  Copy,
  Check,
  CreditCard,
  History,
  Store,
  AlertCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CopyValue } from "@/components/ui/CopyValue";
import { useVendors, useClients } from "@/hooks/useStorage";
import { useAgency } from "@/hooks/useAgency";
import { useVouchers } from "@/hooks/useVouchers";
import { InlinePaymentHistory } from "@/components/InlinePaymentHistory";
import { ClientPaymentDialog } from "@/components/ClientPaymentDialog";
import { CreateVoucherDialog } from "@/components/CreateVoucherDialog";
import { generateBookingConfirmationPDF } from "@/lib/bookingPdfGenerator";
import { downloadVoucherPdf, printVoucherPdf } from "@/lib/voucherPdfGenerator";
import { PartyLedgerAndStatement } from "./PartyLedgerAndStatement";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scale } from "lucide-react";
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

interface DirectBookingDetailModalProps {
  client: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (client: any) => void;
  onDeleteSuccess?: () => void;
}

export function DirectBookingDetailModal({
  client,
  open,
  onOpenChange,
  onEdit,
  onDeleteSuccess,
}: DirectBookingDetailModalProps) {
  const [cardSubTab, setCardSubTab] = useState<"bookings" | "ledger" | "statement" | "add_payment">("bookings");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCreateVoucher, setShowCreateVoucher] = useState(false);
  const [copiedPnr, setCopiedPnr] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const { deleteClient } = useClients();
  const { vendors } = useVendors();
  const { data: agency } = useAgency();
  const { vouchers, addVoucher } = useVouchers();

  if (!open || !client) return null;

  const vendor = client.vendor_id
    ? vendors.find((v) => v.id === client.vendor_id) || null
    : null;

  // Find linked vouchers
  const linkedVouchers = vouchers.filter(
    (v) =>
      v.booking_id === client.id ||
      (v.passenger_name &&
        v.passenger_name.toLowerCase() === client.name.toLowerCase()) ||
      (v.pnr && client.pnr && v.pnr.toLowerCase() === client.pnr.toLowerCase())
  );

  const purchasePrice = Number(client.purchasing_price) || 0;
  const sellingPrice = Number(client.selling_price) || 0;
  const amountPaid = Number(client.amount_paid) || 0;
  const remaining = Math.max(0, sellingPrice - amountPaid);
  const profit = sellingPrice - purchasePrice;

  const passengers = Array.isArray(client.passengers_data) && client.passengers_data.length > 0
    ? client.passengers_data
    : [
        {
          name: client.name,
          passport_number: client.passport_number || "-",
          cnic: client.cnic || "-",
          date_of_birth: "-",
          gender: "M",
          nationality: "Pakistani",
        },
      ];

  const handleCopyPnr = () => {
    if (!client.pnr) return;
    navigator.clipboard.writeText(client.pnr);
    setCopiedPnr(true);
    toast.success("PNR copied to clipboard");
    setTimeout(() => setCopiedPnr(false), 2000);
  };

  const handleDownloadConfirmationPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      await generateBookingConfirmationPDF(client, vendor, {
        agencyName: agency?.name || "Travel Agency",
        phone: agency?.phone_number || agency?.contact_info || "",
        email: agency?.email || agency?.contact_email || "",
      });
      toast.success("Booking confirmation PDF downloaded!");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate booking confirmation PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteClient.mutateAsync(client.id);
      toast.success("Booking deleted successfully");
      setShowDeleteConfirm(false);
      onOpenChange(false);
      onDeleteSuccess?.();
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
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate max-w-[200px] sm:max-w-md">
                {client.name}
              </h2>
              <Badge variant="secondary" className="bg-blue-600/10 text-blue-700 dark:text-blue-300 border-blue-500/20 text-xs">
                Direct
              </Badge>
              <Badge variant="outline" className="text-xs">
                {client.travel_type || "Ticket"}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs capitalize",
                  client.payment_status === "Paid" || client.payment_status === "paid"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : client.payment_status === "Partial" || client.payment_status === "partial"
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    : "bg-red-500/10 text-red-600 border-red-500/20"
                )}
              >
                ● {client.payment_status || "Pending"}
              </Badge>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadConfirmationPdf}
              disabled={isGeneratingPdf}
              className="text-xs h-8 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Booking PDF</span>
            </Button>

            {linkedVouchers.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadVoucherPdf(linkedVouchers[0], {
                    agencyName: agency?.name || "Travel Agency",
                    agencyEmail: agency?.email || agency?.contact_email || "",
                    agencyPhone: agency?.phone_number || agency?.contact_info || "",
                    agencyAddress: "",
                  })
                }
                className="text-xs h-8 gap-1.5"
              >
                <Ticket className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Voucher PDF</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateVoucher(true)}
                className="text-xs h-8 gap-1.5"
              >
                <Ticket className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">+ Voucher</span>
              </Button>
            )}

            <Button
              variant="default"
              size="sm"
              onClick={() => setCardSubTab("add_payment")}
              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Add Payment
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onEdit(client);
              }}
              className="text-xs h-8 gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteConfirm(true)}
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              title="Delete Booking"
            >
              <Trash2 className="w-4 h-4" />
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

        {/* ===================== FULL SCREEN BODY ===================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Top Quick Stats Card */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-card border rounded-lg p-3">
              <span className="text-xs text-muted-foreground block">Selling Price</span>
              <span className="text-base sm:text-lg font-bold text-foreground">
                <CopyValue
                  value={sellingPrice}
                  isAmount={true}
                  displayValue={`PKR ${sellingPrice.toLocaleString()}`}
                  label="selling price"
                />
              </span>
            </div>
            <div className="bg-card border rounded-lg p-3">
              <span className="text-xs text-muted-foreground block">Purchase Cost</span>
              <span className="text-base sm:text-lg font-bold text-foreground">
                <CopyValue
                  value={purchasePrice}
                  isAmount={true}
                  displayValue={`PKR ${purchasePrice.toLocaleString()}`}
                  label="purchase cost"
                />
              </span>
            </div>
            <div className="bg-card border rounded-lg p-3">
              <span className="text-xs text-muted-foreground block">Profit</span>
              <span className="text-base sm:text-lg font-bold text-emerald-600">
                <CopyValue
                  value={profit}
                  isAmount={true}
                  displayValue={`PKR ${profit.toLocaleString()}`}
                  label="profit"
                />
              </span>
            </div>
            <div className="bg-card border rounded-lg p-3">
              <span className="text-xs text-muted-foreground block">Paid Amount</span>
              <span className="text-base sm:text-lg font-bold text-emerald-600">
                <CopyValue
                  value={amountPaid}
                  isAmount={true}
                  displayValue={`PKR ${amountPaid.toLocaleString()}`}
                  label="paid amount"
                />
              </span>
            </div>
            <div className="bg-card border rounded-lg p-3">
              <span className="text-xs text-muted-foreground block">Remaining Due</span>
              <span
                className={cn(
                  "text-base sm:text-lg font-bold",
                  remaining > 0 ? "text-amber-600" : "text-muted-foreground"
                )}
              >
                <CopyValue
                  value={remaining}
                  isAmount={true}
                  displayValue={`PKR ${remaining.toLocaleString()}`}
                  label="remaining due"
                />
              </span>
            </div>
          </div>

          {/* Sub-Tabs: Bookings | Ledger | Statement | Add Payment */}
          <div className="flex items-center justify-between border-b pb-2">
            <Tabs value={cardSubTab} onValueChange={(val: any) => setCardSubTab(val)} className="w-full sm:w-auto">
              <TabsList className="grid grid-cols-4 w-full sm:w-auto h-9 p-0.5 bg-muted/60 border">
                <TabsTrigger value="bookings" className="text-xs font-semibold gap-1.5">
                  <Plane className="w-3.5 h-3.5 text-primary" />
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left 2 Cols: Travel & Passenger Details */}
            <div className="lg:col-span-2 space-y-5">
              {/* Flight & Travel Details Card */}
              <Card>
                <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Plane className="w-4 h-4 text-primary" />
                    Travel & Booking Information
                  </CardTitle>
                  {client.pnr && (
                    <div className="flex items-center gap-1.5 bg-muted/60 px-2 py-0.5 rounded border">
                      <span className="text-xs text-muted-foreground">PNR:</span>
                      <span className="font-mono font-bold text-xs">{client.pnr}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCopyPnr}
                        className="h-5 w-5 ml-1"
                      >
                        {copiedPnr ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Service Type</span>
                    <span className="font-semibold text-foreground text-sm">
                      {client.travel_type || "Ticket"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Destination</span>
                    <span className="font-semibold text-foreground text-sm uppercase">
                      {client.destination || "Not specified"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Airline</span>
                    <span className="font-semibold text-foreground text-sm">
                      {client.airline || "Not specified"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Flight Date</span>
                    <span className="font-semibold text-foreground text-sm flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      {client.flight_date
                        ? format(parseISO(client.flight_date), "dd MMM yyyy")
                        : "Not set"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Name Update Date</span>
                    <span className="font-semibold text-foreground text-sm flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      {client.name_update_date || "Not set"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Passengers Count</span>
                    <span className="font-semibold text-foreground text-sm">
                      {passengers.length} Pax ({client.group_booking_type || "Individual"})
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Contact Phone</span>
                    <span className="font-semibold text-foreground text-sm flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      {client.contact_number || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Contact Email</span>
                    <span className="font-semibold text-foreground text-sm flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      {client.email || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Booking Created</span>
                    <span className="font-semibold text-foreground text-sm">
                      {client.created_at
                        ? format(parseISO(client.created_at), "dd MMM yyyy, hh:mm a")
                        : "-"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Passengers Manifest Card */}
              <Card>
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    Passengers Manifest ({passengers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b text-muted-foreground">
                      <tr>
                        <th className="p-2.5 text-center w-10">#</th>
                        <th className="p-2.5 text-left">Passenger Name</th>
                        <th className="p-2.5 text-left">Passport Number</th>
                        <th className="p-2.5 text-left">CNIC</th>
                        <th className="p-2.5 text-left">DOB</th>
                        <th className="p-2.5 text-center">Gender</th>
                        <th className="p-2.5 text-left">Nationality</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {passengers.map((pax: any, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="p-2.5 text-center font-bold text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="p-2.5 font-bold uppercase text-foreground">
                            {pax.name || client.name}
                          </td>
                          <td className="p-2.5 font-mono uppercase">
                            {pax.passport_number || client.passport_number || "-"}
                          </td>
                          <td className="p-2.5 font-mono">
                            {pax.cnic || client.cnic || "-"}
                          </td>
                          <td className="p-2.5">{pax.date_of_birth || "-"}</td>
                          <td className="p-2.5 text-center">{pax.gender || "M"}</td>
                          <td className="p-2.5">{pax.nationality || "Pakistani"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Notes Card */}
              {client.notes && (
                <Card>
                  <CardHeader className="py-2.5 px-4 border-b">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                      Notes & Special Instructions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                    {client.notes}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Col: Payments & Vendor Association */}
            <div className="space-y-5">
              {/* Vendor Association Card */}
              <Card>
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Store className="w-4 h-4 text-emerald-500" />
                    Supplier / Vendor Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 text-xs space-y-2">
                  {vendor ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Vendor Name:</span>
                        <span className="font-bold text-foreground text-sm">
                          {vendor.name}
                        </span>
                      </div>
                      {vendor.service_type && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Service:</span>
                          <span className="font-medium text-foreground">
                            {vendor.service_type}
                          </span>
                        </div>
                      )}
                      {vendor.contact_person && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Contact Person:</span>
                          <span className="font-medium text-foreground">
                            {vendor.contact_person}
                          </span>
                        </div>
                      )}
                      {vendor.contact_number && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Phone:</span>
                          <span className="font-medium text-foreground">
                            {vendor.contact_number}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-muted-foreground">Payable for this booking:</span>
                        <span className="font-bold text-foreground">
                          PKR {purchasePrice.toLocaleString()}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground italic text-center py-2">
                      No vendor associated with this booking
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Payment History Card */}
              <Card>
                <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-500" />
                    Settlement & Payments
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPaymentDialog(true)}
                    className="h-7 text-xs gap-1"
                  >
                    <DollarSign className="w-3 h-3 text-emerald-600" />
                    + Payment
                  </Button>
                </CardHeader>
                <CardContent className="p-4">
                  <InlinePaymentHistory entityId={client.id} entityType="client" />
                </CardContent>
              </Card>

              {/* Linked Vouchers Card */}
              <Card>
                <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-amber-500" />
                    Vouchers ({linkedVouchers.length})
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateVoucher(true)}
                    className="h-7 text-xs text-amber-600 font-semibold"
                  >
                    + Create Voucher
                  </Button>
                </CardHeader>
                <CardContent className="p-4 text-xs space-y-2">
                  {linkedVouchers.length > 0 ? (
                    linkedVouchers.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between p-2 rounded border bg-muted/30"
                      >
                        <div>
                          <span className="font-bold">{v.voucher_number}</span>
                          <span className="text-muted-foreground ml-2">
                            ({v.voucher_type})
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            downloadVoucherPdf(v, {
                              agencyName: agency?.name || "Travel Agency",
                              agencyEmail: agency?.email || agency?.contact_email || "",
                              agencyPhone: agency?.phone_number || agency?.contact_info || "",
                              agencyAddress: "",
                            })
                          }
                          className="h-6 text-[11px] gap-1"
                        >
                          <Download className="w-3 h-3" />
                          PDF
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground italic text-center py-1">
                      No vouchers issued for this booking yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          )}

          {cardSubTab !== "bookings" && (
            <PartyLedgerAndStatement
              partyId={client.id}
              partyType="client"
              partyName={client.name}
              pnr={client.pnr}
              bookingId={client.id}
              defaultSubTab={cardSubTab === "add_payment" ? "payment" : cardSubTab === "statement" ? "statement" : "ledger"}
              outstandingBalance={remaining}
            />
          )}
        </div>
      </div>

      {/* Payment Dialog */}
      {showPaymentDialog && (
        <ClientPaymentDialog
          client={client}
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
        />
      )}

      {/* Create Voucher Dialog */}
      {showCreateVoucher && (
        <CreateVoucherDialog
          open={showCreateVoucher}
          onOpenChange={setShowCreateVoucher}
          initialBookingData={client}
          onSave={async (voucherData) => {
            await addVoucher.mutateAsync({
              ...voucherData,
              booking_id: client.id,
            });
            setShowCreateVoucher(false);
            toast.success("Voucher created successfully!");
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the booking for <b>{client.name}</b>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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

