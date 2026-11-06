import { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus, FileText, Download, Mail, Pencil, Trash2, RefreshCw, Search, Banknote, Loader2, Eye, Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQuotations, type Quotation, type QuotationInput, type QuotationItem } from "@/hooks/useQuotations";
import { useClients } from "@/hooks/useStorage";
import { useB2BAgents } from "@/hooks/useB2BAgents";
import { useAgency } from "@/hooks/useAgency";
import { downloadQuotationPdf, quotationPdfBase64 } from "@/lib/quotationPdf";
import { sendEmail } from "@/lib/emailService";

type ServiceType = "client_booking" | "b2b" | "umrah" | "custom";
type Status = "draft" | "sent" | "accepted" | "rejected";

const serviceLabels: Record<ServiceType, string> = {
  client_booking: "Client Booking",
  b2b: "B2B Service",
  umrah: "Umrah Package",
  custom: "Custom",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  accepted: "bg-green-500/15 text-green-700 dark:text-green-300",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-300",
};

/**
 * Generate the next quotation number with format: Q-YYYYMM-####
 * Scans existing quotations for the same month and increments the highest seq.
 */
const generateQuotationNumber = (existing: Quotation[]): string => {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `Q-${ym}-`;
  let maxSeq = 0;
  for (const q of existing) {
    if (!q.quotation_number?.startsWith(prefix)) continue;
    const tail = q.quotation_number.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (!isNaN(n) && n > maxSeq) maxSeq = n;
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
};

const emptyForm = (number: string): QuotationInput => ({
  quotation_number: number,
  quotation_date: format(new Date(), "yyyy-MM-dd"),
  valid_until: format(new Date(Date.now() + 14 * 86400000), "yyyy-MM-dd"),
  service_type: "client_booking",
  client_name: "",
  client_email: "",
  client_phone: "",
  client_id: null,
  agent_id: null,
  title: "",
  description: "",
  items: [{ description: "", qty: 1, unit_price: 0, amount: 0 }],
  subtotal: 0,
  discount: 0,
  tax: 0,
  total: 0,
  currency: "PKR",
  status: "draft",
  notes: "",
  terms: "Quotation valid until the date mentioned above. Prices subject to availability at the time of confirmation.",
  source: null,
  source_ref: null,
});

export default function Quotations() {
  const { quotations, isLoading, isFetching, refetch, addQuotation, updateQuotation, deleteQuotation } = useQuotations();
  const { clients } = useClients();
  const { agents: b2bAgents = [] } = useB2BAgents();
  const { data: agency } = useAgency();
  const location = useLocation();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [form, setForm] = useState<QuotationInput>(() => emptyForm(`Q-${Date.now().toString().slice(-6)}`));
  const [search, setSearch] = useState("");
  const [filterService, setFilterService] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sending, setSending] = useState<string | null>(null);
  const [previewQ, setPreviewQ] = useState<Quotation | null>(null);
  const [previewAction, setPreviewAction] = useState<"download" | "email" | null>(null);

  // Prefill from navigation state (e.g. from Umrah Calculator)
  useEffect(() => {
    const prefill = (location.state as any)?.prefill as Partial<QuotationInput> | undefined;
    if (prefill) {
      const base = emptyForm(generateQuotationNumber(quotations));
      setForm({ ...base, ...prefill, quotation_number: base.quotation_number });
      setEditing(null);
      setDialogOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotations.length]);

  const filtered = useMemo(() => {
    return quotations.filter((q) => {
      if (filterService !== "all" && q.service_type !== filterService) return false;
      if (filterStatus !== "all" && q.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          q.quotation_number.toLowerCase().includes(s) ||
          q.client_name.toLowerCase().includes(s) ||
          (q.title || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [quotations, search, filterService, filterStatus]);

  const stats = useMemo(() => {
    const total = quotations.reduce((s, q) => s + Number(q.total || 0), 0);
    const accepted = quotations.filter((q) => q.status === "accepted");
    const acceptedTotal = accepted.reduce((s, q) => s + Number(q.total || 0), 0);
    return { count: quotations.length, total, accepted: accepted.length, acceptedTotal };
  }, [quotations]);

  const recalc = (next: QuotationInput): QuotationInput => {
    const items = next.items.map((it) => ({
      ...it,
      amount: Number(it.qty || 0) * Number(it.unit_price || 0),
    }));
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const total = Math.max(0, subtotal - Number(next.discount || 0) + Number(next.tax || 0));
    return { ...next, items, subtotal, total };
  };

  const setItem = (idx: number, patch: Partial<QuotationItem>) => {
    setForm((f) => recalc({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(generateQuotationNumber(quotations)));
    setDialogOpen(true);
  };

  const regenerateNumber = () => {
    setForm((f) => ({ ...f, quotation_number: generateQuotationNumber(quotations) }));
    toast.success("Quotation number refreshed");
  };

  const openEdit = (q: Quotation) => {
    setEditing(q);
    setForm({
      quotation_number: q.quotation_number,
      quotation_date: q.quotation_date,
      valid_until: q.valid_until,
      service_type: q.service_type,
      client_name: q.client_name,
      client_email: q.client_email,
      client_phone: q.client_phone,
      client_id: q.client_id,
      agent_id: q.agent_id,
      title: q.title,
      description: q.description,
      items: q.items?.length ? q.items : [{ description: "", qty: 1, unit_price: 0, amount: 0 }],
      subtotal: q.subtotal,
      discount: q.discount,
      tax: q.tax,
      total: q.total,
      currency: q.currency,
      status: q.status,
      notes: q.notes,
      terms: q.terms,
      source: q.source,
      source_ref: q.source_ref,
    });
    setDialogOpen(true);
  };

  const submit = () => {
    if (!form.client_name.trim()) { toast.error("Client name is required"); return; }
    if (!form.quotation_number.trim()) { toast.error("Quotation number is required"); return; }
    if (!form.items.length || form.items.every((i) => !i.description.trim())) {
      toast.error("Add at least one item with a description"); return;
    }
    // Enforce uniqueness of quotation number
    const clash = quotations.find(
      (q) => q.quotation_number.trim().toLowerCase() === form.quotation_number.trim().toLowerCase() && q.id !== editing?.id,
    );
    if (clash) {
      toast.error("Quotation number already exists", { description: "Use a different number or click Auto." });
      return;
    }
    const normalized = recalc(form);
    if (editing) {
      updateQuotation.mutate({ id: editing.id, ...normalized }, { onSuccess: () => { setDialogOpen(false); refetch(); } });
    } else {
      addQuotation.mutate(normalized, { onSuccess: () => { setDialogOpen(false); refetch(); } });
    }
  };

  const handleDownload = (q: Quotation) => {
    downloadQuotationPdf(q, {
      agencyName: agency?.name,
      agencyEmail: agency?.contact_email || agency?.email,
      agencyPhone: agency?.phone_number,
    });
    toast.success("PDF downloaded");
  };

  const handleEmail = async (q: Quotation) => {
    if (!q.client_email) {
      toast.error("Client email missing", { description: "Edit the quotation and add the client's email." });
      return;
    }
    if (!agency?.email) {
      toast.error("Email sender not configured", { description: "Add sender email in Settings > Agency Branding." });
      return;
    }
    setSending(q.id);
    try {
      const base64 = quotationPdfBase64(q, {
        agencyName: agency?.name,
        agencyEmail: agency?.contact_email || agency?.email,
        agencyPhone: agency?.phone_number,
      });
      const body = `
        <div style="font-family:Arial,sans-serif;color:#0a2540;">
          <h2>Quotation ${q.quotation_number}</h2>
          <p>Dear ${q.client_name},</p>
          <p>Please find attached your quotation for <strong>${serviceLabels[q.service_type] || q.service_type}</strong>${q.title ? ` — ${q.title}` : ""}.</p>
          <p><strong>Total: ${q.currency} ${Number(q.total).toLocaleString()}</strong></p>
          ${q.valid_until ? `<p>Valid until: ${format(new Date(q.valid_until), "dd MMM yyyy")}</p>` : ""}
          <p>Best regards,<br/>${agency?.name || ""}</p>
        </div>`;
      const result = await sendEmail(
        { email: agency.email, password: "", contactEmail: agency.contact_email || undefined },
        {
          to: q.client_email,
          subject: `Quotation ${q.quotation_number} — ${agency?.name || "Quotation"}`,
          body,
          attachments: [{ name: `Quotation-${q.quotation_number}.pdf`, data: base64 }],
          emailType: "quotation",
          clientId: q.client_id || undefined,
        }
      );
      if (result.success) {
        toast.success("Quotation emailed");
        if (q.status === "draft") {
          updateQuotation.mutate({ id: q.id, status: "sent" });
        }
      } else {
        toast.error("Email failed", { description: result.message });
      }
    } catch (e: any) {
      toast.error("Email failed", { description: e?.message || String(e) });
    } finally {
      setSending(null);
    }
  };

  const openPreview = (q: Quotation, action: "download" | "email" | null = null) => {
    setPreviewQ(q);
    setPreviewAction(action);
  };

  const confirmFromPreview = async () => {
    if (!previewQ) return;
    const q = previewQ;
    const action = previewAction;
    setPreviewQ(null);
    setPreviewAction(null);
    if (action === "download") handleDownload(q);
    else if (action === "email") await handleEmail(q);
  };

  const changeStatus = (q: Quotation, status: Status) => {
    if (q.status === status) return;
    updateQuotation.mutate({ id: q.id, status }, { onSuccess: () => refetch() });
  };

  return (
    <div className="container mx-auto p-3 md:p-6 space-y-4 md:space-y-6 max-w-7xl pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary" /> Quotations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create professional quotations for client bookings, B2B services and Umrah packages.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="flex-1 md:flex-none">
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button onClick={openCreate} size="sm" className="flex-1 md:flex-none">
            <Plus className="w-4 h-4 mr-2" /> New Quotation
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <Card><CardContent className="p-3 md:p-4">
          <p className="text-xs text-muted-foreground">Total Quotations</p>
          <p className="text-xl md:text-2xl font-bold">{stats.count}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 md:p-4">
          <p className="text-xs text-muted-foreground">Total Value</p>
          <p className="text-base md:text-xl font-bold flex items-center gap-1"><Banknote className="w-4 h-4" />PKR {stats.total.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 md:p-4">
          <p className="text-xs text-muted-foreground">Accepted</p>
          <p className="text-xl md:text-2xl font-bold text-green-600">{stats.accepted}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 md:p-4">
          <p className="text-xs text-muted-foreground">Accepted Value</p>
          <p className="text-base md:text-xl font-bold text-green-600">PKR {stats.acceptedTotal.toLocaleString()}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 md:p-4 flex flex-col md:flex-row gap-2 md:gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by number, client or title..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 md:flex gap-2 md:gap-3">
            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="client_booking">Client Booking</SelectItem>
                <SelectItem value="b2b">B2B Service</SelectItem>
                <SelectItem value="umrah">Umrah Package</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="p-4 md:p-6"><CardTitle className="text-base md:text-lg">Quotations</CardTitle></CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto opacity-30 mb-2" />
              No quotations yet. Click "New Quotation" to create one.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((q) => (
                <div key={q.id} className="border rounded-xl p-3 md:p-4 hover:bg-muted/30 transition-colors active:bg-muted/40">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm md:text-base break-all">{q.quotation_number}</span>
                        <Badge className={statusColors[q.status]}>{q.status}</Badge>
                        <Badge variant="outline" className="text-xs">{serviceLabels[q.service_type] || q.service_type}</Badge>
                      </div>
                      <div className="mt-1 text-sm">
                        <span className="font-medium">{q.client_name}</span>
                        {q.title ? <span className="text-muted-foreground"> — {q.title}</span> : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(q.quotation_date), "dd MMM yyyy")}
                        {q.valid_until ? ` • Valid until ${format(new Date(q.valid_until), "dd MMM yyyy")}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-bold text-sm md:text-base">{q.currency} {Number(q.total).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action row — mobile-optimised */}
                  <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2">
                    <Select value={q.status} onValueChange={(v: Status) => changeStatus(q, v)}>
                      <SelectTrigger className="h-9 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex-1" />
                    <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => openPreview(q, null)}>
                      <Eye className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline">Preview</span>
                    </Button>
                    <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => openPreview(q, "download")}>
                      <Download className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline">PDF</span>
                    </Button>
                    <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => openPreview(q, "email")} disabled={sending === q.id}>
                      {sending === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4 md:mr-1" />} <span className="hidden md:inline">Email</span>
                    </Button>
                    <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => openEdit(q)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-9 px-2"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="z-[100]">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete quotation?</AlertDialogTitle>
                          <AlertDialogDescription>Quotation {q.quotation_number} will be permanently removed.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteQuotation.mutate(q.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl w-[calc(100vw-1rem)] max-h-[95vh] md:max-h-[90vh] overflow-y-auto z-[100] p-4 md:p-6">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Quotation" : "New Quotation"}</DialogTitle>
            <DialogDescription>Fill in details and save. PDF and email options are available after saving.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Quotation # *</Label>
                <div className="flex gap-1">
                  <Input value={form.quotation_number} onChange={(e) => setForm({ ...form, quotation_number: e.target.value })} />
                  {!editing && (
                    <Button type="button" size="icon" variant="outline" title="Auto-generate number" onClick={regenerateNumber}>
                      <Sparkles className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input type="date" value={form.quotation_date} onChange={(e) => setForm({ ...form, quotation_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Valid Until</Label>
                <Input type="date" value={form.valid_until || ""} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Service Type *</Label>
                <Select value={form.service_type} onValueChange={(v: ServiceType) => setForm({ ...form, service_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client_booking">Client Booking</SelectItem>
                    <SelectItem value="b2b">B2B Service</SelectItem>
                    <SelectItem value="umrah">Umrah Package</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.service_type === "client_booking" && clients.length > 0 && (
              <div className="space-y-1">
                <Label>Link Existing Client (optional)</Label>
                <Select
                  value={form.client_id || "none"}
                  onValueChange={(v) => {
                    if (v === "none") { setForm({ ...form, client_id: null }); return; }
                    const c = clients.find((x: any) => x.id === v);
                    setForm({
                      ...form,
                      client_id: v,
                      client_name: c?.name || form.client_name,
                      client_email: (c as any)?.email || form.client_email,
                      client_phone: (c as any)?.contact_number || form.client_phone,
                    });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Pick a client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.service_type === "b2b" && b2bAgents.length > 0 && (
              <div className="space-y-1">
                <Label>Link B2B Agent (optional)</Label>
                <Select
                  value={form.agent_id || "none"}
                  onValueChange={(v) => {
                    if (v === "none") { setForm({ ...form, agent_id: null }); return; }
                    const a = b2bAgents.find((x: any) => x.id === v);
                    setForm({
                      ...form,
                      agent_id: v,
                      client_name: a?.agent_name || form.client_name,
                      client_email: a?.email || form.client_email,
                      client_phone: a?.phone || form.client_phone,
                    });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Pick an agent" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {b2bAgents.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.agent_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Client / Recipient Name *</Label>
                <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.client_email || ""} onChange={(e) => setForm({ ...form, client_email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.client_phone || ""} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Umrah Package 14-Night" />
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PKR">PKR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="SAR">SAR</SelectItem>
                    <SelectItem value="AED">AED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items *</Label>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => setForm(recalc({ ...form, items: [...form.items, { description: "", qty: 1, unit_price: 0, amount: 0 }] }))}>
                  <Plus className="w-3 h-3 mr-1" /> Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {form.items.map((it, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start">
                    <Input className="col-span-12 md:col-span-6" placeholder="Description" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />
                    <Input className="col-span-3 md:col-span-1" type="number" inputMode="decimal" min="0" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} />
                    <Input className="col-span-4 md:col-span-2" type="number" inputMode="decimal" min="0" step="0.01" placeholder="Unit" value={it.unit_price} onChange={(e) => setItem(i, { unit_price: Number(e.target.value) })} />
                    <div className="col-span-4 md:col-span-2 text-sm text-right pt-2.5 font-medium">{Number(it.amount || 0).toLocaleString()}</div>
                    <Button type="button" size="icon" variant="ghost" className="col-span-1"
                      onClick={() => setForm(recalc({ ...form, items: form.items.filter((_, x) => x !== i) }))}
                      disabled={form.items.length <= 1}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Discount</Label>
                <Input type="number" inputMode="decimal" min="0" step="0.01" value={form.discount} onChange={(e) => setForm(recalc({ ...form, discount: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>Tax</Label>
                <Input type="number" inputMode="decimal" min="0" step="0.01" value={form.tax} onChange={(e) => setForm(recalc({ ...form, tax: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>Total</Label>
                <div className="h-11 rounded-xl border bg-muted/40 px-4 flex items-center font-bold">
                  {form.currency} {Number(form.total).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Terms</Label>
                <Textarea rows={2} value={form.terms || ""} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={submit} disabled={addQuotation.isPending || updateQuotation.isPending} className="w-full sm:w-auto">
              {addQuotation.isPending || updateQuotation.isPending ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewQ} onOpenChange={(o) => { if (!o) { setPreviewQ(null); setPreviewAction(null); } }}>
        <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] max-h-[95vh] md:max-h-[90vh] overflow-y-auto z-[100] p-4 md:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="w-5 h-5" /> Quotation Preview</DialogTitle>
            <DialogDescription>
              Review totals and items before {previewAction === "email" ? "emailing" : previewAction === "download" ? "downloading the PDF" : "closing"}.
            </DialogDescription>
          </DialogHeader>

          {previewQ && (
            <div className="space-y-4 text-sm">
              <div className="flex items-start justify-between gap-2 pb-3 border-b">
                <div>
                  <p className="font-bold text-base">{previewQ.quotation_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(previewQ.quotation_date), "dd MMM yyyy")}
                    {previewQ.valid_until ? ` • Valid until ${format(new Date(previewQ.valid_until), "dd MMM yyyy")}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={statusColors[previewQ.status]}>{previewQ.status}</Badge>
                  <Badge variant="outline" className="text-xs">{serviceLabels[previewQ.service_type] || previewQ.service_type}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Quotation For</p>
                  <p className="font-medium">{previewQ.client_name}</p>
                  {previewQ.client_email && <p className="text-xs">{previewQ.client_email}</p>}
                  {previewQ.client_phone && <p className="text-xs">{previewQ.client_phone}</p>}
                </div>
                {previewQ.title && (
                  <div>
                    <p className="text-xs text-muted-foreground">Title</p>
                    <p className="font-medium">{previewQ.title}</p>
                  </div>
                )}
              </div>

              {previewQ.description && (
                <div>
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="whitespace-pre-wrap">{previewQ.description}</p>
                </div>
              )}

              {/* Items */}
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-xs font-semibold">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Unit</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>
                {(previewQ.items || []).map((it, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-t text-sm">
                    <div className="col-span-6 break-words">{it.description || "-"}</div>
                    <div className="col-span-2 text-center">{it.qty}</div>
                    <div className="col-span-2 text-right">{Number(it.unit_price || 0).toLocaleString()}</div>
                    <div className="col-span-2 text-right font-medium">{Number(it.amount || 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="ml-auto w-full sm:w-72 space-y-1">
                <div className="flex justify-between text-sm"><span>Subtotal</span><span>{previewQ.currency} {Number(previewQ.subtotal).toLocaleString()}</span></div>
                {Number(previewQ.discount) > 0 && (
                  <div className="flex justify-between text-sm"><span>Discount</span><span>- {previewQ.currency} {Number(previewQ.discount).toLocaleString()}</span></div>
                )}
                {Number(previewQ.tax) > 0 && (
                  <div className="flex justify-between text-sm"><span>Tax</span><span>{previewQ.currency} {Number(previewQ.tax).toLocaleString()}</span></div>
                )}
                <div className="flex justify-between text-base font-bold pt-1 border-t">
                  <span>Total</span><span>{previewQ.currency} {Number(previewQ.total).toLocaleString()}</span>
                </div>
              </div>

              {previewQ.notes && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-wrap text-sm">{previewQ.notes}</p>
                </div>
              )}
              {previewQ.terms && (
                <div>
                  <p className="text-xs text-muted-foreground">Terms</p>
                  <p className="whitespace-pre-wrap text-sm">{previewQ.terms}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setPreviewQ(null); setPreviewAction(null); }} className="w-full sm:w-auto">
              Close
            </Button>
            {previewQ && previewAction === null && (
              <>
                <Button variant="outline" onClick={() => { const q = previewQ; setPreviewQ(null); handleDownload(q); }} className="w-full sm:w-auto">
                  <Download className="w-4 h-4 mr-2" /> Download PDF
                </Button>
                <Button onClick={() => { const q = previewQ; setPreviewQ(null); handleEmail(q); }} className="w-full sm:w-auto" disabled={!previewQ.client_email}>
                  <Mail className="w-4 h-4 mr-2" /> Email
                </Button>
              </>
            )}
            {previewQ && previewAction === "download" && (
              <Button onClick={confirmFromPreview} className="w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" /> Confirm & Download
              </Button>
            )}
            {previewQ && previewAction === "email" && (
              <Button onClick={confirmFromPreview} className="w-full sm:w-auto" disabled={!previewQ.client_email}>
                <Mail className="w-4 h-4 mr-2" /> Confirm & Send
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
