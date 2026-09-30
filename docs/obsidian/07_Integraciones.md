# Integraciones

## Supabase

- Auth: login por email interno derivado del nombre de usuario.
- Database: PostgreSQL con RLS.
- Storage: buckets privados `organization-documents`, `profile-avatars` y `generated-pdfs`.
- Realtime: refresco de entidades filtradas por `organization_id`.
- Edge Functions: `ai-agent` y `communications` con JWT; `chatgpt-oauth` valida manualmente las acciones autenticadas y deja público solo el callback protegido por OAuth.
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

## ChatGPT

La conexión usa Sign in with ChatGPT, Authorization Code con PKCE y OIDC. La cuenta queda asociada a la empresa activa. Variables privadas:

```env
CHATGPT_CLIENT_ID=
CHATGPT_CLIENT_SECRET=
CHATGPT_TOKEN_AUTH_METHOD=none
CHATGPT_REDIRECT_URI=https://rcvzfzuisnactwepvcup.supabase.co/functions/v1/chatgpt-oauth/callback
CHATGPT_TOKEN_ENCRYPTION_KEY=
CHATGPT_AGENT_HOST_ID=
ALLOWED_ORIGINS=https://erp.scsolucionesconectadas.com.ar
```

Los tokens de acceso, renovación e identidad se cifran antes de guardarse y nunca se devuelven al navegador. Se puede conectar, reconectar, cambiar de cuenta, actualizar modelos o desconectar. No hay acciones destructivas automáticas y cada ejecución queda registrada. La conexión productiva depende de que OpenAI apruebe a SC como aplicación alojada y entregue su `client_id`.

## Resend

La función `communications` entrega correos preparados desde el portal. Valida permiso, destinatarios, frecuencia e idempotencia; los adjuntos se obtienen desde Storage privado.

```env
RESEND_API_KEY=
RESEND_FROM=
RESEND_REPLY_TO=
```

No hay envíos hasta configurar un remitente verificado y realizar una prueba controlada.
