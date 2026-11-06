import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  X,
  User,
  Phone,
  Flag,
  Activity,
  UserCheck,
  Calendar,
  MessageSquare,
  FileText,
  Save,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQueries } from "@/hooks/useStorage";
import { cn } from "@/lib/utils";

type Priority = "low" | "medium" | "high" | "urgent";
type Status = "pending" | "in-progress" | "completed" | "cancelled";

const PRIORITY_ITEMS: { value: Priority; label: string; badgeClass: string }[] = [
  { value: "low", label: "Low", badgeClass: "text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400" },
  { value: "medium", label: "Medium", badgeClass: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400" },
  { value: "high", label: "High", badgeClass: "text-orange-600 bg-orange-50 dark:bg-orange-950/50 dark:text-orange-400" },
  { value: "urgent", label: "Urgent", badgeClass: "text-destructive bg-red-50 dark:bg-red-950/50 dark:text-red-400 font-bold" },
];

const STATUS_ITEMS: { value: Status; label: string; badgeClass: string }[] = [
  { value: "pending", label: "Pending", badgeClass: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400" },
  { value: "in-progress", label: "In Progress", badgeClass: "text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400" },
  { value: "completed", label: "Completed", badgeClass: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400" },
  { value: "cancelled", label: "Cancelled", badgeClass: "text-muted-foreground bg-muted" },
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
  const [status, setStatus] = useState<Status>("pending");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [queryText, setQueryText] = useState("");
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState<{ clientName?: string; queryText?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field refs for strict keyboard focus order
  const clientNameRef = useRef<HTMLInputElement>(null);
  const contactNumberRef = useRef<HTMLInputElement>(null);
  const assignedToRef = useRef<HTMLInputElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const queryTextRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  // Initial load for editing or prefilling from navigation state
  useEffect(() => {
    if (isEdit && queries.length > 0) {
      const existing = queries.find((q: any) => q.id === id);
      if (existing) {
        setClientName(existing.client_name || "");
        setContactNumber(existing.contact_number || "");
        setPriority((existing.priority as Priority) || "medium");
        setStatus((existing.status as Status) || "pending");
        setAssignedTo(existing.assigned_to || "");
        setDueDate(existing.due_date ? format(new Date(existing.due_date), "yyyy-MM-dd") : "");
        setQueryText(existing.query_text || "");
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

  // Auto-focus primary field on load
  useEffect(() => {
    const timer = setTimeout(() => {
      clientNameRef.current?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  const hasUnsavedChanges = Boolean(
    clientName.trim() || contactNumber.trim() || queryText.trim() || notes.trim()
  );

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm("You have unsaved changes. Discard and close?");
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
      nextErrors.queryText = "Query Details are required";
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
          setClientName("");
          setContactNumber("");
          setPriority("medium");
          setStatus("pending");
          setAssignedTo("");
          setDueDate("");
          setQueryText("");
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

  // Global Keyboard Shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl/Cmd + Shift + Enter = Save & Add Another
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        handleSave(true);
        return;
      }

      // Ctrl/Cmd + Enter = Save Query
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave(false);
        return;
      }

      // Esc = Close / Cancel (only if no open select or modal)
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
        return;
      }
    },
    [handleClose, handleSave]
  );

  return (
    <div
      onKeyDown={handleKeyDown}
      className="flex flex-col h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-4.25rem)] w-full max-w-4xl mx-auto overflow-hidden bg-background"
    >
      {/* 1. Global Header Bar: Back, Title, Action Group: Save & Add Another -> Save Query -> X */}
      <div className="h-12 md:h-14 px-3 sm:px-6 border-b border-border/70 flex items-center justify-between shrink-0 bg-background/95 backdrop-blur z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
            title="Go back (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-base sm:text-lg font-bold text-foreground truncate">
            {isEdit ? "Edit Client Query" : "New Client Query"}
          </h1>
        </div>

        {/* Action Group: Save & Add Another -> Save Query -> X */}
        <div className="flex items-center gap-2 shrink-0">
          {!isEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              tabIndex={9}
              onClick={() => handleSave(true)}
              disabled={isSubmitting}
              className="hidden sm:inline-flex h-8 px-3 text-xs gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none font-medium"
              title="Save and clear for next entry (Ctrl+Shift+Enter)"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Save & Add Another</span>
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            tabIndex={10}
            onClick={() => handleSave(false)}
            disabled={isSubmitting}
            className="h-8 px-3.5 text-xs font-semibold shadow-sm gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
            title="Save Query (Ctrl+Enter)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? "Saving..." : isEdit ? "Update Query" : "Save Query"}</span>
          </Button>

          {/* Compact X Icon Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            tabIndex={11}
            onClick={handleClose}
            aria-label="Cancel and close"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
            title="Cancel and close (Esc)"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Form Content: Single Screen Card Layout, No Page Scrolling */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden p-3 sm:p-5 flex flex-col justify-center min-w-0">
        <div className="bg-card rounded-2xl border border-border/70 shadow-sm p-4 sm:p-5 flex flex-col justify-between gap-3 sm:gap-3.5 min-w-0">
          
          <div className="grid grid-cols-12 gap-3 min-w-0">
            {/* ROW 1: Client Name * (col-span-6) | Contact Number (col-span-6) */}
            <div className="col-span-12 sm:col-span-6 space-y-1 min-w-0">
              <Label htmlFor="client_name" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Client Name <span className="text-destructive">*</span></span>
                {errors.clientName && <span className="text-[10px] text-destructive font-normal normal-case">{errors.clientName}</span>}
              </Label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="client_name"
                  ref={clientNameRef}
                  tabIndex={1}
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    if (errors.clientName) setErrors((prev) => ({ ...prev, clientName: undefined }));
                  }}
                  placeholder="e.g. Tariq Mehmood"
                  className={cn(
                    "pl-9 h-10 text-base sm:text-xs rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none transition-all",
                    errors.clientName && "border-destructive focus-visible:ring-destructive"
                  )}
                />
              </div>
            </div>

            <div className="col-span-12 sm:col-span-6 space-y-1 min-w-0">
              <Label htmlFor="contact_number" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Contact Number
              </Label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="contact_number"
                  ref={contactNumberRef}
                  tabIndex={2}
                  type="tel"
                  inputMode="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. +92 300 1234567"
                  className="pl-9 h-10 text-base sm:text-xs rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none transition-all"
                />
              </div>
            </div>

            {/* ROW 2: Priority * (col-span-3) | Status * (col-span-3) | Assigned To (col-span-3) | Due Date (col-span-3) */}
            <div className="col-span-6 sm:col-span-3 space-y-1 min-w-0">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Priority <span className="text-destructive">*</span>
              </Label>
              <Select value={priority} onValueChange={(val: Priority) => setPriority(val)}>
                <SelectTrigger
                  tabIndex={3}
                  className="h-10 text-xs rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Flag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-50 text-xs">
                  {PRIORITY_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      <span className={cn("px-1.5 py-0.5 rounded text-[11px] font-medium", item.badgeClass)}>
                        {item.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-6 sm:col-span-3 space-y-1 min-w-0">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Status <span className="text-destructive">*</span>
              </Label>
              <Select value={status} onValueChange={(val: Status) => setStatus(val)}>
                <SelectTrigger
                  tabIndex={4}
                  className="h-10 text-xs rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Activity className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-50 text-xs">
                  {STATUS_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      <span className={cn("px-1.5 py-0.5 rounded text-[11px] font-medium", item.badgeClass)}>
                        {item.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-6 sm:col-span-3 space-y-1 min-w-0">
              <Label htmlFor="assigned_to" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Assigned To
              </Label>
              <div className="relative">
                <UserCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="assigned_to"
                  ref={assignedToRef}
                  tabIndex={5}
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="e.g. Desk 1 / Usman"
                  className="pl-9 h-10 text-base sm:text-xs rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                />
              </div>
            </div>

            <div className="col-span-6 sm:col-span-3 space-y-1 min-w-0">
              <Label htmlFor="due_date" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Due Date
              </Label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="due_date"
                  ref={dueDateRef}
                  tabIndex={6}
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="pl-9 h-10 text-base sm:text-xs rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                />
              </div>
            </div>

            {/* ROW 3: Query / Request Details * (col-span-12, compact 3-row textarea) */}
            <div className="col-span-12 space-y-1 min-w-0">
              <Label htmlFor="query_text" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Query / Request Details <span className="text-destructive">*</span></span>
                </span>
                {errors.queryText && <span className="text-[10px] text-destructive font-normal normal-case">{errors.queryText}</span>}
              </Label>
              <Textarea
                id="query_text"
                ref={queryTextRef}
                tabIndex={7}
                rows={3}
                value={queryText}
                onChange={(e) => {
                  setQueryText(e.target.value);
                  if (errors.queryText) setErrors((prev) => ({ ...prev, queryText: undefined }));
                }}
                placeholder="Client inquiry details, travel dates, passenger count, ticket or Umrah package requirements..."
                className={cn(
                  "min-h-[72px] text-base sm:text-xs rounded-lg resize-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none transition-all",
                  errors.queryText && "border-destructive focus-visible:ring-destructive"
                )}
              />
            </div>

            {/* ROW 4: Internal Follow-up Notes (col-span-12, compact 2-row textarea) */}
            <div className="col-span-12 space-y-1 min-w-0">
              <Label htmlFor="notes" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Internal Follow-up Notes</span>
              </Label>
              <Textarea
                id="notes"
                ref={notesRef}
                tabIndex={8}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Private remarks, caller background, reminder tags..."
                className="min-h-[50px] text-base sm:text-xs rounded-lg resize-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none transition-all"
              />
            </div>
          </div>

          {/* Footer Action: Prominent bottom-right Save Query submit button synced with top action */}
          <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-3 mt-1 shrink-0">
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Press <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">Ctrl+Enter</kbd> to save anytime
            </span>
            <div className="flex items-center gap-2 ml-auto">
              {!isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSave(true)}
                  disabled={isSubmitting}
                  className="sm:hidden h-9 px-3 text-xs"
                >
                  Save & Add Another
                </Button>
              )}
              <Button
                ref={submitBtnRef}
                type="button"
                onClick={() => handleSave(false)}
                disabled={isSubmitting}
                className="h-9 px-5 text-xs font-semibold shadow-sm gap-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Saving..." : isEdit ? "Update Query" : "Save Query"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
