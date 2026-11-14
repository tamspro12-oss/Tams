import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
  alwaysShowClear?: boolean;
  clearValue?: string;
  clearLabel?: string;
  className?: string;
  popoverClassName?: string;
  disabled?: boolean;
  isLoading?: boolean;
  required?: boolean;
  requiredMessage?: string;
  onQuickAdd?: () => void;
  quickAddLabel?: string;
  searchSubheader?: React.ReactNode | ((closePopover: () => void) => React.ReactNode);
  renderSelected?: (selectedItem: SearchableSelectItem | null, value: string) => React.ReactNode;
  renderItem?: (
    item: SearchableSelectItem,
    state: { isSelected: boolean; isHighlighted: boolean }
  ) => React.ReactNode;
  emptyContent?: (search: string, closePopover: () => void) => React.ReactNode;
  triggerProps?: React.ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  items,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found",
  allowClear = false,
  alwaysShowClear = false,
  clearValue = "",
  clearLabel = "Clear selection",
  className = "",
  popoverClassName = "",
  disabled = false,
  isLoading = false,
  required = false,
  requiredMessage,
  onQuickAdd,
  quickAddLabel = "Quick Add",
  searchSubheader,
  renderSelected,
  renderItem,
  emptyContent,
  triggerProps,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingSeedSearchRef = useRef<string | null>(null);

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

  const showClearRow = allowClear && (alwaysShowClear || Boolean(value && value !== clearValue));

  const selectableOptions = useMemo(() => {
    const list: Array<{ type: "clear" | "item"; id: string; item?: SearchableSelectItem }> = [];
    if (showClearRow) {
      list.push({ type: "clear", id: clearValue });
    }
    for (const item of filteredItems) {
      list.push({ type: "item", id: item.id, item });
    }
    return list;
  }, [showClearRow, clearValue, filteredItems]);

  const selectableOptionsRef = useRef(selectableOptions);
  selectableOptionsRef.current = selectableOptions;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (open) {
      const initialSearch = pendingSeedSearchRef.current;
      if (initialSearch !== null) {
        pendingSeedSearchRef.current = null;
        setSearch(initialSearch);
        setHighlightedIndex(0);
      } else {
        const currentIdx = selectableOptionsRef.current.findIndex(
          (opt) => opt.type === "item" && opt.id === valueRef.current
        );
        setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
      }

      const timer = window.setTimeout(() => {
        const input = inputRef.current;
        if (input) {
          input.focus();
          const len = input.value.length;
          try {
            input.setSelectionRange(len, len);
          } catch {
            // ignore
          }
        }
      }, 20);
      return () => window.clearTimeout(timer);
    } else {
      setSearch("");
    }
  }, [open]);

  // Reset highlight to top match only when search term actually changes
  const prevSearchRef = useRef(search);
  useEffect(() => {
    if (prevSearchRef.current !== search) {
      prevSearchRef.current = search;
      if (open) {
        setHighlightedIndex(0);
      }
    }
  }, [search, open]);

  // Keep highlighted option visible inside scrollable list
  useEffect(() => {
    if (!open) return;
    const activeBtn = optionRefs.current[highlightedIndex];
    if (activeBtn) {
      activeBtn.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, open]);

  const commitSelection = useCallback(
    (selectedId: string, advanceFocus: boolean) => {
      if (triggerRef.current && selectedId && selectedId !== clearValue) {
        triggerRef.current.removeAttribute("data-field-error");
        triggerRef.current.removeAttribute("aria-invalid");
      }
      onChange(selectedId);
      setOpen(false);
      window.requestAnimationFrame(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        trigger.focus();
        if (advanceFocus) {
          trigger.dispatchEvent(
            new CustomEvent("tams:field-advance", {
              bubbles: true,
              detail: { sourceEl: trigger },
            })
          );
        }
      });
    },
    [onChange, clearValue]
  );

  const handleCloseOnly = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, []);

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    triggerProps?.onKeyDown?.(e);
    if (e.defaultPrevented || disabled) return;

    // Shift+Enter should navigate backward via useFormKeyboardNav
    if (e.key === "Enter" && e.shiftKey) {
      return;
    }

    if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
      return;
    }

    // Printable letter while closed: open popover and immediately filter
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      pendingSeedSearchRef.current = e.key;
      setOpen(true);
    }
  };

  const handlePopoverKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleCloseOnly();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (selectableOptions.length > 0) {
        setHighlightedIndex((prev) =>
          prev < selectableOptions.length - 1 ? prev + 1 : selectableOptions.length - 1
        );
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (selectableOptions.length > 0) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const activeEl = document.activeElement as HTMLElement | null;
      // Allow clicking inline Quick Add action buttons inside popover without hijacking
      if (activeEl && activeEl.dataset.quickAddBtn === "true") {
        return;
      }

      if (selectableOptions.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        const safeIdx = Math.min(Math.max(highlightedIndex, 0), selectableOptions.length - 1);
        const chosen = selectableOptions[safeIdx];
        if (chosen) {
          commitSelection(chosen.id, true);
        }
      }
    }
  };

  const isEmpty = !selectedItem && (!value || value === "" || (clearValue && value === clearValue));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-required={required || undefined}
          data-required={required ? "true" : undefined}
          data-required-message={requiredMessage}
          data-empty={isEmpty ? "true" : "false"}
          {...triggerProps}
          onKeyDown={handleTriggerKeyDown}
          className={cn(
            "w-full h-8 px-2.5 py-1 text-xs border rounded-none bg-background flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-teal-500/60 focus:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-500 data-[field-error=true]:border-red-500 data-[field-error=true]:ring-2 data-[field-error=true]:ring-red-500/40 transition-colors",
            isEmpty ? "text-muted-foreground" : "text-foreground font-medium",
            disabled && "opacity-50 cursor-not-allowed",
            className,
            triggerProps?.className
          )}
        >
          <span className="truncate flex items-center gap-1.5 flex-1">
            {renderSelected ? (
              renderSelected(selectedItem, value)
            ) : selectedItem ? (
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
              <span>{isLoading ? "Loading..." : placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        data-searchable-select-content="true"
        onKeyDown={handlePopoverKeyDown}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleCloseOnly();
        }}
        className={cn(
          "w-[300px] sm:w-[360px] p-0 rounded-none bg-background border shadow-md",
          popoverClassName
        )}
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
                tabIndex={-1}
                onClick={() => {
                  setSearch("");
                  inputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {typeof searchSubheader === "function" ? searchSubheader(() => setOpen(false)) : searchSubheader}
        </div>

        {/* Items List */}
        <div
          role="listbox"
          className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-100 dark:divide-slate-800"
        >
          {filteredItems.length === 0 ? (
            emptyContent ? (
              emptyContent(search, () => setOpen(false))
            ) : (
              <div className="p-3 text-center text-xs text-muted-foreground space-y-1.5">
                <p>{emptyText}</p>
                {onQuickAdd && (
                  <button
                    type="button"
                    data-quick-add-btn="true"
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
            )
          ) : (
            selectableOptions.map((opt, idx) => {
              const isHighlighted = idx === highlightedIndex;

              if (opt.type === "clear") {
                const isClearSelected = value === clearValue;
                return (
                  <button
                    key="__clear_option__"
                    ref={(el) => {
                      optionRefs.current[idx] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isClearSelected}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => commitSelection(clearValue, false)}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 text-xs text-rose-600 flex items-center justify-between cursor-pointer transition-colors",
                      isHighlighted
                        ? "bg-teal-50 dark:bg-teal-950/60 ring-1 ring-inset ring-teal-500/40"
                        : "hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    )}
                  >
                    <span className="italic">{clearLabel}</span>
                    {isClearSelected ? (
                      <Check className="w-3 h-3 text-teal-600" />
                    ) : (
                      <X className="w-3 h-3 text-rose-500" />
                    )}
                  </button>
                );
              }

              const item = opt.item!;
              const isSelected = item.id === value;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    optionRefs.current[idx] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => commitSelection(item.id, false)}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between cursor-pointer transition-colors",
                    isHighlighted
                      ? "bg-teal-50 dark:bg-teal-950/60 text-teal-950 dark:text-teal-50 ring-1 ring-inset ring-teal-500/40"
                      : isSelected
                      ? "bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-slate-100"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200"
                  )}
                >
                  {renderItem ? (
                    renderItem(item, { isSelected, isHighlighted })
                  ) : (
                    <>
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
                    </>
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
