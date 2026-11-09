import React from "react";
import { Search, X, Calendar as CalendarIcon, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterState {
  dateRange: "today" | "this_month" | "custom" | "all";
  startDate?: string;
  endDate?: string;
  partyId?: string; // specific client/vendor ID or "all"
  entryType: "all" | "sale" | "refund" | "payment" | "expense";
  service: "all" | "Ticket" | "Umrah" | "Visa" | "Insurance" | "Hotel" | "Other";
  status: "all" | "unpaid" | "paid" | "partial";
  searchQuery: string;
}

export const defaultFilterState: FilterState = {
  dateRange: "this_month",
  partyId: "all",
  entryType: "all",
  service: "all",
  status: "all",
  searchQuery: "",
};

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  parties?: { id: string; name: string; type?: string }[];
  showPartyFilter?: boolean;
  showEntryTypeFilter?: boolean;
  showServiceFilter?: boolean;
  showStatusFilter?: boolean;
  searchPlaceholder?: string;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onChange,
  parties = [],
  showPartyFilter = true,
  showEntryTypeFilter = true,
  showServiceFilter = true,
  showStatusFilter = true,
  searchPlaceholder = "Find booking (ticket, PNR, passport, pax, bill)...",
  className = "",
}) => {
  const update = (patch: Partial<FilterState>) => {
    onChange({ ...filters, ...patch });
  };

  const handleReset = () => {
    onChange(defaultFilterState);
  };

  const hasActiveFilters =
    filters.dateRange !== "this_month" ||
    (filters.partyId && filters.partyId !== "all") ||
    filters.entryType !== "all" ||
    filters.service !== "all" ||
    filters.status !== "all" ||
    Boolean(filters.searchQuery);

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm space-y-2.5 ${className}`}
    >
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
        {/* Search input (Find Booking) */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={filters.searchQuery}
            onChange={(e) => update({ searchQuery: e.target.value })}
            placeholder={searchPlaceholder}
            className="pl-8 pr-8 h-9 text-xs bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
          />
          {filters.searchQuery && (
            <button
              onClick={() => update({ searchQuery: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Select
            value={filters.dateRange}
            onValueChange={(val: any) => update({ dateRange: val })}
          >
            <SelectTrigger className="h-9 w-[120px] text-xs font-medium border-slate-200 dark:border-slate-700">
              <CalendarIcon className="w-3.5 h-3.5 mr-1 text-slate-400" />
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          {filters.dateRange === "custom" && (
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={filters.startDate || ""}
                onChange={(e) => update({ startDate: e.target.value })}
                className="h-9 w-[125px] text-xs px-2"
              />
              <span className="text-xs text-slate-400">to</span>
              <Input
                type="date"
                value={filters.endDate || ""}
                onChange={(e) => update({ endDate: e.target.value })}
                className="h-9 w-[125px] text-xs px-2"
              />
            </div>
          )}
        </div>

        {/* Party Filter */}
        {showPartyFilter && (
          <Select
            value={filters.partyId || "all"}
            onValueChange={(val) => update({ partyId: val })}
          >
            <SelectTrigger className="h-9 min-w-[130px] max-w-[180px] text-xs border-slate-200 dark:border-slate-700">
              <SelectValue placeholder="Client / Vendor" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="all">All Parties</SelectItem>
              {parties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} {p.type ? `(${p.type})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Entry Type */}
        {showEntryTypeFilter && (
          <Select
            value={filters.entryType}
            onValueChange={(val: any) => update({ entryType: val })}
          >
            <SelectTrigger className="h-9 w-[110px] text-xs border-slate-200 dark:border-slate-700">
              <SelectValue placeholder="Entry Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entries</SelectItem>
              <SelectItem value="sale">Sale</SelectItem>
              <SelectItem value="payment">Payment</SelectItem>
              <SelectItem value="refund">Refund</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Service Filter */}
        {showServiceFilter && (
          <Select
            value={filters.service}
            onValueChange={(val: any) => update({ service: val })}
          >
            <SelectTrigger className="h-9 w-[110px] text-xs border-slate-200 dark:border-slate-700">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              <SelectItem value="Ticket">Ticket</SelectItem>
              <SelectItem value="Umrah">Umrah</SelectItem>
              <SelectItem value="Visa">Visa</SelectItem>
              <SelectItem value="Insurance">Insurance</SelectItem>
              <SelectItem value="Hotel">Hotel</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Status Filter */}
        {showStatusFilter && (
          <Select
            value={filters.status}
            onValueChange={(val: any) => update({ status: val })}
          >
            <SelectTrigger className="h-9 w-[100px] text-xs border-slate-200 dark:border-slate-700">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Reset Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-9 px-2 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 shrink-0 gap-1 cursor-pointer"
            title="Reset Filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        )}
      </div>
    </div>
  );
};

