import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Party, useParties } from "@/hooks/useParties";
import { supabase } from "@/integrations/supabase/client";
import { Lock } from "lucide-react";
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
  const [codePreview, setCodePreview] = useState<string>("Loading...");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [creditLimit, setCreditLimit] = useState<string>("0");
  const [openingBalance, setOpeningBalance] = useState<string>("0");

  useEffect(() => {
    async function fetchCodePreview() {
      try {
        const counterType = type === "vendor" ? "vendor" : "client";
        const { data, error } = await supabase.rpc("preview_next_number", {
          p_counter_type: counterType,
        });
        if (!error && data) {
          setCodePreview(data);
          return;
        }
      } catch (err) {
        console.warn("Could not preview party code:", err);
      }
      setCodePreview(type === "vendor" ? "V-000001" : "C-000001");
    }

    if (open) {
      fetchCodePreview();
    }
  }, [open, type]);

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
    } catch { }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-2 border-b">
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Add New Party
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col justify-between">
          <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-4 py-2">
            {/* Column 1: Basic Information */}
            <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Party Classification & Contact
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs font-semibold">Type</Label>
                    <Select
                      value={type}
                      onValueChange={(val: any) => {
                        setType(val);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
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
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Party Code</Label>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                        <Lock className="w-2.5 h-2.5" /> Auto
                      </span>
                    </div>
                    <Input
                      value={codePreview}
                      readOnly
                      disabled
                      className="h-8 text-xs font-mono mt-1 bg-muted/60 text-foreground cursor-not-allowed border-dashed"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">
                    Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Al-Madina Travels or Ali Khan"
                    className="h-8 text-xs mt-1"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs font-semibold">Phone</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0300 1234567"
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">WhatsApp</Label>
                    <Input
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="0300 1234567"
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Financials & Location */}
            <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Financials & Balances
                </div>

                <div>
                  <Label className="text-xs font-semibold">Opening Balance (PKR)</Label>
                  <Input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs text-right tabular-nums font-mono mt-1"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Positive amount = party owes you. Negative amount = you owe party.
                  </span>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Credit Limit (PKR)</Label>
                  <Input
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    className="h-8 text-xs text-right tabular-nums font-mono mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">City</Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Lahore, Karachi..."
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Address</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Office / residential address"
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Column 3: Tax, Identification & Notes */}
            <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex-1 flex flex-col space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Tax, Identification & Remarks
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs">CNIC</Label>
                    <Input
                      value={cnic}
                      onChange={(e) => setCnic(e.target.value)}
                      placeholder="35201-..."
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">NTN</Label>
                    <Input
                      value={ntn}
                      onChange={(e) => setNtn(e.target.value)}
                      placeholder="NTN number"
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Passport No</Label>
                    <Input
                      value={passport}
                      onChange={(e) => setPassport(e.target.value)}
                      placeholder="A1234567"
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>

                <div className="flex-1 flex flex-col space-y-1 mt-1">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Special remarks or instructions..."
                    className="flex-1 min-h-[90px] text-xs resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 flex items-center justify-between gap-2 pt-3 border-t">
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

