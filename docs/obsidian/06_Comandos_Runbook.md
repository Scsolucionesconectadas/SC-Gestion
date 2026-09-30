# Comandos y Runbook

## Desarrollo

```bash
npm install
npm run serve
```

## Calidad

```bash
npm run check
npm run lint:html
npm run test:e2e
```

## Aprovisionamiento

En PowerShell, cargar variables sin imprimir secretos y ejecutar:

```powershell
npm run users:create
```

## Supabase

```bash
npx supabase functions deploy ai-agent --project-ref rcvzfzuisnactwepvcup
npx supabase functions deploy communications --project-ref rcvzfzuisnactwepvcup
npx supabase functions deploy chatgpt-oauth --project-ref rcvzfzuisnactwepvcup --no-verify-jwt
```

Configurar secrets desde el panel o CLI. Nunca incluir valores en este documento.

Variables de servidor requeridas para ChatGPT: `CHATGPT_CLIENT_ID`, `CHATGPT_REDIRECT_URI`, `CHATGPT_TOKEN_ENCRYPTION_KEY` y `ALLOWED_ORIGINS`. `CHATGPT_CLIENT_SECRET`, `CHATGPT_TOKEN_AUTH_METHOD` y `CHATGPT_AGENT_HOST_ID` dependen del registro aprobado. Correo requiere `RESEND_API_KEY`, `RESEND_FROM` y `RESEND_REPLY_TO`.

Después de una migración o despliegue, ejecutar Security Advisor y Performance Advisor desde Supabase y registrar cualquier excepción aceptada.

El job `sc-overdue-task-notifications` debe figurar activo en `cron.job` con la expresión `15 11 * * *`. La hora corresponde a las 08:15 de Argentina.
