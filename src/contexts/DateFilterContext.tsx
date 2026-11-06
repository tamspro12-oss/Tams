import React, { createContext, useContext, useState, useMemo } from "react";
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";

export type DateFilterPreset = "current_month" | "last_month" | "last_3_months" | "year_to_date" | "all_time" | "custom";

interface DateFilter {
  preset: DateFilterPreset;
  startDate: Date | null;
  endDate: Date | null;
}

interface DateFilterContextType {
  filter: DateFilter;
  setPreset: (preset: DateFilterPreset) => void;
  setCustomRange: (start: Date | null, end: Date | null) => void;
  getFilterLabel: () => string;
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

export function DateFilterProvider({ children }: { children: React.ReactNode }) {
  const [filter, setFilter] = useState<DateFilter>({
    preset: "current_month",
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
  });

  const setPreset = (preset: DateFilterPreset) => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (preset) {
      case "current_month":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "last_month":
        const lastMonth = subMonths(now, 1);
        startDate = startOfMonth(lastMonth);
        endDate = endOfMonth(lastMonth);
        break;
      case "last_3_months":
        startDate = startOfMonth(subMonths(now, 2));
        endDate = endOfMonth(now);
        break;
      case "year_to_date":
        startDate = startOfYear(now);
        endDate = endOfMonth(now);
        break;
      case "all_time":
        startDate = null;
        endDate = null;
        break;
      case "custom":
        // Keep current dates for custom
        break;
    }

    setFilter({ preset, startDate, endDate });
  };

  const setCustomRange = (start: Date | null, end: Date | null) => {
    setFilter({ preset: "custom", startDate: start, endDate: end });
  };

  const getFilterLabel = () => {
    switch (filter.preset) {
      case "current_month":
        return "This Month";
      case "last_month":
        return "Last Month";
      case "last_3_months":
        return "Last 3 Months";
      case "year_to_date":
        return "Year to Date";
      case "all_time":
        return "All Time";
      case "custom":
        return "Custom Range";
      default:
        return "This Month";
    }
  };

  return (
    <DateFilterContext.Provider value={{ filter, setPreset, setCustomRange, getFilterLabel }}>
      {children}
    </DateFilterContext.Provider>
  );
}

export function useDateFilter() {
  const context = useContext(DateFilterContext);
  if (!context) {
    throw new Error("useDateFilter must be used within DateFilterProvider");
  }
  return context;
}
