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

    // Verify admin role
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Master Admin Email Whitelist & Super Admin Authorization Check
    const isMasterAdminEmail = user.email?.trim().toLowerCase() === 'usmn4u@gmail.com';
    let isSuperAdmin = isMasterAdminEmail;

    if (!isSuperAdmin) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.is_super_admin) {
        isSuperAdmin = true;
      }
    }

    if (!isSuperAdmin) {
      console.error(`Forbidden: Unauthorized user ${user.email} attempted admin manage-users.`);
      return new Response(
        JSON.stringify({ error: '403 Forbidden: Full administrator privileges are restricted exclusively to usmn4u@gmail.com' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, userId, data } = await req.json();

    // LIST USERS
    if (action === 'list') {
      try {
        // 1. Attempt using optimized SQL RPC first
        const { data: rpcUsers, error: rpcError } = await supabaseAdmin.rpc('admin_get_registered_users');
        if (!rpcError && Array.isArray(rpcUsers) && rpcUsers.length > 0) {
          return new Response(
            JSON.stringify({ users: rpcUsers }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (rpcEx) {
        console.warn('RPC admin_get_registered_users fallback:', rpcEx);
      }

      // 2. Direct fallback
      const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      if (authError) throw authError;

      const userEmailMap = new Map(authUsers.users.map(u => [u.id, u.email]));
      const userMetaMap = new Map(authUsers.users.map(u => [u.id, u.user_metadata]));

      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, agency_id, created_at, is_super_admin')
        .order('created_at', { ascending: false });

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const agencyIds = Array.from(new Set((profiles || []).map(p => p.agency_id).filter(Boolean)));
      const { data: agencies } = agencyIds.length > 0
        ? await supabaseAdmin
            .from('agencies')
            .select('id, name, subscription_plan, license_expiry, license_status')
            .in('id', agencyIds)
        : { data: [] };

      const agencyMap = new Map((agencies || []).map(a => [a.id, a]));

      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, role');

      const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));

      const enrichedProfiles = authUsers.users.map(u => {
        const prof = profileMap.get(u.id);
        const agency = prof?.agency_id ? agencyMap.get(prof.agency_id) : null;
        const isMaster = u.email?.toLowerCase() === 'usmn4u@gmail.com' || prof?.is_super_admin === true;

        return {
          id: u.id,
          email: u.email || 'N/A',
          full_name: prof?.full_name || u.user_metadata?.full_name || u.email?.split('@')[0] || 'User',
          role: isMaster ? 'admin' : (roleMap.get(u.id) || 'user'),
          agency_id: prof?.agency_id || null,
          agency_name: isMaster ? 'Master Admin HQ' : (agency?.name || 'Primary Agency'),
          subscription_plan: isMaster ? 'lifetime' : (agency?.subscription_plan || 'free'),
          license_expiry: isMaster ? '2099-12-31T23:59:59.000Z' : agency?.license_expiry,
          license_status: isMaster ? 'active' : (agency?.license_status || 'active'),
          created_at: u.created_at,
          email_confirmed_at: u.email_confirmed_at,
          active_sessions: 1
        };
      });

      return new Response(
        JSON.stringify({ users: enrichedProfiles }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UPDATE USER
    if (action === 'update') {
      if (!userId || !data) {
        return new Response(
          JSON.stringify({ error: 'Missing userId or data' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update profile
      if (data.full_name) {
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ full_name: data.full_name })
          .eq('id', userId);

        if (error) throw error;
      }

      // Update email if provided
      if (data.email) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          email: data.email
        });

        if (error) throw error;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'User updated successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // RESET PASSWORD
    if (action === 'reset-password') {
      if (!userId || !data?.password) {
        return new Response(
          JSON.stringify({ error: 'Missing userId or password' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (data.password.length < 8) {
        return new Response(
          JSON.stringify({ error: 'Password must be at least 8 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'Password reset successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE USER
    if (action === 'delete') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Missing userId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete user (will cascade delete profile due to FK)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'User deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UPDATE SUBSCRIPTION
    if (action === 'update-subscription') {
      if (!data?.agencyId || !data?.plan) {
        return new Response(
          JSON.stringify({ error: 'Missing agencyId or plan' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const planDurations: Record<string, number> = { 
        'free': 14, 
        'monthly': 32, 
        'yearly': 370 
      };
      
      const normalizedPlan = data.plan.toLowerCase();
      const durationDays = planDurations[normalizedPlan] || 14;
      
      const now = new Date();
      const expiryDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const { error } = await supabaseAdmin
        .from('agencies')
        .update({
          subscription_plan: normalizedPlan,
          license_expiry: expiryDate.toISOString(),
          license_active: true,
          license_status: 'active'
        })
        .eq('id', data.agencyId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'Subscription updated successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in manage-users function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
