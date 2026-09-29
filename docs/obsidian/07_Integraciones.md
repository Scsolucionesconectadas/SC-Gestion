# Integraciones

## Supabase

- Auth: login por email interno derivado del nombre de usuario.
- Database: PostgreSQL con RLS.
- Storage: bucket privado `organization-documents`.
- Realtime: refresco de entidades filtradas por `organization_id`.
- Edge Function: `ai-agent` con JWT obligatorio.

Variables administrativas:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## OpenAI

La Edge Function usa Responses API con salida estructurada. Variables:

```env
OPENAI_API_KEY=
OPENAI_PROSPECTING_MODEL=
OPENAI_QUOTE_MODEL=
ALLOWED_ORIGINS=
```

No hay envíos automáticos a clientes ni acciones destructivas por IA.
