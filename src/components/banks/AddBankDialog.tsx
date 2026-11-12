import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AgencyBank } from "@/hooks/useAgencyBanks";

interface AddBankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankToEdit?: AgencyBank | null;
  onSaved?: (bankName: string, bank?: AgencyBank) => void;
}

export const AddBankDialog: React.FC<AddBankDialogProps> = ({
  open,
  onOpenChange,
  bankToEdit = null,
  onSaved,
}) => {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const [bankName, setBankName] = useState("");
  const [accountTitle, setAccountTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [branchName, setBranchName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (bankToEdit) {
        setBankName(bankToEdit.bank_name || "");
        setAccountTitle(bankToEdit.account_title || "");
        setAccountNumber(bankToEdit.account_number || "");
        setBranchName(bankToEdit.branch_name || "");
        setOpeningBalance(String(bankToEdit.opening_balance || 0));
      } else {
        setBankName("");
        setAccountTitle("");
        setAccountNumber("");
        setBranchName("");
        setOpeningBalance("0");
      }
    }
  }, [open, bankToEdit]);

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

    const activeAgencyId = agencyId || (await getAuthenticatedAgencyId()) || localStorage.getItem("tams_agency_id");
    if (!activeAgencyId) {
      toast.error("Unable to identify agency. Please reload and try again.");
      return;
    }

    setIsSubmitting(true);
    try {
      const balanceNum = parseFloat(openingBalance) || 0;

      if (bankToEdit) {
        // Update existing agency bank
        const { data: updatedBank, error: updateErr } = await (supabase as any)
          .from("agency_banks")
          .update({
            bank_name: trimmedBankName,
            account_title: accountTitle.trim(),
            account_number: accountNumber.trim() || null,
            branch_name: branchName.trim() || null,
            opening_balance: balanceNum,
            updated_at: new Date().toISOString(),
          })
          .eq("id", bankToEdit.id)
          .select()
          .single();

        if (updateErr) throw updateErr;

        // Try syncing name in accounts table if matched
        try {
          const oldFullAccountName = bankToEdit.account_number
            ? `${bankToEdit.bank_name} (${bankToEdit.account_number})`
            : bankToEdit.bank_name;
          const newFullAccountName = accountNumber.trim()
            ? `${trimmedBankName} (${accountNumber.trim()})`
            : trimmedBankName;

          await (supabase as any)
            .from("accounts")
            .update({
              name: newFullAccountName,
              opening_balance: balanceNum,
            })
            .eq("agency_id", activeAgencyId)
            .eq("name", oldFullAccountName);
        } catch {
          // ignore account sync error
        }

        queryClient.invalidateQueries({ queryKey: ["agency_banks"] });
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["accounts_with_balances"] });

        toast.success(`Bank account ${trimmedBankName} updated successfully`);
        onSaved?.(trimmedBankName, updatedBank);
      } else {
        // Insert new agency bank
        const { data: newBank, error: bankErr } = await (supabase as any)
          .from("agency_banks")
          .insert({
            agency_id: activeAgencyId,
            bank_name: trimmedBankName,
            account_title: accountTitle.trim(),
            account_number: accountNumber.trim() || null,
            branch_name: branchName.trim() || null,
            opening_balance: balanceNum,
            is_active: true,
          })
          .select()
          .single();

        if (bankErr) {
          if (bankErr.message?.includes("duplicate")) {
            toast.error("Bank account already exists");
          } else {
            throw bankErr;
          }
          return;
        }

        // Safely sync into accounts table
        try {
          const fullAccountName = accountNumber.trim()
            ? `${trimmedBankName} (${accountNumber.trim()})`
            : trimmedBankName;

          await (supabase as any).from("accounts").insert({
            agency_id: activeAgencyId,
            name: fullAccountName,
            type: "bank",
            opening_balance: balanceNum,
            active: true,
          });
        } catch (accErr) {
          console.warn("Could not sync account table record:", accErr);
        }

        queryClient.invalidateQueries({ queryKey: ["agency_banks"] });
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["accounts_with_balances"] });

        toast.success(`Bank account ${trimmedBankName} added successfully`);
        onSaved?.(trimmedBankName, newBank);
      }

      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save bank account");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 bg-background border rounded-none shadow-xl">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-none bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <Building2 className="w-4 h-4" />
            </div>
            <DialogTitle className="text-base font-bold">
              {bankToEdit ? "Edit Bank Account" : "Add Bank Account"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-3 pt-2">
          <div>
            <Label className="text-xs font-semibold">
              Bank Name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. Meezan Bank / HBL / UBL"
              className="h-8 text-xs mt-1 rounded-none"
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
              className="h-8 text-xs mt-1 rounded-none"
              required
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Account Number (Optional)</Label>
            <Input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="e.g. 0101-0103456789 or IBAN"
              className="h-8 text-xs font-mono mt-1 rounded-none"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Branch Name / City (Optional)</Label>
            <Input
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="e.g. Main Branch, Lahore"
              className="h-8 text-xs mt-1 rounded-none"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Opening Balance (PKR) (Optional)</Label>
            <Input
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0"
              className="h-8 text-xs font-mono mt-1 rounded-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs rounded-none cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white rounded-none cursor-pointer"
            >
              {isSubmitting ? "Saving..." : bankToEdit ? "Update Bank" : "Save Bank"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
