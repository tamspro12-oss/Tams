import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

/**
 * Parse free-form booking text (airline confirmation email, GDS PNR dump,
 * WhatsApp message, forwarded itinerary) into structured booking fields.
 * READ-ONLY: never writes to DB. Returns JSON for the client to prefill a form.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { text } = await req.json() as { text?: string };
    if (!text || typeof text !== 'string' || text.trim().length < 5) {
      return new Response(JSON.stringify({ error: 'Please paste booking text (email, PNR, WhatsApp message).' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (text.length > 30_000) {
      return new Response(JSON.stringify({ error: 'Text too long (max 30 000 chars).' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `You are a travel booking parser. Read the message below (an airline confirmation email, GDS PNR, WhatsApp text, or forwarded itinerary — in any language) and extract booking fields.

Return ONLY a JSON object with these keys (use "" for unknown text, 0 for unknown numbers, [] for empty arrays):
{
  "pnr": "",
  "airline": "",
  "flight_number": "",
  "class": "",
  "departure_date": "YYYY-MM-DD",
  "departure_time": "HH:mm",
  "arrival_date": "YYYY-MM-DD",
  "arrival_time": "HH:mm",
  "origin": "",
  "destination": "",
  "sector": "",
  "trip_type": "one_way|round_trip|multi_city",
  "passengers": [
    { "full_name": "", "passport_number": "", "type": "adult|child|infant" }
  ],
  "fare": 0,
  "currency": "",
  "vendor_name": "",
  "booking_reference": "",
  "notes": ""
}

Message:
"""
${text}
"""`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are a precise multilingual travel booking parser. Always return valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      const status = aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500;
      return new Response(JSON.stringify({ error: `AI error: ${errText.slice(0, 300)}` }), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content || '{}';
    let fields: any = {};
    try {
      fields = typeof content === 'string' ? JSON.parse(content) : content;
    } catch {
      const match = String(content).match(/\{[\s\S]*\}/);
      fields = match ? JSON.parse(match[0]) : {};
    }

    return new Response(JSON.stringify({ ok: true, fields }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Parse failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
