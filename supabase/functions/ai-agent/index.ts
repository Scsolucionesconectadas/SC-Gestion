import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SC_CONTEXT = `
SC Soluciones Conectadas es un emprendimiento tecnológico de Concepción del Uruguay, Entre Ríos.
Trabaja con desarrollo de software a medida, CRM/ERP, integraciones, APIs, automatización con n8n/Node-RED,
IA aplicada, dashboards y análisis de datos, apps y automatización industrial.
El enfoque comercial es asesorar antes de vender, entender el proceso actual, detectar un problema concreto
y proponer una solución pequeña y escalable. No afirmar problemas no verificados como hechos.
`;

const PROSPECTING_PROMPT = `
Sos el Agente Comercial de SC Soluciones Conectadas.
Tu tarea es investigar posibles clientes usando información pública actual y devolver oportunidades accionables.

REGLAS:
- Priorizá Concepción del Uruguay y, cuando se solicite, Colón, San José, Villa Elisa, Caseros y Gualeguaychú.
- Evitá duplicar negocios que ya están en el CRM.
- No inventes teléfonos, WhatsApp, emails, webs, nombres de responsables ni necesidades.
- Si un dato no está confirmado, devolvelo como null y explicá qué sí pudiste verificar.
- Separá HECHOS PÚBLICOS de HIPÓTESIS COMERCIALES.
- La oportunidad debe explicar por qué SC podría aportar, sin afirmar que el negocio tiene un problema.
- Para cada negocio generá un mensaje inicial breve, personalizado y profesional en español rioplatense.
- Presentá a SC como "un emprendimiento tecnológico de Concepción del Uruguay".
- Si encontrás fuentes, incluí URLs públicas en sources.
- No hagas rankings absolutos. Usá fit: alto/medio/bajo únicamente como afinidad técnica observable, explicando el motivo.
- Respondé SOLO JSON válido, sin markdown.

ESQUEMA DE RESPUESTA:
{
  "summary": "string",
  "leads": [
    {
      "business_name": "string",
      "sector": "string|null",
      "city": "string|null",
      "public_contact": {
        "contact_name": "string|null",
        "phone": "string|null",
        "email": "string|null",
        "website": "string|null",
        "social": "string|null"
      },
      "verified_facts": ["string"],
      "opportunity_hypotheses": ["string"],
      "suggested_solution_angle": "string",
      "fit": "alto|medio|bajo",
      "fit_reason": "string",
      "message_draft": "string",
      "sources": ["https://..."]
    }
  ]
}
`;

const QUOTE_PROMPT = `
Sos el Agente de Presupuestos de SC Soluciones Conectadas.
Preparás estimaciones profesionales para revisión humana antes de enviarlas a un cliente.

REGLAS:
- Primero proceso, luego tecnología; la decisión final y el precio final son humanos.
- Usá el catálogo interno de precios que recibas como fuente principal.
- No inventes tarifas internas faltantes. Si falta un valor necesario, marcá requires_pricing_input=true.
- Separá costos únicos de costos recurrentes.
- Considerá desarrollo, análisis/relevamiento, diseño cuando corresponda, integraciones/APIs, migración,
  infraestructura/hosting, dominio, servicios de terceros, mantenimiento, soporte, capacitación y contingencia.
- Evitá doble contabilización.
- Explicá supuestos, exclusiones, riesgos y qué puede cambiar el monto.
- Si se habilita investigación de hosting, podés usar búsqueda web para referencias actuales, pero deben aparecer
  como costos externos estimados y nunca como tarifa interna definitiva de SC.
- Generá un rango recomendado y un total sugerido solo cuando los datos permitan hacerlo.
- Respondé SOLO JSON válido, sin markdown.

ESQUEMA DE RESPUESTA:
{
  "title": "string",
  "executive_summary": "string",
  "requires_pricing_input": true,
  "missing_pricing_inputs": ["string"],
  "assumptions": ["string"],
  "scope": ["string"],
  "one_time_items": [
    {"item":"string","quantity":1,"unit":"string","unit_price":0,"subtotal":0,"source":"catalog|assumption|external_reference"}
  ],
  "recurring_items": [
    {"item":"string","billing_cycle":"monthly|annual","quantity":1,"unit_price":0,"subtotal":0,"source":"catalog|external_reference"}
  ],
  "optional_items": [
    {"item":"string","estimated_price":0,"note":"string"}
  ],
  "one_time_total": 0,
  "monthly_total": 0,
  "recommended_range": {"min":0,"max":0,"currency":"ARS"},
  "delivery_estimate": "string",
  "risks": ["string"],
  "exclusions": ["string"],
  "client_questions": ["string"],
  "internal_review_notes": ["string"],
  "external_sources": ["https://..."]
}
`;

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const chunks: string[] = [];
  for (const item of payload?.output ?? []) {
    if (item?.type !== 'message') continue;
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content?.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
}

function parseJson(text: string) {
  const clean = text.trim()
    .replace(/^\`\`\`json\s*/i, '')
    .replace(/^\`\`\`\s*/i, '')
    .replace(/\s*\`\`\`$/, '');
  return JSON.parse(clean);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const openaiKey = Deno.env.get('OPENAI_API_KEY');

  if (!supabaseUrl || !anonKey || !openaiKey) {
    return new Response(JSON.stringify({ error: 'Missing server configuration' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const authHeader = req.headers.get('Authorization') || '';
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: profile } = await supabase.from('profiles').select('id,full_name,role,active').eq('id', userData.user.id).single();
  if (!profile?.active) {
    return new Response(JSON.stringify({ error: 'Inactive user' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const body = await req.json();
  const agentType = body?.agent_type;
  if (!['prospecting','quote'].includes(agentType)) {
    return new Response(JSON.stringify({ error: 'Unsupported agent_type' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let model = Deno.env.get(agentType === 'prospecting' ? 'OPENAI_PROSPECTING_MODEL' : 'OPENAI_QUOTE_MODEL')
    || (agentType === 'prospecting' ? 'gpt-5.6-terra' : 'gpt-5.6-sol');

  let instructions = SC_CONTEXT + '\n' + (agentType === 'prospecting' ? PROSPECTING_PROMPT : QUOTE_PROMPT);
  let inputContext: any = body?.input ?? {};
  let tools: any[] = [];

  if (agentType === 'prospecting') {
    const { data: existing } = await supabase.from('prospects').select('business_name,sector,city').limit(2000);
    inputContext = {
      ...inputContext,
      existing_crm_businesses: (existing ?? []).map((x:any)=>x.business_name)
    };
    tools = [{ type: 'web_search' }];
  } else {
    const { data: catalog } = await supabase.from('pricing_catalog')
      .select('code,label,category,unit,currency,cost_amount,sell_amount,billing_cycle,notes')
      .eq('active', true)
      .order('category')
      .order('label');

    let prospect = null;
    if (body?.prospect_id) {
      const { data: p } = await supabase.from('prospects').select('*').eq('id', body.prospect_id).single();
      prospect = p;
    }

    inputContext = {
      ...inputContext,
      prospect,
      pricing_catalog: catalog ?? []
    };

    if (body?.input?.research_hosting_market === true) {
      tools = [{ type: 'web_search' }];
    }
  }

  const openaiBody: any = {
    model,
    instructions,
    input: JSON.stringify(inputContext),
    store: false
  };
  if (tools.length) openaiBody.tools = tools;

  const runInsert = await supabase.from('agent_runs').insert({
    user_id: userData.user.id,
    prospect_id: body?.prospect_id ?? null,
    agent_type: agentType,
    request: body,
    status: 'running',
    model
  }).select('id').single();

  const runId = runInsert.data?.id ?? null;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + openaiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(openaiBody)
    });

    const raw = await response.json();
    if (!response.ok) throw new Error(raw?.error?.message || 'OpenAI request failed');

    const text = extractOutputText(raw);
    let parsed: any;
    try {
      parsed = parseJson(text);
    } catch {
      parsed = { raw_text: text, parse_warning: 'The model response was not valid JSON.' };
    }

    if (runId) {
      await supabase.from('agent_runs').update({ response: parsed, status: 'completed' }).eq('id', runId);
    }

    return new Response(JSON.stringify({ run_id: runId, agent_type: agentType, model, result: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (runId) {
      await supabase.from('agent_runs').update({ status: 'failed', error_message: String(error?.message || error) }).eq('id', runId);
    }
    return new Response(JSON.stringify({ error: String(error?.message || error), run_id: runId }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
