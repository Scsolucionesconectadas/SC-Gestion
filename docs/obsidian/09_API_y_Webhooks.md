# API y Webhooks

## Edge Function `ai-agent`

`POST /functions/v1/ai-agent`

Entrada mínima:

```json
{
  "organization_id": "uuid",
  "agent_type": "prospecting",
  "input": {}
}
```

Requiere JWT de Supabase. Valida origen, tamaño, organización, membresía, rol y límite horario. Responde errores públicos sin trazas internas.

No existen webhooks públicos en esta versión.
