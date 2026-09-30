# Agentes IA de SC Gestión

Los agentes se ejecutan mediante la Edge Function `ai-agent` con la cuenta de ChatGPT asociada a la empresa activa. No se usan claves API manuales, cookies copiadas ni contraseñas de ChatGPT.

## Agent Studio

Los usuarios con `agents.manage` pueden crear agentes especializados, guardar borradores y publicar versiones inmutables. Cada definición contiene nombre, propósito, instrucciones, modelo, fuentes internas, herramientas habilitadas y requisito de aprobación humana. Los usuarios con `agents.run` solo ejecutan versiones publicadas.

El modelo solicitado por una definición debe existir en el catálogo que devuelve la cuenta conectada. La validación final siempre ocurre en la Edge Function y Agent Studio solo ofrece esos modelos.

## Agente comercial

- Investiga fuentes públicas actuales.
- Excluye negocios ya presentes en la empresa activa.
- Separa hechos verificados de hipótesis comerciales.
- Propone afinidad, ángulo de solución y borrador de contacto.
- Requiere revisión humana antes de agregar el prospecto.

## Agente de presupuestos

- Usa únicamente el catálogo de precios de la empresa activa.
- Separa implementación, costos recurrentes y opcionales.
- Explicita supuestos, riesgos, exclusiones y preguntas pendientes.
- Marca los precios faltantes en vez de inventarlos.
- Guarda un borrador interno, nunca una factura ni propuesta aprobada.

## Controles

- JWT obligatorio.
- Membresía activa en el `organization_id` recibido.
- Permiso `agents.run` resuelto en la base para la empresa activa.
- Permiso `agents.manage` separado para configuración y publicación.
- Límite de 20 ejecuciones por usuario, empresa y hora.
- Entradas limitadas por tamaño y salidas validadas con JSON Schema estricto.
- Consultas al CRM, catálogo y trazabilidad filtradas por empresa.
- Errores internos no se exponen al navegador.
- `store: false` en Responses API.
- `stream: true`; una ejecución se confirma únicamente al recibir `response.completed`.
- Tokens OAuth cifrados con AES-GCM y contexto por empresa.
- Renovación rotativa del `refresh_token` con control de versión para evitar carreras.

## Conexión con ChatGPT

El flujo usa OpenID Connect y Authorization Code con PKCE. Solo un usuario con `agents.manage` puede iniciar, cambiar, verificar o desconectar la cuenta. El callback valida `state`, `nonce`, emisor, audiencia y firma antes de persistir la conexión.

Variables privadas de Edge Functions:

```env
CHATGPT_CLIENT_ID=
CHATGPT_CLIENT_SECRET=
CHATGPT_TOKEN_AUTH_METHOD=none
CHATGPT_REDIRECT_URI=https://rcvzfzuisnactwepvcup.supabase.co/functions/v1/chatgpt-oauth/callback
CHATGPT_TOKEN_ENCRYPTION_KEY=
CHATGPT_AGENT_HOST_ID=
ALLOWED_ORIGINS=https://erp.scsolucionesconectadas.com.ar
```

`CHATGPT_TOKEN_ENCRYPTION_KEY` debe contener 32 bytes aleatorios codificados como base64url sin padding. `CHATGPT_CLIENT_SECRET` se usa únicamente si el registro asignado por OpenAI exige `client_secret_basic`.

SC es una aplicación alojada y necesita que OpenAI apruebe “Sign in with ChatGPT” y entregue un `client_id` antes de realizar la prueba real. Mientras falte esa aprobación, Configuración muestra el bloqueo sin simular una conexión. Una vez habilitada, se puede conectar, reconectar, cambiar de cuenta, actualizar modelos o desconectar. Las ejecuciones registran agente, versión, duración y consumo informado, sin guardar secretos ni conversaciones en OpenAI.
