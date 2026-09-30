# IA, Agentes y MCP

## Agentes

- Comercial: investigación pública y borrador de contacto.
- Presupuestos: estimación interna basada en catálogo.
- Configurables: propósito, prompt, modelo, fuentes, herramientas y aprobación humana administrados desde Agent Studio.

## Controles

- Salida JSON Schema estricta.
- `store: false`.
- `stream: true` y confirmación de `response.completed`.
- Revisión humana obligatoria.
- Rate limit por usuario y empresa.
- Consultas filtradas por tenant.
- Cuenta de ChatGPT asociada a la empresa activa mediante OAuth/OIDC y PKCE.
- Tokens cifrados con AES-GCM solo en servidor; sin cookies copiadas, contraseñas ni claves API manuales.
- Modelos disponibles verificados contra `GET /v1/models` antes de mostrarlos en Agent Studio.
- Versiones publicadas inmutables y ejecución vinculada a agente y versión.
- Métricas de duración y tokens informados por la API.

## Conexión ChatGPT

- Configuración permite iniciar el login oficial, verificar la cuenta, actualizar modelos, reconectar, cambiar de cuenta o desconectar.
- El callback valida estado, PKCE, nonce, firma, emisor, audiencia y scope `chatgpt.tokens.use.direct`.
- Los refresh tokens rotan y se actualizan con control de versión para resolver concurrencia.
- Si la sesión vence, el plan alcanza su límite o el modelo deja de estar disponible, el usuario recibe una explicación accionable y el detalle interno queda en logs.
- SC debe obtener aprobación y un `client_id` del programa Sign in with ChatGPT antes de completar el flujo productivo.

## MCP

Supabase MCP se usó para aplicar y auditar la migración y desplegar la función. No forma parte del runtime del portal.
