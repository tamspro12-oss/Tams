// Agency Email Service — Strictly per-agency Gmail via Supabase Edge Function (`send-email`).
// Never falls back to TAMS Pro's system email (tamspro12@gmail.com).
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";
import { toFriendlyMessage } from "@/lib/friendlyError";

export const RESERVED_SYSTEM_EMAIL = "tamspro12@gmail.com";
export const CONNECT_GMAIL_PROMPT = "Connect your Gmail in Settings";

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
  password?: string;
  contactEmail?: string;
  agencyName?: string;
}

export interface AgencyGmailStatus {
  connected: boolean;
  gmailAddress: string;
  maskedPassword: string;
  updatedAt: string | null;
}

let emailQueue: EmailOptions[] = [];

export function jsPdfDocToBase64(doc: { output: (type: "datauristring") => string }): string {
  const dataUri = doc.output("datauristring");
  const idx = dataUri.indexOf(",");
  return idx >= 0 ? dataUri.slice(idx + 1) : dataUri;
}

function escapeHtml(raw: string): string {
  return String(raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Queries the logged-in agency's Gmail connection status without ever returning the password.
 */
export async function fetchAgencyGmailStatus(): Promise<AgencyGmailStatus> {
  try {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { action: "status" },
    });
    if (!error && data && typeof data.connected === "boolean") {
      return {
        connected: Boolean(data.connected),
        gmailAddress: typeof data.gmailAddress === "string" ? data.gmailAddress : "",
        maskedPassword:
          typeof data.maskedPassword === "string"
            ? data.maskedPassword
            : data.connected
              ? "•••• •••• •••• ••••"
              : "",
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
      };
    }
  } catch {
    // Fall back to SQL RPC below
  }

  try {
    const { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
      "get_my_agency_email_status"
    );
    if (!rpcErr && rpcData && typeof rpcData === "object") {
      const connected = Boolean(rpcData.connected);
      return {
        connected,
        gmailAddress: typeof rpcData.gmailAddress === "string" ? rpcData.gmailAddress : "",
        maskedPassword: connected
          ? typeof rpcData.maskedPassword === "string" && rpcData.maskedPassword
            ? rpcData.maskedPassword
            : "•••• •••• •••• ••••"
          : "",
        updatedAt: typeof rpcData.updatedAt === "string" ? rpcData.updatedAt : null,
      };
    }
  } catch {
    // Fall back to agency_smtp_configured RPC
  }

  try {
    const agencyId = await getAuthenticatedAgencyId();
    if (!agencyId) {
      return { connected: false, gmailAddress: "", maskedPassword: "", updatedAt: null };
    }
    const [{ data: configured }, { data: agencyRow }] = await Promise.all([
      supabase.rpc("agency_smtp_configured"),
      supabase.from("agencies").select("email").eq("id", agencyId).maybeSingle(),
    ]);
    const rawEmail = (agencyRow?.email || "").trim();
    const validAgencyEmail =
      Boolean(rawEmail) && rawEmail.toLowerCase() !== RESERVED_SYSTEM_EMAIL;
    const isConnected = Boolean(configured && validAgencyEmail);
    return {
      connected: isConnected,
      gmailAddress: validAgencyEmail ? rawEmail : "",
      maskedPassword: isConnected ? "•••• •••• •••• ••••" : "",
      updatedAt: null,
    };
  } catch {
    return { connected: false, gmailAddress: "", maskedPassword: "", updatedAt: null };
  }
}

/**
 * Encrypts and saves the agency's own Gmail address + 16-char App Password server-side.
 */
export async function saveAgencyGmailCredentials(input: {
  gmailAddress: string;
  appPassword?: string;
}): Promise<{ ok: boolean; error?: string; status?: AgencyGmailStatus }> {
  const cleanEmail = input.gmailAddress.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: "Please enter a valid Gmail address." };
  }
  if (cleanEmail === RESERVED_SYSTEM_EMAIL) {
    return {
      ok: false,
      error: "Please enter your agency's own Gmail address.",
    };
  }

  const cleanPwd = (input.appPassword || "").replace(/\s+/g, "");
  if (cleanPwd && !/^[a-zA-Z0-9]{16}$/.test(cleanPwd)) {
    return {
      ok: false,
      error: "Gmail App Password must be 16 letters/numbers (spaces are removed automatically).",
    };
  }

  // 1. Primary path: Edge Function AES-256-GCM encryption
  try {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        action: "save",
        gmailAddress: cleanEmail,
        appPassword: cleanPwd || undefined,
      },
    });

    if (!error && data?.success) {
      return {
        ok: true,
        status: {
          connected: true,
          gmailAddress: data.gmailAddress || cleanEmail,
          maskedPassword: data.maskedPassword || "•••• •••• •••• ••••",
          updatedAt: new Date().toISOString(),
        },
      };
    }

    if (data?.error && !String(data.error).toLowerCase().includes("missing required fields")) {
      return { ok: false, error: String(data.error) };
    }
  } catch {
    // Try encrypted PostgreSQL RPC fallback below
  }

  // 2. Encrypted PostgreSQL RPC fallback (`pgcrypto`)
  try {
    const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc(
      "save_agency_email_credentials",
      {
        p_gmail_address: cleanEmail,
        p_app_password: cleanPwd || null,
      }
    );
    if (!rpcErr && rpcRes) {
      return {
        ok: true,
        status: {
          connected: true,
          gmailAddress: rpcRes.gmailAddress || cleanEmail,
          maskedPassword: rpcRes.maskedPassword || "•••• •••• •••• ••••",
          updatedAt: new Date().toISOString(),
        },
      };
    }
    if (rpcErr) {
      return {
        ok: false,
        error: toFriendlyMessage(rpcErr, "Could not save Gmail settings."),
      };
    }
  } catch (err) {
    return {
      ok: false,
      error: toFriendlyMessage(err, "Could not save Gmail settings."),
    };
  }

  return { ok: false, error: "Could not save Gmail settings. Please try again." };
}

/**
 * Sends a test email using ONLY the logged-in agency's own connected Gmail.
 */
export async function sendAgencyTestEmail(recipientEmail?: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const status = await fetchAgencyGmailStatus();
    if (!status.connected || !status.gmailAddress) {
      return { success: false, message: CONNECT_GMAIL_PROMPT };
    }

    const agencyId = await getAuthenticatedAgencyId();
    let agencyName = "Travel Agency";
    if (agencyId) {
      const { data: agencyRow } = await supabase
        .from("agencies")
        .select("name")
        .eq("id", agencyId)
        .maybeSingle();
      if (agencyRow?.name) agencyName = agencyRow.name;
    }

    const to = (recipientEmail || status.gmailAddress).trim();
    const subject = `${agencyName} — Gmail Connection Test`;
    const body = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;color:#0f172a;">
      <h2 style="margin:0 0 12px 0;color:#0F5E63;">${escapeHtml(agencyName)} — Test Email</h2>
      <p style="font-size:14px;line-height:1.6;color:#334155;">Your agency Gmail (<strong>${escapeHtml(status.gmailAddress)}</strong>) is connected in TAMS Pro and ready to send invoices, vouchers, quotations, and booking confirmations.</p>
    </div>`;

    return await sendEmail(
      { email: status.gmailAddress, agencyName },
      { to, subject, body, emailType: "test" }
    );
  } catch (err) {
    return {
      success: false,
      message: toFriendlyMessage(err, "Could not send test email."),
    };
  }
}

export const sendEmail = async (
  agencyConfig: AgencyEmailConfig,
  options: EmailOptions
): Promise<{ success: boolean; message: string; notConnected?: boolean }> => {
  try {
    const senderCheck = (agencyConfig.email || "").trim().toLowerCase();
    if (!senderCheck || senderCheck === RESERVED_SYSTEM_EMAIL) {
      return {
        success: false,
        notConnected: true,
        message: CONNECT_GMAIL_PROMPT,
      };
    }

    if (!options.to || !options.to.trim()) {
      return {
        success: false,
        message: "Recipient email address is required.",
      };
    }

    const cleanTo = options.to.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanTo)) {
      return {
        success: false,
        message: "Please enter a valid recipient email address.",
      };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const agencyId = await getAuthenticatedAgencyId();

    let resolvedAgencyName = (agencyConfig.agencyName || "").trim();
    if (!resolvedAgencyName && agencyId) {
      const { data: agencyRow } = await supabase
        .from("agencies")
        .select("name")
        .eq("id", agencyId)
        .maybeSingle();
      if (agencyRow?.name) {
        resolvedAgencyName = agencyRow.name.trim();
      }
    }
    if (!resolvedAgencyName) {
      resolvedAgencyName = "Travel Agency";
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueEmail(options);
      if (user && agencyId) {
        await supabase.from("email_logs").insert({
          agency_id: agencyId,
          sent_by: user.id,
          recipient_email: cleanTo,
          subject: options.subject,
          email_type: options.emailType || "general",
          status: "queued",
          client_id: options.clientId || null,
        });
      }
      return {
        success: false,
        message: "You are offline. Email queued and will send when internet returns.",
      };
    }

    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        action: "send",
        to: cleanTo,
        subject: options.subject,
        body: options.body,
        attachments: options.attachments,
        fromName: resolvedAgencyName,
      },
    });

    if (error || !data?.success) {
      const rawErrMsg = String(data?.error || error?.message || "");
      const isNotConnected =
        data?.code === "GMAIL_NOT_CONNECTED" ||
        rawErrMsg.toLowerCase().includes("not configured") ||
        rawErrMsg.toLowerCase().includes("connect your gmail");

      const friendlyError = isNotConnected
        ? CONNECT_GMAIL_PROMPT
        : rawErrMsg.includes("535") || rawErrMsg.includes("Username and Password not accepted")
          ? "Gmail authentication failed. Verify 2-Step Verification is enabled and enter a valid 16-character App Password in Settings → Email."
          : toFriendlyMessage(data?.error || error, "Could not send email. Please check your Gmail settings.");

      if (user && agencyId && !isNotConnected) {
        await supabase.from("email_logs").insert({
          agency_id: agencyId,
          sent_by: user.id,
          recipient_email: cleanTo,
          subject: options.subject,
          email_type: options.emailType || "general",
          status: "failed",
          error_message: friendlyError,
          client_id: options.clientId || null,
        });
      }

      return {
        success: false,
        notConnected: isNotConnected,
        message: friendlyError,
      };
    }

    if (user && agencyId) {
      await supabase.from("email_logs").insert({
        agency_id: agencyId,
        sent_by: user.id,
        recipient_email: cleanTo,
        subject: options.subject,
        email_type: options.emailType || "general",
        status: "success",
        client_id: options.clientId || null,
      });
    }

    return { success: true, message: `Email sent to ${cleanTo}` };
  } catch (error: unknown) {
    return {
      success: false,
      message: toFriendlyMessage(error, "Could not send email right now."),
    };
  }
};

const queueEmail = (options: EmailOptions) => {
  try {
    emailQueue.push(options);
    localStorage.setItem("email_queue", JSON.stringify(emailQueue));
  } catch {
    // Ignore storage quota errors
  }
};

export const processEmailQueue = async (agencyConfig: AgencyEmailConfig) => {
  try {
    const stored = localStorage.getItem("email_queue");
    if (stored) {
      emailQueue = JSON.parse(stored);
    }
  } catch {
    emailQueue = [];
  }

  if (typeof navigator !== "undefined" && (!navigator.onLine || emailQueue.length === 0)) return;

  const status = await fetchAgencyGmailStatus();
  if (!status.connected || !status.gmailAddress) return;

  const queue = [...emailQueue];
  emailQueue = [];
  localStorage.removeItem("email_queue");

  for (const email of queue) {
    try {
      await sendEmail(
        { ...agencyConfig, email: status.gmailAddress },
        email
      );
    } catch (error) {
      console.error("Failed to send queued email:", error);
    }
  }
};

export const createBookingEmailBody = (data: {
  clientName: string;
  agencyName: string;
  pnr?: string;
  destination?: string;
  flightDate?: string;
  travelType?: string;
}) => {
  const safeClient = escapeHtml(data.clientName || "Valued Traveler");
  const safeAgency = escapeHtml(data.agencyName || "Travel Agency");
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; margin: 0; padding: 20px; background: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0F5E63; color: #ffffff; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px;">Booking Confirmation — ${safeAgency}</h1>
        </div>
        <div style="padding: 26px;">
          <p>Dear <strong>${safeClient}</strong>,</p>
          <p>Thank you for choosing <strong>${safeAgency}</strong>. Please find your official booking confirmation attached as a PDF.</p>
          ${data.pnr ? `<div style="margin:8px 0;padding:10px;background:#f8fafc;border-radius:6px;"><strong>PNR / Ref:</strong> ${escapeHtml(data.pnr)}</div>` : ""}
          ${data.destination ? `<div style="margin:8px 0;padding:10px;background:#f8fafc;border-radius:6px;"><strong>Destination / Route:</strong> ${escapeHtml(data.destination)}</div>` : ""}
          ${data.travelType ? `<div style="margin:8px 0;padding:10px;background:#f8fafc;border-radius:6px;"><strong>Service:</strong> ${escapeHtml(data.travelType)}</div>` : ""}
          ${data.flightDate ? `<div style="margin:8px 0;padding:10px;background:#f8fafc;border-radius:6px;"><strong>Date:</strong> ${escapeHtml(data.flightDate)}</div>` : ""}
          <p style="margin-top: 18px;">Have a safe and pleasant journey!</p>
          <p style="margin-top: 18px; font-size: 13px; color: #475569;">Warm regards,<br/><strong>${safeAgency}</strong></p>
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
  const safeClient = escapeHtml(data.clientName || "Valued Client");
  const safeAgency = escapeHtml(data.agencyName || "Travel Agency");
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; margin: 0; padding: 20px; background: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0F5E63; color: #ffffff; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px;">Invoice — ${safeAgency}</h1>
        </div>
        <div style="padding: 26px;">
          <p>Dear <strong>${safeClient}</strong>,</p>
          <p>Please find your invoice from <strong>${safeAgency}</strong> attached as a PDF.</p>
          ${data.invoiceNumber ? `<div style="margin:8px 0;padding:10px;background:#f8fafc;border-radius:6px;"><strong>Invoice Number:</strong> ${escapeHtml(data.invoiceNumber)}</div>` : ""}
          ${typeof data.amount === "number" ? `<div style="margin:8px 0;padding:10px;background:#f8fafc;border-radius:6px;"><strong>Total Amount:</strong> PKR ${data.amount.toLocaleString()}</div>` : ""}
          <p style="margin-top: 18px;">If you have any questions regarding this invoice, please reply directly to this email.</p>
          <p style="margin-top: 18px; font-size: 13px; color: #475569;">Warm regards,<br/><strong>${safeAgency}</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const createVoucherEmailBody = (data: {
  clientName: string;
  agencyName: string;
  voucherNumber?: string;
  voucherLabel?: string;
  amount?: number;
}) => {
  const safeClient = escapeHtml(data.clientName || "Valued Client");
  const safeAgency = escapeHtml(data.agencyName || "Travel Agency");
  const safeLabel = escapeHtml(data.voucherLabel || "Voucher");
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; margin: 0; padding: 20px; background: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0F5E63; color: #ffffff; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px;">${safeLabel} — ${safeAgency}</h1>
        </div>
        <div style="padding: 26px;">
          <p>Dear <strong>${safeClient}</strong>,</p>
          <p>Please find your <strong>${safeLabel.toLowerCase()}</strong> from <strong>${safeAgency}</strong> attached as a PDF.</p>
          ${data.voucherNumber ? `<div style="margin:8px 0;padding:10px;background:#f8fafc;border-radius:6px;"><strong>Voucher Number:</strong> ${escapeHtml(data.voucherNumber)}</div>` : ""}
          ${typeof data.amount === "number" && data.amount > 0 ? `<div style="margin:8px 0;padding:10px;background:#f8fafc;border-radius:6px;"><strong>Amount:</strong> PKR ${data.amount.toLocaleString()}</div>` : ""}
          <p style="margin-top: 18px; font-size: 13px; color: #475569;">Warm regards,<br/><strong>${safeAgency}</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const createQuotationEmailBody = (data: {
  clientName: string;
  agencyName: string;
  quotationNumber: string;
  serviceLabel?: string;
  currency?: string;
  total?: number;
  validUntil?: string;
}) => {
  const safeClient = escapeHtml(data.clientName || "Valued Client");
  const safeAgency = escapeHtml(data.agencyName || "Travel Agency");
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; margin: 0; padding: 20px; background: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0F5E63; color: #ffffff; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px;">Quotation ${escapeHtml(data.quotationNumber)} — ${safeAgency}</h1>
        </div>
        <div style="padding: 26px;">
          <p>Dear <strong>${safeClient}</strong>,</p>
          <p>Please find attached your travel quotation from <strong>${safeAgency}</strong>${data.serviceLabel ? ` for <strong>${escapeHtml(data.serviceLabel)}</strong>` : ""}.</p>
          ${typeof data.total === "number" ? `<div style="margin:8px 0;padding:10px;background:#f8fafc;border-radius:6px;"><strong>Total Quoted:</strong> ${escapeHtml(data.currency || "PKR")} ${data.total.toLocaleString()}</div>` : ""}
          ${data.validUntil ? `<div style="margin:8px 0;padding:10px;background:#f8fafc;border-radius:6px;"><strong>Valid Until:</strong> ${escapeHtml(data.validUntil)}</div>` : ""}
          <p style="margin-top: 18px;">Reply to this email or contact us to confirm your booking.</p>
          <p style="margin-top: 18px; font-size: 13px; color: #475569;">Warm regards,<br/><strong>${safeAgency}</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const createReminderEmailBody = (data: {
  clientName: string;
  agencyName: string;
  type: "flight" | "payment" | "umrah";
  details: {
    flightDate?: string;
    destination?: string;
    pnr?: string;
    amount?: number;
    dueDate?: string;
  };
}) => {
  const typeConfig = {
    flight: { title: "Flight Reminder", color: "#0F5E63" },
    payment: { title: "Payment Reminder", color: "#d97706" },
    umrah: { title: "Umrah Departure Reminder", color: "#0F5E63" },
  };

  const config = typeConfig[data.type];
  const safeClient = escapeHtml(data.clientName);
  const safeAgency = escapeHtml(data.agencyName);

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: ${config.color}; color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px;">${config.title} — ${safeAgency}</h1>
        </div>
        <div style="background: #ffffff; padding: 26px;">
          <p>Dear <strong>${safeClient}</strong>,</p>
          ${
            data.type === "flight"
              ? `
            <p>This is a friendly reminder regarding your upcoming flight booked with <strong>${safeAgency}</strong>:</p>
            ${data.details.flightDate ? `<p><strong>Flight Date:</strong> ${escapeHtml(data.details.flightDate)}</p>` : ""}
            ${data.details.destination ? `<p><strong>Destination:</strong> ${escapeHtml(data.details.destination)}</p>` : ""}
            ${data.details.pnr ? `<p><strong>PNR:</strong> ${escapeHtml(data.details.pnr)}</p>` : ""}
          `
              : data.type === "payment"
                ? `
            <p>This is a reminder regarding your pending balance with <strong>${safeAgency}</strong>:</p>
            ${data.details.amount ? `<p><strong>Amount Due:</strong> PKR ${data.details.amount.toLocaleString()}</p>` : ""}
            ${data.details.dueDate ? `<p><strong>Due Date:</strong> ${escapeHtml(data.details.dueDate)}</p>` : ""}
          `
                : `
            <p>This is a reminder regarding your upcoming Umrah journey with <strong>${safeAgency}</strong>:</p>
            ${data.details.flightDate ? `<p><strong>Departure Date:</strong> ${escapeHtml(data.details.flightDate)}</p>` : ""}
          `
          }
          <p style="margin-top: 20px;">Warm regards,<br/><strong>${safeAgency}</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;
};

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void processEmailQueue({ email: "" });
  });
}
