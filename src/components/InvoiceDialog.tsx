import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Download, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateInvoicePDF } from "@/lib/invoiceGenerator";
import { useAgency } from "@/hooks/useAgency";
import { InvoicePreviewDialog } from "./InvoicePreviewDialog";

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedClient?: any;
}

export function InvoiceDialog({ open, onOpenChange, preSelectedClient }: InvoiceDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState("");
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const { toast } = useToast();
  const { data: agency } = useAgency();

  const handleGenerateInvoice = async (client: any) => {
    if (!agency) {
      toast({
        title: "Error",
        description: "Agency information not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const { blobUrl, filename, doc } = await generateInvoicePDF(client, agency);
      setPdfUrl(blobUrl);
      setPdfFilename(filename);
      setPdfDoc(doc);
      setShowPreview(true);
      toast({
        title: "Success",
        description: "Invoice generated successfully",
      });
    } catch (error) {
      console.error('Invoice generation error:', error);
      toast({
        title: "Error",
        description: "Failed to generate invoice",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    if (pdfDoc && pdfFilename) {
      pdfDoc.save(pdfFilename);
      toast({
        title: "Downloaded",
        description: "Invoice PDF has been downloaded",
      });
    }
  };

  // Auto-generate invoice if preSelectedClient is provided
  useEffect(() => {
    if (open && preSelectedClient && agency) {
      handleGenerateInvoice(preSelectedClient);
    }
  }, [open, preSelectedClient, agency]);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["invoice-clients", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      
      const { data } = await supabase
        .from("clients")
        .select("*")
        .or(`name.ilike.%${searchQuery}%,passport_number.ilike.%${searchQuery}%`)
        .order("created_at", { ascending: false });
      
      return data || [];
    },
    enabled: searchQuery.length > 0,
  });

  return (
    <>
      {/* Only show search dialog if no preSelectedClient */}
      {!preSelectedClient && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Generate Invoice</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search by Name or Passport Number</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    id="search"
                    placeholder="Enter client name or passport..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {isLoading && <div className="text-center py-4">Searching...</div>}

              {!isLoading && searchQuery && clients.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  No clients found matching "{searchQuery}"
                </div>
              )}

              {clients.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {clients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{client.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {client.passport_number && `Passport: ${client.passport_number}`}
                          {client.passport_number && client.travel_type && " • "}
                          {client.travel_type && `Service: ${client.travel_type}`}
                        </div>
                        <div className="text-sm font-medium mt-1">
                          Amount: ₨ {client.selling_price ? Number(client.selling_price).toLocaleString() : "0"}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleGenerateInvoice(client)}
                        className="gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Generate PDF
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <InvoicePreviewDialog
        open={showPreview}
        onOpenChange={(isOpen) => {
          setShowPreview(isOpen);
          if (!isOpen) {
            onOpenChange(false);
          }
        }}
        pdfUrl={pdfUrl}
        filename={pdfFilename}
        onDownload={handleDownload}
      />
    </>
  );
}
