# API y Webhooks

## Edge Function `ai-agent`

`POST /functions/v1/ai-agent`

Entrada mínima:

```json
{
  "organization_id": "uuid",
  "agent_id": "uuid",
  "input": {}
}
```

También admite los agentes especializados heredados mediante `agent_type`. Requiere JWT de Supabase. Valida origen, tamaño, organización, permiso `agents.run`, versión publicada, modelo autorizado y límite horario. Responde errores públicos sin trazas internas.

La ejecución toma el token OAuth cifrado de la empresa, lo renueva si corresponde, valida el modelo contra `GET /v1/models` y consume Responses API con `store: false` y `stream: true`.

## Edge Function `chatgpt-oauth`

`POST /functions/v1/chatgpt-oauth` admite `status`, `start`, `models`, `verify` y `disconnect`. Todas estas acciones autentican manualmente el JWT de Supabase y exigen `agents.manage` para la empresa indicada.

`GET /functions/v1/chatgpt-oauth/callback` es el redirect OAuth público. Valida transacción vigente, estado de un solo uso, PKCE, nonce, firma OIDC, emisor, audiencia y scope antes de cifrar los tokens. Nunca devuelve tokens al frontend.

## Edge Function `communications`

`POST /functions/v1/communications`

Operaciones: `connection_status` y `send_email`. `send_email` recibe `organization_id` y `message_id`; el cuerpo, destinatarios y adjuntos se recuperan desde la base y Storage privados. Requiere JWT, permiso `communications.send`, límite de frecuencia e idempotencia por mensaje.

No existen webhooks públicos en esta versión.

## RPC `save_commercial_proposal`

`POST /rest/v1/rpc/save_commercial_proposal`

Recibe `p_proposal` con la cabecera y `p_sections` con etapas y conceptos. Requiere JWT de Supabase y permiso `quotes.write`; `quotes.approve` es adicional para aprobar. La función valida la empresa, reemplaza el detalle dentro de una transacción, recalcula importes, conserva el snapshot de versión y actualiza el avance de la oportunidad al enviar o aceptar.

Las tablas `proposals`, `proposal_sections`, `proposal_items` y `proposal_versions` ofrecen solo lectura directa a `authenticated`; no se admiten mutaciones parciales desde REST. Los estados cerrados requieren crear una nueva versión.

## RPC `convert_accepted_proposal`

`POST /rest/v1/rpc/convert_accepted_proposal`

Recibe `p_proposal_id` y `p_conversion`. Requiere JWT, `quotes.write`, acceso a la organización y una propuesta en estado `aceptada`. Permite indicar un cliente existente o los datos del nuevo cliente, crear opcionalmente un proyecto y seleccionar tareas iniciales. La respuesta contiene los identificadores resultantes y marca si la conversión ya existía.

La operación es atómica e idempotente. No expone una conversión automática al cambiar de estado ni admite saltarse la revisión de duplicados presentada por la interfaz.

## CORS productivo

`ai-agent`, `communications` y las acciones POST de `chatgpt-oauth` permiten `https://erp.scsolucionesconectadas.com.ar` y los orígenes locales documentados. Una preflight desde otro origen recibe `403`; CORS complementa JWT, permisos y RLS, pero no los reemplaza.
