# Contexto del Proyecto

## Objetivo

SC Gestión es el portal interno multiempresa de Soluciones Conectadas. Centraliza CRM, clientes, proyectos, tareas, documentos privados, administración no fiscal, reportes y agentes IA.

## Estado actual

- Esquema multiempresa aplicado al proyecto Supabase `sc-crm-comercial`.
- Frontend y demo local implementados.
- RLS, roles, Storage privado y auditoría implementados.
- Aprovisionamiento preparado, pendiente de ejecutarse con contraseñas definidas por el titular.
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

- [ ] Aprovisionar empresa y usuarios con secretos locales.
- [ ] Validar separación con dos empresas y usuarios reales.
- [ ] Definir hosting privado, dominio y recuperación de contraseña.
- [ ] Completar datos identificatorios de SC cuando existan formalmente.

## Notas relacionadas

- [[01_Arquitectura]]
- [[02_Decisiones_Tecnicas]]
- [[05_Pendientes]]
- [[13_Deploy_Infraestructura]]
