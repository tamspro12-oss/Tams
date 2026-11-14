import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Party, useParties } from "@/hooks/useParties";
import { supabase } from "@/integrations/supabase/client";
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";
import { Lock, Info, Users } from "lucide-react";
import { toast } from "sonner";

interface AddPartyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: "client" | "vendor" | "both";
  lockType?: boolean;
  partyToEdit?: Party | null;
  onSaved?: (party: Party) => void;
}

export const AddPartyDialog: React.FC<AddPartyDialogProps> = ({
  open,
  onOpenChange,
  initialType = "client",
  lockType = false,
  partyToEdit = null,
  onSaved,
}) => {
  const { addParty, updateParty, isSaving } = useParties();
  const formRef = useRef<HTMLFormElement>(null);

  const isTypeLocked = lockType || (initialType !== undefined && lockType);

  const [type, setType] = useState<"client" | "vendor" | "both">(
    partyToEdit ? partyToEdit.type : initialType
  );
  const [name, setName] = useState(partyToEdit ? partyToEdit.name : "");
  const [codePreview, setCodePreview] = useState<string>(
    partyToEdit?.code || "Loading..."
  );
  const [phone, setPhone] = useState(partyToEdit?.phone || "");
  const [email, setEmail] = useState(partyToEdit?.email || "");
  const [city, setCity] = useState(partyToEdit?.city || "");
  const [address, setAddress] = useState(partyToEdit?.address || "");
  const [creditLimit, setCreditLimit] = useState<string>(
    partyToEdit ? String(partyToEdit.credit_limit || 0) : "0"
  );
  const [openingBalance, setOpeningBalance] = useState<string>(
    partyToEdit ? String(partyToEdit.opening_balance || 0) : "0"
  );
  const [notes, setNotes] = useState(partyToEdit?.notes || "");

  // Reset or fill form when open or partyToEdit changes
  useEffect(() => {
    if (open) {
      if (partyToEdit) {
        setType(partyToEdit.type || "client");
        setName(partyToEdit.name || "");
        setCodePreview(partyToEdit.code || "—");
        setPhone(partyToEdit.phone || "");
        setEmail(partyToEdit.email || "");
        setCity(partyToEdit.city || "");
        setAddress(partyToEdit.address || "");
        setCreditLimit(String(partyToEdit.credit_limit || 0));
        setOpeningBalance(String(partyToEdit.opening_balance || 0));
        setNotes(partyToEdit.notes || "");
      } else {
        setType(initialType);
        setName("");
        setPhone("");
        setEmail("");
        setCity("");
        setAddress("");
        setCreditLimit("0");
        setOpeningBalance("0");
        setNotes("");
      }
    }
  }, [open, partyToEdit, initialType]);

  // Fetch live running code preview when adding new party
  useEffect(() => {
    if (!open || partyToEdit) return;

    let isCancelled = false;
    async function fetchCodePreview() {
      try {
        const counterType = type === "vendor" ? "vendor" : "client";
        const { data, error } = await supabase.rpc("preview_next_number", {
          p_counter_type: counterType,
        });
        if (!error && data && !isCancelled) {
          setCodePreview(data);
          return;
        }
      } catch (err) {
        console.warn("Could not preview party code:", err);
      }
      if (!isCancelled) {
        setCodePreview(type === "vendor" ? "V-000001" : "C-000001");
      }
    }

    fetchCodePreview();

    return () => {
      isCancelled = true;
    };
  }, [open, type, partyToEdit]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("You are offline, not saved");
      return;
    }
    if (!name.trim()) {
      toast.error("Party name is required");
      return;
    }

    try {
      const parsedCredit = parseFloat(creditLimit) || 0;
      const parsedOpening = parseFloat(openingBalance) || 0;

      let saved: Party | undefined;

      if (partyToEdit) {
        saved = await updateParty({
          id: partyToEdit.id,
          updates: {
            type,
            name: name.trim(),
            phone: phone.trim() || undefined,
            whatsapp: phone.trim() || partyToEdit.whatsapp || undefined,
            email: email.trim() || undefined,
            city: city.trim() || undefined,
            address: address.trim() || undefined,
            credit_limit: parsedCredit,
            opening_balance: parsedOpening,
            notes: notes.trim() || undefined,
          },
        });
      } else {
        saved = await addParty({
          type,
          name: name.trim(),
          phone: phone.trim() || undefined,
          whatsapp: phone.trim() || undefined,
          email: email.trim() || undefined,
          city: city.trim() || undefined,
          address: address.trim() || undefined,
          credit_limit: parsedCredit,
          opening_balance: parsedOpening,
          current_balance: parsedOpening,
          notes: notes.trim() || undefined,
          active: true,
        });
      }

      onOpenChange(false);
      if (onSaved && saved) {
        onSaved(saved);
      }
    } catch {
      // Error handled by mutation
    }
  };

  const isDirty = Boolean(
    name.trim() !== (partyToEdit?.name || "") ||
      phone.trim() !== (partyToEdit?.phone || "") ||
      email.trim() !== (partyToEdit?.email || "") ||
      city.trim() !== (partyToEdit?.city || "") ||
      address.trim() !== (partyToEdit?.address || "") ||
      notes.trim() !== (partyToEdit?.notes || "")
  );

  useFormKeyboardNav({
    containerRef: formRef,
    enabled: open,
    isDirty,
    onSave: () => handleSubmit(),
    onCancel: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-3xl p-0 gap-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl">
        {/* Header: title, auto Party Code badge, close (X) */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
              {partyToEdit ? "Edit Party" : "Add New Party"}
            </DialogTitle>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 mr-7">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Party Code:</span>
            <span className="text-blue-600 dark:text-blue-400">{codePreview}</span>
            <Badge variant="secondary" className="text-[9px] px-1 h-3.5 ml-0.5">
              Auto
            </Badge>
          </div>
        </div>

        {/* ONE COMPACT FORM: Flat tight 4-column grid, compact inputs, fits on one screen with NO scrolling */}
        <form ref={formRef} onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3">
          {/* LINE 1: Type | Name * | Phone | Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Type
              </Label>
              <Select
                value={type}
                onValueChange={(val: any) => setType(val)}
                disabled={isTypeLocked}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Al-Madina Travels or Ali Khan"
                className="h-8 text-xs mt-1"
                required
                data-required-message="Party name is required"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Phone
              </Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0300 1234567"
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          {/* LINE 2: Opening Balance (PKR) | Credit Limit (PKR) | City | Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div>
              <div className="flex items-center gap-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Opening Balance (PKR)
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        tabIndex={-1}
                        className="inline-flex text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Positive = party owes you. Negative = you owe party."
                      >
                        <Info className="w-3 h-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-xs">
                      Positive = party owes you. Negative = you owe party.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0"
                className="h-8 text-xs text-right tabular-nums font-mono mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Credit Limit (PKR)
              </Label>
              <Input
                type="number"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="0"
                className="h-8 text-xs text-right tabular-nums font-mono mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                City
              </Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Lahore, Karachi..."
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Address
              </Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Office / street address"
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          {/* LINE 3: Notes (single-line input, grows only if the user types more) */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Notes
            </Label>
            <Textarea
              rows={1}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special remarks or instructions..."
              className="min-h-[32px] h-8 text-xs mt-1 resize-y py-1.5 focus:h-16 transition-[height] duration-200"
            />
          </div>

          {/* FOOTER: only "Cancel" and "Save Party" */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              data-save-button="true"
              disabled={isSaving}
              className="h-8 text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer min-w-[90px]"
            >
              {isSaving ? "Saving..." : partyToEdit ? "Update Party" : "Save Party"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
