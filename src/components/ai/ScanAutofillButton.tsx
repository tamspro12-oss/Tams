import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScanLine, Loader2, Upload, Check, X, FileText, Trash2 } from "lucide-react";
import { scanDocument, type DocType } from "@/lib/ai/documentScanner";
import { toast } from "sonner";

interface Props {
  docType?: DocType;
  label?: string;
  onApply: (fields: Record<string, any>) => void;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "default";
  multiple?: boolean;
}

export function ScanAutofillButton({
  docType = "auto",
  label = "Scan & Autofill",
  onApply,
  size = "sm",
  variant = "outline",
  multiple = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<File[]>([]);
  const [fields, setFields] = useState<Record<string, any> | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setQueue([]);
    setFields(null);
    setEdited({});
  };

  const addFiles = (list: FileList | null) => {
    if (!list || !list.length) return;
    const incoming = Array.from(list);
    setQueue((prev) => {
      const merged = multiple ? [...prev, ...incoming] : incoming;
      return merged.slice(0, 5);
    });
  };

  const runScan = async () => {
    if (!queue.length) return;
    setLoading(true);
    setFields(null);
    try {
      const res = await scanDocument(queue, docType);
      const raw = res.fields || {};
      setFields(raw);
      const initial: Record<string, string> = {};
      Object.entries(raw).forEach(([k, v]) => {
        if (typeof v !== "object" || v === null) initial[k] = String(v ?? "");
      });
      setEdited(initial);
      toast.success(`Scanned ${res.fileCount || queue.length} file(s). Review below.`);
    } catch (e: any) {
      toast.error(e?.message || "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (fields) {
      const merged: Record<string, any> = { ...fields, ...edited };
      onApply(merged);
      toast.success("Fields applied. Review and save.");
    }
    setOpen(false);
    reset();
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <ScanLine className="w-4 h-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="z-[100] w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="w-5 h-5" /> AI Document Scan
            </DialogTitle>
            <DialogDescription>
              Upload passport, ID (front & back), visa, ticket, or invoice. JPG / PNG / PDF. AI extracts fields — you review before applying. Files are processed in memory only.
            </DialogDescription>
          </DialogHeader>

          {!fields && (
            <div className="space-y-3">
              <input
                ref={inputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple={multiple}
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              <Button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={loading}
                className="w-full h-24 border-dashed border-2 gap-2"
                variant="outline"
              >
                <Upload className="w-5 h-5" />
                {multiple ? "Add files (up to 5)" : "Select file"}
              </Button>

              {queue.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-2 space-y-1">
                  {queue.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => setQueue((q) => q.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                className="w-full"
                disabled={!queue.length || loading}
                onClick={runScan}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning…</>
                ) : (
                  <><ScanLine className="w-4 h-4 mr-2" /> Scan {queue.length || ""} file{queue.length === 1 ? "" : "s"}</>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Max 5 files, 8 MB each, 15 MB total. Nothing is stored.
              </p>
            </div>
          )}

          {fields && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3 max-h-72 overflow-y-auto text-sm space-y-2">
                {Object.entries(fields).map(([k, v]) => {
                  const isObj = typeof v === "object" && v !== null;
                  return (
                    <div key={k} className="space-y-1 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                      <label className="text-xs font-medium capitalize text-muted-foreground">
                        {k.replace(/_/g, " ")}
                      </label>
                      {isObj ? (
                        <pre className="text-xs bg-background rounded p-2 overflow-x-auto">
                          {JSON.stringify(v, null, 2)}
                        </pre>
                      ) : (
                        <Input
                          value={edited[k] ?? ""}
                          onChange={(e) => setEdited((prev) => ({ ...prev, [k]: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={reset}>
                  <X className="w-4 h-4 mr-1" /> Rescan
                </Button>
                <Button type="button" className="flex-1" onClick={apply}>
                  <Check className="w-4 h-4 mr-1" /> Apply to form
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
