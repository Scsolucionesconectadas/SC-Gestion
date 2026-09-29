# SC Gestión

Portal interno multiempresa de **Soluciones Conectadas** para centralizar oportunidades, clientes, proyectos, tareas colaborativas, documentos privados, comunicaciones, administración no fiscal, reportes y agentes de IA configurables.

## Stack

- Frontend estático en HTML, CSS y JavaScript.
- Supabase Auth, PostgreSQL, Storage, Realtime y Edge Functions.
- Row Level Security por `organization_id`, roles y permisos granulares.
- OpenAI Responses API detrás de una Edge Function autenticada.
- Chart.js, SortableJS, Day.js y Lucide con versiones fijadas.
- Playwright y HTML Validate para calidad.

## Roles por empresa

`owner`, `admin`, `commercial`, `project_manager`, `accounting`, `collaborator` y `viewer`.

La autorización proviene de `memberships.role`, los permisos predeterminados del rol y `permission_overrides` por empresa. El contenido de `user_metadata` nunca concede permisos. El propietario conserva control total; los administradores solo pueden delegar permisos que ya poseen y no pueden asignar el rol propietario.

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

Las migraciones están en `supabase/migrations/`. Además del núcleo multiempresa, incluyen permisos granulares, comentarios y seguidores de tareas, notificaciones, correo, documentos generados, Agent Studio, endurecimiento RLS e índices de relaciones.

Los PDF generados desde Administración son documentos internos no fiscales, se guardan en el bucket privado `generated-pdfs` y conservan versión y trazabilidad. No reemplazan comprobantes emitidos ante ARCA.

## Aprovisionar empresa y usuarios

1. Crear `.env` desde `.env.example`.
2. Completar `SUPABASE_SERVICE_ROLE_KEY` y contraseñas iniciales fuertes.
3. Ejecutar `npm run users:create` desde una terminal administrativa.

El script es repetible: crea o actualiza la empresa, perfiles y membresías. La service role y las contraseñas nunca deben enviarse al navegador ni versionarse.

## Comunicaciones

La Edge Function `communications` envía mensajes preparados desde el portal mediante Resend. Requiere JWT, permiso `communications.send`, destinatarios válidos e idempotencia por mensaje. Los adjuntos se descargan únicamente desde Storage privado. Configure `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO` y `ALLOWED_ORIGINS` como Supabase Secrets.

## Agentes IA

La función `supabase/functions/ai-agent/index.ts` exige JWT, membresía activa, permiso `agents.run` y `organization_id`. Agent Studio permite a quienes tienen `agents.manage` crear borradores, definir instrucciones, contexto, herramientas, modelo permitido y publicar versiones inmutables. La clave de OpenAI queda únicamente en Supabase Secrets. Consulte `docs/AI_AGENTS.md`.

## Colaboración

- Tareas con responsables, prioridad, vencimiento, checklist, subtareas, comentarios, menciones y seguidores.
- Notificaciones dentro de la aplicación para asignaciones, comentarios y vencimientos.
- Preferencias personales de avisos por empresa.
- Gestión multiempresa de usuarios, roles y excepciones de permisos.

## Documentación técnica

La memoria operativa y las decisiones están en `docs/obsidian/00_Contexto_Proyecto.md` y notas relacionadas.

## Publicación

El código se mantiene en el repositorio privado `Scsolucionesconectadas/SC-Gestion`. Antes de exponer el portal en Internet hay que completar el aprovisionamiento inicial, definir el hosting privado, configurar el dominio permitido y validar acceso real con al menos dos empresas de prueba.
