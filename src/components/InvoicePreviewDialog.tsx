import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface InvoicePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string | null;
  filename: string;
  onDownload: () => void;
}

export function InvoicePreviewDialog({ 
  open, 
  onOpenChange, 
  pdfUrl, 
  filename,
  onDownload 
}: InvoicePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Invoice Preview</DialogTitle>
          <DialogDescription>Review the invoice before downloading</DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden px-6">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-[60vh] border rounded-lg"
              title="Invoice Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-[60vh] bg-muted rounded-lg">
              <p className="text-muted-foreground">Loading invoice...</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          <Button onClick={onDownload} className="gap-2">
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
