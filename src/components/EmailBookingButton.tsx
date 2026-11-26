import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { generateBookingConfirmationPDF } from "@/lib/bookingPdfGenerator";
import { createBookingEmailBody, jsPdfDocToBase64 } from "@/lib/emailService";
import { useAgency } from "@/hooks/useAgency";
import { useAgencyBranding } from "@/hooks/useAgencyBranding";
import {
  SendDocumentEmailDialog,
  type DocumentEmailPayload,
} from "@/components/SendDocumentEmailDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EmailBookingButtonProps {
  client: any;
  vendor?: any;
}

export function EmailBookingButton({ client, vendor }: EmailBookingButtonProps) {
  const [emailPayload, setEmailPayload] = useState<DocumentEmailPayload | null>(null);
  const { data: agency } = useAgency();
  const { getBrandingAsync } = useAgencyBranding();

  const handleOpenDialog = () => {
    const safeSlug = String(client.pnr || client.name || "Confirmation").replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    );
    setEmailPayload({
      documentLabel: `Booking Confirmation — ${client.name || "Traveler"}`,
      emailType: "booking",
      defaultRecipientEmail: client.email || "",
      recipientName: client.name || "Traveler",
      clientId: client.id,
      subject: `Booking Confirmation${agency?.name ? ` — ${agency.name}` : ""}`,
      attachmentFileName: `Booking_${safeSlug}.pdf`,
      buildPdfAndBody: async (agencyName) => {
        const branding = await getBrandingAsync();
        const pdfResult = await generateBookingConfirmationPDF(client, vendor, branding);
        return {
          pdfBase64: jsPdfDocToBase64(pdfResult.doc),
          htmlBody: createBookingEmailBody({
            clientName: client.name || "Traveler",
            agencyName,
            pnr: client.pnr || undefined,
            destination: client.destination || undefined,
            flightDate: client.flight_date
              ? new Date(client.flight_date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : undefined,
            travelType: client.travel_type || undefined,
          }),
        };
      },
    });
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={handleOpenDialog}
              aria-label="Send Booking Confirmation by email"
            >
              <Mail className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Send by email</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <SendDocumentEmailDialog
        payload={emailPayload}
        onClose={() => setEmailPayload(null)}
      />
    </>
  );
}
