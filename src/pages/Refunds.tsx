import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, RotateCcw, Banknote, Search, FileSpreadsheet, FileText, Pencil, RefreshCw, X } from "lucide-react";
import { DateFilter, DatePresetFilterValue, isDateWithinPreset } from "@/components/DateFilter";
import { useRefunds, Refund, RefundInput } from "@/hooks/useRefunds";
import { useClients } from "@/hooks/useStorage";
import { useAgency } from "@/hooks/useAgency";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { exportRowsToExcel, exportRowsToPDF } from "@/lib/simpleExport";

const emptyForm: RefundInput = {
  client_id: null,
  booking_id: null,
  refund_date: format(new Date(), "yyyy-MM-dd"),
  refund_amount: 0,
  payment_mode: "cash",
  bank_name: null,
  reason: null,
  notes: null,
};

export default function Refunds() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Refund | null>(null);
  const [form, setForm] = useState<RefundInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DatePresetFilterValue>({
    preset: "this_month",
  });

  const { refunds, isLoading, isFetching, refetch, addRefund, updateRefund, deleteRefund } = useRefunds();
  const { clients } = useClients();
  const { data: agency } = useAgency();

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings-for-refund", form.client_id],
    queryFn: async () => {
      if (!form.client_id) return [];
      const { data } = await supabase
        .from("bookings")
        .select("id, pnr, flight_date")
        .eq("client_id", form.client_id)
        .order("flight_date", { ascending: false });
      return data || [];
    },
    enabled: !!form.client_id,
  });

  const clientName = (id: string | null) =>
    clients.find((c: any) => c.id === id)?.name || "—";

  const filtered = useMemo(() => {
    return refunds.filter((r) => {
      if (modeFilter !== "all" && (r.payment_mode || "cash") !== modeFilter) return false;
      if (!isDateWithinPreset(r.refund_date, dateFilter.preset, dateFilter.customFrom, dateFilter.customTo)) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = clientName(r.client_id).toLowerCase();
        if (
          !name.includes(q) &&
          !(r.reason || "").toLowerCase().includes(q) &&
          !(r.notes || "").toLowerCase().includes(q) &&
          !String(r.refund_amount).includes(q)
        ) return false;
      }
      return true;
    });
  }, [refunds, search, modeFilter, dateFilter, clients]);

  const totalRefunds = filtered.reduce((s, r) => s + Number(r.refund_amount || 0), 0);

  const openNew = () => { setEditing(null); setForm(emptyForm); setErrors({}); setOpen(true); };
  const openEdit = (r: Refund) => {
    setEditing(r);
    setErrors({});
    setForm({
      client_id: r.client_id, booking_id: r.booking_id, refund_date: r.refund_date,
      refund_amount: Number(r.refund_amount), payment_mode: r.payment_mode || "cash",
      bank_name: r.bank_name, reason: r.reason, notes: r.notes,
    });
    setOpen(true);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.refund_date) e.refund_date = "Date is required";
    if (!form.refund_amount || Number(form.refund_amount) <= 0) e.refund_amount = "Amount must be greater than 0";
    if (form.payment_mode === "bank" && !form.bank_name?.trim()) e.bank_name = "Bank name is required for bank payments";
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Please fix the highlighted fields", { description: Object.values(e).join(" • ") });
      return false;
    }
    return true;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const payload: RefundInput = { ...form, refund_amount: Number(form.refund_amount) };
    if (editing) {
      updateRefund.mutate({ id: editing.id, ...payload }, { onSuccess: () => { setOpen(false); refetch(); } });
    } else {
      addRefund.mutate(payload, { onSuccess: () => { setOpen(false); refetch(); } });
    }
  };

  const buildExportRows = () => filtered.map((r) => ({
    Date: r.refund_date,
    Client: clientName(r.client_id),
    Amount: Number(r.refund_amount),
    Mode: r.payment_mode || "cash",
    Bank: r.bank_name || "",
    Reason: r.reason || "",
    Notes: r.notes || "",
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <RotateCcw className="h-7 w-7 text-primary" />
            Refunds & Sales Returns
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Record cancelled bookings and refunded payments to clients.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Button variant="outline" size="sm" onClick={() => exportRowsToPDF("Refunds Report", buildExportRows(), "refunds", agency?.name)} className="h-9 gap-2">
            <FileText className="h-4 w-4" /> PDF
          </Button>
          <Button onClick={openNew} className="h-9 gap-2"><Plus className="h-4 w-4" /> New Refund</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-5 w-5 text-primary" />
            Total Refunded {filtered.length !== refunds.length && <span className="text-xs text-muted-foreground">(filtered)</span>}
          </CardTitle>
          <CardDescription className="text-2xl font-bold text-destructive">
            PKR {totalRefunds.toLocaleString()}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Refund History</CardTitle>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 pr-8 h-9 text-xs rounded-lg"
                placeholder="Search by client, booking, reason, amount..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-0">
              <DateFilter
                value={dateFilter}
                onChange={setDateFilter}
                className="h-9 shrink-0"
              />
              <Select value={modeFilter} onValueChange={setModeFilter}>
                <SelectTrigger className="h-9 w-36 text-xs rounded-lg shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50 text-xs">
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No refunds match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.refund_date}</TableCell>
                      <TableCell>{clientName(r.client_id)}</TableCell>
                      <TableCell className="font-semibold text-destructive">
                        PKR {Number(r.refund_amount).toLocaleString()}
                      </TableCell>
                      <TableCell className="capitalize">{r.payment_mode || "cash"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.reason || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(r.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[96vw] max-w-[1600px] h-[92vh] max-h-[92vh] overflow-y-auto z-[100]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Refund" : "Record Refund"}</DialogTitle>
            <DialogDescription>Refunds reduce client receivables and total revenue.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={form.client_id || "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? null : v, booking_id: null })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {clients.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            {form.client_id && bookings.length > 0 && (
              <div className="space-y-2">
                <Label>Booking (optional)</Label>
                <Select value={form.booking_id || "none"} onValueChange={(v) => setForm({ ...form, booking_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {bookings.map((b: any) => (<SelectItem key={b.id} value={b.id}>{b.pnr} — {b.flight_date}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={form.refund_date} onChange={(e) => setForm({ ...form, refund_date: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Amount (PKR) *</Label>
                <Input type="number" step="0.01" min="0.01" value={form.refund_amount || ""} onChange={(e) => setForm({ ...form, refund_amount: Number(e.target.value) })} aria-invalid={!!errors.refund_amount} className={errors.refund_amount ? "border-destructive" : ""} required />
                {errors.refund_amount && <p className="text-xs text-destructive">{errors.refund_amount}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={form.payment_mode || "cash"} onValueChange={(v) => setForm({ ...form, payment_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bank {form.payment_mode === "bank" && "*"}</Label>
                <Input value={form.bank_name || ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value || null })} placeholder="Bank name" aria-invalid={!!errors.bank_name} className={errors.bank_name ? "border-destructive" : ""} />
                {errors.bank_name && <p className="text-xs text-destructive">{errors.bank_name}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value || null })} placeholder="Cancellation, duplicate charge, etc." />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addRefund.isPending || updateRefund.isPending}>
                {editing ? "Update Refund" : "Save Refund"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this refund?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the refund entry. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) deleteRefund.mutate(deleteId);
                setDeleteId(null);
              }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
