# Integraciones

## Supabase

- Auth: login por email interno derivado del nombre de usuario.
- Database: PostgreSQL con RLS.
- Storage: buckets privados `organization-documents` y `profile-avatars`.
- Realtime: refresco de entidades filtradas por `organization_id`.
- Edge Function: `ai-agent` con JWT obligatorio.

Usuarios iniciales aprovisionados:

- `mbetancourt`: `owner`.
- `areyes`: `commercial`.
- `orojas`: `commercial`.

Las contraseñas no se documentan. `mbetancourt` completó el cambio inicial; `areyes` y `orojas` lo mantienen pendiente.

Las fotos admiten JPEG, PNG o WebP de hasta 2 MB, se guardan bajo `{user_id}/archivo` y se entregan con URLs firmadas. La membresía determina quién puede ver o administrar esos archivos.

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
