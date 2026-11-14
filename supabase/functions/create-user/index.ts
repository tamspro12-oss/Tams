import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key
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

    // Get the authorization header to verify admin role
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the JWT token and get the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Strict RBAC check via public.user_roles table (role = 'super_admin')
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    const isSuperAdmin = !roleError && roleRow?.role === 'super_admin';

    if (!isSuperAdmin) {
      console.error(`Forbidden: Unauthorized user ${user.id} attempted admin create-user.`);
      return new Response(
        JSON.stringify({ error: '403 Forbidden: super_admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { email, password, full_name, agency_id, agency_name, subscription_plan } = await req.json();

    // Validate input
    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, full_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Must provide either agency_id OR agency_name (not both)
    if (!agency_id && !agency_name) {
      return new Response(
        JSON.stringify({ error: 'Must provide either agency_id or agency_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let finalAgencyId: string;
    let agencyNameForLog: string;

    // Create new agency if agency_name provided
    if (agency_name) {
      const planDurations: Record<string, number> = { 'free': 14, 'monthly': 32, 'yearly': 370 };
      const normalizedPlan = subscription_plan ? subscription_plan.toLowerCase() : 'free';
      
      const now = new Date();
      const durationDays = planDurations[normalizedPlan] || 14;
      const expiryDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const { data: newAgency, error: createAgencyError } = await supabaseAdmin
        .from('agencies')
        .insert({
          name: agency_name,
          license_key: 'KEY-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
          subscription_plan: normalizedPlan,
          license_expiry: expiryDate.toISOString(),
          license_active: true,
          license_status: 'active'
        })
        .select('id, name')
        .single();

      if (createAgencyError || !newAgency) {
        console.error('Error creating agency:', createAgencyError);
        return new Response(
          JSON.stringify({ error: 'Failed to create agency: ' + createAgencyError?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      finalAgencyId = newAgency.id;
      agencyNameForLog = newAgency.name;
    } else {
      // Use existing agency
      const { data: agency, error: agencyError } = await supabaseAdmin
        .from('agencies')
        .select('id, name')
        .eq('id', agency_id)
        .single();

      if (agencyError || !agency) {
        return new Response(
          JSON.stringify({ error: 'Agency not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      finalAgencyId = agency.id;
      agencyNameForLog = agency.name;

      // Update subscription if plan provided
      if (subscription_plan) {
        const planDurations: Record<string, number> = { 'free': 14, 'monthly': 32, 'yearly': 370 };
        const normalizedPlan = subscription_plan.toLowerCase();
        
        if (planDurations[normalizedPlan]) {
          const now = new Date();
          const durationDays = planDurations[normalizedPlan];
          const expiryDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
          
          await supabaseAdmin
            .from('agencies')
            .update({
              subscription_plan: normalizedPlan,
              license_expiry: expiryDate.toISOString(),
              license_active: true,
              license_status: 'active'
            })
            .eq('id', finalAgencyId);
        }
      }
    }

    // Create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name,
        agency_id: finalAgencyId
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the profile with agency_id (trigger should create it)
    await supabaseAdmin
      .from('profiles')
      .update({ agency_id: finalAgencyId })
      .eq('id', newUser.user.id);

    console.log('User created successfully:', email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          full_name
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-user function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
