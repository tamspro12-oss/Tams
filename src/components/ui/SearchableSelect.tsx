import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Search, ChevronsUpDown, Check, X, Plus } from "lucide-react";
import { cleanPastedSearch } from "@/lib/searchUtils";
import { cn } from "@/lib/utils";

export interface SearchableSelectItem {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
  searchText?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  items: SearchableSelectItem[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowClear?: boolean;
  clearLabel?: string;
  className?: string;
  disabled?: boolean;
  onQuickAdd?: () => void;
  quickAddLabel?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  items,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found",
  allowClear = false,
  clearLabel = "Clear selection",
  className = "",
  disabled = false,
  onQuickAdd,
  quickAddLabel = "Quick Add",
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
    }
  }, [open]);

  const selectedItem = useMemo(() => {
    if (!value || value === "none") return null;
    return items.find((item) => item.id === value) || null;
  }, [items, value]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      const matchLabel = item.label.toLowerCase().includes(term);
      const matchSub = item.sublabel ? item.sublabel.toLowerCase().includes(term) : false;
      const matchBadge = item.badge ? item.badge.toLowerCase().includes(term) : false;
      const matchSearch = item.searchText ? item.searchText.toLowerCase().includes(term) : false;
      return matchLabel || matchSub || matchBadge || matchSearch;
    });
  }, [items, search]);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full h-8 px-2.5 py-1 text-xs border rounded-none bg-background flex items-center justify-between text-left focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
            !selectedItem ? "text-muted-foreground" : "text-foreground font-medium",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <span className="truncate flex items-center gap-1.5 flex-1">
            {selectedItem ? (
              <>
                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {selectedItem.label}
                </span>
                {selectedItem.sublabel && (
                  <span className="text-[11px] text-muted-foreground truncate">
                    {selectedItem.sublabel}
                  </span>
                )}
                {selectedItem.badge && (
                  <span className="text-[9px] px-1 py-0 uppercase font-bold tracking-wider rounded-none border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    {selectedItem.badge}
                  </span>
                )}
              </>
            ) : (
              <span>{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[300px] sm:w-[360px] p-0 rounded-none bg-background border shadow-md"
        align="start"
      >
        {/* Search Input Bar */}
        <div className="p-2 border-b bg-slate-50 dark:bg-slate-900/50">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(cleanPastedSearch(e.target.value))}
              placeholder={searchPlaceholder}
              data-search-box="true"
              className="h-8 pl-8 pr-7 text-xs customer-search-box rounded-none bg-white dark:bg-slate-950"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Items List */}
        <div className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-100 dark:divide-slate-800">
          {allowClear && value && (
            <button
              type="button"
              onClick={handleClear}
              className="w-full text-left px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-between cursor-pointer transition-colors"
            >
              <span className="italic">{clearLabel}</span>
              <X className="w-3 h-3 text-rose-500" />
            </button>
          )}

          {filteredItems.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground space-y-1.5">
              <p>{emptyText}</p>
              {onQuickAdd && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onQuickAdd();
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> {quickAddLabel}
                </button>
              )}
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = item.id === value;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between cursor-pointer transition-colors",
                    isSelected
                      ? "bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-slate-100"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200"
                  )}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {item.sublabel}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

