import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';
import {
  ChatGptPlanError,
  consumeResponsesStream,
  ensureAccessToken,
  getChatGptConnection,
  refreshConnectionModels
} from '../_shared/chatgpt-plan.ts';

const DEFAULT_ORIGINS = [
  'https://erp.scsolucionesconectadas.com.ar',
  'http://127.0.0.1:4173',
  'http://localhost:4173'
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SC_CONTEXT = `
SC Soluciones Conectadas es un emprendimiento tecnológico de Concepción del Uruguay, Entre Ríos.
Trabaja con desarrollo de software a medida, CRM/ERP, integraciones, APIs, automatización con n8n/Node-RED,
IA aplicada, dashboards y análisis de datos, aplicaciones y automatización industrial.
El enfoque comercial es asesorar antes de vender, entender el proceso actual, detectar una ineficiencia concreta
y proponer una solución pequeña y escalable. No afirmar problemas no verificados como hechos.
`;

const PROSPECTING_PROMPT = `
Sos el Agente Comercial de SC Soluciones Conectadas.
Investigá posibles clientes con información pública actual y devolvé oportunidades accionables.

REGLAS:
- Priorizá la ubicación solicitada y evitá duplicar negocios que ya están en el CRM.
- No inventes teléfonos, emails, responsables, necesidades ni fuentes.
- Separá hechos públicos verificados de hipótesis comerciales.
- Si un dato no está confirmado, devolvelo como null.
- La afinidad alto/medio/bajo debe explicarse con evidencia observable.
- Ningún mensaje se envía automáticamente.
`;

const QUOTE_PROMPT = `
Sos el Agente de Presupuestos de SC Soluciones Conectadas.
Preparás estimaciones internas para revisión humana antes de enviarlas a un cliente.

REGLAS:
- Usá el catálogo interno recibido como única fuente de tarifas de SC.
- No inventes importes faltantes; marcá requires_pricing_input=true.
- Separá costos únicos, recurrentes y opcionales.
- Explicá supuestos, exclusiones, riesgos y preguntas pendientes.
- Ninguna estimación es una factura ni una propuesta final aprobada.
`;

const PROSPECTING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'leads'],
  properties: {
    summary: { type: 'string' },
    leads: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'business_name', 'sector', 'city', 'public_contact', 'verified_facts',
          'opportunity_hypotheses', 'suggested_solution_angle', 'fit',
          'fit_reason', 'message_draft', 'sources'
        ],
        properties: {
          business_name: { type: 'string' },
          sector: { type: ['string', 'null'] },
          city: { type: ['string', 'null'] },
          public_contact: {
            type: 'object',
            additionalProperties: false,
            required: ['contact_name', 'phone', 'email', 'website', 'social'],
            properties: {
              contact_name: { type: ['string', 'null'] },
              phone: { type: ['string', 'null'] },
              email: { type: ['string', 'null'] },
              website: { type: ['string', 'null'] },
              social: { type: ['string', 'null'] }
            }
          },
          verified_facts: { type: 'array', items: { type: 'string' } },
          opportunity_hypotheses: { type: 'array', items: { type: 'string' } },
          suggested_solution_angle: { type: 'string' },
          fit: { type: 'string', enum: ['alto', 'medio', 'bajo'] },
          fit_reason: { type: 'string' },
          message_draft: { type: 'string' },
          sources: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }
};

const QUOTE_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['item', 'quantity', 'unit', 'unit_price', 'subtotal', 'source'],
  properties: {
    item: { type: 'string' },
    quantity: { type: 'number' },
    unit: { type: 'string' },
    unit_price: { type: 'number' },
    subtotal: { type: 'number' },
    source: { type: 'string', enum: ['catalog', 'assumption', 'external_reference'] }
  }
};

const QUOTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title', 'executive_summary', 'requires_pricing_input', 'missing_pricing_inputs',
    'assumptions', 'scope', 'one_time_items', 'recurring_items', 'optional_items',
    'one_time_total', 'monthly_total', 'recommended_range', 'delivery_estimate',
    'risks', 'exclusions', 'client_questions', 'internal_review_notes', 'external_sources'
  ],
  properties: {
    title: { type: 'string' },
    executive_summary: { type: 'string' },
    requires_pricing_input: { type: 'boolean' },
    missing_pricing_inputs: { type: 'array', items: { type: 'string' } },
    assumptions: { type: 'array', items: { type: 'string' } },
    scope: { type: 'array', items: { type: 'string' } },
    one_time_items: { type: 'array', items: QUOTE_ITEM_SCHEMA },
    recurring_items: { type: 'array', items: QUOTE_ITEM_SCHEMA },
    optional_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['item', 'estimated_price', 'note'],
        properties: {
          item: { type: 'string' },
          estimated_price: { type: 'number' },
          note: { type: 'string' }
        }
      }
    },
    one_time_total: { type: 'number' },
    monthly_total: { type: 'number' },
    recommended_range: {
      type: 'object',
      additionalProperties: false,
      required: ['min', 'max', 'currency'],
      properties: {
        min: { type: 'number' },
        max: { type: 'number' },
        currency: { type: 'string', enum: ['ARS', 'USD'] }
      }
    },
    delivery_estimate: { type: 'string' },
    risks: { type: 'array', items: { type: 'string' } },
    exclusions: { type: 'array', items: { type: 'string' } },
    client_questions: { type: 'array', items: { type: 'string' } },
    internal_review_notes: { type: 'array', items: { type: 'string' } },
    external_sources: { type: 'array', items: { type: 'string' } }
  }
};

const GENERIC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'result_markdown', 'next_actions', 'warnings'],
  properties: {
    summary: { type: 'string' },
    result_markdown: { type: 'string' },
    next_actions: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } }
  }
};

function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...configured]);
}

function corsHeaders(origin: string): Record<string, string> {
  const selected = allowedOrigins().has(origin) ? origin : DEFAULT_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': selected,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jsonResponse(payload: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || '';
  const headers = corsHeaders(origin);

  if (origin && !allowedOrigins().has(origin)) return jsonResponse({ error: 'Origin not allowed' }, 403, headers);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, headers);

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > 100_000) return jsonResponse({ error: 'Request too large' }, 413, headers);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) return jsonResponse({ error: 'Service unavailable' }, 503, headers);

  const authHeader = req.headers.get('Authorization') || '';
  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: 'Unauthorized' }, 401, headers);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, headers);
  }

  const organizationId = String(body?.organization_id || '');
  if (!UUID_PATTERN.test(organizationId)) return jsonResponse({ error: 'Invalid organization' }, 400, headers);

  const { data: allowed, error: permissionError } = await supabase.rpc('current_user_has_permission', {
    target_organization_id: organizationId,
    requested_permission: 'agents.run'
  });
  if (permissionError || !allowed) return jsonResponse({ error: 'Forbidden' }, 403, headers);

  let connection;
  try {
    connection = await getChatGptConnection(admin, organizationId);
    if (!connection) {
      return jsonResponse({
        error: 'ChatGPT is not connected',
        code: 'CHATGPT_NOT_CONNECTED',
        message: 'ChatGPT todavia no esta conectado. Un propietario debe completar Configuracion > Integraciones.'
      }, 409, headers);
    }
  } catch (error) {
    const known = error instanceof ChatGptPlanError;
    return jsonResponse({
      error: known ? error.code : 'CHATGPT_CONNECTION_FAILED',
      code: known ? error.code : 'CHATGPT_CONNECTION_FAILED',
      message: known ? error.publicMessage : 'No se pudo consultar la conexion con ChatGPT.'
    }, known ? error.status : 500, headers);
  }

  const input = body?.input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return jsonResponse({ error: 'Invalid input' }, 400, headers);
  if (JSON.stringify(input).length > 20_000) return jsonResponse({ error: 'Input too large' }, 413, headers);

  let agentQuery = supabase.from('agent_definitions').select('*').eq('organization_id', organizationId).eq('status', 'active');
  if (body?.agent_id && UUID_PATTERN.test(String(body.agent_id))) agentQuery = agentQuery.eq('id', body.agent_id);
  else agentQuery = agentQuery.eq('slug', String(body?.agent_type || body?.agent_slug || ''));
  const { data: definition, error: definitionError } = await agentQuery.maybeSingle();
  if (definitionError || !definition) return jsonResponse({ error: 'Published agent not found' }, 404, headers);

  let snapshot: any = definition;
  if (definition.current_version > 0) {
    const { data: version } = await supabase.from('agent_versions').select('snapshot').eq('organization_id', organizationId).eq('agent_id', definition.id).eq('version', definition.current_version).maybeSingle();
    if (version?.snapshot) snapshot = { ...definition, ...version.snapshot };
  }
  const agentType = definition.slug;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('agent_runs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('user_id', userData.user.id)
    .gte('created_at', oneHourAgo);
  if ((count || 0) >= 20) return jsonResponse({ error: 'Hourly usage limit reached' }, 429, headers);

  let session;
  try {
    session = await ensureAccessToken(admin, connection);
    if (!Array.isArray(session.connection.models) || !session.connection.models.length) {
      session.connection = await refreshConnectionModels(admin, session.connection, session.accessToken);
    }
  } catch (error) {
    const known = error instanceof ChatGptPlanError;
    return jsonResponse({
      error: known ? error.code : 'CHATGPT_SESSION_FAILED',
      code: known ? error.code : 'CHATGPT_SESSION_FAILED',
      message: known ? error.publicMessage : 'No se pudo preparar la sesion de ChatGPT.'
    }, known ? error.status : 502, headers);
  }

  const availableModels = new Set((session.connection.models || []).map((item: any) => String(item.slug || '')));
  const requestedModel = String(snapshot.model || '');
  if (!requestedModel || !availableModels.has(requestedModel)) return jsonResponse({
    error: 'Agent model is not available for the connected account',
    code: 'MODEL_NOT_ALLOWED',
    message: requestedModel
      ? `El modelo ${requestedModel} no esta disponible para la cuenta de ChatGPT conectada.`
      : 'El agente no tiene un modelo de ChatGPT configurado.'
  }, 422, headers);
  const model = requestedModel;
  const specialistPrompt = agentType === 'prospecting' ? PROSPECTING_PROMPT : agentType === 'quote' ? QUOTE_PROMPT : '';
  const instructions = `${SC_CONTEXT}\n${specialistPrompt}\nCONFIGURACION PUBLICADA DEL AGENTE:\n${String(snapshot.instructions || '').slice(0, 20_000)}`;
  let inputContext: Record<string, unknown> = { ...input };
  let tools: Array<Record<string, unknown>> = [];

  if (agentType === 'prospecting') {
    const { data: existing, error } = await supabase
      .from('prospects')
      .select('business_name,sector,city')
      .eq('organization_id', organizationId)
      .limit(2000);
    if (error) return jsonResponse({ error: 'Could not load CRM context' }, 500, headers);
    inputContext = {
      ...inputContext,
      existing_crm_businesses: (existing || []).map((item: any) => item.business_name)
    };
    tools = [{ type: 'web_search' }];
  } else if (agentType === 'quote') {
    const { data: catalog, error: catalogError } = await supabase
      .from('pricing_catalog')
      .select('code,label,category,unit,currency,cost_amount,sell_amount,billing_cycle,notes')
      .eq('organization_id', organizationId)
      .eq('active', true)
      .order('category')
      .order('label');
    if (catalogError) return jsonResponse({ error: 'Could not load pricing context' }, 500, headers);

    let prospect = null;
    if (body?.prospect_id) {
      if (!UUID_PATTERN.test(String(body.prospect_id))) return jsonResponse({ error: 'Invalid prospect' }, 400, headers);
      const { data, error } = await supabase
        .from('prospects')
        .select('id,business_name,sector,city,need_interest,status,notes')
        .eq('organization_id', organizationId)
        .eq('id', body.prospect_id)
        .maybeSingle();
      if (error || !data) return jsonResponse({ error: 'Prospect not found' }, 404, headers);
      prospect = data;
    }

    inputContext = { ...inputContext, prospect, pricing_catalog: catalog || [] };
    if (body?.input?.research_hosting_market === true) tools = [{ type: 'web_search' }];
  } else {
    const sources = Array.isArray(snapshot.context_sources) ? snapshot.context_sources : [];
    if (sources.includes('prospects')) {
      const { data: prospects } = await supabase.from('prospects').select('business_name,sector,city,status,need_interest').eq('organization_id', organizationId).limit(250);
      inputContext.prospects = prospects || [];
    }
    if (sources.includes('pricing_catalog')) {
      const { data: catalog } = await supabase.from('pricing_catalog').select('code,label,category,unit,currency,sell_amount,billing_cycle,notes').eq('organization_id', organizationId).eq('active', true).limit(500);
      inputContext.pricing_catalog = catalog || [];
    }
    const configuredTools = Array.isArray(snapshot.tools) ? snapshot.tools : [];
    if (configuredTools.includes('web_search')) tools = [{ type: 'web_search' }];
  }

  const responseFormat = agentType === 'prospecting'
    ? { type: 'json_schema', name: 'prospecting_result', strict: true, schema: PROSPECTING_SCHEMA }
    : agentType === 'quote'
      ? { type: 'json_schema', name: 'quote_result', strict: true, schema: QUOTE_SCHEMA }
      : { type: 'json_schema', name: 'agent_result', strict: true, schema: GENERIC_SCHEMA };

  const startedAt = Date.now();

  const { data: run, error: runError } = await supabase
    .from('agent_runs')
    .insert({
      organization_id: organizationId,
      user_id: userData.user.id,
      prospect_id: body?.prospect_id || null,
      agent_type: agentType,
      agent_id: definition.id,
      agent_version: definition.current_version || null,
      request: { input, prospect_id: body?.prospect_id || null },
      status: 'running',
      model
    })
    .select('id')
    .single();
  if (runError || !run) return jsonResponse({ error: 'Could not register agent run' }, 500, headers);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        instructions,
        input: [{
          role: 'user',
          content: [{ type: 'input_text', text: JSON.stringify(inputContext) }]
        }],
        tools,
        text: { format: responseFormat },
        store: false,
        stream: true
      }),
      signal: AbortSignal.timeout(90_000)
    });
    const completed = await consumeResponsesStream(response);
    if (!completed.outputText) throw new ChatGptPlanError('CHATGPT_EMPTY_OUTPUT', 'ChatGPT no devolvio un resultado util.', 502);
    const result = JSON.parse(completed.outputText);

    await supabase
      .from('agent_runs')
      .update({
        response: result,
        status: 'completed',
        error_message: null,
        duration_ms: Date.now() - startedAt,
        input_tokens: completed.usage?.input_tokens || null,
        output_tokens: completed.usage?.output_tokens || null
      })
      .eq('organization_id', organizationId)
      .eq('id', run.id);

    return jsonResponse({ run_id: run.id, agent_id: definition.id, agent_type: agentType, agent_version: definition.current_version, model, result }, 200, headers);
  } catch (error) {
    const internalMessage = error instanceof Error ? error.message : String(error);
    const publicError = error instanceof ChatGptPlanError
      ? { code: error.code, message: error.publicMessage, status: error.status }
      : error instanceof SyntaxError
        ? { code: 'CHATGPT_INVALID_STRUCTURED_OUTPUT', message: 'ChatGPT devolvio una respuesta incompleta. Volve a ejecutar el agente.', status: 502 }
        : { code: 'AGENT_EXECUTION_FAILED', message: 'El agente no pudo completar esta ejecucion. Volve a intentar o revisa la integracion.', status: 502 };
    console.error('ai-agent execution failed', { run_id: run.id, message: internalMessage });
    await supabase
      .from('agent_runs')
      .update({ status: 'failed', error_message: internalMessage.slice(0, 500), duration_ms: Date.now() - startedAt })
      .eq('organization_id', organizationId)
      .eq('id', run.id);
    return jsonResponse({ error: 'The agent could not complete this request', code: publicError.code, message: publicError.message, run_id: run.id }, publicError.status, headers);
  }
});
