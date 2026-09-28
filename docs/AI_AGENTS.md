# Agentes IA del CRM

El CRM incorpora una capa de agentes conectada a OpenAI mediante una **Supabase Edge Function**. La clave de OpenAI nunca se expone en GitHub Pages ni en el navegador.

## 1. Agente Comercial

Objetivo:
- buscar posibles clientes en Concepción del Uruguay y alrededores;
- revisar información pública actual;
- excluir negocios ya cargados en el CRM;
- separar hechos verificados de hipótesis comerciales;
- mostrar datos públicos de contacto;
- proponer un ángulo de solución;
- redactar un mensaje base personalizado;
- permitir agregar el negocio al CRM con un clic.

La búsqueda web se ejecuta desde la Responses API de OpenAI con la herramienta de búsqueda web.

## 2. Agente de Presupuestos

Objetivo:
- transformar el relevamiento del cliente en una estimación interna;
- usar el catálogo real de precios de SC;
- separar implementación y costos recurrentes;
- considerar hosting, terceros, mantenimiento, soporte, capacitación e integraciones;
- detectar información faltante;
- generar preguntas de relevamiento;
- guardar borradores para revisión humana.

**El agente no inventa tarifas internas.** Si el catálogo no tiene un precio necesario, devuelve `requires_pricing_input=true`.

## Seguridad

- Supabase Auth identifica al usuario.
- RLS protege tablas.
- `OPENAI_API_KEY` vive únicamente como secreto de Supabase Edge Functions.
- Los resultados se guardan en `agent_runs` para trazabilidad.
- Ningún mensaje se envía automáticamente.
- Ningún presupuesto se considera final sin revisión humana.

## Secrets del Edge Function

```
OPENAI_API_KEY=...
OPENAI_PROSPECTING_MODEL=gpt-5.6-terra
OPENAI_QUOTE_MODEL=gpt-5.6-sol
```

Los modelos quedan configurables por variables de entorno para poder cambiarlos sin modificar el frontend.
