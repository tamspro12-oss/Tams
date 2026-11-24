import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sendEmail, createInvoiceEmailBody } from "@/lib/emailService";
import { fetchAgencySmtpConfigured, useAgency } from "@/hooks/useAgency";
import { useAgencyBranding } from "@/hooks/useAgencyBranding";
import { generateInvoicePDF } from "@/lib/invoiceGenerator";
import { parseSupabaseError } from "@/lib/supabaseErrorHandler";
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
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const { data: agency } = useAgency();
  const { getBrandingAsync } = useAgencyBranding();
  const queryClient = useQueryClient();

  const handleEmailInvoice = async () => {
    if (isSending) return;

    console.log('[EmailInvoiceButton] Validating client email:', {
      clientId: client.id,
      clientName: client.name,
      hasEmail: !!client.email,
      email: client.email
    });

    if (!client.email) {
      console.error('[EmailInvoiceButton] Client email missing');
      toast({
        title: "Email Required",
        description: "Please add an email address for this client first.",
        variant: "destructive",
      });
      return;
    }

    const smtpConfigured = agency?.email
      ? await queryClient.fetchQuery({
        queryKey: ["agency-smtp-configured", agency?.id ?? "anonymous"],
        queryFn: fetchAgencySmtpConfigured,
        staleTime: 10 * 60 * 1000,
      })
      : false;

    console.log('[EmailInvoiceButton] Validating agency SMTP config:', {
      hasEmail: !!agency?.email,
      hasPassword: smtpConfigured
    });

    if (!agency?.email || !smtpConfigured) {
      console.error('[EmailInvoiceButton] Agency SMTP credentials missing');
      toast({
        title: "Email Not Configured",
        description: "Add your Gmail App Password in Settings → Email Integration to send emails.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    console.log('[EmailInvoiceButton] Starting invoice email process...');

    try {
      const branding = await getBrandingAsync();
      // Generate PDF using the professional invoice generator
      const { doc } = await generateInvoicePDF(client, agency, branding);
      const pdfBlob = doc.output('blob');

      // Generate invoice number
      const invoiceNumber = `INV-${client.id?.slice(0, 8).toUpperCase() || 'DRAFT'}`;

      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(pdfBlob);
      const base64Data = await base64Promise;

      const total = Number(client.selling_price) || 0;

      // Create email body
      const emailBody = createInvoiceEmailBody({
        clientName: client.name,
        agencyName: agency.name,
        invoiceNumber,
        amount: total,
      });

      // Send email
      const result = await sendEmail(
        {
          email: agency.email,
          password: "",
          contactEmail: agency.contact_email,
        },
        {
          to: client.email,
          subject: `Invoice ${invoiceNumber} - ${agency.name}`,
          body: emailBody,
          attachments: [
            {
              name: `Invoice_${invoiceNumber}.pdf`,
              data: base64Data,
            },
          ],
          emailType: 'invoice',
          clientId: client.id,
        }
      );

      if (result.success) {
        console.log('[EmailInvoiceButton] ✓ Invoice email sent successfully');
        toast({
          title: "Email Sent",
          description: `Invoice sent to ${client.email}`,
        });
      } else {
        console.warn('[EmailInvoiceButton] Email queued:', result.message);
        toast({
          title: "Email Queued",
          description: result.message,
          variant: "default",
        });
      }
    } catch (error: unknown) {
      console.error('[EmailInvoiceButton] ✗ Send failed:', error);
      const parsed = parseSupabaseError(error, "Failed to send invoice email");
      toast({
        title: "Error",
        description: parsed.userMessage,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={handleEmailInvoice}
            disabled={isSending}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Send Invoice PDF via Email</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
