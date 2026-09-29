# SC Gestión

Portal interno multiempresa de **Soluciones Conectadas** para centralizar oportunidades, clientes, proyectos, tareas, documentos, administración no fiscal, reportes y asistentes de IA.

## Stack

- Frontend estático en HTML, CSS y JavaScript.
- Supabase Auth, PostgreSQL, Storage, Realtime y Edge Functions.
- Row Level Security por `organization_id` y membresías con roles.
- OpenAI Responses API detrás de una Edge Function autenticada.
- Chart.js, SortableJS, Day.js y Lucide con versiones fijadas.
- Playwright y HTML Validate para calidad.

## Roles por empresa

`owner`, `admin`, `commercial`, `project_manager`, `accounting`, `collaborator` y `viewer`.

La autorización proviene exclusivamente de `memberships.role`. El contenido de `user_metadata` nunca concede permisos.

## Ejecutar localmente

```bash
npm install
npm run serve
```

Abrir `http://127.0.0.1:4173`. Si `assets/js/config.js` no tiene configuración válida, se habilita la demo local ficticia.

## Validar

```bash
npm run check
npm run lint:html
npm run test:e2e
```

## Base de datos

Las migraciones están en `supabase/migrations/`. La migración `20260928215846_multi_company_core.sql` agrega aislamiento multiempresa, módulos operativos, Storage privado, auditoría y políticas RLS.

## Aprovisionar empresa y usuarios

1. Crear `.env` desde `.env.example`.
2. Completar `SUPABASE_SERVICE_ROLE_KEY` y contraseñas iniciales fuertes.
3. Ejecutar `npm run users:create` desde una terminal administrativa.

El script es repetible: crea o actualiza la empresa, perfiles y membresías. La service role y las contraseñas nunca deben enviarse al navegador ni versionarse.

## Agentes IA

La función `supabase/functions/ai-agent/index.ts` exige JWT, una membresía activa, un rol permitido y `organization_id`. La clave de OpenAI queda únicamente en Supabase Secrets. Consulte `docs/AI_AGENTS.md`.

## Documentación técnica

La memoria operativa y las decisiones están en `docs/obsidian/00_Contexto_Proyecto.md` y notas relacionadas.

## Publicación

El código se mantiene en el repositorio privado `Scsolucionesconectadas/SC-Gestion`. Antes de exponer el portal en Internet hay que completar el aprovisionamiento inicial, definir el hosting privado, configurar el dominio permitido y validar acceso real con al menos dos empresas de prueba.
