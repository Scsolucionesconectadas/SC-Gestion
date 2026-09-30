# Contexto del Proyecto

## Objetivo

SC Gestión es el portal interno multiempresa de Soluciones Conectadas. Centraliza CRM, clientes, proyectos, tareas, documentos privados, administración no fiscal, reportes y agentes IA.

## Estado actual

- Esquema multiempresa aplicado al proyecto Supabase `sc-crm-comercial`.
- Frontend y demo local implementados.
- RLS, roles, permisos granulares por empresa, Storage privado y auditoría implementados.
- Empresa y tres usuarios iniciales aprovisionados y validados contra Auth y RLS; `mbetancourt` completó el cambio inicial y los otros dos usuarios lo mantienen pendiente.
- Perfiles profesionales, fotos privadas y administración del equipo por el propietario implementados.
- Sidebar responsive, formularios y modales actualizados y cubiertos por Playwright.
- Colaboración de tareas con checklist, subtareas, comentarios y seguidores; notificaciones, comunicaciones por email, PDF internos y preferencias personales implementados.
- Avisos diarios de tareas vencidas programados a las 08:15 de Argentina mediante `pg_cron`.
- Agent Studio implementado con borradores, versiones publicadas y modelos de la cuenta de ChatGPT conectada por empresa.
- Flujo OAuth de ChatGPT preparado con PKCE, tokens cifrados en servidor, renovación, cambio de cuenta y desconexión. La prueba real espera el `client_id` aprobado por OpenAI.
- Frontend publicado en GitHub Pages con dominio `https://erp.scsolucionesconectadas.com.ar/`, HTTPS obligatorio y frontend público protegido por Auth y RLS.

## Stack técnico

- Frontend: HTML, CSS y JavaScript ES modules.
- Backend: Supabase Auth, Edge Functions y Realtime.
- Base de datos: PostgreSQL con RLS.
- Archivos: Supabase Storage privado.
- IA: plan de ChatGPT mediante OAuth oficial y Responses API desde Edge Functions.
- Calidad: Playwright y HTML Validate.

## Cómo ejecutar

```bash
npm install
npm run serve
```

## Pendientes importantes

- [ ] Confirmar que `areyes` y `orojas` reemplazaron su contraseña temporal.
- [ ] Validar separación con dos empresas y usuarios reales.
- [ ] Configurar recuperación de contraseña para las identidades internas.
- [ ] Configurar y verificar Resend con un dominio remitente validado.
- [ ] Obtener de OpenAI la habilitación y el `client_id` de Sign in with ChatGPT; cargar secretos y ejecutar una prueba controlada.
- [ ] Activar protección contra contraseñas filtradas y MFA para propietarios.
- [ ] Completar datos identificatorios de SC cuando existan formalmente.

## Notas relacionadas

- [[01_Arquitectura]]
- [[02_Decisiones_Tecnicas]]
- [[05_Pendientes]]
- [[13_Deploy_Infraestructura]]
