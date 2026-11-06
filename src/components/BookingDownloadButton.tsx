import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateBookingConfirmationPDF } from "@/lib/bookingPdfGenerator";
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

  const handleDownload = async () => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    try {
      // Load invoice template for agency branding
      const templateData = localStorage.getItem("invoice_template");
      if (!templateData) {
        toast({
          title: "Template not configured",
          description: "Please set up your invoice template in Settings to include agency branding",
          variant: "destructive",
        });
        setIsGenerating(false);
        return;
      }

      const template = JSON.parse(templateData);

      toast({
        title: "Generating booking confirmation...",
        description: "Please wait",
      });

      // Generate booking confirmation PDF
      const { blobUrl, filename } = await generateBookingConfirmationPDF(
        client,
        vendor || null,
        template
      );

      // Download the PDF
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

      toast({
        title: "Booking confirmation downloaded",
        description: `${filename} has been saved to your device`,
      });
    } catch (error: any) {
      console.error("Failed to generate booking confirmation:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate booking confirmation",
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