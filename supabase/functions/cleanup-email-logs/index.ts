import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface CleanupResult {
  agency_id: string;
  agency_name: string;
  deleted_count: number;
  cutoff_date: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Require a shared cron secret so this maintenance endpoint cannot be triggered anonymously
  const cronSecret = req.headers.get('x-cron-secret');
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected || cronSecret !== expected) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('[Email Cleanup] Starting automatic email log cleanup...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all agencies with cleanup enabled
    const { data: agencies, error: agenciesError } = await supabase
      .from('agencies')
      .select('id, name, email_cleanup_enabled, email_cleanup_keep_days')
      .eq('email_cleanup_enabled', true);

    if (agenciesError) {
      console.error('[Email Cleanup] Error fetching agencies:', agenciesError);
      throw agenciesError;
    }

    if (!agencies || agencies.length === 0) {
      console.log('[Email Cleanup] No agencies with cleanup enabled');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No agencies with cleanup enabled',
          results: []
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    console.log(`[Email Cleanup] Processing ${agencies.length} agencies`);

    const results: CleanupResult[] = [];

    // Process each agency
    for (const agency of agencies) {
      const keepDays = agency.email_cleanup_keep_days || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);
      const cutoffIso = cutoffDate.toISOString();

      console.log(`[Email Cleanup] Processing agency: ${agency.name} (${agency.id})`);
      console.log(`[Email Cleanup] Deleting logs older than: ${cutoffIso} (${keepDays} days)`);

      // Delete old email logs for this agency
      const { data: deletedLogs, error: deleteError } = await supabase
        .from('email_logs')
        .delete()
        .eq('agency_id', agency.id)
        .lt('sent_at', cutoffIso)
        .select('id');

      if (deleteError) {
        console.error(`[Email Cleanup] Error deleting logs for agency ${agency.name}:`, deleteError);
        continue;
      }

      const deletedCount = deletedLogs?.length || 0;
      console.log(`[Email Cleanup] ✓ Deleted ${deletedCount} logs for agency: ${agency.name}`);

      results.push({
        agency_id: agency.id,
        agency_name: agency.name,
        deleted_count: deletedCount,
        cutoff_date: cutoffIso,
      });
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.deleted_count, 0);
    console.log(`[Email Cleanup] ✓ Cleanup complete. Total logs deleted: ${totalDeleted}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleanup complete. Deleted ${totalDeleted} email logs across ${results.length} agencies`,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('[Email Cleanup] ✗ Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to cleanup email logs',
        details: error.toString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
};

serve(handler);
