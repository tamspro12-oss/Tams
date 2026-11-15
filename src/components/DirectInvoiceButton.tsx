import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAgency } from "@/hooks/useAgency";
import { generateInvoicePDF } from "@/lib/invoiceGenerator";
import { parseSupabaseError } from "@/lib/supabaseErrorHandler";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DirectInvoiceButtonProps {
  client: any;
}

export function DirectInvoiceButton({ client }: DirectInvoiceButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const { data: agency } = useAgency();

  const handleGenerateInvoice = async () => {
    if (isGenerating) return;
    
    if (!agency) {
      toast({
        title: "Error",
        description: "Agency information not available",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const { blobUrl, filename, doc } = await generateInvoicePDF(client, agency);
      
      // Direct download
      doc.save(filename);
      
      // Clean up blob URL
      URL.revokeObjectURL(blobUrl);
      
      toast({
        title: "Invoice Generated",
        description: `Downloaded ${filename}`,
      });
    } catch (error: unknown) {
      console.error('[DirectInvoiceButton] Generation failed:', error);
      const parsed = parseSupabaseError(error, "Failed to generate invoice");
      toast({
        title: "Error",
        description: parsed.userMessage,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleGenerateInvoice}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Download Invoice PDF</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}