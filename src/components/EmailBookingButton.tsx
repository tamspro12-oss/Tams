import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateBookingConfirmationPDF } from "@/lib/bookingPdfGenerator";
import { sendEmail, createBookingEmailBody } from "@/lib/emailService";
import { useAgency } from "@/hooks/useAgency";
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
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const { data: agency } = useAgency();

  const handleEmailBooking = async () => {
    if (isSending) return;
    
    console.log('[EmailBookingButton] Validating client email:', { 
      clientId: client.id, 
      clientName: client.name,
      hasEmail: !!client.email,
      email: client.email 
    });

    if (!client.email) {
      console.error('[EmailBookingButton] Client email missing');
      toast({
        title: "Email Required",
        description: "Please add an email address for this client first.",
        variant: "destructive",
      });
      return;
    }

    console.log('[EmailBookingButton] Validating agency SMTP config:', {
      hasEmail: !!agency?.email,
      hasPassword: !!agency?.smtp_configured
    });

    if (!agency?.email || !agency?.smtp_configured) {
      console.error('[EmailBookingButton] Agency SMTP credentials missing');
      toast({
        title: "Email Not Configured",
        description: "Please configure your agency email in Settings > Agency Branding.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSending(true);
    console.log('[EmailBookingButton] Starting booking email process...');
    try {
      // Load invoice template
      const template = localStorage.getItem('invoice_template');
      const parsedTemplate = template ? JSON.parse(template) : {};
      
      // Generate PDF and get blob (correct parameter order: client, vendor, template)
      const pdfResult = await generateBookingConfirmationPDF(client, vendor, parsedTemplate);
      const pdfBlob = pdfResult.doc.output('blob');
      
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

      // Create email body
      const emailBody = createBookingEmailBody({
        clientName: client.name,
        agencyName: agency.name,
        pnr: client.pnr,
        destination: client.destination,
        flightDate: client.flight_date ? new Date(client.flight_date).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }) : undefined,
        travelType: client.travel_type,
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
          subject: `Booking Confirmation - ${agency.name}`,
          body: emailBody,
          attachments: [
            {
              name: `Booking_${client.name}_${client.pnr || 'Confirmation'}.pdf`,
              data: base64Data,
            },
          ],
          emailType: 'booking',
          clientId: client.id,
        }
      );

      if (result.success) {
        console.log('[EmailBookingButton] ✓ Booking email sent successfully');
        toast({
          title: "Email Sent",
          description: `Booking confirmation sent to ${client.email}`,
        });
      } else {
        console.warn('[EmailBookingButton] Email queued:', result.message);
        toast({
          title: "Email Queued",
          description: result.message,
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error('[EmailBookingButton] ✗ Send failed:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send booking email",
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
            onClick={handleEmailBooking}
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
          <p>Send Booking PDF via Email</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
