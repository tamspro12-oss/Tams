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
      const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select(`
          id,
          full_name,
          agency_id,
          created_at,
          agencies!inner (
            id,
            name,
            subscription_plan,
            license_expiry,
            license_status
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user emails and roles
      const userIds = profiles.map(p => p.id);
      
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const userEmailMap = new Map(authUsers.users.map(u => [u.id, u.email]));

      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      // Get active session counts for all users
      const sessionCountMap = new Map<string, number>();
      try {
        // Query auth.sessions table directly using RPC
        const { data: sessionData, error: sessionError } = await supabaseAdmin.rpc('get_active_session_counts');
        
        if (!sessionError && sessionData) {
          sessionData.forEach((row: any) => {
            sessionCountMap.set(row.user_id, row.session_count);
          });
        }
      } catch (e) {
        console.log('Could not fetch session counts:', e);
        // Set all to 0 if query fails
        userIds.forEach(id => sessionCountMap.set(id, 0));
      }

      const enrichedProfiles = profiles.map(profile => {
        const agency = Array.isArray(profile.agencies) ? profile.agencies[0] : profile.agencies;
        
        return {
          ...profile,
          email: userEmailMap.get(profile.id) || 'N/A',
          role: roleMap.get(profile.id) || 'user',
          agency_name: agency?.name || 'N/A',
          subscription_plan: agency?.subscription_plan || 'free',
          license_expiry: agency?.license_expiry,
          license_status: agency?.license_status,
          active_sessions: sessionCountMap.get(profile.id) || 0
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
