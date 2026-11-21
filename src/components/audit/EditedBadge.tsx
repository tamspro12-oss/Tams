import React from "react";
import { History } from "lucide-react";
import { formatEditedDateShort } from "@/lib/documentEditHelpers";
import { cn } from "@/lib/utils";

interface EditedBadgeProps {
  isEdited?: boolean | null;
  editCount?: number | null;
  lastEditedAt?: string | null;
  onClick: () => void;
  className?: string;
}

export const EditedBadge: React.FC<EditedBadgeProps> = ({
  isEdited,
  editCount,
  lastEditedAt,
  onClick,
  className,
}) => {
  const count = Number(editCount) || 0;
  if (!isEdited && count <= 0) return null;

  const formattedDate = formatEditedDateShort(lastEditedAt);
  const titleText = formattedDate
    ? `Edited on ${formattedDate} — click to view edit history`
    : "Edited — click to view edit history";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={titleText}
      aria-label={titleText}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
        "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100",
        "dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/70 dark:hover:bg-amber-900/50",
        "transition-colors cursor-pointer shrink-0",
        className
      )}
    >
      <History className="w-2.5 h-2.5 shrink-0" />
      <span>Edited{count > 1 ? ` ×${count}` : ""}</span>
    </button>
  );
};

