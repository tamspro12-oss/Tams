import React from "react";
import { FolderOpen, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  type?: "empty" | "filtered";
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = "empty",
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) => {
  const isFiltered = type === "filtered";
  const defaultTitle = isFiltered ? "No records for these filters" : "No records yet";
  const defaultDesc = isFiltered
    ? "Try adjusting or clearing your date or search filters to see matching records."
    : "Create your first entry to see it listed here.";

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center select-none">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3 shadow-inner">
        {icon ? (
          icon
        ) : isFiltered ? (
          <SearchX className="w-6 h-6" />
        ) : (
          <FolderOpen className="w-6 h-6" />
        )}
      </div>
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {title || defaultTitle}
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
        {description || defaultDesc}
      </p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          size="sm"
          className="mt-4 bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

