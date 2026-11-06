import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { useQueries } from "@/hooks/useStorage";
import { cn } from "@/lib/utils";

type Priority = "low" | "medium" | "high" | "urgent";
type Status = "pending" | "in-progress" | "completed" | "cancelled";

const PRIORITY_OPTIONS: { value: Priority; label: string; keyLetter: string; activeClass: string }[] = [
  { value: "low", label: "Low", keyLetter: "l", activeClass: "bg-blue-600 text-white shadow-sm border-blue-600" },
  { value: "medium", label: "Medium", keyLetter: "m", activeClass: "bg-amber-500 text-white shadow-sm border-amber-500" },
  { value: "high", label: "High", keyLetter: "h", activeClass: "bg-orange-600 text-white shadow-sm border-orange-600" },
  { value: "urgent", label: "Urgent", keyLetter: "u", activeClass: "bg-destructive text-destructive-foreground shadow-sm border-destructive" },
];

const STATUS_OPTIONS: { value: Status; label: string; keyLetter: string; activeClass: string }[] = [
  { value: "pending", label: "Pending", keyLetter: "p", activeClass: "bg-amber-500 text-white shadow-sm border-amber-500" },
  { value: "in-progress", label: "In Progress", keyLetter: "i", activeClass: "bg-blue-600 text-white shadow-sm border-blue-600" },
  { value: "completed", label: "Completed", keyLetter: "c", activeClass: "bg-emerald-600 text-white shadow-sm border-emerald-600" },
  { value: "cancelled", label: "Cancelled", keyLetter: "x", activeClass: "bg-muted-foreground text-white shadow-sm border-muted-foreground" },
];

export default function QueryFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const location = useLocation();

  const { queries = [], addQuery, updateQuery } = useQueries();

  const [clientName, setClientName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [queryText, setQueryText] = useState("");
  const [status, setStatus] = useState<Status>("pending");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState<{ clientName?: string; queryText?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field refs for keyboard navigation and focus jumping
  const clientNameRef = useRef<HTMLInputElement>(null);
  const contactNumberRef = useRef<HTMLInputElement>(null);
  const priorityGroupRef = useRef<HTMLDivElement>(null);
  const queryTextRef = useRef<HTMLTextAreaElement>(null);
  const statusGroupRef = useRef<HTMLDivElement>(null);
  const assignedToRef = useRef<HTMLInputElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Initial load for editing or prefilling from navigation state
  useEffect(() => {
    if (isEdit && queries.length > 0) {
      const existing = queries.find((q: any) => q.id === id);
      if (existing) {
        setClientName(existing.client_name || "");
        setContactNumber(existing.contact_number || "");
        setPriority((existing.priority as Priority) || "medium");
        setQueryText(existing.query_text || "");
        setStatus((existing.status as Status) || "pending");
        setAssignedTo(existing.assigned_to || "");
        setDueDate(existing.due_date ? format(new Date(existing.due_date), "yyyy-MM-dd") : "");
        setNotes(existing.notes || "");
      } else {
        toast.error("Query not found");
        navigate("/app/leads-quotes?tab=queries", { replace: true });
      }
    } else {
      const prefill = (location.state as { prefill?: Record<string, string> })?.prefill;
      if (prefill) {
        if (prefill.client_name) setClientName(prefill.client_name);
        if (prefill.contact_number) setContactNumber(prefill.contact_number);
        if (prefill.query_text) setQueryText(prefill.query_text);
        if (prefill.notes) setNotes(prefill.notes);
      }
    }
  }, [id, isEdit, queries, navigate, location.state]);

  // Autofocus client name on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      clientNameRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const hasUnsavedChanges = Boolean(
    clientName.trim() || contactNumber.trim() || queryText.trim() || notes.trim()
  );

  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm("You have unsaved changes. Are you sure you want to discard them?");
      if (!confirmLeave) return;
    }
    navigate("/app/leads-quotes?tab=queries");
  }, [hasUnsavedChanges, navigate]);

  const validate = (): boolean => {
    const nextErrors: { clientName?: string; queryText?: string } = {};
    if (!clientName.trim()) {
      nextErrors.clientName = "Client Name is required";
    }
    if (!queryText.trim()) {
      nextErrors.queryText = "Query / Request is required";
    }

    setErrors(nextErrors);

    if (nextErrors.clientName) {
      clientNameRef.current?.focus();
      return false;
    }
    if (nextErrors.queryText) {
      queryTextRef.current?.focus();
      return false;
    }
    return true;
  };

  const handleSave = useCallback(
    async (andAddAnother: boolean = false) => {
      if (!validate()) return;

      setIsSubmitting(true);
      const payload = {
        client_name: clientName.trim(),
        contact_number: contactNumber.trim() || null,
        priority,
        query_text: queryText.trim(),
        status,
        assigned_to: assignedTo.trim() || null,
        due_date: dueDate || null,
        notes: notes.trim() || null,
      };

      try {
        if (isEdit && id) {
          await updateQuery.mutateAsync({ id, query: payload });
          toast.success("Query updated successfully");
        } else {
          await addQuery.mutateAsync(payload);
          toast.success("Query saved successfully");
        }

        if (andAddAnother) {
          // Clear form and re-focus Client Name
          setClientName("");
          setContactNumber("");
          setPriority("medium");
          setQueryText("");
          setStatus("pending");
          setAssignedTo("");
          setDueDate("");
          setNotes("");
          setErrors({});
          clientNameRef.current?.focus();
        } else {
          navigate("/app/leads-quotes?tab=queries");
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to save query";
        toast.error(msg);
      } finally {
        setIsSubmitting(false);
      }
    },
    [clientName, contactNumber, priority, queryText, status, assignedTo, dueDate, notes, isEdit, id, updateQuery, addQuery, navigate]
  );

  // Keyboard navigation across form
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl/Cmd + Shift + Enter = Save & Add Another
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        handleSave(true);
        return;
      }

      // Ctrl/Cmd + Enter = Save
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave(false);
        return;
      }

      // Esc = Back/Cancel
      if (e.key === "Escape") {
        e.preventDefault();
        handleBack();
        return;
      }
    },
    [handleBack, handleSave]
  );

  // Enter key handler to advance to next field on single-line inputs
  const handleEnterAdvance = (nextRef: React.RefObject<HTMLElement | null>) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  // Priority radio group keyboard controls
  const handlePriorityKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = PRIORITY_OPTIONS.findIndex((p) => p.value === priority);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = (currentIndex + 1) % PRIORITY_OPTIONS.length;
      setPriority(PRIORITY_OPTIONS[next].value);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (currentIndex - 1 + PRIORITY_OPTIONS.length) % PRIORITY_OPTIONS.length;
      setPriority(PRIORITY_OPTIONS[prev].value);
    } else {
      const match = PRIORITY_OPTIONS.find((p) => p.keyLetter === e.key.toLowerCase());
      if (match) {
        e.preventDefault();
        setPriority(match.value);
      }
    }
  };

  // Status radio group keyboard controls
  const handleStatusKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = STATUS_OPTIONS.findIndex((s) => s.value === status);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = (currentIndex + 1) % STATUS_OPTIONS.length;
      setStatus(STATUS_OPTIONS[next].value);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (currentIndex - 1 + STATUS_OPTIONS.length) % STATUS_OPTIONS.length;
      setStatus(STATUS_OPTIONS[prev].value);
    } else {
      const match = STATUS_OPTIONS.find((s) => s.keyLetter === e.key.toLowerCase());
      if (match) {
        e.preventDefault();
        setStatus(match.value);
      }
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className="flex flex-col h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-4.25rem)] w-full max-w-5xl mx-auto overflow-hidden bg-background"
    >
      {/* Top Bar */}
      <div className="h-12 md:h-14 px-3 sm:px-6 border-b border-border/70 flex items-center justify-between shrink-0 bg-background/95 backdrop-blur z-20">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
            title="Go back (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-baseline gap-2 truncate">
            <h1 className="text-base sm:text-lg font-bold text-foreground truncate">
              {isEdit ? "Edit Query" : "New Query"}
            </h1>
            <span className="hidden lg:inline text-[11px] text-muted-foreground font-mono">
              Tab = next | Ctrl+Enter = Save | Esc = Back
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          {!isEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSave(true)}
              disabled={isSubmitting}
              className="hidden sm:inline-flex h-8 px-3 text-xs"
              title="Ctrl+Shift+Enter"
            >
              Save & Add Another
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => handleSave(false)}
            disabled={isSubmitting}
            className="h-8 px-3 text-xs font-semibold shadow-sm"
            title="Ctrl+Enter"
          >
            {isSubmitting ? "Saving..." : isEdit ? "Update Query" : "Save Query"}
          </Button>
        </div>
      </div>

      {/* Main Form Content - One screen, no page scroll on desktop */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden p-3 sm:p-5 flex flex-col justify-between">
        <div className="grid grid-cols-12 gap-3 text-xs">
          {/* ROW 1: Client Name * (5 cols) | Contact Number (4 cols) | Priority * (3 cols) */}
          <div className="col-span-12 sm:col-span-5 space-y-1">
            <Label htmlFor="client_name" className="text-xs font-semibold flex items-center justify-between">
              <span>Client Name <span className="text-destructive">*</span></span>
              {errors.clientName && <span className="text-[11px] text-destructive font-normal">{errors.clientName}</span>}
            </Label>
            <Input
              id="client_name"
              ref={clientNameRef}
              tabIndex={1}
              value={clientName}
              onChange={(e) => {
                setClientName(e.target.value);
                if (errors.clientName) setErrors((prev) => ({ ...prev, clientName: undefined }));
              }}
              onKeyDown={handleEnterAdvance(contactNumberRef)}
              placeholder="e.g. Tariq Mehmood"
              className={cn(
                "h-10 text-base sm:text-sm rounded-lg",
                errors.clientName && "border-destructive focus-visible:ring-destructive"
              )}
            />
          </div>

          <div className="col-span-12 sm:col-span-4 space-y-1">
            <Label htmlFor="contact_number" className="text-xs font-semibold">
              Contact Number
            </Label>
            <Input
              id="contact_number"
              ref={contactNumberRef}
              tabIndex={2}
              type="tel"
              inputMode="tel"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              onKeyDown={handleEnterAdvance(queryTextRef)}
              placeholder="e.g. +92 300 1234567"
              className="h-10 text-base sm:text-sm rounded-lg"
            />
          </div>

          <div className="col-span-12 sm:col-span-3 space-y-1">
            <Label className="text-xs font-semibold">
              Priority <span className="text-destructive">*</span>
            </Label>
            <div
              ref={priorityGroupRef}
              tabIndex={3}
              role="radiogroup"
              aria-label="Priority"
              onKeyDown={handlePriorityKeyDown}
              className="grid grid-cols-4 gap-1 p-0.5 rounded-lg border bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {PRIORITY_OPTIONS.map((p) => {
                const isSelected = priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      "h-8 text-[11px] font-semibold rounded-md transition-all flex items-center justify-center",
                      isSelected
                        ? p.activeClass
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ROW 2: Query / Request * (full width textarea, auto-grows, 3 rows) */}
          <div className="col-span-12 space-y-1">
            <Label htmlFor="query_text" className="text-xs font-semibold flex items-center justify-between">
              <span>Query / Request Details <span className="text-destructive">*</span></span>
              {errors.queryText && <span className="text-[11px] text-destructive font-normal">{errors.queryText}</span>}
            </Label>
            <Textarea
              id="query_text"
              ref={queryTextRef}
              tabIndex={4}
              rows={3}
              value={queryText}
              onChange={(e) => {
                setQueryText(e.target.value);
                if (errors.queryText) setErrors((prev) => ({ ...prev, queryText: undefined }));
              }}
              placeholder="Inquiry details, destinations, flight dates, hotel preferences, passenger count..."
              className={cn(
                "min-h-[72px] text-base sm:text-sm rounded-lg resize-y",
                errors.queryText && "border-destructive focus-visible:ring-destructive"
              )}
            />
          </div>

          {/* ROW 3: Status * | Assigned To | Due Date | (quick date chips) */}
          <div className="col-span-12 sm:col-span-5 space-y-1">
            <Label className="text-xs font-semibold">
              Status <span className="text-destructive">*</span>
            </Label>
            <div
              ref={statusGroupRef}
              tabIndex={5}
              role="radiogroup"
              aria-label="Status"
              onKeyDown={handleStatusKeyDown}
              className="grid grid-cols-4 gap-1 p-0.5 rounded-lg border bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {STATUS_OPTIONS.map((s) => {
                const isSelected = status === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setStatus(s.value)}
                    className={cn(
                      "h-8 text-[11px] font-semibold rounded-md transition-all flex items-center justify-center truncate px-1",
                      isSelected
                        ? s.activeClass
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="col-span-12 sm:col-span-3 space-y-1">
            <Label htmlFor="assigned_to" className="text-xs font-semibold">
              Assigned To
            </Label>
            <Input
              id="assigned_to"
              ref={assignedToRef}
              tabIndex={6}
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              onKeyDown={handleEnterAdvance(dueDateRef)}
              placeholder="e.g. Usman / Desk 1"
              className="h-10 text-base sm:text-sm rounded-lg"
            />
          </div>

          <div className="col-span-12 sm:col-span-4 space-y-1">
            <Label htmlFor="due_date" className="text-xs font-semibold">
              Due Date
            </Label>
            <Input
              id="due_date"
              ref={dueDateRef}
              tabIndex={7}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-10 text-base sm:text-sm rounded-lg"
            />
            {/* Quick date chips */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setDueDate(format(new Date(), "yyyy-MM-dd"))}
                className="text-[10px] px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDueDate(format(addDays(new Date(), 1), "yyyy-MM-dd"))}
                className="text-[10px] px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setDueDate(format(addDays(new Date(), 7), "yyyy-MM-dd"))}
                className="text-[10px] px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border"
              >
                Next Week
              </button>
            </div>
          </div>

          {/* ROW 4: Notes (full width, 2 rows) */}
          <div className="col-span-12 space-y-1">
            <Label htmlFor="notes" className="text-xs font-semibold">
              Internal Follow-up Notes
            </Label>
            <Textarea
              id="notes"
              ref={notesRef}
              tabIndex={8}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Private remarks, caller background, reminder tags..."
              className="min-h-[56px] text-base sm:text-sm rounded-lg resize-none"
            />
          </div>
        </div>

        {/* Mobile Sticky Save Bar (< 1024px) */}
        <div className="lg:hidden sticky bottom-0 left-0 right-0 pt-3 pb-[env(safe-area-inset-bottom,0.75rem)] bg-background/95 backdrop-blur border-t mt-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="flex-1 min-h-[48px] text-sm"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => handleSave(false)}
            disabled={isSubmitting}
            className="flex-1 min-h-[48px] text-sm font-semibold shadow-md"
          >
            {isSubmitting ? "Saving..." : isEdit ? "Update Query" : "Save Query"}
          </Button>
        </div>
      </div>
    </div>
  );
}
