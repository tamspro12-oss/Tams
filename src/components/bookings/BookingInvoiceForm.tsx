import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParties } from "@/hooks/useParties";
import { generateBookingConfirmationPdf, generateBookingInvoicePdf, BookingPdfData } from "@/lib/pdf/bookingInvoicePdf";
import { useAgency } from "@/hooks/useAgency";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText,
  FileCheck,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";

export type ServiceType = "Ticket" | "Umrah" | "Visa" | "Insurance" | "Hotel" | "Other";

interface Passenger {
  name: string;
  passport?: string;
  ticketNo?: string;
  type?: string;
}

interface BookingInvoiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const BookingInvoiceForm: React.FC<BookingInvoiceFormProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { parties } = useParties();
  const { data: agency } = useAgency();

  // Primary fields
  const [service, setService] = useState<ServiceType>("Ticket");
  const [partyId, setPartyId] = useState<string>("");
  const [vendorId, setVendorId] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );

  // Financials
  const [clientAmount, setClientAmount] = useState<string>("0");
  const [vendorPayable, setVendorPayable] = useState<string>("0");

  // Passengers
  const [passengers, setPassengers] = useState<Passenger[]>([
    { name: "", passport: "", type: "Adult" },
  ]);

  // Additional service details (always visible)
  const [pnr, setPnr] = useState("");
  const [ticketNo, setTicketNo] = useState("");
  const [passportNo, setPassportNo] = useState("");
  const [sarRate, setSarRate] = useState("");
  const [sarAmount, setSarAmount] = useState("");
  const [commission, setCommission] = useState("");
  const [wht, setWht] = useState("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter clients and vendors
  const clientsList = useMemo(
    () => parties.filter((p) => p.type === "client" || p.type === "both"),
    [parties]
  );
  const vendorsList = useMemo(
    () => parties.filter((p) => p.type === "vendor" || p.type === "both"),
    [parties]
  );

  // Live Profit Preview (Client Amount minus Vendor Payable)
  const clientAmtNum = parseFloat(clientAmount) || 0;
  const vendorPayNum = parseFloat(vendorPayable) || 0;
  const liveProfit = clientAmtNum - vendorPayNum;

  const handleAddPassenger = () => {
    setPassengers((prev) => [...prev, { name: "", passport: "", type: "Adult" }]);
  };

  const handleRemovePassenger = (index: number) => {
    if (passengers.length === 1) return;
    setPassengers((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePassengerChange = (index: number, field: keyof Passenger, value: string) => {
    setPassengers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const selectedParty = parties.find((p) => p.id === partyId);

  const getPdfData = (invNo: string): BookingPdfData => ({
    invoiceNo: invNo,
    invoiceDate,
    service,
    clientName: selectedParty?.name || passengers[0]?.name || "Customer",
    clientPhone: selectedParty?.phone,
    clientAddress: selectedParty?.address || selectedParty?.city,
    pnr: pnr || undefined,
    ticketNo: ticketNo || passengers[0]?.ticketNo || undefined,
    passportNo: passportNo || passengers[0]?.passport || undefined,
    passengers: passengers.filter((p) => p.name.trim()),
    clientAmount: clientAmtNum,
    paidAmount: 0,
    balanceDue: clientAmtNum,
    currency: "PKR",
    notes: notes || undefined,
    agency: {
      name: agency?.name,
      phone: agency?.contact_info,
    },
  });

  const handleSave = async (downloadConfirmation = false, downloadInvoice = false) => {
    if (!partyId && !passengers[0]?.name.trim()) {
      toast.error("Please select a client or enter a passenger name");
      return;
    }

    if (clientAmtNum <= 0) {
      toast.error("Client amount must be greater than zero");
      return;
    }

    setIsSubmitting(true);
    const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;

    try {
      // 1. Try atomic RPC if migration applied
      const { data, error } = await (supabase as any).rpc("save_booking_invoice", {
        p_invoice_no: invoiceNo,
        p_service: service,
        p_party_id: partyId || null,
        p_vendor_id: vendorId || null,
        p_client_amount: clientAmtNum,
        p_vendor_payable: vendorPayNum,
        p_invoice_date: invoiceDate,
        p_pnr: pnr || null,
        p_ticket_no: ticketNo || null,
        p_passport_no: passportNo || passengers[0]?.passport || null,
        p_passengers: passengers,
        p_currency: "PKR",
        p_sar_rate: sarRate ? parseFloat(sarRate) : null,
        p_sar_amount: sarAmount ? parseFloat(sarAmount) : null,
        p_commission: commission ? parseFloat(commission) : 0,
        p_wht: wht ? parseFloat(wht) : 0,
        p_notes: notes || null,
      });

      if (error) {
        // Fallback: save to clients and bookings
        await (supabase as any).from("clients").insert({
          name: selectedParty?.name || passengers[0]?.name,
          contact_number: selectedParty?.phone,
          travel_type: service === "Ticket" ? "Ticket" : service === "Umrah" ? "Umrah" : "Other",
          selling_price: clientAmtNum,
          purchasing_price: vendorPayNum,
          amount_paid: 0,
          payment_status: "Pending",
          pnr: pnr || null,
          passport_number: passportNo || passengers[0]?.passport || null,
          flight_date: invoiceDate,
        });
      }

      toast.success("Booking Invoice saved successfully");

      // PDF downloads
      const pdfData = getPdfData(invoiceNo);
      if (downloadConfirmation) {
        generateBookingConfirmationPdf(pdfData);
      }
      if (downloadInvoice) {
        generateBookingInvoicePdf(pdfData);
      }

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to save booking invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh] flex flex-col overflow-hidden p-0 gap-0 bg-background border rounded-xl shadow-2xl">
        {/* 1. Sticky Header */}
        <div className="px-6 py-3.5 border-b flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            New Booking Invoice
          </DialogTitle>
          <div className="flex items-center gap-2 mr-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => generateBookingConfirmationPdf(getPdfData("PREVIEW"))}
              className="text-xs h-8 gap-1.5 font-medium cursor-pointer"
            >
              <FileCheck className="w-3.5 h-3.5 text-teal-600" />
              Confirmation PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => generateBookingInvoicePdf(getPdfData("PREVIEW"))}
              className="text-xs h-8 gap-1.5 font-medium cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Invoice PDF
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-5 px-6 py-4">
          {/* Column 1: Service, Client, Vendor & Passengers */}
          <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
            {/* Primary Service Selection */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs font-semibold">Service</Label>
                  <Select value={service} onValueChange={(val: any) => setService(val)}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ticket">Air Ticket</SelectItem>
                      <SelectItem value="Umrah">Umrah Package</SelectItem>
                      <SelectItem value="Visa">Visa Services</SelectItem>
                      <SelectItem value="Insurance">Travel Insurance</SelectItem>
                      <SelectItem value="Hotel">Hotel Booking</SelectItem>
                      <SelectItem value="Other">Other Services</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Client (Party)</Label>
                  <Select value={partyId} onValueChange={setPartyId}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue placeholder="Select Client" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {clientsList.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.code ? `(${c.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Vendor (Supplier)</Label>
                  <Select value={vendorId} onValueChange={setVendorId}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue placeholder="Direct / Vendor" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <SelectItem value="none">Direct / None</SelectItem>
                      {vendorsList.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Passengers List */}
            <div className="flex-1 min-h-[180px] p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60 shrink-0">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Passengers ({passengers.length})
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddPassenger}
                  className="text-xs h-7 text-teal-600 dark:text-teal-400 gap-1 px-2"
                >
                  <Plus className="w-3 h-3" /> Add Passenger
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pt-2 pr-1">
                {passengers.map((pax, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-background p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-mono font-bold text-slate-400 w-4 text-center">
                      {idx + 1}
                    </span>
                    <Input
                      value={pax.name}
                      onChange={(e) => handlePassengerChange(idx, "name", e.target.value)}
                      placeholder="Passenger Name"
                      className="h-8 text-xs flex-1"
                    />
                    <Input
                      value={pax.passport || ""}
                      onChange={(e) => handlePassengerChange(idx, "passport", e.target.value)}
                      placeholder="Passport No"
                      className="h-8 text-xs w-24 font-mono uppercase"
                    />
                    <Select
                      value={pax.type || "Adult"}
                      onValueChange={(val) => handlePassengerChange(idx, "type", val)}
                    >
                      <SelectTrigger className="h-8 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Adult">Adult</SelectItem>
                        <SelectItem value="Child">Child</SelectItem>
                        <SelectItem value="Infant">Infant</SelectItem>
                      </SelectContent>
                    </Select>
                    {passengers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemovePassenger(idx)}
                        className="h-8 w-8 text-slate-400 hover:text-red-500 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Financials, Profit Preview, Commission & SAR */}
          <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
            {/* Financials & Live Profit */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Client Amount (PKR) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    value={clientAmount}
                    onChange={(e) => setClientAmount(e.target.value)}
                    placeholder="0"
                    className="h-9 text-xs font-mono font-bold text-right mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Vendor Payable (PKR)
                  </Label>
                  <Input
                    type="number"
                    value={vendorPayable}
                    onChange={(e) => setVendorPayable(e.target.value)}
                    placeholder="0"
                    className="h-9 text-xs font-mono text-right mt-1"
                  />
                </div>
              </div>

              {/* Live Profit Preview Box */}
              <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-teal-800 dark:text-teal-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <TrendingUp className="w-4 h-4" /> Profit Preview
                </span>
                <span
                  className={`text-xl font-bold font-mono ${
                    liveProfit >= 0
                      ? "text-teal-700 dark:text-teal-300"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  PKR {liveProfit.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Currency (SAR) & Commission / WHT */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Currency & Commissions
              </div>

              {/* SAR Currency Fields */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-xs font-medium">SAR Exchange Rate</Label>
                  <Input
                    type="number"
                    value={sarRate}
                    onChange={(e) => setSarRate(e.target.value)}
                    placeholder="e.g. 74.5"
                    className="h-8 text-xs font-mono text-right mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">SAR Amount</Label>
                  <Input
                    type="number"
                    value={sarAmount}
                    onChange={(e) => setSarAmount(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono text-right mt-1"
                  />
                </div>
              </div>

              {/* Commission and WHT */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-xs font-medium">Commission (PKR)</Label>
                  <Input
                    type="number"
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono text-right mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">WHT (PKR)</Label>
                  <Input
                    type="number"
                    value={wht}
                    onChange={(e) => setWht(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono text-right mt-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Booking Reference (PNR, Ticket, Passport) & Notes */}
          <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
            {/* References */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Booking References
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-xs font-medium">PNR</Label>
                  <Input
                    value={pnr}
                    onChange={(e) => setPnr(e.target.value.toUpperCase())}
                    placeholder="PNR Code"
                    className="h-8 text-xs font-mono uppercase mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Ticket Number</Label>
                  <Input
                    value={ticketNo}
                    onChange={(e) => setTicketNo(e.target.value)}
                    placeholder="e.g. 214-1234567890"
                    className="h-8 text-xs font-mono mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium">Primary Passport</Label>
                <Input
                  value={passportNo}
                  onChange={(e) => setPassportNo(e.target.value)}
                  placeholder="Passport Number"
                  className="h-8 text-xs font-mono uppercase mt-1"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="flex-1 p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col space-y-1.5">
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Booking Notes & Remarks
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Itinerary remarks, hotel room info, special passenger requests..."
                className="flex-1 min-h-[90px] text-xs resize-none"
              />
            </div>
          </div>
        </div>

        {/* 3. Pinned Bottom Footer */}
        <div className="px-6 py-3.5 border-t bg-gray-50 dark:bg-slate-900/60 flex items-center justify-end gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            onClick={() => handleSave(true, false)}
            className="text-xs cursor-pointer"
          >
            Save & Confirmation
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer"
          >
            {isSubmitting ? "Saving..." : "Save & Download Invoice"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

