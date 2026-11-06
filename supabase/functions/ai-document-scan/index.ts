import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const SCHEMAS: Record<string, string> = {
  passport: `Extract passport fields. Return JSON with keys: full_name, given_names, surname, passport_number, nationality, date_of_birth (YYYY-MM-DD), gender, place_of_birth, issue_date (YYYY-MM-DD), expiry_date (YYYY-MM-DD), place_of_issue, mrz.`,
  cnic: `Extract Pakistani CNIC / ID card fields. If two images (front + back) are supplied, MERGE them. Return JSON with keys: full_name, father_name, cnic_number (formatted xxxxx-xxxxxxx-x), date_of_birth (YYYY-MM-DD), gender, address, issue_date, expiry_date.`,
  invoice: `Extract invoice / receipt / voucher fields. Return JSON with keys: vendor_name, invoice_number, amount (number), currency, date (YYYY-MM-DD), due_date, category (best guess: travel, hotel, flight, visa, office, salary, utility, fuel, food, other), pnr, airline, passenger_name, notes.`,
  ticket: `Extract airline ticket / e-ticket / itinerary fields. Return JSON with keys: pnr, airline, flight_number, passenger_name, passport_number, class, departure_date (YYYY-MM-DD), departure_time (HH:mm), arrival_date, arrival_time, origin, destination, fare (number), currency, notes.`,
  auto: `Detect document type from: passport, cnic, id_card, visa, ticket, invoice, receipt, hotel_voucher, other. If multiple images are supplied that belong to the same document (front+back ID, multi-page voucher), MERGE the fields. Return JSON with keys: doc_type, full_name, given_names, surname, document_number, passport_number, cnic_number, date_of_birth, expiry_date, issue_date, nationality, gender, address, amount, currency, vendor_name, invoice_number, pnr, airline, flight_number, departure_date, arrival_date, origin, destination, extra (object with anything else useful).`,
};

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

    const body = await req.json();
    let { files, fileBase64, mimeType, docType = 'auto', mode = 'single' } = body as {
      files?: Array<{ fileBase64: string; mimeType: string }>;
      fileBase64?: string; mimeType?: string; docType?: string;
      mode?: 'single' | 'bulk';
    };

    // Backward compatibility: single-file callers
    if ((!files || !files.length) && fileBase64 && mimeType) {
      files = [{ fileBase64, mimeType }];
    }
    if (!files || !files.length) {
      return new Response(JSON.stringify({ error: 'No files supplied' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (files.length > 5) {
      return new Response(JSON.stringify({ error: 'Max 5 files per scan' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let totalBytes = 0;
    for (const f of files) totalBytes += (f.fileBase64?.length || 0);
    if (totalBytes > 20_000_000) {
      return new Response(JSON.stringify({ error: 'Total upload too large (max ~15 MB)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const instruction = SCHEMAS[docType] || SCHEMAS.auto;
    const bulkInstruction = `BULK MODE — multi-passenger extraction with TICKET GROUPING.

The supplied files may contain MULTIPLE distinct persons (separate passports/IDs, or several documents in one photo, or a single ticket/PNR listing several passengers). Detect EACH person separately.

CRITICAL GROUPING RULES:
1. Front+back of the SAME ID → merge into ONE record.
2. Passengers that share the SAME ticket/booking (same PNR, same e-ticket number stem, same flight+date+booking reference, or listed together on one itinerary/invoice) → assign them the SAME "group_id" (a short stable slug like "grp-1", "grp-2"). Different tickets/PNRs → different group_id.
3. If grouping cannot be determined confidently, put every passenger in its own group.
4. Within each group, assign "seat_index" starting at 1 in the order they appear on the ticket (lead passenger = 1). Across groups, "seat_index" restarts at 1.
5. Also set a global "order_index" starting at 1 across ALL records in the order the AI encountered them (used as deterministic fallback).
6. Never merge two different people into one record — even if names look similar.

Return JSON: { "records": [ { ...one record per person... } ] }

Each record MUST include (use "" for unknown, 0 for unknown numbers):
  order_index (integer, 1-based, global),
  group_id (string, e.g. "grp-1"),
  seat_index (integer, 1-based within group),
  group_confidence (0..1 — how sure you are about the grouping),
  full_name, given_names, surname, doc_type (passport|cnic|id_card|visa|ticket|other),
  passport_number, cnic_number, document_number,
  date_of_birth (YYYY-MM-DD), gender, nationality,
  issue_date (YYYY-MM-DD), expiry_date (YYYY-MM-DD), place_of_issue,
  passenger_type (adult|child|infant — infer from DOB: <2y infant, <12y child, else adult),
  father_name, address, mrz,
  pnr, ticket_number, airline, flight_number, booking_reference,
  departure_date, arrival_date, origin, destination,
  source_file (filename or index the record came from),
  extra (object with anything else useful).

Sort records by group_id then seat_index. Respond with ONLY valid JSON. No prose, no markdown.`;


    const singleInstruction = `${instruction}\n\nIf multiple files are supplied, treat them as ONE logical document (e.g. passport pages, ID front+back, multi-page voucher) and MERGE all fields into a single JSON. Use "" for unknown text and 0 for unknown numbers. Respond with ONLY a single JSON object. No prose, no markdown.`;

    const userContent: any[] = [
      { type: 'text', text: mode === 'bulk' ? bulkInstruction : singleInstruction },
    ];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const dataUrl = `data:${f.mimeType};base64,${f.fileBase64}`;
      if (f.mimeType === 'application/pdf') {
        userContent.push({ type: 'file', file: { filename: `doc_${i + 1}.pdf`, file_data: dataUrl } });
      } else {
        userContent.push({ type: 'image_url', image_url: { url: dataUrl } });
      }
    }

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are a precise multilingual document data extractor. Always return valid JSON only.' },
          { role: 'user', content: userContent },
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
      fields = match ? JSON.parse(match[0]) : { raw: content };
    }

    const records = mode === 'bulk'
      ? (Array.isArray(fields?.records) ? fields.records : Array.isArray(fields) ? fields : [])
      : undefined;

    return new Response(JSON.stringify({ ok: true, docType, mode, fields, records, fileCount: files.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Scan failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
