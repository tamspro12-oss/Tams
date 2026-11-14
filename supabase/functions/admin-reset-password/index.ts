import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing bearer token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token);

    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Strict server-side authorization via public.user_roles (role = 'super_admin')
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (roleError || roleRow?.role !== 'super_admin') {
      console.warn(`[admin-reset-password] 403 denied for caller=${caller.id}`);
      return new Response(
        JSON.stringify({ error: '403 Forbidden: super_admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    const newPassword =
      typeof body?.newPassword === 'string'
        ? body.newPassword
        : typeof body?.password === 'string'
          ? body.password
          : '';

    if (!userId || !UUID_REGEX.test(userId)) {
      return new Response(
        JSON.stringify({ error: 'Valid target userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newPassword || newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'New password must be at least 8 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify target user exists
    const { data: targetUserRes, error: targetLookupErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (targetLookupErr || !targetUserRes?.user) {
      return new Response(
        JSON.stringify({ error: 'Target user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Update password via Supabase Auth Admin API (old password stops working immediately)
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message || 'Failed to update password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Kill ALL sessions & refresh tokens for target user via SECURITY DEFINER SQL RPC
    const { data: revokedCount, error: revokeErr } = await supabaseAdmin.rpc(
      'admin_revoke_user_sessions',
      { p_user_id: userId }
    );

    if (revokeErr) {
      console.error(`[admin-reset-password] Failed to revoke sessions for userId=${userId}: ${revokeErr.message}`);
      return new Response(
        JSON.stringify({ error: 'Password updated, but session revocation failed cleanly. Please retry revocation.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Record audit log entry (NEVER store or log plaintext password)
    await supabaseAdmin
      .from('admin_audit_logs')
      .insert({
        admin_user_id: caller.id,
        action_type: 'admin_reset_password',
        target_type: 'user',
        target_id: userId,
        target_name: targetUserRes.user.email || userId,
        old_value: null,
        new_value: { sessions_revoked: revokedCount ?? 0, revoked_at: new Date().toISOString() },
        user_agent: req.headers.get('user-agent') || null,
      })
      .then(() => undefined, () => undefined);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset and all active sessions revoked successfully',
        userId,
        sessionsRevoked: typeof revokedCount === 'number' ? revokedCount : 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[admin-reset-password] Unexpected failure:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

