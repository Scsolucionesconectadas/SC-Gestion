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
- Versiones publicadas inmutables y ejecución vinculada a agente y versión.
- Métricas de duración y tokens informados por la API.

## MCP

Supabase MCP se usó para aplicar y auditar la migración y desplegar la función. No forma parte del runtime del portal.
