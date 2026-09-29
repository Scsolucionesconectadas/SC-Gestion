# IA, Agentes y MCP

## Agentes

- Comercial: investigación pública y borrador de contacto.
- Presupuestos: estimación interna basada en catálogo.

## Controles

- Salida JSON Schema estricta.
- `store: false`.
- Revisión humana obligatoria.
- Rate limit por usuario y empresa.
- Consultas filtradas por tenant.
- Clave OpenAI solo en Supabase Secrets.

## MCP

Supabase MCP se usó para aplicar y auditar la migración y desplegar la función. No forma parte del runtime del portal.
