import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVendors } from "@/hooks/useStorage";
import { useVendorPaymentHistoryLocal } from "@/hooks/useLocalPaymentHistory";
import { useAgency } from "@/hooks/useAgency";
import { Plus, Maximize2, Minimize2, Save, Building2 } from "lucide-react";
import { vendorSchema, validateData } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { LockedDateField, getTodayDateString } from "@/components/ui/LockedDateField";
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";

interface AddVendorDialogValidatedProps {
  editVendor?: any;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const getInitialFormData = (vendor?: any) => ({
  name: vendor?.name || "",
  contact_person: vendor?.contact_person || "",
  contact_number: vendor?.contact_number || "",
  email: vendor?.email || "",
  booking_date: getTodayDateString(),
  payment_amount: vendor?.payment_amount?.toString() || "",
  amount_paid: vendor?.amount_paid?.toString() || "0",
  payment_status: vendor?.payment_status || "Pending",
  service_type: vendor?.service_type || "",
  notes: vendor?.notes || "",
});

export function AddVendorDialogValidated({ editVendor, open, onOpenChange }: AddVendorDialogValidatedProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { addVendor, updateVendor } = useVendors();
  const { addPaymentHistory } = useVendorPaymentHistoryLocal();
  const { data: agency } = useAgency();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  const [formData, setFormData] = useState(getInitialFormData(editVendor));

  // Auto-fill form when editVendor changes (crucial for editing)
  useEffect(() => {
    if (editVendor && isOpen) {
      setFormData(getInitialFormData(editVendor));
    }
  }, [editVendor, isOpen]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen && !editVendor) {
      setFormData(getInitialFormData());
    }
  }, [isOpen, editVendor]);

  useFormKeyboardNav({
    containerRef: formRef,
    enabled: isOpen,
    onSave: () => formRef.current?.requestSubmit(),
    onCancel: () => setIsOpen(false),
    autoFocusFirst: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const totalAmount = formData.payment_amount ? parseFloat(formData.payment_amount) : 0;
      const amountPaid = formData.amount_paid ? parseFloat(formData.amount_paid) : 0;
      
      const vendorData = {
        name: formData.name.trim(),
        contact_person: formData.contact_person?.trim() || undefined,
        contact_number: formData.contact_number?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        service_type: formData.service_type?.trim() || undefined,
        payment_amount: totalAmount || undefined,
        amount_paid: amountPaid || undefined,
        notes: formData.notes?.trim() || undefined,
      };

      // Validate
      const validation = validateData(vendorSchema, vendorData);
      
      if (!validation.success) {
        setIsSubmitting(false);
        toast.error((validation as { success: false; error: string }).error);
        return;
      }

      const validatedData = validation.data;
      
      // Calculate payment status
      let paymentStatus = "Pending";
      if (totalAmount > 0) {
        if (amountPaid >= totalAmount) {
          paymentStatus = "Paid";
        } else if (amountPaid > 0) {
          paymentStatus = "Partial";
        }
      }
      
      const finalData = {
        ...validatedData,
        payment_status: paymentStatus,
        booking_date: formData.booking_date || null,
      };

      if (editVendor) {
        await updateVendor.mutateAsync({ id: editVendor.id, vendor: finalData });
        toast.success("Vendor updated successfully");
      } else {
        const newVendor = await addVendor.mutateAsync(finalData);
        
        // Record initial payment history if amount was paid
        if (amountPaid > 0 && agency?.id) {
          const paymentType: "partial" | "full" = amountPaid >= totalAmount ? "full" : "partial";
          await addPaymentHistory.mutateAsync({
            vendor_id: newVendor.id,
            agency_id: agency.id,
            payment_amount: amountPaid,
            payment_type: paymentType,
            payment_date: new Date().toISOString().split('T')[0],
            notes: `Initial payment of ₨${amountPaid.toLocaleString()}`,
          });
        }
        toast.success("Vendor added successfully");
      }

      setIsOpen(false);
      if (!editVendor) {
        setFormData(getInitialFormData());
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to save vendor");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!editVendor && (
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Add Vendor
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={isFullScreen ? "max-w-full h-screen m-0 rounded-none overflow-y-auto" : "w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] overflow-y-auto"}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <DialogTitle className="text-lg">{editVendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              tabIndex={-1}
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="h-8 w-8 p-0"
            >
              {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className={isFullScreen ? "p-6 lg:p-8" : ""}>
          <div className={isFullScreen ? "max-w-6xl mx-auto space-y-4" : "space-y-4"}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="name">Vendor Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_number">Contact Number</Label>
              <Input
                id="contact_number"
                value={formData.contact_number}
                onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                placeholder="03001234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_type">Service Type</Label>
              <Input
                id="service_type"
                value={formData.service_type}
                onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                placeholder="e.g., Hotel, Transport"
                maxLength={100}
              />
            </div>
            <LockedDateField
              id="booking_date"
              label="Entry Date"
              value={formData.booking_date}
              onChange={(val) => setFormData((prev) => ({ ...prev, booking_date: val }))}
            />
            <div className="space-y-2">
              <Label htmlFor="payment_amount">Payment Amount (₨)</Label>
              <Input
                id="payment_amount"
                type="number"
                step="0.01"
                min="0"
                max="10000000"
                value={formData.payment_amount}
                onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount_paid">Amount Paid (₨)</Label>
              <Input
                id="amount_paid"
                type="number"
                step="0.01"
                min="0"
                max="10000000"
                value={formData.amount_paid}
                onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_status">Payment Status</Label>
              <Select value={formData.payment_status} onValueChange={(value) => setFormData({ ...formData, payment_status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              maxLength={5000}
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" tabIndex={-1} onClick={() => setIsOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" data-save-button="true" disabled={isSubmitting} className="gap-2">
              <Save className="w-4 h-4" />
              {isSubmitting ? (editVendor ? "Updating..." : "Adding...") : (editVendor ? "Update Vendor" : "Add Vendor")}
            </Button>
          </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
