import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SubUser {
  id?: string;
  user_id?: string;
  main_user_id: string;
  agency_id: string;
  sub_id_code?: string;
  permissions: any;
  is_active?: boolean;
  email?: string;
  password?: string;
  full_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, sub_user_id, data } = await req.json();

    console.log(`[manage-sub-users] Action: ${action}, User: ${user.id}`);

    // Service role client for privileged operations (RLS bypass) — used only
    // after we validate the caller's authorization server-side.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Strict RBAC check via public.user_roles table (role = 'super_admin')
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    const isSuperAdmin = !roleError && roleRow?.role === 'super_admin';

    // Look up the caller's own agency_id server-side. This is the ONLY value
    // we trust for scoping — never accept agency_id from the client body.
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .maybeSingle();
    const callerAgencyId = callerProfile?.agency_id ?? null;

    switch (action) {
      case 'list': {
        // Use service role for Super Admin to bypass RLS and see all agencies
        const queryClient = isSuperAdmin ? supabaseAdmin : supabaseClient;
        
        let query = queryClient.from('sub_users').select(`
          *,
          agencies(name)
        `);

        // Only filter by main_user_id for non-Super Admin users
        if (!isSuperAdmin) {
          query = query.eq('main_user_id', user.id);
        }

        const { data: subUsers, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ sub_users: subUsers }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-count': {
        const { data: count, error } = await supabaseClient
          .rpc('count_sub_users', { _main_user_id: user.id });

        if (error) throw error;

        return new Response(JSON.stringify({ count }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create': {
        const { email, password, full_name, permissions } = data as SubUser;

        // Ignore any client-supplied agency_id. The sub-user is always
        // created inside the caller's own agency (super-admins would need
        // a different, explicit admin-only path).
        if (!callerAgencyId) {
          return new Response(
            JSON.stringify({ error: 'Forbidden: caller has no agency' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const agency_id = callerAgencyId;

        // Check limit (max 2 Sub IDs per Main ID)
        if (!isSuperAdmin) {
          const { data: count } = await supabaseClient
            .rpc('count_sub_users', { _main_user_id: user.id });
          
          if (count >= 2) {
            return new Response(JSON.stringify({ error: 'Maximum 2 Sub Users allowed' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        // Get agency name for sub_id_code generation (server-side lookup only).
        const { data: agency, error: agencyError } = await supabaseAdmin
          .from('agencies')
          .select('name')
          .eq('id', agency_id)
          .maybeSingle();

        if (agencyError || !agency) {
          return new Response(
            JSON.stringify({ error: 'Forbidden: invalid agency' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate unique sub_id_code
        const prefix = agency?.name?.substring(0, 3).toUpperCase() || 'SUB';
        const random = Math.floor(1000 + Math.random() * 9000);
        const sub_id_code = `SUB-${prefix}-${random}`;

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });

        if (createError) throw createError;

        // Create profile
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: newUser.user.id,
            agency_id,
            full_name,
          });

        if (profileError) throw profileError;

        // Create sub_user record
        const { data: subUser, error: subUserError } = await supabaseAdmin
          .from('sub_users')
          .insert({
            user_id: newUser.user.id,
            main_user_id: user.id,
            agency_id,
            sub_id_code,
            permissions,
          })
          .select()
          .single();

        if (subUserError) throw subUserError;

        console.log(`[manage-sub-users] Created Sub ID: ${sub_id_code}`);

        return new Response(JSON.stringify({ sub_user: subUser }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update': {
        const { permissions, is_active } = data;

        // Use service role for Super Admin to bypass RLS
        const updateClient = isSuperAdmin ? supabaseAdmin : supabaseClient;

        const { data: subUser, error } = await updateClient
          .from('sub_users')
          .update({ permissions, is_active })
          .eq('id', sub_user_id)
          .select()
          .single();

        if (error) throw error;

        console.log(`[manage-sub-users] Updated Sub ID: ${sub_user_id}`);

        return new Response(JSON.stringify({ sub_user: subUser }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete': {
        // Use service role for Super Admin to bypass RLS
        const deleteClient = isSuperAdmin ? supabaseAdmin : supabaseClient;
        
        // Delete sub_user record (cascade will handle auth user deletion)
        const { data: subUser } = await deleteClient
          .from('sub_users')
          .select('user_id')
          .eq('id', sub_user_id)
          .single();

        if (!subUser) {
          throw new Error('Sub user not found');
        }

        // Delete auth user (this will cascade delete profile and sub_user)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(subUser.user_id);
        if (deleteError) throw deleteError;

        console.log(`[manage-sub-users] Deleted Sub ID: ${sub_user_id}`);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('[manage-sub-users] Error:', error);
    return new Response(JSON.stringify({ error: 'Request failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
