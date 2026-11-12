import React, { useState, useMemo, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useParties, Party } from "@/hooks/useParties";
import { AddPartyDialog } from "@/components/parties/AddPartyDialog";
import { cleanPastedSearch } from "@/lib/searchUtils";
import {
  User,
  Users,
  Search,
  Plus,
  Check,
  ChevronsUpDown,
  X,
  Building,
  Phone,
} from "lucide-react";

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
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddPartyOpen, setIsAddPartyOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<"client" | "vendor">(defaultQuickAddType);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selected party entity
  const selectedParty = useMemo(() => {
    if (!value || value === "none") return null;
    return parties.find((p) => p.id === value) || null;
  }, [value, parties]);

  // Dynamically filter parties across both Clients & Vendors by name, code, phone
  const filteredParties = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return parties;
    return parties.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const code = (p.code || "").toLowerCase();
      const phone = (p.phone || "").toLowerCase();
      const type = (p.type || "").toLowerCase();
      return (
        name.includes(term) ||
        code.includes(term) ||
        phone.includes(term) ||
        type.includes(term)
      );
    });
  }, [parties, searchTerm]);

  // Handle focus when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm("");
    }
  }, [open]);

  const handleSelect = (pId: string, party?: Party) => {
    onChange(pId, party);
    setOpen(false);
  };

  const handleOpenQuickAdd = (type: "client" | "vendor") => {
    setQuickAddType(type);
    setIsAddPartyOpen(true);
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
            onClick={() => handleOpenQuickAdd(defaultQuickAddType)}
            className="text-[10px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-0.5 cursor-pointer hover:underline"
            title={`Quick add new ${defaultQuickAddType}`}
          >
            <Plus className="w-2.5 h-2.5" /> Quick Add
          </button>
        </div>
      </div>

      {/* Popover Selection Box */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className={`w-full h-8 px-2.5 py-1 text-xs border rounded-md bg-background flex items-center justify-between text-left focus:outline-none focus:ring-1 focus:ring-ring transition-colors ${
              !selectedParty && value !== "none" ? "text-muted-foreground" : "text-foreground font-medium"
            }`}
          >
            <span className="truncate flex items-center gap-1.5">
              {value === "none" ? (
                <span className="text-slate-500 italic">{noneLabel}</span>
              ) : selectedParty ? (
                <>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {selectedParty.name}
                  </span>
                  {selectedParty.code && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      ({selectedParty.code})
                    </span>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 uppercase font-bold tracking-wider ${
                      selectedParty.type === "client"
                        ? "border-teal-500 text-teal-600 bg-teal-50 dark:bg-teal-950/40"
                        : "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40"
                    }`}
                  >
                    {selectedParty.type}
                  </Badge>
                </>
              ) : (
                <span>{isLoading ? "Loading parties..." : placeholder}</span>
              )}
            </span>
            <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-[320px] sm:w-[380px] p-0" align="start">
          {/* Dynamic Search Box */}
          <div className="p-2 border-b bg-slate-50 dark:bg-slate-900/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchTerm}
                onChange={(e) => setSearchTerm(cleanPastedSearch(e.target.value))}
                placeholder="Type name, party code, or phone..."
                className="h-8 pl-8 pr-7 text-xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between mt-1.5 px-0.5 text-[10px] text-muted-foreground">
              <span>Clients & Vendors searchable together</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    handleOpenQuickAdd("client");
                  }}
                  className="text-teal-600 hover:underline font-semibold cursor-pointer"
                >
                  + Client
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    handleOpenQuickAdd("vendor");
                  }}
                  className="text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  + Vendor
                </button>
              </div>
            </div>
          </div>

          {/* Results List */}
          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-100 dark:divide-slate-800">
            {allowNone && (
              <button
                type="button"
                onClick={() => handleSelect("none")}
                className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  value === "none" ? "bg-slate-100 dark:bg-slate-800 font-semibold" : ""
                }`}
              >
                <span className="text-slate-500 italic">{noneLabel}</span>
                {value === "none" && <Check className="w-3.5 h-3.5 text-teal-600" />}
              </button>
            )}

            {filteredParties.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground space-y-2">
                <p>No parties matching "{searchTerm}"</p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-teal-600 border-teal-200"
                    onClick={() => {
                      setOpen(false);
                      handleOpenQuickAdd("client");
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Quick Add Client
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-blue-600 border-blue-200"
                    onClick={() => {
                      setOpen(false);
                      handleOpenQuickAdd("vendor");
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Quick Add Vendor
                  </Button>
                </div>
              </div>
            ) : (
              filteredParties.map((p) => {
                const isSelected = p.id === value;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p.id, p)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/70 ${
                      isSelected ? "bg-teal-50 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100" : ""
                    }`}
                  >
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
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Quick Add Party Dialog */}
      <AddPartyDialog
        open={isAddPartyOpen}
        onOpenChange={setIsAddPartyOpen}
        initialType={quickAddType}
        lockType={false}
        onSaved={(newParty: Party) => {
          handleSelect(newParty.id, newParty);
        }}
      />
    </div>
  );
};

