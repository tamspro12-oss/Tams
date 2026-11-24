import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateBookingConfirmationPDF } from "@/lib/bookingPdfGenerator";
import { openPdfInNewTab } from "@/lib/pdf/openPdfInNewTab";
import { parseSupabaseError } from "@/lib/supabaseErrorHandler";
import { useAgencyBranding } from "@/hooks/useAgencyBranding";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BookingDownloadButtonProps {
  client: any;
  vendor?: any;
}

export function BookingDownloadButton({ client, vendor }: BookingDownloadButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const { getBrandingAsync } = useAgencyBranding();

  const handleDownload = async () => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    try {
      const branding = await getBrandingAsync();

      toast({
        title: "Generating booking confirmation...",
        description: "Please wait",
      });

      // Generate booking confirmation PDF and open in a new tab
      const { blobUrl, filename, doc } = await generateBookingConfirmationPDF(
        client,
        vendor || null,
        branding
      );

      openPdfInNewTab(blobUrl || doc, filename);

      toast({
        title: "Booking confirmation ready",
        description: `Opened ${filename} in a new tab`,
      });
    } catch (error: unknown) {
      console.error("Failed to generate booking confirmation:", error);
      const parsed = parseSupabaseError(error, "Failed to generate booking confirmation");
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
            onClick={handleDownload}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Download Booking PDF</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}