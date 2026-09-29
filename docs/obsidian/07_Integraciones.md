# Integraciones

## Supabase

- Auth: login por email interno derivado del nombre de usuario.
- Database: PostgreSQL con RLS.
- Storage: buckets privados `organization-documents`, `profile-avatars` y `generated-pdfs`.
- Realtime: refresco de entidades filtradas por `organization_id`.
- Edge Functions: `ai-agent` y `communications`, ambas con JWT obligatorio.

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
OPENAI_ALLOWED_MODELS=
OPENAI_PROSPECTING_MODEL=
OPENAI_QUOTE_MODEL=
ALLOWED_ORIGINS=
```

No hay acciones destructivas automáticas por IA. Las versiones configurables pueden exigir aprobación humana y cada ejecución queda registrada.

## Resend

La función `communications` entrega correos preparados desde el portal. Valida permiso, destinatarios, frecuencia e idempotencia; los adjuntos se obtienen desde Storage privado.

```env
RESEND_API_KEY=
RESEND_FROM=
RESEND_REPLY_TO=
```

No hay envíos hasta configurar un remitente verificado y realizar una prueba controlada.
