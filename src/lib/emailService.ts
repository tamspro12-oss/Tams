// Professional email service using Resend via Edge Function
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";

export interface EmailAttachment {
  name: string;
  data: string; // base64 encoded
}

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
  emailType?: string;
  clientId?: string;
}

export interface AgencyEmailConfig {
  email: string;
  password: string;
  contactEmail?: string;
}

let emailQueue: EmailOptions[] = [];

// Send email function using Edge Function
export const sendEmail = async (
  agencyConfig: AgencyEmailConfig,
  options: EmailOptions
): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('[Email Service] Validating email configuration...');
    
    // Validate agency config
    if (!agencyConfig.email) {
      console.error('[Email Service] Agency email missing');
      throw new Error('Agency email not configured. Please add it in Settings > Agency Branding.');
    }

    // Validate recipient email
    if (!options.to) {
      console.error('[Email Service] Recipient email missing');
      throw new Error('Recipient email address is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(options.to)) {
      console.error('[Email Service] Invalid recipient email format:', options.to);
      throw new Error('Invalid recipient email address format');
    }

    console.log('[Email Service] Email validation passed:', {
      to: options.to,
      from: agencyConfig.contactEmail || agencyConfig.email,
      hasAttachments: !!options.attachments?.length
    });

    // Get user and agency info for logging
    const { data: { user } } = await supabase.auth.getUser();
    const agencyId = await getAuthenticatedAgencyId();

    // Check if online
    if (!navigator.onLine) {
      console.warn('[Email Service] Offline - queueing email');
      queueEmail(options);
      
      // Log as queued
      if (user && agencyId) {
        await supabase.from('email_logs').insert({
          agency_id: agencyId,
          sent_by: user.id,
          recipient_email: options.to,
          subject: options.subject,
          email_type: options.emailType || 'general',
          status: 'queued',
          client_id: options.clientId || null,
        });
      }
      
      return {
        success: false,
        message: 'Offline - Email queued and will be sent when connection is restored'
      };
    }

    console.log('[Email Service] Sending via edge function...');
    
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: options.to,
        subject: options.subject,
        body: options.body,
        attachments: options.attachments,
        fromName: agencyConfig.contactEmail ? undefined : 'TAMS',
      }
    });

    if (error) {
      console.error('[Email Service] Edge function error:', error);
      
      // Log failure
      if (user && agencyId) {
        await supabase.from('email_logs').insert({
          agency_id: agencyId,
          sent_by: user.id,
          recipient_email: options.to,
          subject: options.subject,
          email_type: options.emailType || 'general',
          status: 'failed',
          error_message: error.message,
          client_id: options.clientId || null,
        });
      }
      
      // Check for Gmail authentication errors
      const errorMsg = error.message || 'Failed to send email';
      if (errorMsg.includes('535') || errorMsg.includes('Username and Password not accepted')) {
        throw new Error('Gmail authentication failed. Please verify:\n1. You created a Gmail App Password (16 characters)\n2. 2-Step Verification is enabled on your Gmail\n3. The password is copied correctly without spaces\n\nClick "How to Create App Password?" in Settings > Agency Branding for help.');
      }
      
      throw new Error(errorMsg);
    }

    if (!data.success) {
      console.error('[Email Service] Email sending failed:', data.error);
      
      // Log failure
      if (user && agencyId) {
        await supabase.from('email_logs').insert({
          agency_id: agencyId,
          sent_by: user.id,
          recipient_email: options.to,
          subject: options.subject,
          email_type: options.emailType || 'general',
          status: 'failed',
          error_message: data.error,
          client_id: options.clientId || null,
        });
      }
      
      throw new Error(data.error || 'Failed to send email');
    }

    // Log success
    if (user && agencyId) {
      await supabase.from('email_logs').insert({
        agency_id: agencyId,
        sent_by: user.id,
        recipient_email: options.to,
        subject: options.subject,
        email_type: options.emailType || 'general',
        status: 'success',
        client_id: options.clientId || null,
      });
    }

    console.log('[Email Service] ✓ Email sent successfully to:', options.to);
    return { success: true, message: 'Email sent successfully' };

  } catch (error: any) {
    console.error('[Email Service] ✗ Email send failed:', {
      error: error.message,
      to: options.to,
      from: agencyConfig.email
    });
    queueEmail(options);
    return {
      success: false,
      message: error.message || 'Failed to send email. Email queued for retry.'
    };
  }
};

// Queue management
const queueEmail = (options: EmailOptions) => {
  emailQueue.push(options);
  localStorage.setItem('email_queue', JSON.stringify(emailQueue));
};

export const processEmailQueue = async (agencyConfig: AgencyEmailConfig) => {
  const stored = localStorage.getItem('email_queue');
  if (stored) {
    emailQueue = JSON.parse(stored);
  }

  if (!navigator.onLine || emailQueue.length === 0) return;

  const queue = [...emailQueue];
  emailQueue = [];
  localStorage.removeItem('email_queue');

  for (const email of queue) {
    try {
      await sendEmail(agencyConfig, email);
    } catch (error) {
      console.error('Failed to send queued email:', error);
    }
  }
};

// Email templates
export const createBookingEmailBody = (data: {
  clientName: string;
  agencyName: string;
  pnr?: string;
  destination?: string;
  flightDate?: string;
  travelType?: string;
}) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .detail { margin: 10px 0; padding: 10px; background: white; border-radius: 5px; }
        .label { font-weight: bold; color: #667eea; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✈️ Booking Confirmation</h1>
        </div>
        <div class="content">
          <p>Dear <strong>${data.clientName}</strong>,</p>
          <p>Thank you for choosing <strong>${data.agencyName}</strong>. Your booking details are attached.</p>
          ${data.pnr ? `<div class="detail"><span class="label">PNR:</span> ${data.pnr}</div>` : ''}
          ${data.destination ? `<div class="detail"><span class="label">Destination:</span> ${data.destination}</div>` : ''}
          ${data.travelType ? `<div class="detail"><span class="label">Travel Type:</span> ${data.travelType}</div>` : ''}
          ${data.flightDate ? `<div class="detail"><span class="label">Flight Date:</span> ${data.flightDate}</div>` : ''}
          <p style="margin-top: 20px;">Please review the attached PDF for complete booking information.</p>
          <p>Have a safe journey!</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${data.agencyName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const createInvoiceEmailBody = (data: {
  clientName: string;
  agencyName: string;
  invoiceNumber?: string;
  amount?: number;
}) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .detail { margin: 10px 0; padding: 10px; background: white; border-radius: 5px; }
        .label { font-weight: bold; color: #10b981; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📄 Invoice</h1>
        </div>
        <div class="content">
          <p>Dear <strong>${data.clientName}</strong>,</p>
          <p>Please find your invoice from <strong>${data.agencyName}</strong> attached to this email.</p>
          ${data.invoiceNumber ? `<div class="detail"><span class="label">Invoice Number:</span> ${data.invoiceNumber}</div>` : ''}
          ${data.amount ? `<div class="detail"><span class="label">Amount:</span> PKR ${data.amount.toLocaleString()}</div>` : ''}
          <p style="margin-top: 20px;">If you have any questions about this invoice, please don't hesitate to contact us.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${data.agencyName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const createReminderEmailBody = (data: {
  clientName: string;
  agencyName: string;
  type: 'flight' | 'payment' | 'umrah';
  details: {
    flightDate?: string;
    destination?: string;
    pnr?: string;
    amount?: number;
    dueDate?: string;
  };
}) => {
  const typeConfig = {
    flight: { emoji: '✈️', title: 'Flight Reminder', color: '#3b82f6' },
    payment: { emoji: '💳', title: 'Payment Reminder', color: '#f59e0b' },
    umrah: { emoji: '🕋', title: 'Umrah Reminder', color: '#8b5cf6' }
  };

  const config = typeConfig[data.type];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${config.color}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .detail { margin: 10px 0; padding: 10px; background: white; border-radius: 5px; }
        .label { font-weight: bold; color: ${config.color}; }
        .checklist { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .checklist-item { margin: 8px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${config.emoji} ${config.title}</h1>
        </div>
        <div class="content">
          <p>Dear <strong>${data.clientName}</strong>,</p>
          ${data.type === 'flight' ? `
            <p>This is a reminder about your upcoming flight with <strong>${data.agencyName}</strong>:</p>
            ${data.details.flightDate ? `<div class="detail"><span class="label">Flight Date:</span> ${data.details.flightDate}</div>` : ''}
            ${data.details.destination ? `<div class="detail"><span class="label">Destination:</span> ${data.details.destination}</div>` : ''}
            ${data.details.pnr ? `<div class="detail"><span class="label">PNR:</span> ${data.details.pnr}</div>` : ''}
            <div class="checklist">
              <strong>Pre-Flight Checklist:</strong>
              <div class="checklist-item">✓ Arrive at airport 3 hours before departure</div>
              <div class="checklist-item">✓ Carry your passport and documents</div>
              <div class="checklist-item">✓ Check-in online if available</div>
              <div class="checklist-item">✓ Verify baggage allowance</div>
            </div>
          ` : data.type === 'payment' ? `
            <p>This is a reminder about your pending payment with <strong>${data.agencyName}</strong>:</p>
            ${data.details.amount ? `<div class="detail"><span class="label">Amount Due:</span> PKR ${data.details.amount.toLocaleString()}</div>` : ''}
            ${data.details.dueDate ? `<div class="detail"><span class="label">Due Date:</span> ${data.details.dueDate}</div>` : ''}
            <p style="margin-top: 15px;">Please arrange payment at your earliest convenience to avoid any inconvenience.</p>
          ` : `
            <p>This is a reminder about your upcoming Umrah journey with <strong>${data.agencyName}</strong>:</p>
            ${data.details.flightDate ? `<div class="detail"><span class="label">Departure Date:</span> ${data.details.flightDate}</div>` : ''}
            <div class="checklist">
              <strong>Pre-Departure Checklist:</strong>
              <div class="checklist-item">✓ Passport valid for at least 6 months</div>
              <div class="checklist-item">✓ Meningitis vaccination certificate</div>
              <div class="checklist-item">✓ Ihram clothing prepared</div>
              <div class="checklist-item">✓ Travel insurance confirmed</div>
            </div>
          `}
          <p style="margin-top: 20px;">If you have any questions, please contact us.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${data.agencyName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Initialize email queue processing on app load.
// SMTP credentials are fetched server-side inside the send-email edge function
// (from the authenticated user's agency), so no client-side password cache is
// needed or safe. We just retry the queue with a placeholder config; the edge
// function ignores client-supplied credentials.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processEmailQueue({ email: '', password: '' } as AgencyEmailConfig);
  });
}

