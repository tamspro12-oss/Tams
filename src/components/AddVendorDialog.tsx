import { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useVendors } from "@/hooks/useStorage";
import { useVendorPaymentHistoryLocal } from "@/hooks/useLocalPaymentHistory";
import { useOpeningBalances } from "@/hooks/useOpeningBalances";
import { useAgency } from "@/hooks/useAgency";
import {
  Plus,
  Store,
  User,
  Phone,
  Mail,
  Briefcase,
  Banknote,
  FileText,
  Scale,
  X,
  Check,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ScanAutofillButton } from "@/components/ai/ScanAutofillButton";
import { useEnterToNext } from "@/hooks/useEnterToNext";
import { LockedDateField, getTodayDateString } from "@/components/ui/LockedDateField";

export interface AddVendorDialogProps {
  editVendor?: any;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialName?: string;
  onSaved?: (vendor: any) => void;
}

export function AddVendorDialog({
  editVendor,
  open,
  onOpenChange,
  initialName = "",
  onSaved,
}: AddVendorDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  const { addVendor, updateVendor } = useVendors();
  const { addPaymentHistory } = useVendorPaymentHistoryLocal();
  const { balances, upsertBalance } = useOpeningBalances();
  const { data: agency } = useAgency();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // References
  const dialogRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const vendorNameRef = useRef<HTMLInputElement>(null);
  const serviceTypeRef = useRef<HTMLInputElement>(null);

  // Form states
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [amountPaid, setAmountPaid] = useState("0");
  const [notes, setNotes] = useState("");

  const existingOpeningBalance = editVendor
    ? balances.find((b) => b.party_type === "vendor" && b.party_id === editVendor.id)
    : null;
  const [openingBalanceAmount, setOpeningBalanceAmount] = useState<string>("");
  const [openingBalanceType, setOpeningBalanceType] = useState<"payable" | "receivable">("payable");

  // Remaining calculation
  const remainingAmount = useMemo(() => {
    const total = parseFloat(paymentAmount) || 0;
    const paid = parseFloat(amountPaid) || 0;
    return Math.max(0, total - paid);
  }, [paymentAmount, amountPaid]);

  // Form Reset / Initialization
  const resetForm = (namePrefill = "") => {
    if (editVendor) {
      setName(editVendor.name || "");
      setContactPerson(editVendor.contact_person || "");
      setContactNumber(editVendor.contact_number || "");
      setEmail(editVendor.email || "");
      setServiceType(editVendor.service_type || "");
      setBookingDate(getTodayDateString());
      setPaymentAmount(editVendor.payment_amount?.toString() || "");
      setAmountPaid(editVendor.amount_paid?.toString() || "0");
      setNotes(editVendor.notes || "");
      if (existingOpeningBalance) {
        setOpeningBalanceAmount(String(existingOpeningBalance.amount));
        setOpeningBalanceType(existingOpeningBalance.balance_type);
      } else {
        setOpeningBalanceAmount("");
        setOpeningBalanceType("payable");
      }
    } else {
      setName(namePrefill || initialName || "");
      setContactPerson("");
      setContactNumber("");
      setEmail("");
      setServiceType("Airlines / Ticketing");
      setBookingDate(getTodayDateString());
      setPaymentAmount("");
      setAmountPaid("0");
      setOpeningBalanceAmount("");
      setOpeningBalanceType("payable");
      setNotes("");
    }
  };

  useEffect(() => {
    if (isOpen) {
      resetForm(initialName);
      setTimeout(() => {
        if (vendorNameRef.current) {
          vendorNameRef.current.focus();
          if (vendorNameRef.current.value) {
            vendorNameRef.current.select();
          }
        }
      }, 80);
    }
  }, [isOpen, editVendor, initialName, existingOpeningBalance]);

  // Main Submit Handler
  const handleSaveInternal = async (isSaveAndAddNext = false) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Vendor Name is required");
      vendorNameRef.current?.focus();
      return;
    }

    const trimmedService = serviceType.trim();
    if (!trimmedService) {
      toast.error("Service Type is required");
      serviceTypeRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const totalAmount = paymentAmount ? parseFloat(paymentAmount) : 0;
      const paidVal = amountPaid ? parseFloat(amountPaid) : 0;
      const paymentStatus = paidVal >= totalAmount ? "Paid" : "Pending";

      const vendorData = {
        name: trimmedName,
        contact_person: contactPerson.trim() || null,
        contact_number: contactNumber.trim() || null,
        email: email.trim() || null,
        booking_date: bookingDate || null,
        payment_amount: totalAmount,
        amount_paid: paidVal,
        payment_status: paymentStatus,
        service_type: trimmedService,
        notes: notes.trim() || null,
      };

      let savedVendorResult: any = null;
      if (editVendor) {
        await updateVendor.mutateAsync({ id: editVendor.id, vendor: vendorData });
        savedVendorResult = { ...editVendor, ...vendorData };
        toast.success(`Vendor "${trimmedName}" updated successfully!`);
      } else {
        savedVendorResult = await addVendor.mutateAsync(vendorData);
        toast.success(`Vendor "${trimmedName}" created successfully!`);

        if (paidVal > 0 && agency?.id) {
          const paymentType: "partial" | "full" = paidVal >= totalAmount ? "full" : "partial";
          await addPaymentHistory.mutateAsync({
            vendor_id: savedVendorResult.id,
            agency_id: agency.id,
            payment_amount: paidVal,
            payment_type: paymentType,
            payment_date: new Date().toISOString().split("T")[0],
            notes: `Initial payment of PKR ${paidVal.toLocaleString()}`,
          });
        }
      }

      // Record optional Opening Balance
      const opBalNum = parseFloat(openingBalanceAmount);
      if (savedVendorResult?.id && !isNaN(opBalNum) && opBalNum > 0) {
        await upsertBalance.mutateAsync({
          party_type: "vendor",
          party_id: savedVendorResult.id,
          balance_type: openingBalanceType,
          amount: opBalNum,
          as_of_date: new Date().toISOString().split("T")[0],
          notes: "Initial brought-forward opening balance",
        });
      }

      if (savedVendorResult) {
        onSaved?.(savedVendorResult);
      }

      if (isSaveAndAddNext) {
        resetForm("");
        toast.info("Ready for next vendor");
        setTimeout(() => {
          vendorNameRef.current?.focus();
        }, 60);
      } else {
        setIsOpen(false);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to save vendor");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation hook (covers both form inputs and pinned footer Save button)
  useEnterToNext({
    containerRef: dialogRef,
    enabled: isOpen,
    isDirty: Boolean(name.trim() || contactPerson.trim() || paymentAmount),
    onSave: () => handleSaveInternal(false),
    onSaveAndAddNext: () => handleSaveInternal(true),
    onCancel: () => setIsOpen(false),
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {/* Uncontrolled Trigger for Pages like Vendors.tsx */}
      {!editVendor && open === undefined && (
        <DialogTrigger asChild>
          <Button
            size="sm"
            className="h-9 text-xs rounded-lg px-3.5 gap-1.5 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Vendor
          </Button>
        </DialogTrigger>
      )}

      <DialogContent
        ref={dialogRef}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] p-0 gap-0 overflow-hidden rounded-xl border border-border shadow-2xl flex flex-col bg-background"
        aria-describedby="add-vendor-description"
      >
        <DialogTitle className="sr-only">
          {editVendor ? "Edit Vendor" : "Add New Vendor"}
        </DialogTitle>
        <DialogDescription id="add-vendor-description" className="sr-only">
          Vendor profile and payable information form
        </DialogDescription>

        {/* ================= HEADER ================= */}
        <div className="h-11 px-4 border-b border-border/80 flex items-center justify-between shrink-0 bg-muted/40">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-sm tracking-tight text-foreground">
              {editVendor ? "Edit Vendor" : "Add New Vendor"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ScanAutofillButton
              docType="invoice"
              label="Scan Voucher"
              onApply={(f) => {
                if (f.vendor_name) setName(f.vendor_name);
                if (f.passenger_name) setContactPerson(f.passenger_name);
                if (f.amount) setPaymentAmount(String(f.amount));
                const noteBits = [
                  f.invoice_number && `Invoice: ${f.invoice_number}`,
                  f.pnr && `PNR: ${f.pnr}`,
                  f.airline && `Airline: ${f.airline}`,
                ]
                  .filter(Boolean)
                  .join(" | ");
                if (noteBits) setNotes((prev) => (prev ? `${prev}\n${noteBits}` : noteBits));
                toast.success("Voucher data autofilled!");
              }}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              tabIndex={-1}
              data-cancel-button="true"
              className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ================= FORM BODY ================= */}
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveInternal(false);
          }}
          className="flex-1 overflow-y-auto p-4 space-y-3.5"
        >
          {/* 1. Basic Info (BLUE) */}
          <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 border-l-4 border-l-blue-600 dark:border-l-blue-500 rounded-lg p-3 shadow-2xs">
            <div className="text-xs font-bold text-blue-950 dark:text-blue-100 flex items-center gap-1.5 mb-2.5">
              <Store className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Basic Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {/* Vendor Name */}
              <div className="sm:col-span-2 md:col-span-1">
                <Label
                  htmlFor="vendor_name"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block"
                >
                  Vendor / Supplier Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="vendor_name"
                  ref={vendorNameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. PIA, Gerry's, Bukhari"
                  required
                  className="h-8 text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                />
              </div>

              {/* Contact Person */}
              <div>
                <Label
                  htmlFor="contact_person"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block flex items-center gap-1"
                >
                  <User className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  Contact Person
                </Label>
                <Input
                  id="contact_person"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Primary contact name"
                  className="h-8 text-xs focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                />
              </div>

              {/* Contact Number */}
              <div>
                <Label
                  htmlFor="contact_number"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block flex items-center gap-1"
                >
                  <Phone className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  Phone Number
                </Label>
                <Input
                  id="contact_number"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="0300-1234567"
                  className="h-8 text-xs focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                />
              </div>

              {/* Email */}
              <div>
                <Label
                  htmlFor="vendor_email"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block flex items-center gap-1"
                >
                  <Mail className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  Email Address
                </Label>
                <Input
                  id="vendor_email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vendor@example.com"
                  className="h-8 text-xs focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                />
              </div>

              {/* Service Type */}
              <div>
                <Label
                  htmlFor="service_type"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block flex items-center gap-1"
                >
                  <Briefcase className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  Service Type <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="service_type"
                  ref={serviceTypeRef}
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  placeholder="e.g. Airlines, Hotel, Umrah, Visa"
                  required
                  className="h-8 text-xs focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                />
              </div>

              {/* Booking / Ledger Date (Locked System Date) */}
              <LockedDateField
                id="booking_date"
                label="Entry Date"
                value={bookingDate}
                onChange={setBookingDate}
              />
            </div>
          </div>

          {/* 2. Financial & Payment Info (GREEN) */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 border-l-4 border-l-emerald-600 dark:border-l-emerald-500 rounded-lg p-3 shadow-2xs">
            <div className="text-xs font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-1.5 mb-2.5">
              <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Financial & Payment Details
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {/* Total Payable Amount */}
              <div>
                <Label
                  htmlFor="payment_amount"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block"
                >
                  Total Cost / Payable (PKR)
                </Label>
                <Input
                  id="payment_amount"
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                />
              </div>

              {/* Amount Paid */}
              <div>
                <Label
                  htmlFor="amount_paid"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block"
                >
                  Amount Paid (PKR)
                </Label>
                <Input
                  id="amount_paid"
                  type="number"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-xs font-semibold text-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                />
              </div>

              {/* Remaining (Auto, Read-only: Green at 0, Red above 0) */}
              <div>
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block">
                  Remaining Balance
                </Label>
                <div
                  tabIndex={-1}
                  className={cn(
                    "h-8 px-2 flex items-center justify-between rounded-md border text-xs font-bold select-none",
                    remainingAmount === 0
                      ? "text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800"
                      : "text-red-700 dark:text-red-400 bg-red-100/70 dark:bg-red-950/50 border-red-300 dark:border-red-800"
                  )}
                >
                  <span>PKR {remainingAmount.toLocaleString()}</span>
                  <span className="text-[10px] font-semibold uppercase opacity-80">
                    {remainingAmount === 0 ? "Settled" : "Payable"}
                  </span>
                </div>
              </div>

              {/* Opening Balance Group */}
              <div>
                <Label
                  htmlFor="vendor_opening_balance"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block flex items-center gap-1"
                >
                  <Scale className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Opening Balance
                </Label>
                <div className="flex gap-1">
                  <Select
                    value={openingBalanceType}
                    onValueChange={(val: any) => setOpeningBalanceType(val)}
                  >
                    <SelectTrigger className="h-8 text-xs w-20 shrink-0 bg-background focus:ring-2 focus:ring-emerald-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payable">Pay (Owed)</SelectItem>
                      <SelectItem value="receivable">Rec (Advance)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="vendor_opening_balance"
                    type="number"
                    step="0.01"
                    value={openingBalanceAmount}
                    onChange={(e) => setOpeningBalanceAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-xs flex-1 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Notes (AMBER) */}
          <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 border-l-4 border-l-amber-500 dark:border-l-amber-500 rounded-lg p-3 shadow-2xs">
            <div className="text-xs font-bold text-amber-950 dark:text-amber-100 flex items-center gap-1.5 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Notes & Remarks
            </div>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes, payment terms, or remarks for this vendor..."
              rows={2}
              className="text-xs min-h-[56px] resize-none bg-background focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:border-amber-500"
            />
          </div>
        </form>

        {/* ================= PINNED FOOTER ================= */}
        <div className="h-12 border-t border-border px-4 flex items-center justify-between shrink-0 bg-background/95 backdrop-blur-xs">
          <Button
            type="button"
            variant="outline"
            size="sm"
            tabIndex={-1}
            data-cancel-button="true"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
            className="text-xs h-8 cursor-pointer"
          >
            Cancel
          </Button>

          {/* Center hint text */}
          <div className="hidden sm:flex items-center text-[11px] text-muted-foreground select-none">
            <span>Enter = next field • Ctrl+Enter = save • Esc = cancel</span>
          </div>

          <div className="flex items-center gap-2">
            {!editVendor && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-save-next="true"
                onClick={() => handleSaveInternal(true)}
                disabled={isSubmitting}
                className="text-xs h-8 font-semibold gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Save & Add Next
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              data-save-button="true"
              onClick={() => handleSaveInternal(false)}
              disabled={isSubmitting}
              className="text-xs h-8 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? "Saving..." : editVendor ? "Update Vendor" : "Save Vendor"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
