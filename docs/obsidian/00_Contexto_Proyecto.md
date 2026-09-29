# Contexto del Proyecto

## Objetivo

SC Gestión es el portal interno multiempresa de Soluciones Conectadas. Centraliza CRM, clientes, proyectos, tareas, documentos privados, administración no fiscal, reportes y agentes IA.

## Estado actual

- Esquema multiempresa aplicado al proyecto Supabase `sc-crm-comercial`.
- Frontend y demo local implementados.
- RLS, roles, Storage privado y auditoría implementados.
- Empresa y tres usuarios iniciales aprovisionados y validados contra Auth y RLS; `mbetancourt` completó el cambio inicial y los otros dos usuarios lo mantienen pendiente.
- Perfiles profesionales, fotos privadas y administración del equipo por el propietario implementados.
- Sidebar responsive, formularios y modales actualizados y cubiertos por Playwright.
- Hosting privado y dominio interno pendientes.

## Stack técnico

- Frontend: HTML, CSS y JavaScript ES modules.
- Backend: Supabase Auth, Edge Functions y Realtime.
- Base de datos: PostgreSQL con RLS.
- Archivos: Supabase Storage privado.
- IA: OpenAI Responses API desde Edge Function.
- Calidad: Playwright y HTML Validate.

## Cómo ejecutar

```bash
npm install
npm run serve
```

## Pendientes importantes

- [ ] Confirmar que `areyes` y `orojas` reemplazaron su contraseña temporal.
- [ ] Validar separación con dos empresas y usuarios reales.
- [ ] Definir hosting privado, dominio y recuperación de contraseña.
- [ ] Completar datos identificatorios de SC cuando existan formalmente.

## Notas relacionadas

- [[01_Arquitectura]]
- [[02_Decisiones_Tecnicas]]
- [[05_Pendientes]]
- [[13_Deploy_Infraestructura]]
