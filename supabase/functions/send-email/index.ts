import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  attachments?: Array<{
    name: string;
    data: string; // base64
  }>;
  fromName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // -- Authenticate caller (JWT required) --
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const user = userData.user;

    // -- Look up the caller's agency SMTP credentials server-side --
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("agency_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.agency_id) {
      return new Response(
        JSON.stringify({ error: "No agency associated with user" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: agency } = await supabaseAdmin
      .from("agencies")
      .select("email, email_password")
      .eq("id", profile.agency_id)
      .maybeSingle();

    if (!agency?.email || !agency?.email_password) {
      return new Response(
        JSON.stringify({ error: "Agency email not configured. Add SMTP credentials in Settings." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const senderEmail = agency.email;
    const senderPassword = agency.email_password;

    // -- Validate client-supplied payload --
    const { to, subject, body, attachments, fromName }: EmailRequest = await req.json();

    console.log('[Send Email] Processing request:', { to, subject, hasAttachments: !!attachments?.length });

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, body' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return new Response(
        JSON.stringify({ error: 'Invalid recipient email address format' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // -- Send via Gmail SMTP using server-side credentials only --
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

    const smtpAttachments = attachments?.map(att => ({
      filename: att.name,
      content: att.data,
      encoding: "base64" as const,
      contentType: att.name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
    })) || [];

    await client.send({
      from: fromName ? `${fromName} <${senderEmail}>` : senderEmail,
      to: to,
      subject: subject,
      html: body,
      attachments: smtpAttachments.length > 0 ? smtpAttachments : undefined,
    });

    await client.close();

    console.log('[Send Email] ✓ Email sent successfully via Gmail SMTP');

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error('[Send Email] ✗ Error:', error);

    let errorMessage = 'Failed to send email. Please verify Gmail and App Password in Settings.';
    if (error?.message?.includes('535') || error?.message?.includes('Username and Password not accepted')) {
      errorMessage = 'Gmail authentication failed. Please verify: 1) You created a Gmail App Password (16 characters), 2) 2-Step Verification is enabled, 3) Password copied correctly without spaces.';
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
