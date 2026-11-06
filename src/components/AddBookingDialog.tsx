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
      <DialogContent>
          <DialogHeader>
            <DialogTitle>{editBooking ? 'Edit Booking' : 'Add New Booking'}</DialogTitle>
            <DialogDescription>Enter booking details and save.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 flex-wrap">
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
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client">Client *</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
              <SelectTrigger>
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
          <div className="space-y-2">
            <Label htmlFor="pnr">PNR / Reference *</Label>
            <Input id="pnr" name="pnr" required maxLength={50} defaultValue={editBooking?.pnr || ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="flightDate">Flight Date *</Label>
            <Input id="flightDate" name="flightDate" type="date" required defaultValue={editBooking?.flight_date || ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seatClass">Seat Class</Label>
            <Input id="seatClass" name="seatClass" placeholder="Economy, Business, etc." maxLength={50} defaultValue={editBooking?.seat_class || ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bookingType">Booking Type *</Label>
            <Select name="bookingType" defaultValue={editBooking?.booking_type || "Ticket"} required>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ticket">Ticket</SelectItem>
                <SelectItem value="Umrah">Umrah</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentStatus">Payment Status</Label>
            <Select name="paymentStatus" defaultValue={editBooking?.payment_status || "Pending"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="discountAmount">Discount Amount (PKR)</Label>
            <Input id="discountAmount" name="discountAmount" type="number" min="0" step="0.01" placeholder="0" defaultValue={editBooking?.discount_amount || ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} maxLength={5000} defaultValue={editBooking?.notes || ''} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addBooking.isPending || updateBooking.isPending || !selectedClientId}>
              {addBooking.isPending || updateBooking.isPending ? (editBooking ? "Updating..." : "Adding...") : (editBooking ? "Update Booking" : "Add Booking")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
