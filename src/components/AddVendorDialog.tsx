import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useVendors } from "@/hooks/useStorage";
import { useVendorPaymentHistoryLocal } from "@/hooks/useLocalPaymentHistory";
import { useOpeningBalances } from "@/hooks/useOpeningBalances";
import { useAgency } from "@/hooks/useAgency";
import { Plus, Store, User, Phone, Mail, Briefcase, Calendar, Banknote, FileText, Maximize2, Minimize2, Scale } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { FormSectionNav } from "@/components/FormSectionNav";
import { ScanAutofillButton } from "@/components/ai/ScanAutofillButton";

const SECTIONS = [
  { id: 'vendor-info', label: 'Vendor Information', color: 'purple' },
  { id: 'payment-info', label: 'Payment Information', color: 'amber' },
];

// Helper function to get initial form data
const getInitialFormData = (vendor?: any) => ({
  name: vendor?.name || "",
  contact_person: vendor?.contact_person || "",
  contact_number: vendor?.contact_number || "",
  email: vendor?.email || "",
  booking_date: vendor?.booking_date || "",
  payment_amount: vendor?.payment_amount?.toString() || "",
  amount_paid: vendor?.amount_paid?.toString() || "0",
  payment_status: vendor?.payment_status || "Pending",
  service_type: vendor?.service_type || "",
  notes: vendor?.notes || "",
});

export function AddVendorDialog({ editVendor, open, onOpenChange }: { editVendor?: any; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const { addVendor, updateVendor } = useVendors();
  const { addPaymentHistory } = useVendorPaymentHistoryLocal();
  const { balances, upsertBalance } = useOpeningBalances();
  const { data: agency } = useAgency();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const existingOpeningBalance = editVendor
    ? balances.find((b) => b.party_type === "vendor" && b.party_id === editVendor.id)
    : null;
  const [openingBalanceAmount, setOpeningBalanceAmount] = useState<string>("");
  const [openingBalanceType, setOpeningBalanceType] = useState<"payable" | "receivable">("payable");

  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  const { activeSection, setSectionRef, scrollToSection, containerRef, isVisible } = useScrollAnimation(SECTIONS.length);

  const [formData, setFormData] = useState(getInitialFormData(editVendor));

  // Auto-fill form when editVendor changes (CRUCIAL for editing!)
  useEffect(() => {
    if (editVendor && isOpen) {
      setFormData(getInitialFormData(editVendor));
      if (existingOpeningBalance) {
        setOpeningBalanceAmount(String(existingOpeningBalance.amount));
        setOpeningBalanceType(existingOpeningBalance.balance_type);
      } else {
        setOpeningBalanceAmount("");
        setOpeningBalanceType("payable");
      }
    } else if (!editVendor) {
      setOpeningBalanceAmount("");
      setOpeningBalanceType("payable");
    }
  }, [editVendor, isOpen, existingOpeningBalance]);

  // Reset form when dialog closes (for new vendor creation)
  useEffect(() => {
    if (!isOpen && !editVendor) {
      setFormData(getInitialFormData());
      setOpeningBalanceAmount("");
      setOpeningBalanceType("payable");
    }
  }, [isOpen, editVendor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const totalAmount = formData.payment_amount ? parseFloat(formData.payment_amount) : 0;
      const amountPaid = formData.amount_paid ? parseFloat(formData.amount_paid) : 0;
      const paymentStatus = amountPaid >= totalAmount ? "Paid" : "Pending";
      
      const vendorData = {
        name: formData.name,
        contact_person: formData.contact_person,
        contact_number: formData.contact_number,
        email: formData.email,
        booking_date: formData.booking_date || null,
        payment_amount: totalAmount,
        amount_paid: amountPaid,
        payment_status: paymentStatus,
        service_type: formData.service_type,
        notes: formData.notes,
      };

      let targetVendorId = editVendor?.id;
      if (editVendor) {
        await updateVendor.mutateAsync({ id: editVendor.id, vendor: vendorData });
      } else {
        const newVendor = await addVendor.mutateAsync(vendorData);
        targetVendorId = newVendor.id;
        
        if (amountPaid > 0 && agency?.id) {
          const paymentType: "partial" | "full" = amountPaid >= totalAmount ? "full" : "partial";
          await addPaymentHistory.mutateAsync({
            vendor_id: newVendor.id,
            agency_id: agency.id,
            payment_amount: amountPaid,
            payment_type: paymentType,
            payment_date: new Date().toISOString().split('T')[0],
            notes: `Initial payment of PKR ${amountPaid.toLocaleString()}`,
          });
        }
      }

      // Record optional Opening Balance
      const opBalNum = parseFloat(openingBalanceAmount);
      if (targetVendorId && !isNaN(opBalNum) && opBalNum > 0) {
        await upsertBalance.mutateAsync({
          party_type: "vendor",
          party_id: targetVendorId,
          balance_type: openingBalanceType,
          amount: opBalNum,
          as_of_date: new Date().toISOString().split("T")[0],
          notes: "Initial brought-forward opening balance",
        });
      }

      setIsOpen(false);
      setFormData({
        name: "",
        contact_person: "",
        contact_number: "",
        email: "",
        booking_date: "",
        payment_amount: "",
        amount_paid: "0",
        payment_status: "Pending",
        service_type: "",
        notes: "",
      });
    } catch (error) {
      // Error is already handled by the mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!editVendor && (
        <DialogTrigger asChild>
          <Button className="gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/25">
            <Plus className="w-4 h-4" />
            Add Vendor
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className={cn(
        "enterprise-dialog overflow-hidden flex flex-col transition-all duration-300",
        isFullScreen 
          ? "!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !max-w-none w-screen h-[100dvh] !rounded-none border-0" 
          : "w-[95vw] max-w-4xl max-h-[85vh]"
      )}>
        <DialogHeader className="pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="form-section-icon form-section-icon-purple">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">{editVendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
                <DialogDescription className="text-muted-foreground/80">Manage your vendor information and payments</DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="h-8 w-8 shrink-0"
              title={isFullScreen ? "Compact mode" : "Fullscreen mode"}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex justify-end pt-2">
            <ScanAutofillButton
              docType="invoice"
              label="Scan Invoice / Voucher"
              onApply={(f) => {
                setFormData((prev) => ({
                  ...prev,
                  name: prev.name || f.vendor_name || "",
                  contact_person: prev.contact_person || f.passenger_name || "",
                  payment_amount: prev.payment_amount || (f.amount ? String(f.amount) : ""),
                  booking_date: prev.booking_date || f.date || "",
                  notes: prev.notes || [f.invoice_number && `Invoice: ${f.invoice_number}`, f.pnr && `PNR: ${f.pnr}`, f.airline && `Airline: ${f.airline}`].filter(Boolean).join(" | "),
                }));
              }}
            />
          </div>
        </DialogHeader>
        
        {/* Section Navigation - Only in fullscreen */}
        {isFullScreen && (
          <FormSectionNav
            sections={SECTIONS}
            activeSection={activeSection}
            onNavigate={scrollToSection}
          />
        )}
        
        <form 
          onSubmit={handleSubmit} 
          className={cn(
            "flex-1 overflow-y-auto form-scroll-container",
            isFullScreen ? "p-6 lg:p-8" : "p-2"
          )}
        >
          <div 
            ref={containerRef}
            className={isFullScreen ? "max-w-3xl mx-auto space-y-6" : "space-y-4"}
          >
          {/* Vendor Information Card */}
          <div 
            ref={setSectionRef(0)}
            className={cn(
              "scroll-reveal",
              isVisible(0) && "is-visible"
            )}
          >
            <Card className="form-card form-card-purple">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon-purple">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="form-section-title form-section-title-purple">Vendor Information</h3>
                    <p className="form-section-description">Enter the vendor's basic details</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium flex items-center gap-2">
                      <Store className="w-4 h-4 text-purple-600" />
                      Vendor Name *
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Company or vendor name"
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_person" className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4 text-purple-600" />
                      Contact Person
                    </Label>
                    <Input
                      id="contact_person"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      placeholder="Primary contact name"
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_number" className="text-sm font-medium flex items-center gap-2">
                      <Phone className="w-4 h-4 text-purple-600" />
                      Contact Number
                    </Label>
                    <Input
                      id="contact_number"
                      value={formData.contact_number}
                      onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                      placeholder="Phone number"
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4 text-purple-600" />
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="vendor@example.com"
                      className="enterprise-input"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="service_type" className="text-sm font-medium flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-purple-600" />
                      Service Type *
                    </Label>
                    <Input
                      id="service_type"
                      placeholder="e.g., Hotel Booking, Visa Service"
                      value={formData.service_type}
                      onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                      required
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="booking_date" className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-600" />
                      Booking Date
                    </Label>
                    <Input
                      id="booking_date"
                      type="date"
                      value={formData.booking_date}
                      onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                      className="enterprise-input"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Information Card */}
          <div 
            ref={setSectionRef(1)}
            className={cn(
              "scroll-reveal",
              isVisible(1) && "is-visible"
            )}
          >
            <Card className="form-card form-card-amber">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon-amber">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="form-section-title form-section-title-amber">Payment Information</h3>
                    <p className="form-section-description">Track vendor payment amounts</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment_amount" className="text-sm font-medium flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-amber-600" />
                      Total Amount (PKR)
                    </Label>
                    <Input
                      id="payment_amount"
                      type="number"
                      value={formData.payment_amount}
                      onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
                      placeholder="Total payable amount"
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount_paid" className="text-sm font-medium flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-amber-600" />
                      Amount Paid (PKR)
                    </Label>
                    <Input
                      id="amount_paid"
                      type="number"
                      value={formData.amount_paid}
                      onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                      placeholder="Amount already paid"
                      className="enterprise-input"
                    />
                    <p className="text-xs text-muted-foreground/70">
                      Remaining will be calculated automatically
                    </p>
                  </div>
                </div>

                {/* Optional Opening Balance Section */}
                <div className="p-3.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-amber-600" />
                    <div>
                      <p className="text-xs font-semibold text-amber-900 dark:text-amber-300">Opening Balance (Optional Brought-Forward)</p>
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">Historical balance prior to software start. Does not affect P&L or sales.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Opening Balance (PKR)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={openingBalanceAmount}
                        onChange={(e) => setOpeningBalanceAmount(e.target.value)}
                        placeholder="0.00"
                        className="h-9 text-xs enterprise-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Balance Type</Label>
                      <Select
                        value={openingBalanceType}
                        onValueChange={(val: any) => setOpeningBalanceType(val)}
                      >
                        <SelectTrigger className="h-9 text-xs enterprise-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="payable">Payable (Agency owes Vendor)</SelectItem>
                          <SelectItem value="receivable">Advance / Credit (Vendor owes Agency)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-600" />
                    Notes
                  </Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Additional notes about this vendor..."
                    className="enterprise-input min-h-[80px] resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          </div>
          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-border/50 sticky bottom-0 bg-background pb-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              className="px-6"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="px-6 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/25"
            >
              {isSubmitting ? (editVendor ? "Updating..." : "Adding...") : (editVendor ? "Update Vendor" : "Add Vendor")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
