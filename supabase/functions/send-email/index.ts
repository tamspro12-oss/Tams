import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Strictly forbidden as an agency sender — System Email and Agency Email must NEVER mix.
const RESERVED_SYSTEM_EMAIL = "tamspro12@gmail.com";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APP_PASSWORD_REGEX = /^[a-zA-Z0-9]{16}$/;
const MASKED_DISPLAY = "•••• •••• •••• ••••";

interface AgencyEmailRequest {
  action?: "status" | "save" | "disconnect" | "test" | "send";
  gmailAddress?: string;
  appPassword?: string;
  to?: string;
  subject?: string;
  body?: string;
  attachments?: Array<{
    name: string;
    data: string; // base64
  }>;
  fromName?: string;
}

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function deriveAesKey(secretMaterial: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(secretMaterial));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function getEncryptionSecretMaterial(): { secret: string; keyVersion: "v1" | "v0" } {
  const dedicatedKey = (Deno.env.get("AGENCY_EMAIL_ENCRYPTION_KEY") || "").trim();
  if (dedicatedKey.length >= 16) {
    return { secret: dedicatedKey, keyVersion: "v1" };
  }
  const fallbackServiceSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return { secret: `tams-agency-vault:${fallbackServiceSecret}`, keyVersion: "v0" };
}

async function encryptAppPassword(plain16: string, agencyId: string): Promise<string> {
  const { secret, keyVersion } = getEncryptionSecretMaterial();
  const key = await deriveAesKey(`${secret}:${agencyId}`);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plain16);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return `${keyVersion}:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipherBuf))}`;
}

async function decryptAppPassword(stored: string, agencyId: string): Promise<string | null> {
  if (!stored) return null;

  if (stored.startsWith("v1:") || stored.startsWith("v0:")) {
    const parts = stored.split(":");
    if (parts.length !== 3) return null;
    const [ver, ivB64, dataB64] = parts;

    const dedicatedKey = (Deno.env.get("AGENCY_EMAIL_ENCRYPTION_KEY") || "").trim();
    const fallbackSecret = `tams-agency-vault:${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`;
    const candidateSecret = ver === "v1" ? dedicatedKey : fallbackSecret;
    if (!candidateSecret) return null;

    const key = await deriveAesKey(`${candidateSecret}:${agencyId}`);
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(ivB64) },
      key,
      base64ToBytes(dataB64)
    );
    return new TextDecoder().decode(plainBuf);
  }

  return null;
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
    const user = userData.user;

    // Resolve caller's own agency strictly on the server (never from client input)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("agency_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.agency_id) {
      return jsonResponse({ success: false, error: "No agency workspace is linked to this login." }, 403);
    }

    const agencyId = String(profile.agency_id);

    const { data: subUserRow } = await supabaseAdmin
      .from("sub_users")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    const isSubUser = Boolean(subUserRow);

    const payload: AgencyEmailRequest =
      req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = payload.action || "send";

    // Fetch agency metadata + encrypted credentials for THIS agency only
    const [{ data: agencyRow }, { data: encryptedRow }] = await Promise.all([
      supabaseAdmin
        .from("agencies")
        .select("id, name, email, email_password")
        .eq("id", agencyId)
        .maybeSingle(),
      supabaseAdmin
        .from("agency_email_settings")
        .select("agency_id, gmail_address, encrypted_app_password, masked_hint, updated_at")
        .eq("agency_id", agencyId)
        .maybeSingle(),
    ]);

    // 1. STATUS ACTION (never returns the password — only masked indicator)
    if (action === "status") {
      const configuredViaVaultTable = Boolean(
        encryptedRow?.gmail_address && encryptedRow?.encrypted_app_password
      );
      const legacyEmail = (agencyRow?.email || "").trim();
      const configuredViaLegacy = Boolean(
        !configuredViaVaultTable &&
          legacyEmail &&
          legacyEmail.toLowerCase() !== RESERVED_SYSTEM_EMAIL &&
          agencyRow?.email_password
      );
      const isConnected = configuredViaVaultTable || configuredViaLegacy;
      const activeGmail = configuredViaVaultTable
        ? encryptedRow!.gmail_address
        : configuredViaLegacy
          ? legacyEmail
          : "";

      return jsonResponse({
        success: true,
        connected: isConnected,
        gmailAddress: activeGmail,
        maskedPassword: isConnected ? encryptedRow?.masked_hint || MASKED_DISPLAY : "",
        updatedAt: encryptedRow?.updated_at || null,
      });
    }

    // 2. SAVE CREDENTIALS ACTION (owner only; encrypts server-side)
    if (action === "save") {
      if (isSubUser) {
        return jsonResponse(
          { success: false, error: "Only the agency owner can update Gmail credentials." },
          403
        );
      }

      const cleanGmail = (payload.gmailAddress || "").trim().toLowerCase();
      if (!cleanGmail || !EMAIL_REGEX.test(cleanGmail)) {
        return jsonResponse({ success: false, error: "Please enter a valid Gmail address." }, 400);
      }
      if (cleanGmail === RESERVED_SYSTEM_EMAIL) {
        return jsonResponse(
          {
            success: false,
            error: "Please enter your agency's own Gmail address (system email cannot be used here).",
          },
          400
        );
      }

      const cleanPwd = (payload.appPassword || "").replace(/\s+/g, "");
      const hasExistingEncrypted = Boolean(encryptedRow?.encrypted_app_password);

      if (!cleanPwd && !hasExistingEncrypted) {
        return jsonResponse(
          {
            success: false,
            error: "Please enter your 16-character Gmail App Password.",
          },
          400
        );
      }

      if (cleanPwd && !APP_PASSWORD_REGEX.test(cleanPwd)) {
        return jsonResponse(
          {
            success: false,
            error: "Gmail App Password must be 16 letters/numbers (spaces are removed automatically).",
          },
          400
        );
      }

      const cipherText = cleanPwd
        ? await encryptAppPassword(cleanPwd, agencyId)
        : String(encryptedRow!.encrypted_app_password);

      const { error: upsertErr } = await supabaseAdmin.from("agency_email_settings").upsert(
        {
          agency_id: agencyId,
          gmail_address: cleanGmail,
          encrypted_app_password: cipherText,
          masked_hint: MASKED_DISPLAY,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "agency_id" }
      );

      if (upsertErr) {
        console.error("[Agency Email] Upsert error:", upsertErr);
        return jsonResponse(
          {
            success: false,
            error:
              "Could not save encrypted Gmail settings. Please ensure the latest database migration has been applied.",
          },
          500
        );
      }

      // Sync display sender address on agencies.email and clear plaintext agencies.email_password
      await supabaseAdmin
        .from("agencies")
        .update({ email: cleanGmail, email_password: null })
        .eq("id", agencyId);

      return jsonResponse({
        success: true,
        connected: true,
        gmailAddress: cleanGmail,
        maskedPassword: MASKED_DISPLAY,
        message: "Your agency Gmail credentials have been encrypted and saved.",
      });
    }

    // 3. DISCONNECT ACTION (owner only)
    if (action === "disconnect") {
      if (isSubUser) {
        return jsonResponse(
          { success: false, error: "Only the agency owner can disconnect Gmail." },
          403
        );
      }
      await supabaseAdmin.from("agency_email_settings").delete().eq("agency_id", agencyId);
      await supabaseAdmin
        .from("agencies")
        .update({ email_password: null })
        .eq("id", agencyId);

      return jsonResponse({
        success: true,
        connected: false,
        message: "Agency Gmail disconnected.",
      });
    }

    // 4. RESOLVE AGENCY'S OWN CREDENTIALS FOR TEST / SEND (NEVER FALL BACK TO SYSTEM EMAIL)
    let senderEmail = "";
    let senderPassword = "";

    if (encryptedRow?.gmail_address && encryptedRow?.encrypted_app_password) {
      senderEmail = String(encryptedRow.gmail_address).trim();
      if (
        encryptedRow.encrypted_app_password.startsWith("v1:") ||
        encryptedRow.encrypted_app_password.startsWith("v0:")
      ) {
        const decrypted = await decryptAppPassword(
          String(encryptedRow.encrypted_app_password),
          agencyId
        );
        if (decrypted) {
          senderPassword = decrypted;
        }
      } else {
        // Decrypt pgcrypto row saved via SQL RPC fallback
        const { data: rpcDecrypted } = await supabaseAdmin.rpc(
          "service_decrypt_agency_email_password",
          { p_agency_id: agencyId }
        );
        if (typeof rpcDecrypted === "string" && rpcDecrypted.length > 0) {
          senderPassword = rpcDecrypted;
        }
      }
    } else if (agencyRow?.email && agencyRow?.email_password) {
      senderEmail = String(agencyRow.email).trim();
      senderPassword = String(agencyRow.email_password).replace(/\s+/g, "");
      // Opportunistically upgrade legacy plaintext credential into encrypted table
      if (
        senderEmail.toLowerCase() !== RESERVED_SYSTEM_EMAIL &&
        APP_PASSWORD_REGEX.test(senderPassword)
      ) {
        try {
          const cipher = await encryptAppPassword(senderPassword, agencyId);
          const { error: migErr } = await supabaseAdmin.from("agency_email_settings").upsert(
            {
              agency_id: agencyId,
              gmail_address: senderEmail.toLowerCase(),
              encrypted_app_password: cipher,
              masked_hint: MASKED_DISPLAY,
              updated_by: user.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "agency_id" }
          );
          if (!migErr) {
            await supabaseAdmin
              .from("agencies")
              .update({ email_password: null })
              .eq("id", agencyId);
          }
        } catch {
          // Non-blocking opportunistic upgrade
        }
      }
    }

    if (
      !senderEmail ||
      !senderPassword ||
      senderEmail.toLowerCase() === RESERVED_SYSTEM_EMAIL
    ) {
      return jsonResponse(
        {
          success: false,
          code: "GMAIL_NOT_CONNECTED",
          error: "Connect your Gmail in Settings",
        },
        400
      );
    }

    const agencyDisplayName = (payload.fromName || agencyRow?.name || "Travel Agency")
      .replace(/["<>]/g, "")
      .trim();

    const recipient = (payload.to || (action === "test" ? senderEmail : "")).trim();
    const subject =
      action === "test"
        ? payload.subject?.trim() || `${agencyDisplayName} — Gmail Connection Test`
        : (payload.subject || "").trim();
    const htmlBody =
      action === "test"
        ? payload.body?.trim() ||
          `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;color:#0f172a;">
            <h2 style="margin:0 0 12px 0;color:#0F5E63;">${agencyDisplayName} — Gmail Connected!</h2>
            <p style="font-size:14px;line-height:1.6;color:#334155;">Your agency Gmail (<strong>${senderEmail}</strong>) is connected and ready to send branded invoices, vouchers, quotations, and booking confirmations from TAMS Pro.</p>
          </div>`
        : (payload.body || "").trim();

    if (!recipient || !subject || !htmlBody) {
      return jsonResponse(
        { success: false, error: "Recipient email, subject, and message content are required." },
        400
      );
    }

    if (!EMAIL_REGEX.test(recipient)) {
      return jsonResponse({ success: false, error: "Please enter a valid recipient email address." }, 400);
    }

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: senderEmail,
          password: senderPassword,
        },
      },
    });

    const smtpAttachments =
      payload.attachments?.map((att) => ({
        filename: att.name,
        content: att.data,
        encoding: "base64" as const,
        contentType: att.name.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : "application/octet-stream",
      })) || [];

    await client.send({
      from: `"${agencyDisplayName}" <${senderEmail}>`,
      to: recipient,
      subject,
      html: htmlBody,
      attachments: smtpAttachments.length > 0 ? smtpAttachments : undefined,
    });

    await client.close();

    return jsonResponse({
      success: true,
      message: `Email sent from ${agencyDisplayName} (${senderEmail})`,
    });
  } catch (error: any) {
    console.error("[Send Agency Email] Error:", error);

    let errorMessage = "Could not send email. Please check your Gmail address and App Password in Settings.";
    if (
      error?.message?.includes("535") ||
      error?.message?.includes("Username and Password not accepted")
    ) {
      errorMessage =
        "Gmail rejected the App Password. Please confirm 2-Step Verification is enabled on your Google account and enter a fresh 16-character App Password in Settings → Email.";
    }

    return jsonResponse({ success: false, error: errorMessage }, 500);
  }
};

serve(handler);
