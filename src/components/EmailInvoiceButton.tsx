import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { createInvoiceEmailBody, jsPdfDocToBase64 } from "@/lib/emailService";
import { useAgency } from "@/hooks/useAgency";
import { useAgencyBranding } from "@/hooks/useAgencyBranding";
import { generateInvoicePDF } from "@/lib/invoiceGenerator";
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

interface EmailInvoiceButtonProps {
  client: any;
}

export function EmailInvoiceButton({ client }: EmailInvoiceButtonProps) {
  const [emailPayload, setEmailPayload] = useState<DocumentEmailPayload | null>(null);
  const { data: agency } = useAgency();
  const { getBrandingAsync } = useAgencyBranding();

  const handleOpenDialog = () => {
    const invoiceNumber = `INV-${client.id?.slice(0, 8).toUpperCase() || "DRAFT"}`;
    const total = Number(client.selling_price) || 0;
    setEmailPayload({
      documentLabel: `Invoice ${invoiceNumber} — ${client.name || "Client"}`,
      emailType: "invoice",
      defaultRecipientEmail: client.email || "",
      recipientName: client.name || "Client",
      clientId: client.id,
      subject: `Invoice ${invoiceNumber}${agency?.name ? ` — ${agency.name}` : ""}`,
      attachmentFileName: `Invoice_${invoiceNumber}.pdf`,
      buildPdfAndBody: async (agencyName) => {
        const branding = await getBrandingAsync();
        const { doc } = await generateInvoicePDF(client, agency, branding);
        return {
          pdfBase64: jsPdfDocToBase64(doc),
          htmlBody: createInvoiceEmailBody({
            clientName: client.name || "Client",
            agencyName,
            invoiceNumber,
            amount: total,
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
              aria-label="Send Invoice by email"
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
