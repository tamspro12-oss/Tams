import React from "react";
import { Download, FileSpreadsheet, FileText, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TotalMetric {
  label: string;
  value: string | number;
  highlight?: "neutral" | "emerald" | "red" | "teal" | "amber";
  prefix?: string;
  subValue?: string;
}

interface TotalsBarProps {
  metrics: TotalMetric[];
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  onShareWhatsApp?: () => void;
  className?: string;
}

export const TotalsBar: React.FC<TotalsBarProps> = ({
  metrics,
  onExportExcel,
  onExportPdf,
  onShareWhatsApp,
  className = "",
}) => {
  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 md:p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${className}`}
    >
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 md:flex md:items-center md:gap-6 md:overflow-x-auto py-1">
        {metrics.map((m, idx) => {
          let valueColor = "text-slate-900 dark:text-slate-100";
          if (m.highlight === "emerald") valueColor = "text-emerald-600 dark:text-emerald-400";
          if (m.highlight === "red") valueColor = "text-red-600 dark:text-red-400";
          if (m.highlight === "teal") valueColor = "text-teal-600 dark:text-teal-400";
          if (m.highlight === "amber") valueColor = "text-amber-600 dark:text-amber-400";

          return (
            <div key={idx} className="min-w-0 md:shrink-0">
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                {m.label}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5 flex-wrap">
                {m.prefix && (
                  <span className="text-xs font-semibold text-slate-400">{m.prefix}</span>
                )}
                <span className={`text-base md:text-lg font-bold tabular-nums break-words ${valueColor}`}>
                  {typeof m.value === "number" ? m.value.toLocaleString() : m.value}
                </span>
                {m.subValue && (
                  <span className="text-[11px] text-slate-400 ml-1">({m.subValue})</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons: Export & Share */}
      <div className="flex flex-wrap items-center gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 dark:border-slate-800">
        {onExportExcel && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportExcel}
            className="flex-1 md:flex-none text-xs h-11 md:h-8 gap-1.5 cursor-pointer border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </Button>
        )}
        {onExportPdf && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportPdf}
            className="flex-1 md:flex-none text-xs h-11 md:h-8 gap-1.5 cursor-pointer border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <FileText className="w-3.5 h-3.5 text-red-600" />
            <span>PDF</span>
          </Button>
        )}
        {onShareWhatsApp && (
          <Button
            variant="outline"
            size="sm"
            onClick={onShareWhatsApp}
            className="flex-1 md:flex-none text-xs h-11 md:h-8 gap-1.5 cursor-pointer border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </Button>
        )}
      </div>
    </div>
  );
};

