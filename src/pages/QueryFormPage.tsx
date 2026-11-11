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
import { UniversalPartySelect } from "@/components/parties/UniversalPartySelect";

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
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<Status>("pending");
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
        setAssignedTo(existing.assigned_to || "");
        setPriority((existing.priority as Priority) || "medium");
        setStatus((existing.status as Status) || "pending");
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
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        toast.error("You are offline, not saved");
        return;
      }
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
          setAssignedTo("");
          setPriority("medium");
          setStatus("pending");
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
        toast.error(`Could not save: ${msg}`);
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

      // Esc = Close / Cancel
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
      {/* 1. Global Header Bar: ONLY Back arrow + Title on left, and X (close icon) on far right */}
      <div className="h-11 md:h-12 px-3 sm:px-6 border-b border-border/70 flex items-center justify-between shrink-0 bg-background/95 backdrop-blur z-20">
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
          <h1 className="text-sm sm:text-base font-bold text-foreground truncate">
            {isEdit ? "Edit Client Query" : "New Client Query"}
          </h1>
        </div>

        {/* Far Right: ONLY the compact X (close/cancel) button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClose}
          aria-label="Cancel and close"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
          title="Cancel and close (Esc)"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Main Form Content: Explicit Inline Grid per row, Zero Vertical Scroll on Desktop */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden p-3 sm:p-5 flex flex-col justify-center min-w-0">
        <div
          className="bg-card rounded-2xl border border-border/70 shadow-sm p-3.5 sm:p-5 flex flex-col justify-between min-w-0"
          style={{ width: "100%", gap: "10px" }}
        >
          {/* Party Quick Selector */}
          <div style={{ width: "100%", minWidth: 0 }}>
            <UniversalPartySelect
              value=""
              onChange={(_id, p) => {
                if (p?.name) setClientName(p.name);
                if (p?.phone) setContactNumber(p.phone);
                if (errors.clientName) setErrors((prev) => ({ ...prev, clientName: undefined }));
              }}
              label="Select Existing Party (Client / Vendor) or Quick Add"
              placeholder="Search existing party to auto-fill..."
              defaultQuickAddType="client"
            />
          </div>

          {/* ROW 1: Full Width - 1 Column (Client Name *) */}
          <div style={{ width: "100%", minWidth: 0 }}>
            <Label htmlFor="client_name" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Client Name <span className="text-destructive">*</span></span>
              {errors.clientName && <span className="text-[10px] text-destructive font-normal normal-case">{errors.clientName}</span>}
            </Label>
            <div className="relative" style={{ width: "100%", minWidth: 0 }}>
              <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
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
                  "pl-9 h-8 sm:h-9 text-sm rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none transition-all",
                  errors.clientName && "border-destructive focus-visible:ring-destructive"
                )}
                style={{ width: "100%", minWidth: 0 }}
              />
            </div>
          </div>

          {/* ROW 2: 2 Equal 50%/50% Columns (Contact Number & Assigned To) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px", width: "100%" }}>
            <div style={{ width: "100%", minWidth: 0 }}>
              <Label htmlFor="contact_number" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                Contact Number
              </Label>
              <div className="relative" style={{ width: "100%", minWidth: 0 }}>
                <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="contact_number"
                  ref={contactNumberRef}
                  tabIndex={2}
                  type="tel"
                  inputMode="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. +92 300 1234567"
                  className="pl-9 h-8 sm:h-9 text-sm rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none transition-all"
                  style={{ width: "100%", minWidth: 0 }}
                />
              </div>
            </div>

            <div style={{ width: "100%", minWidth: 0 }}>
              <Label htmlFor="assigned_to" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                Assigned To
              </Label>
              <div className="relative" style={{ width: "100%", minWidth: 0 }}>
                <UserCheck className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="assigned_to"
                  ref={assignedToRef}
                  tabIndex={3}
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="e.g. Desk 1 / Usman"
                  className="pl-9 h-8 sm:h-9 text-sm rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                  style={{ width: "100%", minWidth: 0 }}
                />
              </div>
            </div>
          </div>

          {/* ROW 3: 3 Equal 33.3% Columns (Priority *, Status *, Due Date) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", width: "100%" }}>
            <div style={{ width: "100%", minWidth: 0 }}>
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                Priority <span className="text-destructive">*</span>
              </Label>
              <Select value={priority} onValueChange={(val: Priority) => setPriority(val)}>
                <SelectTrigger
                  tabIndex={4}
                  className="h-8 sm:h-9 text-xs rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                  style={{ width: "100%", minWidth: 0 }}
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

            <div style={{ width: "100%", minWidth: 0 }}>
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                Status <span className="text-destructive">*</span>
              </Label>
              <Select value={status} onValueChange={(val: Status) => setStatus(val)}>
                <SelectTrigger
                  tabIndex={5}
                  className="h-8 sm:h-9 text-xs rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                  style={{ width: "100%", minWidth: 0 }}
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

            <div style={{ width: "100%", minWidth: 0 }}>
              <Label htmlFor="due_date" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                Due Date
              </Label>
              <div className="relative" style={{ width: "100%", minWidth: 0 }}>
                <Calendar className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="due_date"
                  ref={dueDateRef}
                  tabIndex={6}
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="pl-9 h-8 sm:h-9 text-sm rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
                  style={{ width: "100%", minWidth: 0 }}
                />
              </div>
            </div>
          </div>

          {/* ROW 4: Full Width - 1 Column (Query / Request Details *, compact 2-row textarea) */}
          <div style={{ width: "100%", minWidth: 0 }}>
            <Label htmlFor="query_text" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-between">
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
              rows={2}
              value={queryText}
              onChange={(e) => {
                setQueryText(e.target.value);
                if (errors.queryText) setErrors((prev) => ({ ...prev, queryText: undefined }));
              }}
              placeholder="Client inquiry details, travel dates, passenger count, ticket or Umrah package requirements..."
              className={cn(
                "min-h-[52px] text-sm rounded-lg resize-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none transition-all",
                errors.queryText && "border-destructive focus-visible:ring-destructive"
              )}
              style={{ width: "100%", minWidth: 0 }}
            />
          </div>

          {/* ROW 5: Full Width - 1 Column (Internal Follow-up Notes, compact 2-row textarea) */}
          <div style={{ width: "100%", minWidth: 0 }}>
            <Label htmlFor="notes" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
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
              className="min-h-[46px] text-sm rounded-lg resize-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none transition-all"
              style={{ width: "100%", minWidth: 0 }}
            />
          </div>

          {/* Bottom Footer Bar (Inside the Bottom of the Form Card): Side-by-Side Action Buttons on the Bottom Right */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "8px",
              paddingTop: "10px",
              marginTop: "4px",
              borderTop: "1px solid hsl(var(--border) / 0.6)",
              width: "100%",
            }}
          >
            {!isEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                tabIndex={9}
                onClick={() => handleSave(true)}
                disabled={isSubmitting}
                className="h-8 sm:h-9 px-3.5 text-xs gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none font-medium"
                title="Save and clear for next entry (Ctrl+Shift+Enter)"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Save & Add Another</span>
              </Button>
            )}

            <Button
              ref={submitBtnRef}
              type="button"
              size="sm"
              tabIndex={10}
              onClick={() => handleSave(false)}
              disabled={isSubmitting}
              className="h-8 sm:h-9 px-5 text-xs font-semibold shadow-sm gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
              title="Save Query (Ctrl+Enter)"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Saving..." : isEdit ? "Update Query" : "Save Query"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
