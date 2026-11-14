import React, { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Building2, Plus } from "lucide-react";
import { useAgencyBanks } from "@/hooks/useAgencyBanks";
import { AddBankDialog } from "@/components/banks/AddBankDialog";
import { SearchableSelect, SearchableSelectItem } from "@/components/ui/SearchableSelect";

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
  placeholder = "Select Bank",
  className = "",
}) => {
  const { banks } = useAgencyBanks();
  const [isAddBankOpen, setIsAddBankOpen] = useState(false);

  // Filter only active agency banks
  const activeBanks = (banks || []).filter((b) => b.is_active !== false);

  const bankItems: SearchableSelectItem[] = useMemo(() => {
    return activeBanks.map((b) => {
      const sub = b.account_number
        ? `${b.account_title ? b.account_title + " • " : ""}${b.account_number}${b.branch_name ? " • " + b.branch_name : ""}`
        : b.account_title || undefined;

      return {
        id: b.bank_name,
        label: b.bank_name,
        sublabel: sub,
        searchText: `${b.bank_name} ${b.account_title || ""} ${b.account_number || ""} ${b.branch_name || ""}`,
      };
    });
  }, [activeBanks]);

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
          <Building2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsAddBankOpen(true)}
          className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-0.5 cursor-pointer hover:underline"
        >
          <Plus className="w-2.5 h-2.5" /> Quick Add
        </button>
      </div>

      <div className="mt-0.5">
        <SearchableSelect
          value={value}
          onChange={onChange}
          items={bankItems}
          placeholder={placeholder}
          searchPlaceholder="Search bank by name, title, account #..."
          emptyText="No banks found"
          allowClear={!required}
          required={required}
          requiredMessage="Please select a bank account"
          clearLabel="Clear Bank (None)"
          onQuickAdd={() => setIsAddBankOpen(true)}
          quickAddLabel="Add New Bank"
        />
      </div>

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
