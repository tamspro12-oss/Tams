import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns3,
  Copy,
  Download,
  Check,
  ChevronRight,
  Filter,
  LayoutGrid,
  Table as TableIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface GridColumn<T = any> {
  key: string;
  header: string;
  width?: number | string;
  minWidth?: number;
  align?: "left" | "center" | "right";
  isNumeric?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
  exportValue?: (row: T) => any;
  totalType?: "sum" | "count" | "avg" | "none";
  defaultVisible?: boolean;
}

export interface ExcelGridProps<T = any> {
  id: string; // Unique grid ID to remember column order and visibility
  data: T[];
  columns: GridColumn<T>[];
  keyExtractor: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  isLoading?: boolean;
  title?: string;
  filename?: string;
  renderMobileCard?: (row: T, index: number) => React.ReactNode;
  stickyFirstColumn?: boolean;
  defaultSortKey?: string;
  defaultSortDir?: "asc" | "desc";
  hideColumnsButton?: boolean;
  hideCopyButton?: boolean;
  hideExportButton?: boolean;
}

export function ExcelGrid<T = any>({
  id,
  data,
  columns,
  keyExtractor,
  onRowClick,
  onRowDoubleClick,
  emptyState,
  isLoading = false,
  title,
  filename = "export",
  renderMobileCard,
  stickyFirstColumn = true,
  defaultSortKey,
  defaultSortDir = "desc",
  hideColumnsButton = false,
  hideCopyButton = false,
  hideExportButton = false,
}: ExcelGridProps<T>) {
  // 1. Column Visibility and Order State (persisted in localStorage)
  const storageKey = `tams_grid_cols_${id}`;
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_order`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return columns.map((c) => c.key);
  });

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_vis`);
      if (saved) return JSON.parse(saved);
    } catch {}
    const initial: Record<string, boolean> = {};
    columns.forEach((c) => {
      initial[c.key] = c.defaultVisible !== false;
    });
    return initial;
  });

  const toggleColumnVisibility = (colKey: string) => {
    setVisibleColumns((prev) => {
      const next = { ...prev, [colKey]: !prev[colKey] };
      try {
        localStorage.setItem(`${storageKey}_vis`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // 2. Sorting State
  const [sortKey, setSortKey] = useState<string | null>(
    defaultSortKey || (columns.length > 0 ? columns[0].key : null)
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDir);

  const handleHeaderSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // 3. Per-Column Filters
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);

  const setColumnFilter = (key: string, val: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (!val) {
        delete next[key];
      } else {
        next[key] = val;
      }
      return next;
    });
  };

  // 4. Mobile View Mode: 'cards' | 'grid'
  const [mobileMode, setMobileMode] = useState<"cards" | "grid">("cards");

  // 5. Active and Selected Cells (Excel keyboard navigation)
  const [activeRow, setActiveRow] = useState<number>(0);
  const [activeCol, setActiveCol] = useState<number>(0);
  const [selectedCells, setSelectedCells] = useState<{ row: number; col: number }[]>([]);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Active columns ordered and filtered by visibility
  const activeColumns = useMemo(() => {
    const colMap = new Map(columns.map((c) => [c.key, c]));
    const ordered: GridColumn<T>[] = [];

    // Add in ordered sequence
    columnOrder.forEach((k) => {
      const col = colMap.get(k);
      if (col && visibleColumns[k] !== false) {
        ordered.push(col);
      }
    });

    // Add any newly introduced columns that aren't in columnOrder yet
    columns.forEach((c) => {
      if (!columnOrder.includes(c.key) && visibleColumns[c.key] !== false) {
        ordered.push(c);
      }
    });

    return ordered;
  }, [columns, columnOrder, visibleColumns]);

  // Filtered and Sorted Data
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply per-column text filters
    Object.entries(columnFilters).forEach(([colKey, query]) => {
      if (!query.trim()) return;
      const lowerQuery = query.toLowerCase();
      result = result.filter((row: any) => {
        const val = row[colKey];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(lowerQuery);
      });
    });

    // Apply sorting
    if (sortKey) {
      result.sort((a: any, b: any) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDir === "asc" ? aVal - bVal : bVal - aVal;
        }

        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [data, columnFilters, sortKey, sortDir]);

  // 6. Keyboard Navigation (Arrow Keys, Tab, Enter, Esc)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (processedData.length === 0 || activeColumns.length === 0) return;

      // Don't intercept if user is typing in an input
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") {
        return;
      }

      const totalRows = processedData.length;
      const totalCols = activeColumns.length;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveRow((prev) => Math.min(prev + 1, totalRows - 1));
          setSelectedCells([]);
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveRow((prev) => Math.max(prev - 1, 0));
          setSelectedCells([]);
          break;
        case "ArrowRight":
        case "Tab":
          if (!e.shiftKey) {
            e.preventDefault();
            if (activeCol < totalCols - 1) {
              setActiveCol((prev) => prev + 1);
            } else if (activeRow < totalRows - 1) {
              setActiveRow((prev) => prev + 1);
              setActiveCol(0);
            }
            setSelectedCells([]);
          } else {
            // Shift + Tab
            e.preventDefault();
            if (activeCol > 0) {
              setActiveCol((prev) => prev - 1);
            } else if (activeRow > 0) {
              setActiveRow((prev) => prev - 1);
              setActiveCol(totalCols - 1);
            }
            setSelectedCells([]);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          setActiveCol((prev) => Math.max(prev - 1, 0));
          setSelectedCells([]);
          break;
        case "Enter":
          e.preventDefault();
          if (onRowDoubleClick && processedData[activeRow]) {
            onRowDoubleClick(processedData[activeRow]);
          } else if (onRowClick && processedData[activeRow]) {
            onRowClick(processedData[activeRow]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setSelectedCells([]);
          setActiveFilterCol(null);
          break;
        case "c":
          if (e.ctrlKey || e.metaKey) {
            // Copy active or selected cells
            handleCopy();
          }
          break;
      }
    },
    [processedData, activeColumns, activeRow, activeCol, onRowClick, onRowDoubleClick]
  );

  // 7. Clipboard Copy (TSV format so pasting into Excel / Sheets works instantly)
  const handleCopy = () => {
    if (processedData.length === 0 || activeColumns.length === 0) return;

    let textToCopy = "";
    if (selectedCells.length > 0) {
      // Group by row
      const rowMap = new Map<number, number[]>();
      selectedCells.forEach((sc) => {
        const cols = rowMap.get(sc.row) || [];
        cols.push(sc.col);
        rowMap.set(sc.row, cols);
      });

      const lines: string[] = [];
      Array.from(rowMap.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([r, cIndices]) => {
          cIndices.sort((a, b) => a - b);
          const rowData = processedData[r] as any;
          const line = cIndices
            .map((cIdx) => {
              const col = activeColumns[cIdx];
              return col ? rowData[col.key] ?? "" : "";
            })
            .join("\t");
          lines.push(line);
        });
      textToCopy = lines.join("\n");
    } else {
      // Copy current active cell or row
      const rowData = processedData[activeRow] as any;
      const col = activeColumns[activeCol];
      textToCopy = col ? String(rowData[col.key] ?? "") : "";
    }

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        toast.success("Copied to clipboard");
      });
    }
  };

  // 8. Excel Export via XLSX
  const handleExportExcel = () => {
    if (processedData.length === 0) {
      toast.error("No records to export");
      return;
    }

    const exportRows = processedData.map((row) => {
      const obj: Record<string, any> = {};
      activeColumns.forEach((col) => {
        if (col.exportValue) {
          obj[col.header] = col.exportValue(row);
        } else {
          obj[col.header] = (row as any)[col.key] ?? "";
        }
      });
      return obj;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, title || "Sheet1");
    XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel file downloaded");
  };

  // 9. Selected Cell Stats (Sum / Count for Excel-like bottom bar)
  const cellStats = useMemo(() => {
    if (selectedCells.length <= 1) return null;

    let sum = 0;
    let numericCount = 0;

    selectedCells.forEach((c) => {
      const row = processedData[c.row] as any;
      const col = activeColumns[c.col];
      if (row && col) {
        const val = Number(row[col.key]);
        if (!isNaN(val)) {
          sum += val;
          numericCount++;
        }
      }
    });

    return {
      count: selectedCells.length,
      sum: numericCount > 0 ? sum : null,
      avg: numericCount > 0 ? sum / numericCount : null,
    };
  }, [selectedCells, processedData, activeColumns]);

  // 10. Live Column Totals
  const columnTotals = useMemo(() => {
    const totals: Record<string, { type: string; value: number | string }> = {};

    activeColumns.forEach((col) => {
      if (!col.totalType || col.totalType === "none") return;

      if (col.totalType === "sum") {
        const sum = processedData.reduce((acc, row: any) => {
          const v = Number(row[col.key]);
          return acc + (isNaN(v) ? 0 : v);
        }, 0);
        totals[col.key] = { type: "sum", value: sum };
      } else if (col.totalType === "count") {
        totals[col.key] = { type: "count", value: processedData.length };
      } else if (col.totalType === "avg") {
        const sum = processedData.reduce((acc, row: any) => {
          const v = Number(row[col.key]);
          return acc + (isNaN(v) ? 0 : v);
        }, 0);
        const avg = processedData.length > 0 ? sum / processedData.length : 0;
        totals[col.key] = { type: "avg", value: avg };
      }
    });

    return totals;
  }, [processedData, activeColumns]);

  return (
    <div
      ref={gridContainerRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="outline-none space-y-2 select-none"
    >
      {/* Top Toolbar: Search summary, Columns toggle, Mobile mode switch, Export */}
      <div className="flex items-center justify-between gap-2 px-1 py-1">
        <div className="flex items-center gap-2">
          {title && (
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {title}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground font-mono">
            {processedData.length} records
          </span>
          {Object.keys(columnFilters).length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setColumnFilters({})}
              className="h-6 text-[10px] text-amber-600 hover:text-amber-700 px-1.5"
            >
              Clear filters ({Object.keys(columnFilters).length})
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mobile View Toggle */}
          <div className="md:hidden flex items-center bg-muted/60 p-0.5 rounded-lg border">
            <button
              onClick={() => setMobileMode("cards")}
              className={cn(
                "p-1 rounded-md text-xs",
                mobileMode === "cards" ? "bg-white shadow text-primary" : "text-muted-foreground"
              )}
              title="Card view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setMobileMode("grid")}
              className={cn(
                "p-1 rounded-md text-xs",
                mobileMode === "grid" ? "bg-white shadow text-primary" : "text-muted-foreground"
              )}
              title="Grid view"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Column Visibility Menu */}
          {!hideColumnsButton && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1 border-slate-200 dark:border-slate-800"
                >
                  <Columns3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Columns</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 max-h-72 overflow-y-auto">
                <DropdownMenuLabel className="text-xs">Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.key}
                    checked={visibleColumns[c.key] !== false}
                    onCheckedChange={() => toggleColumnVisibility(c.key)}
                    className="text-xs cursor-pointer"
                  >
                    {c.header}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Quick Copy Button */}
          {!hideCopyButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              title="Copy selected (Ctrl+C)"
              className="h-8 text-xs gap-1 border-slate-200 dark:border-slate-800 hidden sm:flex"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </Button>
          )}

          {/* Excel Export */}
          {!hideExportButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="h-8 text-xs gap-1 border-slate-200 dark:border-slate-800 text-emerald-700 dark:text-emerald-400"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid or Mobile Cards */}
      {mobileMode === "cards" && renderMobileCard ? (
        <div className="md:hidden space-y-2">
          {processedData.length === 0 ? (
            emptyState || <div className="p-8 text-center text-xs text-muted-foreground">No records</div>
          ) : (
            processedData.map((row, idx) => (
              <div
                key={keyExtractor(row, idx)}
                onClick={() => onRowClick && onRowClick(row)}
                className="cursor-pointer"
              >
                {renderMobileCard(row, idx)}
              </div>
            ))
          )}
        </div>
      ) : (
        /* Excel Table View */
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
          <div className="overflow-x-auto max-h-[70vh] relative">
            <table className="w-full border-collapse text-xs text-left">
              {/* Navy Table Header */}
              <thead className="sticky top-0 z-20 bg-[#0B192C] text-slate-100 uppercase text-[11px] font-semibold tracking-wider select-none">
                <tr>
                  {activeColumns.map((col, colIdx) => {
                    const isSticky = stickyFirstColumn && colIdx === 0;
                    const isSorted = sortKey === col.key;
                    const hasFilter = Boolean(columnFilters[col.key]);

                    return (
                      <th
                        key={col.key}
                        style={{
                          width: col.width,
                          minWidth: col.minWidth || 100,
                        }}
                        className={cn(
                          "px-3 py-3 font-semibold border-b border-slate-700/80 transition-colors whitespace-nowrap",
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left",
                          isSticky ? "sticky left-0 z-30 bg-[#0B192C] shadow-[1px_0_0_0_#1e293b]" : ""
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-1",
                            col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : "justify-start"
                          )}
                        >
                          <span
                            onClick={() => col.sortable !== false && handleHeaderSort(col.key)}
                            className={cn(
                              "cursor-pointer hover:text-teal-300 transition-colors inline-flex items-center gap-1",
                              isSorted ? "text-teal-400 font-bold" : ""
                            )}
                          >
                            {col.header}
                            {col.sortable !== false && (
                              <span className="text-[10px]">
                                {isSorted ? (
                                  sortDir === "asc" ? (
                                    <ArrowUp className="w-3 h-3 text-teal-400" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3 text-teal-400" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-2.5 h-2.5 opacity-40 hover:opacity-100" />
                                )}
                              </span>
                            )}
                          </span>

                          {/* Per-column filter trigger */}
                          {col.filterable !== false && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFilterCol(activeFilterCol === col.key ? null : col.key);
                              }}
                              className={cn(
                                "p-0.5 rounded hover:bg-slate-800 transition-colors ml-0.5",
                                hasFilter ? "text-amber-400 font-bold" : "text-slate-400 opacity-60 hover:opacity-100"
                              )}
                              title="Filter column"
                            >
                              <Filter className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>

                        {/* Inline Filter Input Pop-down */}
                        {activeFilterCol === col.key && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1.5 pt-1.5 border-t border-slate-700 flex items-center gap-1"
                          >
                            <Input
                              autoFocus
                              value={columnFilters[col.key] || ""}
                              onChange={(e) => setColumnFilter(col.key, e.target.value)}
                              placeholder={`Filter ${col.header}...`}
                              className="h-6 text-[10px] text-slate-900 bg-white dark:text-slate-100 dark:bg-slate-800 px-1.5 py-0 rounded"
                            />
                            {columnFilters[col.key] && (
                              <button
                                onClick={() => setColumnFilter(col.key, "")}
                                className="text-slate-400 hover:text-white"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {processedData.length === 0 ? (
                  <tr>
                    <td colSpan={activeColumns.length} className="py-12">
                      {emptyState || (
                        <div className="text-center text-xs text-muted-foreground">
                          No records found
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  processedData.map((row, rowIdx) => {
                    const isRowActive = activeRow === rowIdx;

                    return (
                      <tr
                        key={keyExtractor(row, rowIdx)}
                        onClick={() => {
                          setActiveRow(rowIdx);
                          if (onRowClick) onRowClick(row);
                        }}
                        onDoubleClick={() => {
                          if (onRowDoubleClick) onRowDoubleClick(row);
                        }}
                        className={cn(
                          "transition-colors group h-10 hover:bg-teal-50/40 dark:hover:bg-teal-950/20 cursor-pointer",
                          isRowActive
                            ? "bg-teal-50/60 dark:bg-teal-950/30"
                            : rowIdx % 2 === 0
                            ? "bg-white dark:bg-slate-900"
                            : "bg-slate-50/30 dark:bg-slate-800/20"
                        )}
                      >
                        {activeColumns.map((col, colIdx) => {
                          const isSticky = stickyFirstColumn && colIdx === 0;
                          const isCellActive = isRowActive && activeCol === colIdx;

                          return (
                            <td
                              key={col.key}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveRow(rowIdx);
                                setActiveCol(colIdx);
                                if (e.shiftKey) {
                                  // Range selection
                                  setSelectedCells((prev) => [...prev, { row: rowIdx, col: colIdx }]);
                                } else {
                                  setSelectedCells([{ row: rowIdx, col: colIdx }]);
                                }
                              }}
                              className={cn(
                                "px-3 py-2 text-slate-800 dark:text-slate-200 whitespace-nowrap transition-colors",
                                col.align === "right" || col.isNumeric
                                  ? "text-right tabular-nums font-mono font-medium"
                                  : col.align === "center"
                                  ? "text-center"
                                  : "text-left",
                                isSticky
                                  ? "sticky left-0 z-10 bg-inherit font-semibold shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#1e293b]"
                                  : "",
                                isCellActive
                                  ? "outline outline-2 outline-teal-500 -outline-offset-2 bg-teal-100/40 dark:bg-teal-900/40"
                                  : ""
                              )}
                            >
                              {col.render
                                ? col.render(row, rowIdx)
                                : col.isNumeric && typeof (row as any)[col.key] === "number"
                                ? (row as any)[col.key].toLocaleString()
                                : (row as any)[col.key] ?? "-"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Live Totals Row */}
              {Object.keys(columnTotals).length > 0 && processedData.length > 0 && (
                <tfoot className="sticky bottom-0 z-20 bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                  <tr>
                    {activeColumns.map((col, colIdx) => {
                      const isSticky = stickyFirstColumn && colIdx === 0;
                      const total = columnTotals[col.key];

                      return (
                        <td
                          key={col.key}
                          className={cn(
                            "px-3 py-2.5 text-slate-900 dark:text-slate-100 whitespace-nowrap",
                            col.align === "right" || col.isNumeric
                              ? "text-right tabular-nums font-mono"
                              : "text-left",
                            isSticky ? "sticky left-0 z-30 bg-slate-100 dark:bg-slate-800" : ""
                          )}
                        >
                          {total ? (
                            <span>
                              {typeof total.value === "number"
                                ? total.value.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                  })
                                : total.value}
                            </span>
                          ) : colIdx === 0 ? (
                            <span className="text-[11px] uppercase tracking-wider text-slate-500">
                              Total
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Excel Status Footer (shows Selected Count, Sum, Avg when cells are highlighted) */}
          {cellStats && (
            <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-1.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-6 text-[11px] text-slate-600 dark:text-slate-300 font-mono">
              <span>
                Count: <strong>{cellStats.count}</strong>
              </span>
              {cellStats.sum !== null && (
                <span>
                  Sum: <strong>{cellStats.sum.toLocaleString()}</strong>
                </span>
              )}
              {cellStats.avg !== null && (
                <span>
                  Avg: <strong>{cellStats.avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

