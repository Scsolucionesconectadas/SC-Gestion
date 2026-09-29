# Agentes IA de SC Gestión

Los agentes se ejecutan mediante la Edge Function `ai-agent`. El navegador nunca recibe `OPENAI_API_KEY`.

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
- Roles habilitados: `owner`, `admin`, `commercial`, `accounting`.
- Límite de 20 ejecuciones por usuario, empresa y hora.
- Entradas limitadas por tamaño y salidas validadas con JSON Schema estricto.
- Consultas al CRM, catálogo y trazabilidad filtradas por empresa.
- Errores internos no se exponen al navegador.
- `store: false` en Responses API.

## Secrets

```env
OPENAI_API_KEY=
OPENAI_PROSPECTING_MODEL=gpt-5-mini
OPENAI_QUOTE_MODEL=gpt-5-mini
ALLOWED_ORIGINS=https://app.example.com
```

Los modelos son configurables para actualizarse sin modificar el frontend.
