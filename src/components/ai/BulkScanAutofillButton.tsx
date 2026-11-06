import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScanLine, Loader2, Upload, Check, X, FileText, Trash2, Plus, Users } from "lucide-react";
import { scanDocument, type DocType } from "@/lib/ai/documentScanner";
import { toast } from "sonner";

export interface BulkColumn {
  /** key in the extracted record */
  key: string;
  /** column header label */
  label: string;
  /** optional min width */
  width?: number;
}

interface Props {
  /** columns shown in the review table. If omitted, a sensible passenger default is used. */
  columns?: BulkColumn[];
  docType?: DocType;
  label?: string;
  /** called with the final edited array when the user clicks "Apply all" */
  onApply: (records: Record<string, any>[]) => void;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "default";
  /** max files per scan (default 10) */
  maxFiles?: number;
  /** max rows returned (default 25) */
  maxRows?: number;
}

const DEFAULT_COLUMNS: BulkColumn[] = [
  { key: "group_label", label: "Ticket / Group", width: 130 },
  { key: "seat_index", label: "Seat", width: 60 },
  { key: "full_name", label: "Full name", width: 200 },
  { key: "passport_number", label: "Passport #", width: 140 },
  { key: "cnic_number", label: "CNIC / ID", width: 160 },
  { key: "date_of_birth", label: "DOB", width: 130 },
  { key: "gender", label: "Gender", width: 90 },
  { key: "nationality", label: "Nationality", width: 130 },
  { key: "expiry_date", label: "Expiry", width: 130 },
  { key: "passenger_type", label: "Type", width: 100 },
  { key: "pnr", label: "PNR", width: 100 },
];

/**
 * Deterministic grouping fallback: if the AI didn't give group_id,
 * group records that share a non-empty PNR / ticket_number / booking_reference.
 * Then assign stable seat_index within each group and a global order_index.
 */
function normaliseGrouping(records: Record<string, any>[]): Record<string, any>[] {
  if (!records.length) return records;
  const keyOf = (r: Record<string, any>) =>
    String(r.group_id || r.pnr || r.ticket_number || r.booking_reference || "").trim().toLowerCase();

  // Build stable label per group in first-seen order
  const labelMap = new Map<string, string>();
  let autoIdx = 0;
  const withKeys = records.map((r, i) => {
    const k = keyOf(r) || `__solo_${i}`;
    if (!labelMap.has(k)) {
      autoIdx += 1;
      const explicit = String(r.pnr || r.ticket_number || r.booking_reference || "").trim();
      labelMap.set(k, explicit ? explicit.toUpperCase() : `Ticket ${autoIdx}`);
    }
    return { r, k, orig: i };
  });

  // Sort by first-appearance of key, then by AI order_index/original index
  const firstSeen = new Map<string, number>();
  withKeys.forEach((x) => { if (!firstSeen.has(x.k)) firstSeen.set(x.k, x.orig); });
  withKeys.sort((a, b) => {
    const ga = firstSeen.get(a.k)!, gb = firstSeen.get(b.k)!;
    if (ga !== gb) return ga - gb;
    const sa = Number(a.r.seat_index) || a.orig;
    const sb = Number(b.r.seat_index) || b.orig;
    return sa - sb;
  });

  const seatCounter = new Map<string, number>();
  return withKeys.map((x, gi) => {
    const seat = (seatCounter.get(x.k) || 0) + 1;
    seatCounter.set(x.k, seat);
    return {
      ...x.r,
      group_id: x.r.group_id || x.k,
      group_label: labelMap.get(x.k),
      seat_index: seat,
      order_index: gi + 1,
    };
  });
}


/**
 * Bulk AI document scanner. Upload up to N files (multiple passports, IDs,
 * ticket batches). AI extracts EACH person as a separate row. User reviews /
 * edits / removes rows in an inline table, then applies all at once.
 * Never writes to DB — parent decides what to do with the array.
 */
export function BulkScanAutofillButton({
  columns = DEFAULT_COLUMNS,
  docType = "auto",
  label = "Bulk Scan (multi-passenger)",
  onApply,
  size = "sm",
  variant = "outline",
  maxFiles = 10,
  maxRows = 25,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<File[]>([]);
  const [rows, setRows] = useState<Record<string, any>[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setQueue([]); setRows(null); };

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setQueue((prev) => [...prev, ...Array.from(list)].slice(0, maxFiles));
  };

  const run = async () => {
    if (!queue.length) return;
    setLoading(true);
    try {
      // Chunk into batches of 5 (edge fn caps 5) and merge records
      const chunks: File[][] = [];
      for (let i = 0; i < queue.length; i += 5) chunks.push(queue.slice(i, i + 5));
      const all: Record<string, any>[] = [];
      for (const chunk of chunks) {
        const res = await scanDocument(chunk, docType, "bulk");
        if (Array.isArray(res.records)) all.push(...res.records);
        else if (res.fields && Object.keys(res.fields).length) all.push(res.fields);
      }
      const trimmed = normaliseGrouping(all.slice(0, maxRows));
      setRows(trimmed);
      const groups = new Set(trimmed.map((r) => r.group_id)).size;
      toast.success(`Extracted ${trimmed.length} passenger${trimmed.length === 1 ? "" : "s"} across ${groups} ticket${groups === 1 ? "" : "s"}. Review below.`);
    } catch (e: any) {
      toast.error(e?.message || "Bulk scan failed");
    } finally {
      setLoading(false);
    }
  };

  const updateCell = (i: number, key: string, value: string) => {
    setRows((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[i] = { ...next[i], [key]: value };
      return next;
    });
  };

  const removeRow = (i: number) =>
    setRows((prev) => (prev ? normaliseGrouping(prev.filter((_, idx) => idx !== i)) : null));
  const addBlank = () =>
    setRows((prev) => normaliseGrouping([...(prev || []), Object.fromEntries(columns.map((c) => [c.key, ""]))]));
  const regroup = () => setRows((prev) => (prev ? normaliseGrouping(prev) : null));

  const apply = () => {
    const clean = normaliseGrouping(
      (rows || []).filter((r) => Object.values(r).some((v) => String(v ?? "").trim())),
    );
    if (!clean.length) { toast.error("No rows to apply"); return; }
    onApply(clean);
    const groups = new Set(clean.map((r) => r.group_id)).size;
    toast.success(`Applied ${clean.length} passenger${clean.length === 1 ? "" : "s"} across ${groups} ticket${groups === 1 ? "" : "s"}.`);
    setOpen(false);
    reset();
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)} className="gap-2">
        <Users className="w-4 h-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="z-[100] max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="w-5 h-5" /> Bulk AI Scan — Multiple Passengers
            </DialogTitle>
            <DialogDescription>
              Upload several passports / IDs / tickets in one go (or one photo with several documents). AI detects EACH person separately. Review, edit, remove rows, then apply all.
            </DialogDescription>
          </DialogHeader>

          {!rows && (
            <div className="space-y-3 overflow-y-auto pr-1">
              <input
                ref={inputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                capture="environment"
                className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
              />
              <Button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={loading}
                className="w-full h-28 border-dashed border-2 gap-2"
                variant="outline"
              >
                <Upload className="w-5 h-5" />
                Add files (up to {maxFiles})
              </Button>

              {queue.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-2 space-y-1 max-h-56 overflow-y-auto">
                  {queue.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                      <Button type="button" size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => setQueue((q) => q.filter((_, idx) => idx !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button type="button" className="w-full" disabled={!queue.length || loading} onClick={run}>
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning {queue.length} file(s)…</>
                ) : (
                  <><ScanLine className="w-4 h-4 mr-2" /> Extract passengers</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                8 MB per file. Processed in memory only — nothing is stored.
              </p>
            </div>
          )}

          {rows && (
            <div className="flex-1 overflow-hidden flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{rows.length} passenger{rows.length === 1 ? "" : "s"}</Badge>
                <Badge variant="outline">
                  {new Set(rows.map((r) => r.group_id)).size} ticket{new Set(rows.map((r) => r.group_id)).size === 1 ? "" : "s"}
                </Badge>
                <Button type="button" size="sm" variant="outline" className="ml-auto gap-1" onClick={regroup}>
                  Regroup by PNR
                </Button>
                <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addBlank}>
                  <Plus className="w-3.5 h-3.5" /> Add row
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={reset}>
                  <X className="w-3.5 h-3.5 mr-1" /> Rescan
                </Button>
              </div>


              <div className="flex-1 overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr>
                      <th className="p-2 text-left w-10">#</th>
                      {columns.map((c) => (
                        <th key={c.key} className="p-2 text-left font-medium" style={{ minWidth: c.width }}>
                          {c.label}
                        </th>
                      ))}
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t hover:bg-muted/20">
                        <td className="p-2 text-muted-foreground text-xs">{i + 1}</td>
                        {columns.map((c) => (
                          <td key={c.key} className="p-1">
                            <Input
                              value={String(row[c.key] ?? "")}
                              onChange={(e) => updateCell(i, c.key, e.target.value)}
                              className="h-8 text-sm"
                            />
                          </td>
                        ))}
                        <td className="p-1">
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => removeRow(i)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={columns.length + 2} className="p-6 text-center text-muted-foreground text-sm">
                        No records. Click "Add row" or Rescan.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setOpen(false); reset(); }}>
                  Cancel
                </Button>
                <Button type="button" className="flex-1" onClick={apply}>
                  <Check className="w-4 h-4 mr-1" /> Apply {rows.length} row{rows.length === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
