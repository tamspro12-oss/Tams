import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Plan duration mappings (in days)
const PLAN_DURATIONS: Record<string, number> = {
  'free': 14,
  'monthly': 32,
  'yearly': 370,
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

    // Get the authorization header to verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the requesting user is an admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
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
      console.error(`Forbidden: Non-admin ${user.email} attempted to modify subscription`);
      return new Response(
        JSON.stringify({ error: '403 Forbidden: Administrator privileges are restricted exclusively to usmn4u@gmail.com' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { agency_id, plan } = await req.json();

    // Validate input
    if (!agency_id || !plan) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: agency_id and plan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate plan
    const normalizedPlan = plan.toLowerCase();
    if (!PLAN_DURATIONS[normalizedPlan]) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid plan. Must be one of: ${Object.keys(PLAN_DURATIONS).join(', ')}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify agency exists
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

    // Calculate expiry date
    const now = new Date();
    const durationDays = PLAN_DURATIONS[normalizedPlan];
    const expiryDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Update agency subscription
    const { error: updateError } = await supabaseAdmin
      .from('agencies')
      .update({
        subscription_plan: normalizedPlan,
        license_expiry: expiryDate.toISOString(),
        license_active: true,
        license_status: 'active'
      })
      .eq('id', agency_id);

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the action
    await supabaseAdmin
      .from('admin_audit_logs')
      .insert({
        admin_user_id: user.id,
        action_type: 'subscription_update',
        target_type: 'agency',
        target_id: agency_id,
        target_name: agency.name,
        new_value: {
          plan: normalizedPlan,
          expiry_date: expiryDate.toISOString(),
          duration_days: durationDays
        }
      });

    console.log(`Subscription updated for agency ${agency.name}: ${normalizedPlan} (expires: ${expiryDate.toISOString()})`);

    return new Response(
      JSON.stringify({ 
        success: true,
        agency_name: agency.name,
        plan: normalizedPlan,
        expiry_date: expiryDate.toISOString(),
        days_until_expiry: durationDays
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in manage-subscription function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
