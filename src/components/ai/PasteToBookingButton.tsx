import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import { parseBookingText } from "@/lib/ai/documentScanner";
import { toast } from "sonner";

interface Props {
  onApply: (fields: Record<string, any>) => void;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "default";
}

/**
 * Paste an airline confirmation email / GDS PNR / WhatsApp message
 * and AI extracts booking fields into the current form.
 * Never writes to the DB — only pre-fills fields for user review.
 */
export function PasteToBookingButton({ onApply, label = "Paste email / message", size = "sm", variant = "outline" }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<Record<string, any> | null>(null);

  const reset = () => { setText(""); setFields(null); };

  const run = async () => {
    if (text.trim().length < 5) {
      toast.error("Paste the message first.");
      return;
    }
    setLoading(true);
    try {
      const res = await parseBookingText(text);
      setFields(res.fields || {});
      toast.success("Parsed. Review the fields below.");
    } catch (e: any) {
      toast.error(e?.message || "Parse failed");
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (fields) {
      onApply(fields);
      toast.success("Fields applied. Review and save.");
    }
    setOpen(false);
    reset();
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} className="gap-2" onClick={() => setOpen(true)}>
        <Sparkles className="w-4 h-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="z-[100] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> AI Booking Assistant
            </DialogTitle>
            <DialogDescription>
              Paste an airline confirmation email, GDS PNR, or WhatsApp message. AI extracts PNR, flight, dates, passengers, and fare into this form. Nothing is saved automatically.
            </DialogDescription>
          </DialogHeader>

          {!fields && (
            <div className="space-y-3">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"Paste text here, e.g.\n\nBooking Confirmation PK-786\nPNR: ABCXYZ\nLahore (LHE) → Jeddah (JED)\n12 Aug 2026 09:35 → 12:20\nPassenger: Ahmed Khan (Adult)\nFare: PKR 145,000"}
                className="min-h-[180px] text-sm"
                disabled={loading}
              />
              <Button type="button" className="w-full" disabled={loading || text.trim().length < 5} onClick={run}>
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Parsing…</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Parse with AI</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Works with any language. Max 30 000 characters.
              </p>
            </div>
          )}

          {fields && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3 max-h-72 overflow-y-auto text-sm space-y-1">
                {Object.entries(fields).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 border-b border-border/40 py-1 last:border-0">
                    <span className="font-medium capitalize text-muted-foreground">{k.replace(/_/g, " ")}</span>
                    <span className="text-right break-all">
                      {typeof v === "object" ? JSON.stringify(v) : String(v || "—")}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={reset}>
                  <X className="w-4 h-4 mr-1" /> Start over
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
