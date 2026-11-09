import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Party, useParties } from "@/hooks/useParties";
import { toast } from "sonner";

interface AddPartyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: "client" | "vendor" | "both";
  onSaved?: (party: Party) => void;
}

export const AddPartyDialog: React.FC<AddPartyDialogProps> = ({
  open,
  onOpenChange,
  initialType = "client",
  onSaved,
}) => {
  const { addParty, isSaving } = useParties();
  const [type, setType] = useState<"client" | "vendor" | "both">(initialType);
  const [name, setName] = useState("");
  const [code, setCode] = useState(() => `${initialType === "client" ? "CLT" : initialType === "vendor" ? "VND" : "PRT"}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [creditLimit, setCreditLimit] = useState<string>("0");
  const [openingBalance, setOpeningBalance] = useState<string>("0");

  // Additional details (always visible)
  const [cnic, setCnic] = useState("");
  const [ntn, setNtn] = useState("");
  const [email, setEmail] = useState("");
  const [passport, setPassport] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Party name is required");
      return;
    }

    try {
      const saved = await addParty({
        type,
        name: name.trim(),
        code: code.trim(),
        phone: phone.trim() || undefined,
        whatsapp: whatsapp.trim() || phone.trim() || undefined,
        city: city.trim() || undefined,
        address: address.trim() || undefined,
        credit_limit: parseFloat(creditLimit) || 0,
        opening_balance: parseFloat(openingBalance) || 0,
        current_balance: parseFloat(openingBalance) || 0,
        cnic: cnic.trim() || undefined,
        ntn: ntn.trim() || undefined,
        email: email.trim() || undefined,
        passport: passport.trim() || undefined,
        notes: notes.trim() || undefined,
        active: true,
      });

      onOpenChange(false);
      setName("");
      setPhone("");
      setWhatsapp("");
      setCity("");
      setAddress("");
      if (onSaved && saved) {
        onSaved(saved);
      }
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
            Add New Party
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          {/* Party Type */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Type</Label>
              <Select
                value={type}
                onValueChange={(val: any) => {
                  setType(val);
                  setCode(`${val === "client" ? "CLT" : val === "vendor" ? "VND" : "PRT"}-${Math.floor(1000 + Math.random() * 9000)}`);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="both">Both (Client & Vendor)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <Label className="text-xs font-semibold">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Al-Madina Travels or Ali Khan"
              className="h-9 text-xs"
              required
            />
          </div>

          {/* Phone & WhatsApp */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0300 1234567"
                className="h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">WhatsApp</Label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="0300 1234567"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* City & Address */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">City</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Lahore, Karachi..."
                className="h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Credit Limit (PKR)</Label>
              <Input
                type="number"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                className="h-9 text-xs text-right tabular-nums font-mono"
              />
            </div>
          </div>

          {/* Opening Balance */}
          <div>
            <Label className="text-xs font-semibold">Opening Balance (PKR)</Label>
            <Input
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0 (Positive = Receivable, Negative = Payable)"
              className="h-9 text-xs text-right tabular-nums font-mono"
            />
            <span className="text-[10px] text-muted-foreground">
              Positive amount = party owes you. Negative amount = you owe party.
            </span>
          </div>

          {/* Additional details */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">CNIC</Label>
                <Input
                  value={cnic}
                  onChange={(e) => setCnic(e.target.value)}
                  placeholder="35201-..."
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">NTN</Label>
                <Input
                  value={ntn}
                  onChange={(e) => setNtn(e.target.value)}
                  placeholder="NTN number"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Passport No</Label>
                <Input
                  value={passport}
                  onChange={(e) => setPassport(e.target.value)}
                  placeholder="A1234567"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Office / residential address"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special remarks..."
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white"
            >
              {isSaving ? "Saving..." : "Save Party"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

