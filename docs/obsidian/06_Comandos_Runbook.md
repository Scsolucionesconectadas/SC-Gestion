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
```

Configurar secrets desde el panel o CLI. Nunca incluir valores en este documento.

Variables de servidor requeridas: `OPENAI_API_KEY`, `OPENAI_ALLOWED_MODELS`, `OPENAI_PROSPECTING_MODEL`, `OPENAI_QUOTE_MODEL`, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO` y `ALLOWED_ORIGINS`.

Después de una migración o despliegue, ejecutar Security Advisor y Performance Advisor desde Supabase y registrar cualquier excepción aceptada.
