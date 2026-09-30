import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.2.12';
import {
  CHATGPT_AUTHORIZE_URL,
  CHATGPT_ISSUER,
  CHATGPT_JWKS_URL,
  CHATGPT_RESOURCE,
  CHATGPT_SCOPES,
  ChatGptPlanError,
  decryptSecret,
  encryptSecret,
  ensureAccessToken,
  getChatGptConnection,
  listChatGptModels,
  oauthConfig,
  publicConnection,
  randomBase64Url,
  refreshConnectionModels,
  requestOAuthToken,
  revokeChatGptSession,
  sha256Base64Url
} from '../_shared/chatgpt-plan.ts';

const DEFAULT_ORIGINS = [
  'https://erp.scsolucionesconectadas.com.ar',
  'http://127.0.0.1:4173',
  'http://localhost:4173'
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWKS = createRemoteJWKSet(new URL(CHATGPT_JWKS_URL));

function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map((value) => value.trim()).filter(Boolean);
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
  return new Response(JSON.stringify(payload), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}

function redirectResult(returnTo: string, outcome: string, reason?: string): Response {
  const target = new URL(returnTo);
  target.searchParams.set('view', 'settings');
  target.searchParams.set('tab', 'integrations');
  target.searchParams.set('chatgpt', outcome);
  if (reason) target.searchParams.set('reason', reason);
  return Response.redirect(target.toString(), 303);
}

function safeReturnTo(raw: unknown): string {
  try {
    const target = new URL(String(raw || DEFAULT_ORIGINS[0]));
    if (!allowedOrigins().has(target.origin)) throw new Error('origin');
    target.hash = '';
    return target.toString();
  } catch {
    return `${DEFAULT_ORIGINS[0]}/?view=settings&tab=integrations`;
  }
}

function serverClients(authHeader = '') {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    throw new ChatGptPlanError('SERVER_CONFIGURATION_REQUIRED', 'El servicio de conexion no esta disponible.', 503);
  }
  return {
    userClient: createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    }),
    admin: createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  };
}

async function requireManager(req: Request, organizationId: string) {
  if (!UUID_PATTERN.test(organizationId)) throw new ChatGptPlanError('INVALID_ORGANIZATION', 'La empresa seleccionada no es valida.', 400);
  const { userClient, admin } = serverClients(req.headers.get('Authorization') || '');
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new ChatGptPlanError('UNAUTHORIZED', 'La sesion de SC Gestion vencio.', 401);
  const { data: allowed, error: permissionError } = await userClient.rpc('current_user_has_permission', {
    target_organization_id: organizationId,
    requested_permission: 'agents.manage'
  });
  if (permissionError || !allowed) throw new ChatGptPlanError('FORBIDDEN', 'No tenes permiso para administrar agentes.', 403);
  return { user: userData.user, admin };
}

function readinessPayload(connection: any = null) {
  const config = oauthConfig();
  const publicData = publicConnection(connection);
  const code = publicData?.connected
    ? 'CONNECTED'
    : !config.providerApproved
      ? 'CHATGPT_PROVIDER_ACCESS_REQUIRED'
      : !config.ready
        ? 'CHATGPT_SERVER_CONFIGURATION_REQUIRED'
        : 'CHATGPT_NOT_CONNECTED';
  const message = code === 'CONNECTED'
    ? 'Cuenta de ChatGPT conectada para la empresa activa.'
    : code === 'CHATGPT_PROVIDER_ACCESS_REQUIRED'
      ? 'SC debe recibir de OpenAI la habilitacion para usar planes de ChatGPT desde una aplicacion alojada.'
      : code === 'CHATGPT_SERVER_CONFIGURATION_REQUIRED'
        ? 'La integracion fue aprobada, pero faltan completar secretos del servidor.'
        : 'Todavia no hay una cuenta de ChatGPT conectada a esta empresa.';
  return {
    provider: 'ChatGPT',
    provider_approved: config.providerApproved,
    oauth_ready: config.ready,
    configured: config.ready,
    connected: Boolean(publicData?.connected),
    code,
    message,
    ...publicData
  };
}

async function handleAction(req: Request, headers: Record<string, string>) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    throw new ChatGptPlanError('INVALID_JSON', 'La solicitud no es valida.', 400);
  }
  const organizationId = String(body?.organization_id || '');
  const { user, admin } = await requireManager(req, organizationId);
  const action = String(body?.action || 'status');
  let connection = await getChatGptConnection(admin, organizationId);

  if (action === 'status') return jsonResponse(readinessPayload(connection), 200, headers);

  if (action === 'start') {
    const config = oauthConfig();
    if (!config.providerApproved) {
      throw new ChatGptPlanError(
        'CHATGPT_PROVIDER_ACCESS_REQUIRED',
        'OpenAI todavia debe habilitar a SC como aplicacion alojada para usar planes de ChatGPT.',
        409
      );
    }
    if (!config.ready) {
      throw new ChatGptPlanError('CHATGPT_SERVER_CONFIGURATION_REQUIRED', 'Falta completar la configuracion segura del servidor.', 503);
    }

    const transactionId = crypto.randomUUID();
    const state = randomBase64Url(32);
    const verifier = randomBase64Url(64);
    const nonce = randomBase64Url(32);
    const challenge = await sha256Base64Url(verifier);
    const switchAccount = body?.switch_account === true;
    const returnTo = safeReturnTo(body?.return_to);

    await admin.from('chatgpt_oauth_transactions').delete().lt('expires_at', new Date().toISOString());
    const { error } = await admin.from('chatgpt_oauth_transactions').insert({
      id: transactionId,
      state_hash: await sha256Base64Url(state),
      organization_id: organizationId,
      user_id: user.id,
      pkce_verifier_encrypted: await encryptSecret(verifier, `chatgpt-oauth:${transactionId}`),
      nonce,
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      return_to: returnTo,
      switch_account: switchAccount,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });
    if (error) throw new ChatGptPlanError('CHATGPT_TRANSACTION_FAILED', 'No se pudo iniciar la conexion con ChatGPT.', 500, error.message);

    const params: Record<string, string> = {
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: CHATGPT_SCOPES.join(' '),
      resource: CHATGPT_RESOURCE,
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    };
    if (config.hostId) params.ext_agent_host_id = config.hostId;
    if (switchAccount) params.prompt = 'select_account';
    if (connection && !switchAccount) {
      params.login_hint = connection.account_email || '';
      try {
        params.id_token_hint = await decryptSecret(connection.id_token_encrypted, `chatgpt:${organizationId}:id`);
      } catch {
        delete params.id_token_hint;
      }
    }
    Object.keys(params).forEach((key) => { if (!params[key]) delete params[key]; });
    return jsonResponse({ authorization_url: `${CHATGPT_AUTHORIZE_URL}?${new URLSearchParams(params)}` }, 200, headers);
  }

  if (action === 'models' || action === 'verify') {
    if (!connection) throw new ChatGptPlanError('CHATGPT_NOT_CONNECTED', 'ChatGPT no esta conectado para esta empresa.', 409);
    const session = await ensureAccessToken(admin, connection);
    connection = await refreshConnectionModels(admin, session.connection, session.accessToken);
    return jsonResponse(readinessPayload(connection), 200, headers);
  }

  if (action === 'disconnect') {
    if (!connection) return jsonResponse({ disconnected: true, remote_revocation_confirmed: true }, 200, headers);
    const revoked = await revokeChatGptSession(connection);
    const { error } = await admin.from('chatgpt_connections').delete().eq('id', connection.id);
    if (error) throw new ChatGptPlanError('CHATGPT_DISCONNECT_FAILED', 'No se pudo desconectar la cuenta de ChatGPT.', 500, error.message);
    return jsonResponse({ disconnected: true, remote_revocation_confirmed: revoked }, 200, headers);
  }

  throw new ChatGptPlanError('INVALID_ACTION', 'La operacion solicitada no existe.', 400);
}

async function handleCallback(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get('state') || '';
  const { admin } = serverClients();
  if (!state) return redirectResult(`${DEFAULT_ORIGINS[0]}/`, 'error', 'invalid_state');

  const stateHash = await sha256Base64Url(state);
  const now = new Date().toISOString();
  const { data: transaction, error: lookupError } = await admin
    .from('chatgpt_oauth_transactions')
    .select('*')
    .eq('state_hash', stateHash)
    .gt('expires_at', now)
    .is('consumed_at', null)
    .maybeSingle();
  if (lookupError || !transaction) return redirectResult(`${DEFAULT_ORIGINS[0]}/`, 'error', 'invalid_state');

  const { data: consumed, error: consumeError } = await admin
    .from('chatgpt_oauth_transactions')
    .update({ consumed_at: now })
    .eq('id', transaction.id)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle();
  if (consumeError || !consumed) return redirectResult(transaction.return_to, 'error', 'invalid_state');
  if (url.searchParams.get('error')) return redirectResult(transaction.return_to, 'error', 'access_denied');

  try {
    const code = url.searchParams.get('code');
    if (!code) throw new ChatGptPlanError('CHATGPT_CODE_MISSING', 'La autorizacion no devolvio un codigo valido.', 400);
    const returnedClientId = url.searchParams.get('client_id');
    if (returnedClientId && returnedClientId !== transaction.client_id) {
      throw new ChatGptPlanError('CHATGPT_CLIENT_MISMATCH', 'La autorizacion no corresponde a esta integracion.', 400);
    }
    const verifier = await decryptSecret(transaction.pkce_verifier_encrypted, `chatgpt-oauth:${transaction.id}`);
    const tokens = await requestOAuthToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: transaction.redirect_uri,
      code_verifier: verifier,
      resource: CHATGPT_RESOURCE
    }, transaction.client_id);
    if (typeof tokens.id_token !== 'string' || typeof tokens.access_token !== 'string' || typeof tokens.refresh_token !== 'string') {
      throw new ChatGptPlanError('CHATGPT_TOKEN_RESPONSE_INCOMPLETE', 'ChatGPT no devolvio una autorizacion renovable.', 502);
    }

    const { payload } = await jwtVerify(tokens.id_token, JWKS, {
      issuer: CHATGPT_ISSUER,
      audience: transaction.client_id,
      requiredClaims: ['sub', 'exp', 'iat'],
      clockTolerance: 5
    });
    if (payload.nonce !== transaction.nonce || typeof payload.sub !== 'string' || !payload.sub) {
      throw new ChatGptPlanError('CHATGPT_IDENTITY_INVALID', 'No se pudo verificar la identidad de ChatGPT.', 401);
    }
    const previousConnection = await getChatGptConnection(admin, transaction.organization_id);
    if (previousConnection && !transaction.switch_account && previousConnection.account_subject !== payload.sub) {
      throw new ChatGptPlanError(
        'CHATGPT_ACCOUNT_MISMATCH',
        'La cuenta autorizada no coincide con la conexion existente. Usa Cambiar cuenta para reemplazarla.',
        409
      );
    }
    const scopes = String(tokens.scope || '').split(/\s+/).filter(Boolean);
    if (!scopes.includes('chatgpt.tokens.use.direct')) {
      throw new ChatGptPlanError('CHATGPT_PLAN_PERMISSION_REQUIRED', 'La cuenta no autorizo el uso de su plan de ChatGPT.', 403);
    }

    const models = await listChatGptModels(tokens.access_token).catch(() => []);
    const context = `chatgpt:${transaction.organization_id}`;
    const connectionPayload = {
      organization_id: transaction.organization_id,
      provider: 'chatgpt',
      account_subject: payload.sub,
      account_email: typeof payload.email === 'string' ? payload.email : null,
      account_name: typeof payload.name === 'string' ? payload.name : null,
      client_id: transaction.client_id,
      access_token_encrypted: await encryptSecret(tokens.access_token, `${context}:access`),
      refresh_token_encrypted: await encryptSecret(tokens.refresh_token, `${context}:refresh`),
      id_token_encrypted: await encryptSecret(tokens.id_token, `${context}:id`),
      expires_at: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString(),
      scopes,
      models,
      status: 'connected',
      token_version: 1,
      last_verified_at: models.length ? new Date().toISOString() : null,
      connected_by: transaction.user_id
    };
    const { error: saveError } = await admin.from('chatgpt_connections').upsert(connectionPayload, { onConflict: 'organization_id' });
    if (saveError) throw new ChatGptPlanError('CHATGPT_CONNECTION_SAVE_FAILED', 'No se pudo asociar ChatGPT con la empresa.', 500, saveError.message);
    if (previousConnection && transaction.switch_account) await revokeChatGptSession(previousConnection);
    return redirectResult(transaction.return_to, 'connected');
  } catch (error) {
    const code = error instanceof ChatGptPlanError ? error.code : 'callback_failed';
    console.error('chatgpt oauth callback failed', { code, transaction_id: transaction.id });
    return redirectResult(transaction.return_to, 'error', code.toLowerCase());
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === 'GET' && url.pathname.endsWith('/callback')) return handleCallback(req);

  const origin = req.headers.get('Origin') || '';
  const headers = corsHeaders(origin);
  if (origin && !allowedOrigins().has(origin)) return jsonResponse({ error: 'Origin not allowed' }, 403, headers);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, headers);

  try {
    return await handleAction(req, headers);
  } catch (error) {
    const known = error instanceof ChatGptPlanError;
    const status = known ? error.status : 500;
    const code = known ? error.code : 'CHATGPT_CONNECTION_FAILED';
    const message = known ? error.publicMessage : 'No se pudo completar la operacion con ChatGPT.';
    console.error('chatgpt oauth action failed', { code, message: error instanceof Error ? error.message : String(error) });
    return jsonResponse({ error: code, code, message }, status, headers);
  }
});
