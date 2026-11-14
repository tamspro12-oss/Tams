import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useClients, useBookings } from "@/hooks/useStorage";
import { bookingSchema, validateData } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { ScanAutofillButton } from "@/components/ai/ScanAutofillButton";
import { BulkScanAutofillButton } from "@/components/ai/BulkScanAutofillButton";
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";


interface AddBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editBooking?: any;
}

export function AddBookingDialog({ open, onOpenChange, editBooking }: AddBookingDialogProps) {
  const [selectedClientId, setSelectedClientId] = useState(editBooking?.client_id || "");
  const formRef = useRef<HTMLFormElement>(null);
  const { clients } = useClients();
  const { addBooking, updateBooking } = useBookings();

  useFormKeyboardNav({
    containerRef: formRef,
    enabled: open,
    onSave: () => formRef.current?.requestSubmit(),
    onCancel: () => onOpenChange(false),
    autoFocusFirst: true,
  });

  const applyScan = (f: Record<string, any>) => {
    const form = formRef.current;
    if (!form) return;
    const setVal = (name: string, val: any) => {
      if (val === undefined || val === null || val === "") return;
      const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
      if (el) el.value = String(val);
    };
    setVal("pnr", f.pnr || f.document_number || f.passport_number);
    setVal("flightDate", f.date || f.expiry_date);
    const noteBits = [
      f.full_name && `Passenger: ${f.full_name}`,
      f.nationality && `Nationality: ${f.nationality}`,
      f.date_of_birth && `DOB: ${f.date_of_birth}`,
      f.airline && `Airline: ${f.airline}`,
    ].filter(Boolean).join(" | ");
    if (noteBits) setVal("notes", noteBits);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const bookingData = {
      client_id: selectedClientId,
      pnr: formData.get("pnr") as string,
      flight_date: formData.get("flightDate") as string,
      seat_class: (formData.get("seatClass") as string) || undefined,
      payment_status: formData.get("paymentStatus") as string,
      booking_type: formData.get("bookingType") as string,
      notes: (formData.get("notes") as string) || undefined,
      discount_amount: Number(formData.get("discountAmount")) || 0,
    };

    // Validate booking data
    const validation = validateData(bookingSchema, bookingData);
    
    if (!validation.success) {
      toast.error((validation as { success: false; error: string }).error);
      return;
    }

    const validatedData = validation.data;

    if (editBooking) {
      updateBooking.mutate({ id: editBooking.id, booking: validatedData }, {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedClientId("");
          toast.success("Booking updated successfully");
        }
      });
    } else {
      addBooking.mutate(validatedData, {
        onSuccess: () => {
          onOpenChange(false);
          e.currentTarget.reset();
          setSelectedClientId("");
          toast.success("Booking added successfully");
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh] flex flex-col p-4 sm:p-6 overflow-hidden"
      >
        <DialogHeader className="shrink-0 pb-2 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold">{editBooking ? 'Edit Booking' : 'Add New Booking'}</DialogTitle>
              <DialogDescription className="text-xs">Enter booking details and save.</DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <ScanAutofillButton onApply={applyScan} docType="auto" label="Scan Ticket / Passport" />
              <BulkScanAutofillButton
                label="Bulk Passengers"
                onApply={(records) => {
                  const form = formRef.current;
                  if (!form) return;
                  const lines = records.map((r, i) => {
                    const bits = [
                      r.full_name && `${i + 1}. ${r.full_name}`,
                      r.passport_number && `Passport: ${r.passport_number}`,
                      r.date_of_birth && `DOB: ${r.date_of_birth}`,
                      r.nationality && r.nationality,
                      r.passenger_type,
                    ].filter(Boolean);
                    return bits.join(" | ");
                  }).join("\n");
                  const el = form.querySelector<HTMLTextAreaElement>('[name="notes"]');
                  if (el) el.value = el.value ? `${el.value}\n${lines}` : lines;
                }}
              />
            </div>
          </div>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col justify-between">
          <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-4 py-2">
            {/* Column 1 */}
            <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Client & Classification
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="client" className="text-xs font-semibold">Client *</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bookingType" className="text-xs font-semibold">Booking Type *</Label>
                  <Select name="bookingType" defaultValue={editBooking?.booking_type || "Ticket"} required>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ticket">Ticket</SelectItem>
                      <SelectItem value="Umrah">Umrah</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="paymentStatus" className="text-xs font-semibold">Payment Status</Label>
                  <Select name="paymentStatus" defaultValue={editBooking?.payment_status || "Pending"}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Column 2 */}
            <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Flight & Reference
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pnr" className="text-xs font-semibold">PNR / Reference *</Label>
                  <Input id="pnr" name="pnr" required maxLength={50} defaultValue={editBooking?.pnr || ''} className="h-9 text-xs font-mono uppercase" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="flightDate" className="text-xs font-semibold">Flight Date *</Label>
                  <Input id="flightDate" name="flightDate" type="date" required defaultValue={editBooking?.flight_date || ''} className="h-9 text-xs" />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="seatClass" className="text-xs font-semibold">Seat Class</Label>
                    <Input id="seatClass" name="seatClass" placeholder="Economy, Business..." maxLength={50} defaultValue={editBooking?.seat_class || ''} className="h-9 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="discountAmount" className="text-xs font-semibold">Discount (PKR)</Label>
                    <Input id="discountAmount" name="discountAmount" type="number" min="0" step="0.01" placeholder="0" defaultValue={editBooking?.discount_amount || ''} className="h-9 text-xs font-mono text-right" />
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3 */}
            <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex-1 flex flex-col space-y-2">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Notes & Particulars
                </div>
                <div className="flex-1 flex flex-col space-y-1">
                  <Label htmlFor="notes" className="text-xs">Notes / Passenger Details</Label>
                  <Textarea id="notes" name="notes" maxLength={5000} defaultValue={editBooking?.notes || ''} className="flex-1 min-h-[140px] text-xs resize-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex gap-2 justify-end pt-3 border-t">
            <Button type="button" variant="outline" size="sm" tabIndex={-1} onClick={() => onOpenChange(false)} className="text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" data-save-button="true" disabled={addBooking.isPending || updateBooking.isPending || !selectedClientId} className="text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white">
              {addBooking.isPending || updateBooking.isPending ? (editBooking ? "Updating..." : "Adding...") : (editBooking ? "Update Booking" : "Add Booking")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
