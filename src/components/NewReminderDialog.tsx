import React, { useState, useRef, useEffect, useMemo } from "react";
import { format, addDays } from "date-fns";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useReminders } from "@/hooks/useReminders";
import { cn } from "@/lib/utils";

export interface NewReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CATEGORIES = [
  { value: "manual", label: "General Task" },
  { value: "flight", label: "Flight Departure" },
  { value: "umrah", label: "Umrah Package" },
  { value: "daily_expense", label: "Daily Expense" },
] as const;

type CategoryType = (typeof CATEGORIES)[number]["value"];

export function NewReminderDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewReminderDialogProps) {
  const { addReminder } = useReminders();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("09:00");
  const [category, setCategory] = useState<CategoryType>("manual");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const categoryRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Focus Title input when dialog opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        titleRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setError(null);
    }
  }, [open]);

  // Quick Chips Options
  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const tomorrowStr = useMemo(() => format(addDays(new Date(), 1), "yyyy-MM-dd"), []);
  const nextWeekStr = useMemo(() => format(addDays(new Date(), 7), "yyyy-MM-dd"), []);

  const dateQuickOptions = [
    { label: "Today", value: todayStr },
    { label: "Tomorrow", value: tomorrowStr },
    { label: "Next Week", value: nextWeekStr },
  ];

  const timeQuickOptions = [
    { label: "9:00 AM", value: "09:00" },
    { label: "12:00 PM", value: "12:00" },
    { label: "5:00 PM", value: "17:00" },
  ];

  const resetForm = () => {
    setTitle("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setTime("09:00");
    setCategory("manual");
    setNotes("");
    setError(null);
    if (notesRef.current) {
      notesRef.current.style.height = "auto";
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!title.trim()) {
      setError("Please enter a title");
      titleRef.current?.focus();
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await addReminder.mutateAsync({
        title: title.trim(),
        type: category,
        remind_date: date,
        remind_time: time ? `${time}:00` : null,
        is_completed: false,
        notes: notes.trim() || null,
      });

      toast.success("Reminder created successfully");
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      toast.error("Failed to create reminder", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation for categories (radio group)
  const handleCategoryKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = (index + 1) % CATEGORIES.length;
      setCategory(CATEGORIES[nextIndex].value);
      categoryRefs.current[nextIndex]?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = (index - 1 + CATEGORIES.length) % CATEGORIES.length;
      setCategory(CATEGORIES[prevIndex].value);
      categoryRefs.current[prevIndex]?.focus();
    }
  };

  // Auto-expand textarea
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.max(52, el.scrollHeight)}px`;
  };

  // Global keydown: Ctrl/Cmd + Enter saves from anywhere, Esc closes
  const handleContainerKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      handleClose();
    }
  };

  // Enter key in Title, Date, or Time saves if title filled
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={handleContainerKeyDown}
        className={cn(
          // Mobile (< 768px): bottom sheet, rounded top corners, full width, scrolls above keyboard
          "fixed inset-x-0 bottom-0 top-auto left-0 right-0 translate-x-0 translate-y-0 w-full max-w-none rounded-t-2xl rounded-b-none sm:rounded-t-2xl sm:rounded-b-none p-4 max-h-[85dvh] overflow-y-auto gap-3",
          // Desktop (>= 768px): compact centered dialog, max-w-md, rounded-xl, fits without scrolling
          "md:top-[50%] md:left-[50%] md:-translate-x-1/2 md:-translate-y-1/2 md:bottom-auto md:right-auto md:max-w-md md:rounded-xl md:p-5 md:max-h-none md:overflow-visible md:gap-3"
        )}
      >
        {/* Mobile drag handle */}
        <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 mx-auto -mt-1 mb-1 md:hidden" />

        {/* Dialog Header: 18px semibold title + small plus icon, subtitle removed */}
        <DialogHeader className="p-0 text-left">
          <DialogTitle className="text-[18px] font-semibold text-foreground flex items-center gap-1.5 leading-none">
            <Plus className="w-4 h-4 text-primary shrink-0" />
            New Reminder
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          {/* Row 1: Title input */}
          <div className="space-y-1">
            <Input
              ref={titleRef}
              autoFocus
              placeholder="What do you need to do?"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={handleInputKeyDown}
              enterKeyHint="done"
              className={cn(
                "h-10 text-base md:text-sm rounded-lg transition-colors",
                error && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {error && (
              <p className="text-xs text-destructive font-medium mt-1 animate-in fade-in-50">
                {error}
              </p>
            )}
          </div>

          {/* Row 2: Date and Time side by side with quick chips */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Date column */}
            <div className="space-y-1">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onKeyDown={handleInputKeyDown}
                className="h-10 text-base md:text-sm rounded-lg"
              />
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
                {dateQuickOptions.map((opt) => {
                  const isSelected = date === opt.value;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      tabIndex={0}
                      onClick={() => setDate(opt.value)}
                      className={cn(
                        "px-2 py-0.5 text-[11px] rounded-md border transition-all shrink-0 font-medium min-h-[30px] md:min-h-[22px] flex items-center justify-center",
                        isSelected
                          ? "bg-primary/10 text-primary border-primary/40 font-semibold"
                          : "bg-muted/40 text-muted-foreground border-transparent hover:border-border hover:bg-muted/70"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time column */}
            <div className="space-y-1">
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                onKeyDown={handleInputKeyDown}
                className="h-10 text-base md:text-sm rounded-lg"
              />
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
                {timeQuickOptions.map((opt) => {
                  const isSelected = time === opt.value;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      tabIndex={0}
                      onClick={() => setTime(opt.value)}
                      className={cn(
                        "px-2 py-0.5 text-[11px] rounded-md border transition-all shrink-0 font-medium min-h-[30px] md:min-h-[22px] flex items-center justify-center",
                        isSelected
                          ? "bg-primary/10 text-primary border-primary/40 font-semibold"
                          : "bg-muted/40 text-muted-foreground border-transparent hover:border-border hover:bg-muted/70"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 3: Category horizontal segmented chip group */}
          <div className="space-y-1">
            <div
              role="radiogroup"
              aria-label="Category"
              className="grid grid-cols-2 md:grid-cols-4 gap-1.5 py-0.5 max-md:flex max-md:overflow-x-auto max-md:no-scrollbar"
            >
              {CATEGORIES.map((cat, idx) => {
                const isSelected = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    ref={(el) => (categoryRefs.current[idx] = el)}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => setCategory(cat.value)}
                    onKeyDown={(e) => handleCategoryKeyDown(e, idx)}
                    className={cn(
                      "px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border shrink-0 min-h-[44px] md:min-h-[32px] flex items-center justify-center text-center",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground border-border/60"
                    )}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 4: Notes (optional), auto-expanding textarea */}
          <div className="space-y-1">
            <Textarea
              ref={notesRef}
              rows={2}
              placeholder="Notes (optional)..."
              value={notes}
              onChange={handleNotesChange}
              className="min-h-[52px] text-base md:text-sm rounded-lg resize-none overflow-hidden transition-all"
            />
          </div>

          {/* Desktop Footer (>= 768px): Cancel (ghost) + Save (primary) right-aligned, keyboard hint on left */}
          <div className="hidden md:flex items-center justify-between pt-2 border-t border-border/50">
            <span className="text-[11px] text-muted-foreground select-none">
              Enter = Save &nbsp;|&nbsp; Esc = Cancel
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                className="h-9 px-3 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-9 px-4 text-xs font-semibold"
              >
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          {/* Mobile Footer (< 768px): Sticky full-width Save button at bottom */}
          <div className="md:hidden sticky bottom-0 -mx-4 -mb-4 p-3.5 bg-background/95 backdrop-blur-sm border-t border-border/60 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] text-base font-semibold"
            >
              {isSubmitting ? "Saving..." : "Save Reminder"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default NewReminderDialog;
