import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sendEmail, createReminderEmailBody } from "@/lib/emailService";
import { useAgency } from "@/hooks/useAgency";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";

interface EmailReminderButtonProps {
  client: any;
  type: 'flight' | 'payment' | 'umrah';
}

export function EmailReminderButton({ client, type }: EmailReminderButtonProps) {
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const { data: agency } = useAgency();

  const getTooltipText = () => {
    switch (type) {
      case 'flight':
        return 'Send Flight Reminder';
      case 'payment':
        return 'Send Payment Reminder';
      case 'umrah':
        return 'Send Umrah Reminder';
      default:
        return 'Send Reminder';
    }
  };

  const handleSendReminder = async () => {
    if (isSending) return;
    
    console.log('[EmailReminderButton] Validating client email:', { 
      clientId: client.id, 
      clientName: client.name,
      hasEmail: !!client.email,
      email: client.email 
    });

    if (!client.email) {
      console.error('[EmailReminderButton] Client email missing');
      toast({
        title: "Email Required",
        description: "Please add an email address for this client first.",
        variant: "destructive",
      });
      return;
    }

    console.log('[EmailReminderButton] Validating agency SMTP config:', {
      hasEmail: !!agency?.email,
      hasPassword: !!agency?.smtp_configured
    });

    if (!agency?.email || !agency?.smtp_configured) {
      console.error('[EmailReminderButton] Agency SMTP credentials missing');
      toast({
        title: "Email Not Configured",
        description: "Please configure your agency email in Settings > Agency Branding.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSending(true);
    console.log('[EmailReminderButton] Starting reminder send process...');
    try {
      const total = Number(client.selling_price) || 0;
      const paid = Number(client.amount_paid) || 0;
      const balance = total - paid;

      const emailBody = createReminderEmailBody({
        clientName: client.name,
        agencyName: agency.name,
        type,
        details: {
          flightDate: client.flight_date ? format(new Date(client.flight_date), 'MMMM dd, yyyy') : undefined,
          destination: client.destination,
          pnr: client.pnr,
          amount: type === 'payment' ? balance : undefined,
          dueDate: client.remaining_payment_date ? format(new Date(client.remaining_payment_date), 'MMMM dd, yyyy') : undefined,
        },
      });

      const subject = type === 'flight' 
        ? `Flight Reminder - ${agency.name}`
        : type === 'payment'
        ? `Payment Reminder - ${agency.name}`
        : `Umrah Reminder - ${agency.name}`;

      const result = await sendEmail(
        {
          email: agency.email,
          password: "",
          contactEmail: agency.contact_email,
        },
        {
          to: client.email,
          subject,
          body: emailBody,
        }
      );

      if (result.success) {
        console.log('[EmailReminderButton] ✓ Reminder sent successfully');
        toast({
          title: "Reminder Sent",
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} reminder sent to ${client.email}`,
        });
      } else {
        console.warn('[EmailReminderButton] Email queued:', result.message);
        toast({
          title: "Email Queued",
          description: result.message,
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error('[EmailReminderButton] ✗ Send failed:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send reminder email",
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
            className="h-7 w-7 rounded-full"
            onClick={handleSendReminder}
            disabled={isSending}
          >
            {isSending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Mail className="h-3 w-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
