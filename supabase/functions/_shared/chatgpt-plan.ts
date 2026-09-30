export const CHATGPT_ISSUER = 'https://auth.openai.com';
export const CHATGPT_AUTHORIZE_URL = 'https://auth.openai.com/api/accounts/authorize';
export const CHATGPT_TOKEN_URL = 'https://auth.openai.com/api/accounts/oauth/token';
export const CHATGPT_REVOKE_URL = 'https://auth.openai.com/api/accounts/oauth/revoke';
export const CHATGPT_JWKS_URL = 'https://auth.openai.com/.well-known/jwks.json';
export const CHATGPT_RESOURCE = 'https://api.openai.com/v1';
export const CHATGPT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'resource.invoke',
  'chatgpt.tokens.use.direct'
];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class ChatGptPlanError extends Error {
  code: string;
  status: number;
  publicMessage: string;

  constructor(code: string, publicMessage: string, status = 500, internalMessage = publicMessage) {
    super(internalMessage);
    this.name = 'ChatGptPlanError';
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

export type ChatGptModel = {
  slug: string;
  display_name: string;
};

export type ChatGptConnection = {
  id: string;
  organization_id: string;
  account_subject: string;
  account_email: string | null;
  account_name: string | null;
  client_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  id_token_encrypted: string;
  expires_at: string;
  scopes: string[];
  models: ChatGptModel[];
  status: 'connected' | 'attention_required';
  token_version: number;
  last_verified_at: string | null;
  connected_by: string | null;
};

export function oauthConfig() {
  const clientId = Deno.env.get('CHATGPT_CLIENT_ID')?.trim() || '';
  const redirectUri = Deno.env.get('CHATGPT_REDIRECT_URI')?.trim() || '';
  const encryptionKey = Deno.env.get('CHATGPT_TOKEN_ENCRYPTION_KEY')?.trim() || '';
  const clientSecret = Deno.env.get('CHATGPT_CLIENT_SECRET')?.trim() || '';
  const authMethod = Deno.env.get('CHATGPT_TOKEN_AUTH_METHOD')?.trim() || 'none';
  const hostId = Deno.env.get('CHATGPT_AGENT_HOST_ID')?.trim() || '';

  return {
    clientId,
    redirectUri,
    encryptionKey,
    clientSecret,
    authMethod: authMethod === 'client_secret_basic' ? authMethod : 'none',
    hostId,
    providerApproved: Boolean(clientId),
    ready: Boolean(clientId && redirectUri && encryptionKey && (authMethod !== 'client_secret_basic' || clientSecret))
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function randomBase64Url(byteLength = 32): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return base64UrlEncode(new Uint8Array(digest));
}

async function encryptionKey(): Promise<CryptoKey> {
  const configured = oauthConfig().encryptionKey;
  if (!configured) {
    throw new ChatGptPlanError(
      'CHATGPT_SERVER_CONFIGURATION_REQUIRED',
      'La conexion con ChatGPT todavia requiere configuracion segura del servidor.',
      503
    );
  }
  let raw: Uint8Array;
  try {
    raw = base64UrlDecode(configured);
  } catch {
    throw new ChatGptPlanError('CHATGPT_INVALID_ENCRYPTION_KEY', 'La configuracion segura de ChatGPT no es valida.', 503);
  }
  if (raw.byteLength !== 32) {
    throw new ChatGptPlanError('CHATGPT_INVALID_ENCRYPTION_KEY', 'La configuracion segura de ChatGPT no es valida.', 503);
  }
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(value: string, context: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(context) },
    await encryptionKey(),
    encoder.encode(value)
  );
  return `v1.${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(value: string, context: string): Promise<string> {
  const [version, ivValue, ciphertext] = String(value || '').split('.');
  if (version !== 'v1' || !ivValue || !ciphertext) {
    throw new ChatGptPlanError('CHATGPT_CREDENTIALS_INVALID', 'La conexion con ChatGPT debe volver a autorizarse.', 401);
  }
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlDecode(ivValue), additionalData: encoder.encode(context) },
      await encryptionKey(),
      base64UrlDecode(ciphertext)
    );
    return decoder.decode(decrypted);
  } catch {
    throw new ChatGptPlanError('CHATGPT_CREDENTIALS_INVALID', 'La conexion con ChatGPT debe volver a autorizarse.', 401);
  }
}

function oauthBasicAuthorization(clientId: string, clientSecret: string): string {
  return `Basic ${btoa(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`)}`;
}

export async function requestOAuthToken(fields: Record<string, string>, clientId: string): Promise<any> {
  const config = oauthConfig();
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  if (config.authMethod === 'client_secret_basic') {
    if (!config.clientSecret) {
      throw new ChatGptPlanError('CHATGPT_CLIENT_SECRET_REQUIRED', 'Falta completar la configuracion privada de ChatGPT.', 503);
    }
    headers.Authorization = oauthBasicAuthorization(clientId, config.clientSecret);
  }
  const response = await fetch(CHATGPT_TOKEN_URL, {
    method: 'POST',
    headers,
    body: new URLSearchParams({ ...fields, client_id: clientId }),
    signal: AbortSignal.timeout(20_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerError = payload?.error;
    const code = String(
      typeof providerError === 'string'
        ? providerError
        : providerError?.code || providerError?.type || `HTTP_${response.status}`
    );
    const reconnect = ['invalid_grant', 'invalid_token', 'unauthorized_client'].includes(code);
    throw new ChatGptPlanError(
      code,
      reconnect ? 'La sesion de ChatGPT vencio o fue revocada. Volve a conectar la cuenta.' : 'ChatGPT no pudo completar la autorizacion.',
      reconnect ? 401 : 502,
      `OAuth token request failed (${response.status}, ${code})`
    );
  }
  return payload;
}

export async function getChatGptConnection(admin: any, organizationId: string): Promise<ChatGptConnection | null> {
  const { data, error } = await admin
    .from('chatgpt_connections')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw new ChatGptPlanError('CHATGPT_CONNECTION_LOOKUP_FAILED', 'No se pudo consultar la conexion con ChatGPT.', 500, error.message);
  return data as ChatGptConnection | null;
}

export async function ensureAccessToken(admin: any, connection: ChatGptConnection, retry = true): Promise<{ accessToken: string; connection: ChatGptConnection }> {
  const expiresAt = new Date(connection.expires_at).getTime();
  if (expiresAt > Date.now() + 5 * 60 * 1000) {
    return {
      accessToken: await decryptSecret(connection.access_token_encrypted, `chatgpt:${connection.organization_id}:access`),
      connection
    };
  }

  const refreshToken = await decryptSecret(connection.refresh_token_encrypted, `chatgpt:${connection.organization_id}:refresh`);
  const tokens = await requestOAuthToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    resource: CHATGPT_RESOURCE
  }, connection.client_id);

  if (typeof tokens.access_token !== 'string' || typeof tokens.refresh_token !== 'string') {
    throw new ChatGptPlanError('CHATGPT_REFRESH_INCOMPLETE', 'La sesion de ChatGPT debe volver a conectarse.', 401);
  }

  const scopes = String(tokens.scope || connection.scopes.join(' ')).split(/\s+/).filter(Boolean);
  const nextVersion = Number(connection.token_version || 1) + 1;
  const update = {
    access_token_encrypted: await encryptSecret(tokens.access_token, `chatgpt:${connection.organization_id}:access`),
    refresh_token_encrypted: await encryptSecret(tokens.refresh_token, `chatgpt:${connection.organization_id}:refresh`),
    id_token_encrypted: typeof tokens.id_token === 'string'
      ? await encryptSecret(tokens.id_token, `chatgpt:${connection.organization_id}:id`)
      : connection.id_token_encrypted,
    expires_at: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString(),
    scopes,
    status: 'connected',
    token_version: nextVersion
  };
  const { data, error } = await admin
    .from('chatgpt_connections')
    .update(update)
    .eq('id', connection.id)
    .eq('token_version', connection.token_version)
    .select('*')
    .maybeSingle();

  if (error) throw new ChatGptPlanError('CHATGPT_REFRESH_SAVE_FAILED', 'No se pudo renovar la sesion de ChatGPT.', 500, error.message);
  if (!data && retry) {
    const latest = await getChatGptConnection(admin, connection.organization_id);
    if (!latest) throw new ChatGptPlanError('CHATGPT_NOT_CONNECTED', 'ChatGPT no esta conectado para esta empresa.', 409);
    return ensureAccessToken(admin, latest, false);
  }
  if (!data) throw new ChatGptPlanError('CHATGPT_REFRESH_CONFLICT', 'La sesion de ChatGPT se esta renovando. Volve a intentar.', 409);
  return { accessToken: tokens.access_token, connection: data as ChatGptConnection };
}

export async function listChatGptModels(accessToken: string): Promise<ChatGptModel[]> {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(payload?.error?.code || payload?.error?.type || `HTTP_${response.status}`);
    throw new ChatGptPlanError(code, response.status === 401
      ? 'La sesion de ChatGPT debe volver a conectarse.'
      : 'No se pudieron consultar los modelos disponibles de ChatGPT.', response.status, `Model list failed (${response.status}, ${code})`);
  }
  const rows = Array.isArray(payload?.models) ? payload.models : Array.isArray(payload?.data) ? payload.data : [];
  const seen = new Set<string>();
  return rows
    .filter((item: any) => !item?.visibility || item.visibility === 'list')
    .map((item: any) => ({
      slug: String(item?.slug || item?.id || '').trim(),
      display_name: String(item?.display_name || item?.name || item?.slug || item?.id || '').trim()
    }))
    .filter((item: ChatGptModel) => item.slug && !seen.has(item.slug) && seen.add(item.slug));
}

export async function refreshConnectionModels(admin: any, connection: ChatGptConnection, accessToken: string): Promise<ChatGptConnection> {
  const models = await listChatGptModels(accessToken);
  const { data, error } = await admin
    .from('chatgpt_connections')
    .update({ models, last_verified_at: new Date().toISOString(), status: 'connected' })
    .eq('id', connection.id)
    .select('*')
    .single();
  if (error) throw new ChatGptPlanError('CHATGPT_MODELS_SAVE_FAILED', 'No se pudo actualizar el catalogo de modelos.', 500, error.message);
  return data as ChatGptConnection;
}

export function publicConnection(connection: ChatGptConnection | null) {
  if (!connection) return null;
  const models = Array.isArray(connection.models) ? connection.models : [];
  return {
    connected: connection.status === 'connected',
    status: connection.status,
    account: {
      email: connection.account_email,
      name: connection.account_name,
      label: connection.account_name || connection.account_email || 'Cuenta de ChatGPT',
      client_id_suffix: connection.client_id.slice(-8)
    },
    scopes: connection.scopes,
    expires_at: connection.expires_at,
    last_verified_at: connection.last_verified_at,
    models,
    available_models: models.map((model) => model.slug)
  };
}

export async function revokeChatGptSession(connection: ChatGptConnection): Promise<boolean> {
  let refreshToken: string;
  try {
    refreshToken = await decryptSecret(connection.refresh_token_encrypted, `chatgpt:${connection.organization_id}:refresh`);
  } catch {
    return false;
  }
  const config = oauthConfig();
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (config.authMethod === 'client_secret_basic' && config.clientSecret) {
    headers.Authorization = oauthBasicAuthorization(connection.client_id, config.clientSecret);
  }
  try {
    const response = await fetch(CHATGPT_REVOKE_URL, {
      method: 'POST',
      headers,
      body: new URLSearchParams({
        token: refreshToken,
        token_type_hint: 'refresh_token',
        client_id: connection.client_id
      }),
      signal: AbortSignal.timeout(15_000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function consumeResponsesStream(response: Response): Promise<{ outputText: string; usage: any; response: any }> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const code = String(payload?.error?.code || payload?.error?.type || `HTTP_${response.status}`);
    throw new ChatGptPlanError(code, publicInferenceMessage(response.status, code), response.status, `Responses request failed (${response.status}, ${code})`);
  }
  if (!response.body) throw new ChatGptPlanError('CHATGPT_EMPTY_STREAM', 'ChatGPT no devolvio una respuesta util.', 502);

  const reader = response.body.getReader();
  const streamDecoder = new TextDecoder();
  let buffer = '';
  let outputText = '';
  let completedResponse: any = null;

  const processBlock = (block: string) => {
    const data = block.split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');
    if (!data || data === '[DONE]') return;
    let event: any;
    try {
      event = JSON.parse(data);
    } catch {
      return;
    }
    if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') outputText += event.delta;
    if (event.type === 'response.completed') completedResponse = event.response || event;
    if (event.type === 'response.failed' || event.type === 'response.incomplete' || event.type === 'error') {
      const error = event?.response?.error || event?.error || {};
      const code = String(error?.code || event.type);
      throw new ChatGptPlanError(code, publicInferenceMessage(502, code), 502, error?.message || code);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += streamDecoder.decode(value, { stream: true });
    if (buffer.length > 2_500_000) {
      await reader.cancel();
      throw new ChatGptPlanError('CHATGPT_RESPONSE_TOO_LARGE', 'La respuesta de ChatGPT supero el limite permitido.', 502);
    }
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';
    for (const block of blocks) processBlock(block);
  }
  if (buffer.trim()) processBlock(buffer);
  if (!completedResponse) throw new ChatGptPlanError('CHATGPT_STREAM_INTERRUPTED', 'La ejecucion de ChatGPT se interrumpio antes de finalizar.', 502);
  if (!outputText && typeof completedResponse.output_text === 'string') outputText = completedResponse.output_text;
  return { outputText: outputText.trim(), usage: completedResponse.usage || null, response: completedResponse };
}

export function publicInferenceMessage(status: number, code: string): string {
  if (['subscription_sharing_usage_limit_exceeded', 'subscription_sharing_usage_unavailable'].includes(code)) {
    return 'El plan de ChatGPT alcanzo su limite compartido o no esta disponible en este momento.';
  }
  if (status === 401 || ['invalid_token', 'invalid_grant'].includes(code)) return 'La sesion de ChatGPT vencio o fue revocada. Volve a conectar la cuenta.';
  if (status === 404) return 'El modelo elegido ya no esta disponible para la cuenta conectada.';
  if (status === 403) return 'La cuenta de ChatGPT no autorizo este modelo o esta herramienta.';
  if (status === 429) return 'El plan de ChatGPT alcanzo un limite de uso. Revisa el consumo de la cuenta.';
  return 'ChatGPT no pudo completar la solicitud. Revisa la conexion y volve a intentar.';
}
