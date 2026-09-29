# IA, Agentes y MCP

## Agentes

- Comercial: investigación pública y borrador de contacto.
- Presupuestos: estimación interna basada en catálogo.
- Configurables: propósito, prompt, modelo, fuentes, herramientas y aprobación humana administrados desde Agent Studio.

## Controles

- Salida JSON Schema estricta.
- `store: false`.
- Revisión humana obligatoria.
- Rate limit por usuario y empresa.
- Consultas filtradas por tenant.
- Clave OpenAI solo en Supabase Secrets.
- Modelos limitados por `OPENAI_ALLOWED_MODELS` en servidor.
- Modelos disponibles verificados contra `GET /v1/models` antes de mostrarlos en Agent Studio.
- Identificación operativa mediante `OPENAI_ACCOUNT_LABEL`, `OPENAI_ORGANIZATION_ID` y `OPENAI_PROJECT_ID`, sin exponer credenciales.
- Versiones publicadas inmutables y ejecución vinculada a agente y versión.
- Métricas de duración y tokens informados por la API.

## Conexión OpenAI

- La API usa una clave de proyecto guardada en Supabase Secrets; no existe un login de ChatGPT dentro del navegador.
- Configuración permite verificar conexión, cuenta, proyecto y modelos habilitados.
- Si falta la clave o OpenAI responde con credencial, cuota, permiso o modelo inválido, el usuario recibe una explicación accionable y el detalle interno queda en logs.
- Modelos base autorizables: `gpt-6-luna`, `gpt-6-sol`, `gpt-6-astra`, `gpt-5.4-mini` y `gpt-5-mini`.

## MCP

Supabase MCP se usó para aplicar y auditar la migración y desplegar la función. No forma parte del runtime del portal.
