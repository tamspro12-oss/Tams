import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create client with anon key for user verification
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: req.headers.get('authorization') ?? ''
          }
        }
      }
    );

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify user authentication using the anon client and the bearer token
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');

    if (!authHeader) {
      console.error('Auth error: Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - please log in again' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer', '').trim();

    if (!token) {
      console.error('Auth error: Missing bearer token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - please log in again' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Basic validation: ensure JWT has a `sub` claim before calling auth API
    try {
      const payloadPart = token.split('.')[1];
      const payloadJson = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson);

      if (!payload.sub) {
        console.error('Auth error: Token missing sub claim');
        return new Response(
          JSON.stringify({ error: 'Unauthorized - please log in again' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (e) {
      console.error('Auth error: Invalid JWT format', e);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - please log in again' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - please log in again' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.email);

    const { action, sessionId } = await req.json();

    // LIST SESSIONS FOR CURRENT USER
    if (action === 'list') {
      // Get active sessions for the current user using RPC
      const { data: sessions, error } = await supabaseAdmin.rpc('get_user_active_sessions', {
        p_user_id: user.id
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ sessions: sessions || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE ALL SESSIONS FOR CURRENT USER
    if (action === 'delete-all') {
      // Sign out from all devices by deleting all sessions
      const { error } = await supabaseAdmin.rpc('delete_all_user_sessions', {
        p_user_id: user.id
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'All sessions deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE SPECIFIC SESSION
    if (action === 'delete-one') {
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: 'Missing sessionId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify the session belongs to the current user before deleting
      const { error } = await supabaseAdmin.rpc('delete_user_session', {
        p_user_id: user.id,
        p_session_id: sessionId
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'Session deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in manage-sessions function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
