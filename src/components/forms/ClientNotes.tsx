import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText } from "lucide-react";

interface ClientNotesProps {
  notes: string;
  setNotes: (notes: string) => void;
}

export function ClientNotes({ notes, setNotes }: ClientNotesProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Additional Notes</h3>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional information about this booking..."
          rows={5}
          maxLength={5000}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground text-right">
          {notes.length} / 5000 characters
        </p>
      </div>
    </div>
  );
}
