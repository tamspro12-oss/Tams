import { corsHeaders } from '../_shared/cors.ts';

const CURRENT_VERSION = '3.2.1'; // Update this with each deployment

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📱 Version check requested');

    const response = {
      version: CURRENT_VERSION,
      timestamp: new Date().toISOString(),
      changelog: {
        '3.2.0': [
          'Professional update system with iOS support',
          'Auto-sync and pull-to-refresh gestures',
          'Enhanced mobile experience with haptic feedback',
          'Improved performance and caching',
        ],
        '3.1.1': [
          'Improved mobile UI with better spacing',
          'Enhanced calculator layout for mobile',
          'Fixed Settings/Storage button accessibility',
        ],
      },
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        } 
      }
    );
  } catch (error) {
    console.error('❌ Version check error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to check version' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
