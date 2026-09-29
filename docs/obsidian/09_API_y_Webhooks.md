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

## Edge Function `communications`

`POST /functions/v1/communications`

Operaciones: `connection_status` y `send_email`. `send_email` recibe `organization_id` y `message_id`; el cuerpo, destinatarios y adjuntos se recuperan desde la base y Storage privados. Requiere JWT, permiso `communications.send`, límite de frecuencia e idempotencia por mensaje.

No existen webhooks públicos en esta versión.

## CORS productivo

`ai-agent` y `communications` permiten `https://erp.scsolucionesconectadas.com.ar` y los orígenes locales documentados. Una preflight desde otro origen recibe `403`; CORS complementa JWT, permisos y RLS, pero no los reemplaza.
