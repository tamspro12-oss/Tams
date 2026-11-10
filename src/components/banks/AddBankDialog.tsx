import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface AddBankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (bankName: string) => void;
}

export const AddBankDialog: React.FC<AddBankDialogProps> = ({
  open,
  onOpenChange,
  onSaved,
}) => {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const [bankName, setBankName] = useState("");
  const [accountTitle, setAccountTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setBankName("");
    setAccountTitle("");
    setAccountNumber("");
    setOpeningBalance("0");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedBankName = bankName.trim();
    if (!trimmedBankName) {
      toast.error("Bank name is required");
      return;
    }

    if (!accountTitle.trim()) {
      toast.error("Account title is required");
      return;
    }

    if (!agencyId) {
      toast.error("Unable to identify agency. Please reload and try again.");
      return;
    }

    setIsSubmitting(true);
    try {
      const balanceNum = parseFloat(openingBalance) || 0;

      // 1. Insert into agency_banks
      const { error: bankErr } = await supabase.from("agency_banks").insert({
        agency_id: agencyId,
        bank_name: trimmedBankName,
        account_title: accountTitle.trim(),
        account_number: accountNumber.trim() || null,
        opening_balance: balanceNum,
        is_active: true,
      });

      if (bankErr) {
        if (bankErr.message?.includes("duplicate")) {
          toast.error("Bank account already exists");
        } else {
          throw bankErr;
        }
        return;
      }

      // 2. Safely sync into accounts table
      try {
        const fullAccountName = accountNumber.trim()
          ? `${trimmedBankName} (${accountNumber.trim()})`
          : trimmedBankName;

        await supabase.from("accounts").insert({
          agency_id: agencyId,
          name: fullAccountName,
          type: "bank",
          opening_balance: balanceNum,
          active: true,
        });
      } catch (accErr) {
        console.warn("Could not sync account table record:", accErr);
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["agency_banks"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });

      toast.success(`Bank account ${trimmedBankName} added successfully`);
      onSaved?.(trimmedBankName);
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add bank account");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 bg-background border rounded-xl shadow-xl">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <Building2 className="w-4 h-4" />
            </div>
            <DialogTitle className="text-base font-bold">Quick Add Bank Account</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-3.5 pt-2">
          <div>
            <Label className="text-xs font-semibold">
              Bank Name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. Meezan Bank / HBL / UBL"
              className="h-8 text-xs mt-1"
              required
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">
              Account Title <span className="text-red-500">*</span>
            </Label>
            <Input
              value={accountTitle}
              onChange={(e) => setAccountTitle(e.target.value)}
              placeholder="e.g. Usman Travels & Tours"
              className="h-8 text-xs mt-1"
              required
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Account Number (Optional)</Label>
            <Input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="e.g. 0101-0103456789 or IBAN"
              className="h-8 text-xs font-mono mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Opening Balance (PKR) (Optional)</Label>
            <Input
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0"
              className="h-8 text-xs font-mono mt-1"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white"
            >
              {isSubmitting ? "Saving..." : "Save Bank"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

