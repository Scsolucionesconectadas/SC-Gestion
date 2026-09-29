# Integraciones

## Supabase

- Auth: login por email interno derivado del nombre de usuario.
- Database: PostgreSQL con RLS.
- Storage: buckets privados `organization-documents`, `profile-avatars` y `generated-pdfs`.
- Realtime: refresco de entidades filtradas por `organization_id`.
- Edge Functions: `ai-agent` y `communications`, ambas con JWT obligatorio.
- `pg_cron`: evaluación diaria de tareas vencidas y creación deduplicada de avisos internos.

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
OPENAI_ACCOUNT_LABEL=
OPENAI_ORGANIZATION_ID=
OPENAI_PROJECT_ID=
OPENAI_ALLOWED_MODELS=gpt-6-luna,gpt-6-sol,gpt-6-astra,gpt-5.4-mini,gpt-5-mini
OPENAI_PROSPECTING_MODEL=
OPENAI_QUOTE_MODEL=
ALLOWED_ORIGINS=https://erp.scsolucionesconectadas.com.ar
```

No hay acciones destructivas automáticas por IA. Las versiones configurables pueden exigir aprobación humana y cada ejecución queda registrada. La integración se autentica con una clave de proyecto en el servidor, no con un login de ChatGPT en el navegador. El portal verifica cuenta, proyecto y modelos sin devolver la clave.

## Resend

La función `communications` entrega correos preparados desde el portal. Valida permiso, destinatarios, frecuencia e idempotencia; los adjuntos se obtienen desde Storage privado.

```env
RESEND_API_KEY=
RESEND_FROM=
RESEND_REPLY_TO=
```

No hay envíos hasta configurar un remitente verificado y realizar una prueba controlada.
