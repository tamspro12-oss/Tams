import React, { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useParties, Party } from "@/hooks/useParties";
import { AddPartyDialog } from "@/components/parties/AddPartyDialog";
import { SearchableSelect, SearchableSelectItem } from "@/components/ui/SearchableSelect";
import { Users, Plus, Check, Phone } from "lucide-react";

interface UniversalPartySelectProps {
  value: string;
  onChange: (partyId: string, party?: Party) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  allowNone?: boolean;
  noneLabel?: string;
  defaultQuickAddType?: "client" | "vendor";
  className?: string;
}

export const UniversalPartySelect: React.FC<UniversalPartySelectProps> = ({
  value,
  onChange,
  label = "Party (Client / Vendor)",
  placeholder = "Search client or vendor...",
  required = false,
  allowNone = false,
  noneLabel = "None / Direct",
  defaultQuickAddType = "client",
  className = "",
}) => {
  const { parties, isLoading } = useParties();
  const [isAddPartyOpen, setIsAddPartyOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<"client" | "vendor">(defaultQuickAddType);

  const partyById = useMemo(() => {
    const map = new Map<string, Party>();
    for (const p of parties) {
      map.set(p.id, p);
    }
    return map;
  }, [parties]);

  const items: SearchableSelectItem[] = useMemo(
    () =>
      parties.map((p) => ({
        id: p.id,
        label: p.name,
        sublabel: p.code ? `(${p.code})` : undefined,
        badge: p.type,
        searchText: [p.name, p.code, p.phone, p.type].filter(Boolean).join(" "),
      })),
    [parties]
  );

  const handleOpenQuickAdd = (type: "client" | "vendor") => {
    setQuickAddType(type);
    setIsAddPartyOpen(true);
  };

  const handleChange = (partyId: string) => {
    const party = partyId && partyId !== "none" ? partyById.get(partyId) : undefined;
    onChange(partyId, party);
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Label and Quick Add header */}
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
          <Users className="w-3 h-3 text-slate-400" />
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => handleOpenQuickAdd(defaultQuickAddType)}
            className="text-[10px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-0.5 cursor-pointer hover:underline"
            title={`Quick add new ${defaultQuickAddType}`}
          >
            <Plus className="w-2.5 h-2.5" /> Quick Add
          </button>
        </div>
      </div>

      {/* Shared Keyboard-Friendly Searchable Select */}
      <SearchableSelect
        value={value}
        onChange={handleChange}
        items={items}
        isLoading={isLoading}
        placeholder={isLoading ? "Loading parties..." : placeholder}
        searchPlaceholder="Type name, party code, or phone..."
        allowClear={allowNone}
        alwaysShowClear={allowNone}
        clearValue="none"
        clearLabel={noneLabel}
        required={required}
        requiredMessage={`Please select ${label}`}
        popoverClassName="w-[320px] sm:w-[380px]"
        triggerProps={{
          "data-customer-box": "true",
          className: "customer-search-box",
        }}
        searchSubheader={(closePopover) => (
          <div className="flex items-center justify-between mt-1.5 px-0.5 text-[10px] text-muted-foreground">
            <span>Clients & Vendors searchable together</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  closePopover();
                  handleOpenQuickAdd("client");
                }}
                className="text-teal-600 hover:underline font-semibold cursor-pointer"
              >
                + Client
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  closePopover();
                  handleOpenQuickAdd("vendor");
                }}
                className="text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                + Vendor
              </button>
            </div>
          </div>
        )}
        renderSelected={(_selectedItem, curVal) => {
          if (curVal === "none") {
            return <span className="text-slate-500 italic">{noneLabel}</span>;
          }
          const selectedParty = curVal ? partyById.get(curVal) : undefined;
          if (!selectedParty) {
            return <span>{isLoading ? "Loading parties..." : placeholder}</span>;
          }
          return (
            <>
              <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                {selectedParty.name}
              </span>
              {selectedParty.code && (
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                  ({selectedParty.code})
                </span>
              )}
              <Badge
                variant="outline"
                className={`text-[9px] px-1 py-0 uppercase font-bold tracking-wider shrink-0 ${
                  selectedParty.type === "client"
                    ? "border-teal-500 text-teal-600 bg-teal-50 dark:bg-teal-950/40"
                    : "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40"
                }`}
              >
                {selectedParty.type}
              </Badge>
            </>
          );
        }}
        renderItem={(item, { isSelected }) => {
          const p = partyById.get(item.id);
          if (!p) return <span>{item.label}</span>;
          return (
            <>
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold truncate text-slate-800 dark:text-slate-100">
                    {p.name}
                  </span>
                  {p.code && (
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                      ({p.code})
                    </span>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 uppercase font-bold tracking-wider shrink-0 ${
                      p.type === "client"
                        ? "border-teal-400 text-teal-600 bg-teal-50 dark:bg-teal-950/40"
                        : "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950/40"
                    }`}
                  >
                    {p.type}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                  {p.phone && (
                    <span className="flex items-center gap-0.5">
                      <Phone className="w-2.5 h-2.5" /> {p.phone}
                    </span>
                  )}
                  {p.current_balance !== undefined && p.current_balance !== 0 && (
                    <span
                      className={`font-mono font-medium ${
                        p.current_balance > 0 ? "text-amber-600" : "text-emerald-600"
                      }`}
                    >
                      Bal: PKR {Math.abs(p.current_balance).toLocaleString()}{" "}
                      {p.current_balance > 0 ? "DR" : "CR"}
                    </span>
                  )}
                </div>
              </div>
              {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
            </>
          );
        }}
        emptyContent={(term, closePopover) => (
          <div className="p-4 text-center text-xs text-muted-foreground space-y-2">
            <p>No parties matching "{term}"</p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-quick-add-btn="true"
                className="h-7 text-xs text-teal-600 border-teal-200"
                onClick={() => {
                  closePopover();
                  handleOpenQuickAdd("client");
                }}
              >
                <Plus className="w-3 h-3 mr-1" /> Quick Add Client
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-quick-add-btn="true"
                className="h-7 text-xs text-blue-600 border-blue-200"
                onClick={() => {
                  closePopover();
                  handleOpenQuickAdd("vendor");
                }}
              >
                <Plus className="w-3 h-3 mr-1" /> Quick Add Vendor
              </Button>
            </div>
          </div>
        )}
      />

      {/* Quick Add Party Dialog */}
      <AddPartyDialog
        open={isAddPartyOpen}
        onOpenChange={setIsAddPartyOpen}
        initialType={quickAddType}
        lockType={false}
        onSaved={(newParty: Party) => {
          onChange(newParty.id, newParty);
        }}
      />
    </div>
  );
};
