import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    
    // Get action from query params or request body
    let action = url.searchParams.get('action');
    let body: any = null;
    
    if (!action && req.method === 'POST') {
      body = await req.json();
      action = body.action;
    }

    // Default GET with no action to status
    if (!action && req.method === 'GET') {
      action = 'status';
    }

    // Google OAuth credentials (set via backend secrets)
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || 'PLACEHOLDER_CLIENT_ID';
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || 'PLACEHOLDER_SECRET';
    const REDIRECT_URI = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-auth`;

    // Handle Google OAuth redirect callback (GET with ?code=...)
    const oauthCode = url.searchParams.get('code');
    const oauthState = url.searchParams.get('state');
    if (req.method === 'GET' && oauthCode) {
      console.log('OAuth callback received with code');
      
      if (!oauthState) {
        return new Response(JSON.stringify({ error: 'Missing state' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Parse state JSON to get uid and return_to
      let stateData: { uid: string; return_to?: string };
      try {
        stateData = JSON.parse(atob(oauthState));
      } catch (e) {
        console.error('Failed to parse state:', e);
        // Fallback for old state format (just uid)
        stateData = { uid: oauthState };
      }

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: oauthCode,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error('Token exchange (callback) failed:', error);
        return new Response(JSON.stringify({ error: 'Failed to exchange code for tokens' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokens = await tokenResponse.json();

      // Ensure destination folder exists
      const searchResp = await fetch(
        'https://www.googleapis.com/drive/v3/files?q=name="TAMS Pro" and mimeType="application/vnd.google-apps.folder" and trashed=false',
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      const searchJson = await searchResp.json();
      let folderId = searchJson?.files?.[0]?.id;
      if (!folderId) {
        const createResp = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'TAMS Pro', mimeType: 'application/vnd.google-apps.folder' }),
        });
        const created = await createResp.json();
        folderId = created.id;
      }

      // Lookup agency for the user id from state
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', stateData.uid)
        .single();

      if (!profile) {
        return new Response(JSON.stringify({ error: 'User profile not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 0) * 1000).toISOString();
      const { error: saveError } = await supabase
        .from('google_drive_tokens')
        .upsert({
          user_id: stateData.uid,
          agency_id: profile.agency_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          drive_folder_id: folderId,
          token_expires_at: expiresAt,
          connected_at: new Date().toISOString(),
        });

      if (saveError) {
        console.error('Failed to save tokens (callback):', saveError);
        return new Response(JSON.stringify({ error: 'Failed to save Drive connection' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Drive connected successfully for user:', stateData.uid);

      // Build allowlist of trusted origins to protect against open-redirect
      // via the state.return_to parameter. We accept:
      //   - the Supabase project's own origin
      //   - any origin listed in the OAUTH_REDIRECT_ORIGINS secret (comma-sep)
      //   - *.lovable.app / *.lovable.dev (preview + published hosts)
      const supabaseOrigin = (() => {
        try { return new URL(Deno.env.get('SUPABASE_URL') ?? '').origin; } catch { return ''; }
      })();
      const extraOrigins = (Deno.env.get('OAUTH_REDIRECT_ORIGINS') ?? '')
        .split(',').map(s => s.trim()).filter(Boolean);
      const allowlist = new Set<string>([supabaseOrigin, ...extraOrigins].filter(Boolean));

      const isAllowedOrigin = (raw: string): { ok: boolean; origin: string } => {
        try {
          const u = new URL(raw);
          if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, origin: '' };
          if (allowlist.has(u.origin)) return { ok: true, origin: u.origin };
          // Allow Lovable preview + published hosts
          if (u.hostname.endsWith('.lovable.app') || u.hostname.endsWith('.lovable.dev')) {
            return { ok: true, origin: u.origin };
          }
          return { ok: false, origin: u.origin };
        } catch {
          return { ok: false, origin: '' };
        }
      };

      // If return_to is provided, validate it against the allowlist before redirecting
      if (stateData.return_to) {
        const check = isAllowedOrigin(stateData.return_to);
        if (!check.ok) {
          console.warn('Blocked open-redirect attempt to:', stateData.return_to);
          return new Response(
            JSON.stringify({ error: 'Forbidden redirect target' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const separator = stateData.return_to.includes('?') ? '&' : '?';
        const redirectUrl = `${stateData.return_to}${separator}driveConnected=1`;
        console.log('Redirecting to:', redirectUrl);
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            'Location': redirectUrl,
          },
        });
      }

      // Otherwise, auto-close popup window (old flow). Restrict postMessage
      // target origin to the opener's own origin — never '*'.
      const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Connected</title></head><body><script>try{if(window.opener){var target=(window.opener.location&&window.opener.location.origin)||window.location.origin;window.opener.postMessage({type:'drive-connected'},target);}}catch(e){}window.close();</script><p>Connected! You can close this window.</p></body></html>`;
      return new Response(html, { headers: { ...corsHeaders, 'Content-Type': 'text/html' } });
    }

    // For all other actions, require a valid Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    // ACTION: Get authorization URL
    if (action === 'get-auth-url') {
      if (!body) {
        body = await req.json();
      }
      const return_to = body.return_to;

      // Encode uid and return_to in state as base64 JSON
      const stateData = { uid: user.id, return_to };
      const stateParam = btoa(JSON.stringify(stateData));

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata')}&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${stateParam}`;

      return new Response(
        JSON.stringify({ authUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Exchange code for tokens
    if (action === 'exchange-code') {
      if (!body) {
        body = await req.json();
      }
      const { code } = body;

      if (!code) {
        throw new Error('Missing authorization code');
      }

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error('Token exchange failed:', error);
        throw new Error('Failed to exchange code for tokens');
      }

      const tokens = await tokenResponse.json();

      // Create or find TAMS Pro folder in Drive
      const folderResponse = await fetch(
        'https://www.googleapis.com/drive/v3/files?q=name="TAMS Pro" and mimeType="application/vnd.google-apps.folder" and trashed=false',
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        }
      );

      let folderId;
      const folders = await folderResponse.json();
      
      if (folders.files && folders.files.length > 0) {
        folderId = folders.files[0].id;
      } else {
        // Create folder
        const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'TAMS Pro',
            mimeType: 'application/vnd.google-apps.folder',
          }),
        });
        const newFolder = await createResponse.json();
        folderId = newFolder.id;
      }

      // Get user's agency_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      // Save tokens to database
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      
      const { error: saveError } = await supabase
        .from('google_drive_tokens')
        .upsert({
          user_id: user.id,
          agency_id: profile.agency_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          drive_folder_id: folderId,
          token_expires_at: expiresAt.toISOString(),
          connected_at: new Date().toISOString(),
        });

      if (saveError) {
        console.error('Failed to save tokens:', saveError);
        throw new Error('Failed to save Drive connection');
      }

      return new Response(
        JSON.stringify({ success: true, folderId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Disconnect Drive
    if (action === 'disconnect') {
      const { error: deleteError } = await supabase
        .from('google_drive_tokens')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        throw new Error('Failed to disconnect Drive');
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Check connection status
    if (action === 'status') {
      const { data: tokens } = await supabase
        .from('google_drive_tokens')
        .select('*')
        .eq('user_id', user.id)
        .single();

      return new Response(
        JSON.stringify({ 
          connected: !!tokens,
          folderId: tokens?.drive_folder_id,
          connectedAt: tokens?.connected_at,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error in google-auth function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
