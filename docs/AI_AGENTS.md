# Agentes IA de SC Gestión

Los agentes se ejecutan mediante la Edge Function `ai-agent`. El navegador nunca recibe `OPENAI_API_KEY`.

## Agent Studio

Los usuarios con `agents.manage` pueden crear agentes especializados, guardar borradores y publicar versiones inmutables. Cada definición contiene nombre, propósito, instrucciones, modelo, fuentes internas, herramientas habilitadas y requisito de aprobación humana. Los usuarios con `agents.run` solo ejecutan versiones publicadas.

El modelo solicitado por una definición debe existir también en `OPENAI_ALLOWED_MODELS`; la validación final siempre ocurre en la Edge Function. Agent Studio consulta el estado del servidor y ofrece los modelos autorizados disponibles para el proyecto conectado.

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

## Secrets

```env
OPENAI_API_KEY=
OPENAI_ACCOUNT_LABEL=SC Produccion
OPENAI_ORGANIZATION_ID=
OPENAI_PROJECT_ID=
OPENAI_ALLOWED_MODELS=gpt-6-luna,gpt-6-sol,gpt-6-astra,gpt-5.4-mini,gpt-5-mini
OPENAI_PROSPECTING_MODEL=gpt-5-mini
OPENAI_QUOTE_MODEL=gpt-5-mini
ALLOWED_ORIGINS=https://erp.scsolucionesconectadas.com.ar
```

OpenAI API autentica con una clave de proyecto, no mediante un inicio de sesión de ChatGPT dentro del CRM. La clave, la organización y el proyecto permanecen exclusivamente en Supabase Secrets. `OPENAI_ACCOUNT_LABEL` es una etiqueta operativa sin secretos que permite identificar en la interfaz qué cuenta financia las ejecuciones.

El estado de la integración verifica `GET /v1/models`, cruza la respuesta con `OPENAI_ALLOWED_MODELS` y muestra únicamente metadatos seguros. Las ejecuciones registran agente, versión, duración y consumo informado por la API sin almacenar secretos. Los errores de credencial, cuota, permisos y modelo se transforman en mensajes accionables sin exponer la respuesta interna completa.
