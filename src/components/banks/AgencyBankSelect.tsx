import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus } from "lucide-react";
import { useAgencyBanks } from "@/hooks/useAgencyBanks";
import { AddBankDialog } from "@/components/banks/AddBankDialog";

interface AgencyBankSelectProps {
  value: string;
  onChange: (bankName: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export const AgencyBankSelect: React.FC<AgencyBankSelectProps> = ({
  value,
  onChange,
  label = "Bank Account",
  required = true,
  placeholder = "Select Agency Bank",
  className = "",
}) => {
  const { banks, isLoading } = useAgencyBanks();
  const [isAddBankOpen, setIsAddBankOpen] = useState(false);

  // Filter only active agency banks
  const activeBanks = (banks || []).filter((b) => b.is_active !== false);

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
          <Building2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
        <button
          type="button"
          onClick={() => setIsAddBankOpen(true)}
          className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-0.5 cursor-pointer hover:underline"
        >
          <Plus className="w-2.5 h-2.5" /> Quick Bank
        </button>
      </div>

      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs mt-0.5">
          <SelectValue placeholder={isLoading ? "Loading banks..." : placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-56">
          {activeBanks.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">
              <p>No agency bank accounts registered.</p>
              <button
                type="button"
                onClick={() => setIsAddBankOpen(true)}
                className="mt-1.5 text-xs text-blue-600 font-semibold underline cursor-pointer"
              >
                + Register First Bank
              </button>
            </div>
          ) : (
            activeBanks.map((b) => {
              const displayLabel = b.account_number
                ? `${b.bank_name} - ${b.account_title || ""} (${b.account_number})`
                : b.bank_name;
              return (
                <SelectItem key={b.id} value={b.bank_name}>
                  {displayLabel}
                </SelectItem>
              );
            })
          )}
        </SelectContent>
      </Select>

      <AddBankDialog
        open={isAddBankOpen}
        onOpenChange={setIsAddBankOpen}
        onSaved={(newBankName: string) => {
          onChange(newBankName);
        }}
      />
    </div>
  );
};

