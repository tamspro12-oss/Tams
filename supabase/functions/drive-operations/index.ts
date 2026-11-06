import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    // Get user's Drive tokens
    const { data: driveTokens, error: tokenError } = await supabase
      .from('google_drive_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !driveTokens) {
      throw new Error('Google Drive not connected. Please connect your Drive first.');
    }

    // Check if token needs refresh
    let accessToken = driveTokens.access_token;
    if (new Date(driveTokens.token_expires_at) <= new Date()) {
      // Refresh token
      const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || 'PLACEHOLDER_CLIENT_ID';
      const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || 'PLACEHOLDER_SECRET';

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: driveTokens.refresh_token,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh access token. Please reconnect your Drive.');
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      // Update token in database
      await supabase
        .from('google_drive_tokens')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        })
        .eq('user_id', user.id);
    }

    const { operation, fileName, data } = await req.json();

    // READ operation
    if (operation === 'read') {
      // Search for file in folder
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${driveTokens.drive_folder_id}' in parents and trashed=false`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const searchResults = await searchResponse.json();

      if (!searchResults.files || searchResults.files.length === 0) {
        return new Response(
          JSON.stringify({ data: null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const fileId = searchResults.files[0].id;

      // Download file content
      const fileResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const fileContent = await fileResponse.text();

      return new Response(
        JSON.stringify({ data: JSON.parse(fileContent) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // WRITE operation
    if (operation === 'write') {
      // Search for existing file
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${driveTokens.drive_folder_id}' in parents and trashed=false`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const searchResults = await searchResponse.json();

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const metadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: [driveTokens.drive_folder_id],
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(data) +
        closeDelim;

      let uploadResponse;

      if (searchResults.files && searchResults.files.length > 0) {
        // Update existing file
        const fileId = searchResults.files[0].id;
        uploadResponse = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartRequestBody,
          }
        );
      } else {
        // Create new file
        uploadResponse = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartRequestBody,
          }
        );
      }

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        console.error('Upload failed:', error);
        throw new Error('Failed to save to Drive');
      }

      // Update last_synced_at
      await supabase
        .from('google_drive_tokens')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('user_id', user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid operation');

  } catch (error) {
    console.error('Error in drive-operations function:', error);
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
