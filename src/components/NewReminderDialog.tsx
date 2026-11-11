import React, { useState, useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import { X, Lock, Plus, Bell, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { useParties, type Party } from "@/hooks/useParties";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AddPartyDialog } from "@/components/parties/AddPartyDialog";
import { CopyValue } from "@/components/ui/CopyValue";
import { cn } from "@/lib/utils";

export interface NewReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  prefill?: {
    title?: string;
    date?: string;
    time?: string;
    type?: string;
    priority?: "low" | "normal" | "high";
    linkTo?: "none" | "client" | "vendor" | "invoice" | "query" | "quote";
    linkId?: string;
    linkTitle?: string;
    remarks?: string;
  };
}

export function NewReminderDialog({
  open,
  onOpenChange,
  onSuccess,
  prefill,
}: NewReminderDialogProps) {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();
  const { parties = [] } = useParties();

  // Form Fields
  const [remDate, setRemDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [remTime, setRemTime] = useState("09:00");
  const [remType, setRemType] = useState<string>("Call Client");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");

  const [title, setTitle] = useState("");
  const [linkTo, setLinkTo] = useState<"none" | "client" | "vendor" | "invoice" | "query" | "quote">("none");
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [selectedRecordLabel, setSelectedRecordLabel] = useState("");

  const [repeat, setRepeat] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const [remindBefore, setRemindBefore] = useState<"at_time" | "15min" | "1hour" | "1day">("at_time");
  const [remarks, setRemarks] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddPartyOpen, setIsAddPartyOpen] = useState(false);
  const [addPartyType, setAddPartyType] = useState<"client" | "vendor">("client");

  // Running auto reminder sequence: REM-YYYY-0001
  const [reminderSeq, setReminderSeq] = useState("0001");

  // Query records for linking
  const { data: bookingInvoices = [] } = useQuery({
    queryKey: ["rem_booking_invoices", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data } = await (supabase as any)
        .from("booking_invoices")
        .select("id, invoice_no, party:parties(name)")
        .eq("agency_id", agencyId)
        .order("invoice_date", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: open && linkTo === "invoice",
  });

  const { data: queriesList = [] } = useQuery({
    queryKey: ["rem_queries", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data } = await (supabase as any)
        .from("queries")
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: open && linkTo === "query",
  });

  const { data: quotesList = [] } = useQuery({
    queryKey: ["rem_quotes", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data } = await supabase
        .from("quotations")
        .select("id, quotation_number, client_name, created_at")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: open && linkTo === "quote",
  });

  // Query Recent Reminders sheet below form
  const { data: recentReminders = [], refetch: refetchRecent } = useQuery({
    queryKey: ["recent_reminders_sheet", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data } = await supabase
        .from("reminders" as any)
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: open,
  });

  // Fetch sequence
  useEffect(() => {
    if (open) {
      const year = new Date().getFullYear();
      const count = (recentReminders.length || 0) + 1;
      const pad = String(count).padStart(4, "0");
      setReminderSeq(`${year}-${pad}`);

      // Apply prefill if supplied
      if (prefill) {
        if (prefill.title) setTitle(prefill.title);
        if (prefill.date) setRemDate(prefill.date);
        if (prefill.time) setRemTime(prefill.time);
        if (prefill.type) setRemType(prefill.type);
        if (prefill.priority) setPriority(prefill.priority);
        if (prefill.linkTo) setLinkTo(prefill.linkTo);
        if (prefill.linkId) setSelectedRecordId(prefill.linkId);
        if (prefill.linkTitle) setSelectedRecordLabel(prefill.linkTitle);
        if (prefill.remarks) setRemarks(prefill.remarks);
      }
    }
  }, [open, prefill, recentReminders.length]);

  const autoReminderNo = `REM-${reminderSeq}`;

  const clientParties = useMemo(() => parties.filter((p) => p.type === "client" || p.type === "both"), [parties]);
  const vendorParties = useMemo(() => parties.filter((p) => p.type === "vendor" || p.type === "both"), [parties]);

  const handleSave = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("You are offline, not saved");
      return;
    }
    if (!title.trim()) {
      toast.error("Reminder title is required");
      return;
    }
    if (!remDate) {
      toast.error("Reminder date is required");
      return;
    }
    if (!agencyId) {
      toast.error("Agency session not resolved");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        agency_id: agencyId,
        title: title.trim(),
        type: remType.toLowerCase().includes("flight") ? "flight" : remType.toLowerCase().includes("umrah") ? "umrah" : remType.toLowerCase().includes("expense") ? "daily_expense" : "manual",
        remind_date: remDate,
        remind_time: remTime ? `${remTime}:00` : "09:00:00",
        notes: [
          `Type: ${remType}`,
          `Priority: ${priority.toUpperCase()}`,
          linkTo !== "none" ? `Linked To: ${linkTo.toUpperCase()} (${selectedRecordLabel || selectedRecordId})` : null,
          repeat !== "none" ? `Repeat: ${repeat}` : null,
          remindBefore !== "at_time" ? `Remind Before: ${remindBefore}` : null,
          remarks ? `Remarks: ${remarks}` : null,
          `No: ${autoReminderNo}`,
        ]
          .filter(Boolean)
          .join(" | "),
        is_completed: false,
        is_recurring_daily: repeat === "daily",
      };

      const { error } = await supabase.from("reminders" as any).insert(payload);
      if (error) throw error;

      toast.success("Reminder saved successfully");
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      queryClient.invalidateQueries({ queryKey: ["recent_reminders_sheet"] });
      queryClient.invalidateQueries({ queryKey: ["alert_custom_reminders"] });
      refetchRecent();

      // Clear input fields (keep Date/Time)
      setTitle("");
      setRemarks("");
      setLinkTo("none");
      setSelectedRecordId("");
      setSelectedRecordLabel("");

      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(`Could not save: ${err.message || "Failed to save reminder"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-4xl max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0 bg-background border rounded-xl shadow-2xl">
        {/* Header: title, auto Reminder No badge (read-only), close (X) */}
        <div className="px-5 py-2.5 border-b flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-amber-500" />
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
              New Reminder
            </DialogTitle>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Reminder #:</span>
            <CopyValue value={autoReminderNo} label="reminder number" className="text-amber-600 dark:text-amber-400" />
            <Badge variant="secondary" className="text-[9px] px-1 h-3.5 ml-0.5">
              Auto
            </Badge>
          </div>
        </div>

        {/* Body: Flat single screen, tight grid, no section headers */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-3">
          {/* LINE 1: Date | Time | Type | Priority */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
            <div>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={remDate}
                onChange={(e) => setRemDate(e.target.value)}
                className="h-8 text-xs mt-0.5"
                required
              />
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Time
              </Label>
              <Input
                type="time"
                value={remTime}
                onChange={(e) => setRemTime(e.target.value)}
                className="h-8 text-xs mt-0.5"
              />
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Type
              </Label>
              <Select value={remType} onValueChange={setRemType}>
                <SelectTrigger className="h-8 text-xs mt-0.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Call Client">Call Client</SelectItem>
                  <SelectItem value="Payment Follow-up">Payment Follow-up</SelectItem>
                  <SelectItem value="Flight/Umrah">Flight / Umrah</SelectItem>
                  <SelectItem value="Visa/Documents">Visa / Documents</SelectItem>
                  <SelectItem value="Vendor Payment">Vendor Payment</SelectItem>
                  <SelectItem value="Meeting">Meeting</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Priority
              </Label>
              <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                <SelectTrigger className="h-8 text-xs mt-0.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* LINE 2: Title * | Link To | Select Record (with + Quick Add) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div className={linkTo === "none" ? "sm:col-span-8" : "sm:col-span-5"}>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g., Follow up with Ahmed regarding ticket payment"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-8 text-xs mt-0.5"
                required
              />
            </div>

            <div className={linkTo === "none" ? "sm:col-span-4" : "sm:col-span-3"}>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Link To
              </Label>
              <Select
                value={linkTo}
                onValueChange={(val: any) => {
                  setLinkTo(val);
                  setSelectedRecordId("");
                  setSelectedRecordLabel("");
                }}
              >
                <SelectTrigger className="h-8 text-xs mt-0.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="query">Query</SelectItem>
                  <SelectItem value="quote">Quote</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {linkTo !== "none" && (
              <div className="sm:col-span-4 flex items-center gap-1.5">
                <div className="flex-1 min-w-0">
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Select {linkTo.charAt(0).toUpperCase() + linkTo.slice(1)}
                  </Label>
                  <Select
                    value={selectedRecordId}
                    onValueChange={(val) => {
                      setSelectedRecordId(val);
                      if (linkTo === "client" || linkTo === "vendor") {
                        const p = parties.find((item) => item.id === val);
                        if (p) setSelectedRecordLabel(p.name);
                      } else if (linkTo === "invoice") {
                        const inv = bookingInvoices.find((item: any) => item.id === val);
                        if (inv) setSelectedRecordLabel(inv.invoice_no);
                      } else if (linkTo === "query") {
                        const q = queriesList.find((item: any) => item.id === val);
                        if (q) setSelectedRecordLabel((q as any).client_name || (q as any).name || "Inquiry");
                      } else if (linkTo === "quote") {
                        const qt = quotesList.find((item: any) => item.id === val);
                        if (qt) setSelectedRecordLabel(qt.quotation_number);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs mt-0.5 truncate">
                      <SelectValue placeholder={`Choose ${linkTo}...`} />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {linkTo === "client" &&
                        clientParties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} {p.phone ? `(${p.phone})` : ""}
                          </SelectItem>
                        ))}
                      {linkTo === "vendor" &&
                        vendorParties.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      {linkTo === "invoice" &&
                        bookingInvoices.map((inv: any) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.invoice_no} ({inv.party?.name || "Client"})
                          </SelectItem>
                        ))}
                      {linkTo === "query" &&
                        queriesList.map((q: any) => (
                          <SelectItem key={q.id} value={q.id}>
                            {q.name} ({q.travel_type || "Trip"})
                          </SelectItem>
                        ))}
                      {linkTo === "quote" &&
                        quotesList.map((qt: any) => (
                          <SelectItem key={qt.id} value={qt.id}>
                            {qt.quotation_number} ({qt.client_name})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {linkTo === "client" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAddPartyType("client");
                      setIsAddPartyOpen(true);
                    }}
                    className="h-8 text-[11px] px-2 mt-4.5 shrink-0"
                    title="Quick Add Client"
                  >
                    + Client
                  </Button>
                )}
                {linkTo === "vendor" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAddPartyType("vendor");
                      setIsAddPartyOpen(true);
                    }}
                    className="h-8 text-[11px] px-2 mt-4.5 shrink-0"
                    title="Quick Add Vendor"
                  >
                    + Vendor
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* LINE 3: Repeat | Remind me before | Remarks (single-line input that grows) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div className="sm:col-span-3">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Repeat
              </Label>
              <Select value={repeat} onValueChange={(val: any) => setRepeat(val)}>
                <SelectTrigger className="h-8 text-xs mt-0.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-3">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Remind Me Before
              </Label>
              <Select value={remindBefore} onValueChange={(val: any) => setRemindBefore(val)}>
                <SelectTrigger className="h-8 text-xs mt-0.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="at_time">At time</SelectItem>
                  <SelectItem value="15min">15 minutes</SelectItem>
                  <SelectItem value="1hour">1 hour</SelectItem>
                  <SelectItem value="1day">1 day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-6">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Remarks
              </Label>
              <Input
                placeholder="Additional notes or action steps..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="h-8 text-xs mt-0.5"
              />
            </div>
          </div>

          {/* Recent Reminders Sheet Below Form */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Recent Reminders
              </span>
              <span className="text-[10px] text-muted-foreground">
                Showing latest 5 entries
              </span>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
              {recentReminders.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  No reminders yet
                </div>
              ) : (
                <div className="divide-y text-xs">
                  {recentReminders.slice(0, 5).map((r: any) => (
                    <div key={r.id} className="p-2 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                          {r.remind_date} {r.remind_time?.slice(0, 5)}
                        </span>
                        <span className="font-semibold text-foreground truncate">
                          {r.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 uppercase">
                          {r.type}
                        </Badge>
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.2 rounded",
                          r.is_completed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {r.is_completed ? "Done" : "Active"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer: ONLY Cancel and Save Reminder */}
        <div className="px-5 py-2.5 border-t bg-slate-50 dark:bg-slate-900/60 flex items-center justify-end gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSubmitting}
            className="h-8 text-xs font-bold px-5 bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
          >
            {isSubmitting ? "Saving..." : "Save Reminder"}
          </Button>
        </div>
      </DialogContent>

      {/* Quick Add Party Dialog */}
      <AddPartyDialog
        open={isAddPartyOpen}
        onOpenChange={setIsAddPartyOpen}
        initialType={addPartyType}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["parties"] });
        }}
      />
    </Dialog>
  );
}
export default NewReminderDialog;
