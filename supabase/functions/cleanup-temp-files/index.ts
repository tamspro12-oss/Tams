import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

serve(async (req) => {
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log("Starting temporary files cleanup...");

    // Find expired temporary files
    const { data: expiredFiles, error: fetchError } = await supabaseClient
      .from('files')
      .select('id, path')
      .eq('is_temporary', true)
      .lt('expires_at', new Date().toISOString());

    if (fetchError) {
      console.error("Error fetching expired files:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredFiles?.length || 0} expired files`);

    if (!expiredFiles || expiredFiles.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No expired files to clean up",
          cleaned: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    let cleanedCount = 0;
    const errors: string[] = [];

    // Delete each file from storage and database
    for (const file of expiredFiles) {
      try {
        // Delete from storage
        const { error: storageError } = await supabaseClient.storage
          .from('agency-files')
          .remove([file.path]);

        if (storageError) {
          console.error(`Storage delete error for ${file.path}:`, storageError);
          errors.push(`Storage: ${file.path}`);
          continue;
        }

        // Delete metadata
        const { error: dbError } = await supabaseClient
          .from('files')
          .delete()
          .eq('id', file.id);

        if (dbError) {
          console.error(`DB delete error for ${file.id}:`, dbError);
          errors.push(`DB: ${file.id}`);
          continue;
        }

        cleanedCount++;
        console.log(`Cleaned up: ${file.path}`);
      } catch (error) {
        console.error(`Error cleaning file ${file.id}:`, error);
        errors.push(`Exception: ${file.id}`);
      }
    }

    const response = {
      message: `Cleanup completed: ${cleanedCount} files deleted`,
      cleaned: cleanedCount,
      total: expiredFiles.length,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log("Cleanup summary:", response);

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error('Cleanup function error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Cleanup failed'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
