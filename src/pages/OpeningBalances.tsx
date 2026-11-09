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
import { Plus, Trash2, Scale, Pencil, Search, FileSpreadsheet, FileText, RefreshCw, X } from "lucide-react";
import { DateFilter, DatePresetFilterValue, isDateWithinPreset } from "@/components/DateFilter";
import { useOpeningBalances, PartyType, BalanceType, OpeningBalance, OpeningBalanceInput } from "@/hooks/useOpeningBalances";
import { useClients, useVendors } from "@/hooks/useStorage";
import { useB2BAgents } from "@/hooks/useB2BAgents";
import { useAgency } from "@/hooks/useAgency";
import { format } from "date-fns";
import { toast } from "sonner";
import { exportRowsToExcel, exportRowsToPDF } from "@/lib/simpleExport";

const emptyForm: OpeningBalanceInput = {
  party_type: "client",
  party_id: "",
  balance_type: "receivable",
  amount: 0,
  as_of_date: format(new Date(), "yyyy-MM-dd"),
  notes: null,
};

export default function OpeningBalances() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OpeningBalance | null>(null);
  const [form, setForm] = useState<OpeningBalanceInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [partyFilter, setPartyFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DatePresetFilterValue>({
    preset: "this_month",
  });

  const { balances, isLoading, isFetching, refetch, upsertBalance, updateBalance, deleteBalance } = useOpeningBalances();
  const { clients } = useClients();
  const { vendors } = useVendors();
  const { agents = [] } = useB2BAgents() as any;
  const { data: agency } = useAgency();

  const partyList: any[] =
    form.party_type === "client" ? clients : form.party_type === "vendor" ? vendors : agents;

  const labelOf = (b: { party_type: string; party_id: string }) => {
    const list =
      b.party_type === "client" ? clients : b.party_type === "vendor" ? vendors : agents;
    const found = (list as any[]).find((p) => p.id === b.party_id);
    return found?.name || found?.agent_name || "—";
  };

  const filtered = useMemo(() => {
    return balances.filter((b) => {
      if (partyFilter !== "all" && b.party_type !== partyFilter) return false;
      if (kindFilter !== "all" && b.balance_type !== kindFilter) return false;
      const dateToCheck = b.as_of_date || (b as any).created_at;
      if (!isDateWithinPreset(dateToCheck, dateFilter.preset, dateFilter.customFrom, dateFilter.customTo)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!labelOf(b).toLowerCase().includes(q) && !(b.notes || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [balances, search, partyFilter, kindFilter, dateFilter, clients, vendors, agents]);

  const totalReceivable = filtered.filter((b) => b.balance_type === "receivable").reduce((s, b) => s + Number(b.amount), 0);
  const totalPayable = filtered.filter((b) => b.balance_type === "payable").reduce((s, b) => s + Number(b.amount), 0);

  // Reconciliation: per-party totals + duplicate detection
  const reconciliation = useMemo(() => {
    const map = new Map<string, { key: string; party_type: string; party_id: string; label: string; receivable: number; payable: number; net: number; count: number }>();
    for (const b of balances) {
      const key = `${b.party_type}:${b.party_id}`;
      const cur = map.get(key) || { key, party_type: b.party_type, party_id: b.party_id, label: labelOf(b), receivable: 0, payable: 0, net: 0, count: 0 };
      if (b.balance_type === "receivable") cur.receivable += Number(b.amount);
      else cur.payable += Number(b.amount);
      cur.net = cur.receivable - cur.payable;
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [balances, clients, vendors, agents]);

  const duplicates = reconciliation.filter(r => r.count > 1);

  const openNew = () => { setEditing(null); setForm(emptyForm); setErrors({}); setOpen(true); };
  const openEdit = (b: OpeningBalance) => {
    setEditing(b);
    setErrors({});
    setForm({
      party_type: b.party_type, party_id: b.party_id, balance_type: b.balance_type,
      amount: Number(b.amount), as_of_date: b.as_of_date, notes: b.notes,
    });
    setOpen(true);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.party_id) e.party_id = "Please select a party";
    if (!form.amount || Number(form.amount) < 0) e.amount = "Amount must be 0 or greater";
    if (!form.as_of_date) e.as_of_date = "Date is required";
    // Duplicate guard (only on create)
    if (!editing && form.party_id) {
      const exists = balances.find(b => b.party_type === form.party_type && b.party_id === form.party_id);
      if (exists) e.party_id = "An opening balance for this party already exists. Edit it instead.";
    }
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
    const payload: OpeningBalanceInput = { ...form, amount: Number(form.amount) };
    if (editing) {
      updateBalance.mutate({ id: editing.id, ...payload }, { onSuccess: () => { setOpen(false); refetch(); } });
    } else {
      upsertBalance.mutate(payload, { onSuccess: () => { setOpen(false); refetch(); } });
    }
  };

  const buildExportRows = () => filtered.map((b) => ({
    Party: labelOf(b),
    "Party Type": b.party_type.replace("_", " "),
    Kind: b.balance_type,
    Amount: Number(b.amount),
    Date: b.as_of_date,
    Notes: b.notes || "",
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary" />
            Opening Balances
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Set starting receivables (clients owe you) and payables (you owe vendors/agents).
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Button variant="outline" size="sm" onClick={() => exportRowsToPDF("Opening Balances", buildExportRows(), "opening-balances", agency?.name)} className="h-9 gap-2">
            <FileText className="h-4 w-4" /> PDF
          </Button>
          <Button onClick={openNew} className="h-9 gap-2"><Plus className="h-4 w-4" /> Add Balance</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Opening Receivable</CardTitle>
            <CardDescription className="text-2xl font-bold text-primary">
              PKR {totalReceivable.toLocaleString()}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Opening Payable</CardTitle>
            <CardDescription className="text-2xl font-bold text-destructive">
              PKR {totalPayable.toLocaleString()}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reconciliation by Party</CardTitle>
          <CardDescription>
            Net opening position per party (Receivable − Payable).
            {duplicates.length > 0 && (
              <span className="block mt-1 text-destructive font-medium">
                ⚠ {duplicates.length} duplicate {duplicates.length === 1 ? "entry" : "entries"} detected — please consolidate to keep calculations accurate.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reconciliation.length === 0 ? (
            <p className="text-sm text-muted-foreground">No opening balances yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Party</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Receivable</TableHead>
                    <TableHead className="text-right">Payable</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Entries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciliation.map((r) => (
                    <TableRow key={r.key} className={r.count > 1 ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell className="capitalize">{r.party_type.replace("_", " ")}</TableCell>
                      <TableCell className="text-right text-primary">PKR {r.receivable.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-destructive">PKR {r.payable.toLocaleString()}</TableCell>
                      <TableCell className={`text-right font-semibold ${r.net >= 0 ? "text-primary" : "text-destructive"}`}>
                        PKR {r.net.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.count > 1 ? <span className="text-destructive font-semibold">{r.count} ⚠</span> : r.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">All Opening Balances</CardTitle>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 pr-8 h-9 text-xs rounded-lg"
                placeholder="Search party or notes..."
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
              <Select value={partyFilter} onValueChange={setPartyFilter}>
                <SelectTrigger className="h-9 w-36 text-xs rounded-lg shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50 text-xs">
                  <SelectItem value="all">All Party Types</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="b2b_agent">B2B Agent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={kindFilter} onValueChange={setKindFilter}>
                <SelectTrigger className="h-9 w-32 text-xs rounded-lg shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50 text-xs">
                  <SelectItem value="all">All Kinds</SelectItem>
                  <SelectItem value="receivable">Receivable</SelectItem>
                  <SelectItem value="payable">Payable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No opening balances match.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Party</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{labelOf(b)}</TableCell>
                      <TableCell className="capitalize">{b.party_type.replace("_", " ")}</TableCell>
                      <TableCell className="capitalize">{b.balance_type}</TableCell>
                      <TableCell className={`font-semibold ${b.balance_type === "receivable" ? "text-primary" : "text-destructive"}`}>
                        PKR {Number(b.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>{b.as_of_date}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(b)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(b.id)}>
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
        <DialogContent className="w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] overflow-y-auto z-[100]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Opening Balance" : "Opening Balance"}</DialogTitle>
            <DialogDescription>One opening balance per party. Re-saving the same party updates the existing record.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-2">
              <Label>Party Type</Label>
              <Select
                value={form.party_type}
                onValueChange={(v) => setForm({ ...form, party_type: v as PartyType, party_id: "" })}
                disabled={!!editing}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="b2b_agent">B2B Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Party *</Label>
              <Select value={form.party_id} onValueChange={(v) => setForm({ ...form, party_id: v })} disabled={!!editing}>
                <SelectTrigger className={errors.party_id ? "border-destructive" : ""}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {partyList.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name || p.agent_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.party_id && <p className="text-xs text-destructive">{errors.party_id}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={form.balance_type} onValueChange={(v) => setForm({ ...form, balance_type: v as BalanceType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receivable">Receivable</SelectItem>
                    <SelectItem value="payable">Payable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount (PKR) *</Label>
                <Input type="number" step="0.01" min="0" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} aria-invalid={!!errors.amount} className={errors.amount ? "border-destructive" : ""} required />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>As of date</Label>
              <Input type="date" value={form.as_of_date} onChange={(e) => setForm({ ...form, as_of_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!form.party_id || upsertBalance.isPending || updateBalance.isPending}>
                {editing ? "Update" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this opening balance?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) deleteBalance.mutate(deleteId); setDeleteId(null); }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
