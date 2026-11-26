import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OFFICIAL_SYSTEM_EMAIL = "tamspro12@gmail.com";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SystemEmailRequest {
  action?: "status" | "logs" | "send_test" | "send";
  to?: string;
  recipientName?: string;
  subject?: string;
  body?: string;
  category?: "test" | "welcome" | "announcement" | "admin_message";
  limit?: number;
}

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSystemHtmlTemplate(subject: string, messageHtmlOrText: string): string {
  const isHtml = /<[a-z][\s\S]*>/i.test(messageHtmlOrText);
  const formattedBody = isHtml
    ? messageHtmlOrText
    : `<p style="margin:0;white-space:pre-line;">${escapeHtml(messageHtmlOrText)}</p>`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background-color:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="background:#0F5E63;padding:22px 28px;color:#ffffff;">
          <div style="font-size:19px;font-weight:700;letter-spacing:0.02em;">TAMS Pro</div>
          <div style="font-size:12px;opacity:0.85;margin-top:3px;">Official Platform Communication</div>
        </td>
      </tr>
      <tr>
        <td style="padding:26px 28px;font-size:14px;line-height:1.65;color:#334155;">
          <h2 style="margin:0 0 14px 0;font-size:18px;color:#0f172a;">${escapeHtml(subject)}</h2>
          ${formattedBody}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 16px 0;" />
          <p style="margin:0;font-size:12px;color:#64748b;">
            Sent by <strong>TAMS Pro</strong> (<a href="https://tamspro.online" style="color:#0F5E63;text-decoration:none;">tamspro.online</a>) · Support: <a href="mailto:${OFFICIAL_SYSTEM_EMAIL}" style="color:#0F5E63;">${OFFICIAL_SYSTEM_EMAIL}</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Authentication required." }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return jsonResponse({ success: false, error: "Invalid or expired login session." }, 401);
    }

    const caller = userData.user;

    // Strictly enforce super_admin authorization for all System Email actions
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleRow) {
      return jsonResponse(
        { success: false, error: "Administrator access required for System Email." },
        403
      );
    }

    const payload: SystemEmailRequest =
      req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = payload.action || "status";

    const configuredUser = (Deno.env.get("SYSTEM_GMAIL_USER") || OFFICIAL_SYSTEM_EMAIL).trim();
    const rawAppPassword = (Deno.env.get("SYSTEM_GMAIL_APP_PASSWORD") || "").replace(/\s+/g, "");
    const fromName = (Deno.env.get("SYSTEM_EMAIL_FROM_NAME") || "TAMS Pro").trim();
    const isConfigured =
      configuredUser.toLowerCase() === OFFICIAL_SYSTEM_EMAIL && rawAppPassword.length === 16;

    if (action === "status") {
      return jsonResponse({
        success: true,
        configured: isConfigured,
        senderEmail: OFFICIAL_SYSTEM_EMAIL,
        fromName,
        hasUserSecret: Boolean(Deno.env.get("SYSTEM_GMAIL_USER")),
        hasPasswordSecret: rawAppPassword.length === 16,
        requiredSecrets: ["SYSTEM_GMAIL_USER", "SYSTEM_GMAIL_APP_PASSWORD"],
      });
    }

    if (action === "logs") {
      const rowLimit = Math.min(Math.max(Number(payload.limit) || 50, 1), 200);
      const { data: logs, error: logsErr } = await supabaseAdmin
        .from("system_email_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(rowLimit);

      if (logsErr) {
        return jsonResponse({ success: true, logs: [] });
      }
      return jsonResponse({ success: true, logs: logs ?? [] });
    }

    if (!isConfigured) {
      return jsonResponse(
        {
          success: false,
          code: "SYSTEM_SECRETS_MISSING",
          error:
            "System Email secrets are not configured yet. Set SYSTEM_GMAIL_USER=tamspro12@gmail.com and SYSTEM_GMAIL_APP_PASSWORD in Supabase Edge Function Secrets.",
        },
        400
      );
    }

    const recipient = (payload.to || (action === "send_test" ? caller.email || OFFICIAL_SYSTEM_EMAIL : "")).trim();
    if (!recipient || !EMAIL_REGEX.test(recipient)) {
      return jsonResponse({ success: false, error: "Please enter a valid recipient email address." }, 400);
    }

    const category =
      action === "send_test"
        ? "test"
        : payload.category || "admin_message";

    const subject =
      action === "send_test"
        ? payload.subject?.trim() || "TAMS Pro — System Email Test"
        : (payload.subject || "").trim();

    const rawBody =
      action === "send_test"
        ? payload.body?.trim() ||
          `This is a test email from the TAMS Pro System Email sender (${OFFICIAL_SYSTEM_EMAIL}).\n\nYour Supabase Edge Function secrets (SYSTEM_GMAIL_USER & SYSTEM_GMAIL_APP_PASSWORD) are configured and working properly.`
        : (payload.body || "").trim();

    if (!subject || !rawBody) {
      return jsonResponse({ success: false, error: "Both email subject and message body are required." }, 400);
    }

    const htmlContent = buildSystemHtmlTemplate(subject, rawBody);

    try {
      const client = new SMTPClient({
        connection: {
          hostname: "smtp.gmail.com",
          port: 465,
          tls: true,
          auth: {
            username: OFFICIAL_SYSTEM_EMAIL,
            password: rawAppPassword,
          },
        },
      });

      await client.send({
        from: `${fromName} <${OFFICIAL_SYSTEM_EMAIL}>`,
        to: recipient,
        subject,
        html: htmlContent,
      });

      await client.close();

      await supabaseAdmin.from("system_email_logs").insert({
        sent_by: caller.id,
        recipient_email: recipient,
        recipient_name: payload.recipientName?.trim() || null,
        subject,
        email_category: category,
        status: "sent",
      });

      return jsonResponse({
        success: true,
        message: `System email sent from ${OFFICIAL_SYSTEM_EMAIL} to ${recipient}.`,
      });
    } catch (smtpErr: any) {
      console.error("[Send System Email] SMTP error:", smtpErr);

      const friendlyErr =
        smtpErr?.message?.includes("535") ||
        smtpErr?.message?.includes("Username and Password not accepted")
          ? "Gmail rejected the App Password for tamspro12@gmail.com. Verify 2-Step Verification is active and SYSTEM_GMAIL_APP_PASSWORD is a valid 16-character App Password."
          : "Could not deliver system email via Gmail SMTP. Please verify Edge Function secrets and try again.";

      await supabaseAdmin.from("system_email_logs").insert({
        sent_by: caller.id,
        recipient_email: recipient,
        recipient_name: payload.recipientName?.trim() || null,
        subject,
        email_category: category,
        status: "failed",
        error_message: friendlyErr,
      });

      return jsonResponse({ success: false, error: friendlyErr }, 500);
    }
  } catch (err) {
    console.error("[Send System Email] Unexpected error:", err);
    return jsonResponse(
      { success: false, error: "Could not process system email request right now." },
      500
    );
  }
};

serve(handler);

