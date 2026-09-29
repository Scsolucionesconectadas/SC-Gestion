# Bitácora de Desarrollo

## 2026-09-28 - Portal multiempresa

**Cambios realizados:**
- Migración multiempresa, roles, RLS, Storage y auditoría.
- Clientes, proyectos, documentos, administración, pagos y equipo.
- Selector de empresa y permisos visuales por rol.
- Agentes IA aislados por empresa y con límite de uso.
- Script seguro de aprovisionamiento.
- Pruebas E2E responsive y validación HTML.

**Validaciones realizadas:**
- `npm run check`.
- `npm run lint:html`.
- `npm run test:e2e`.
- Supabase Security Advisor.
- Supabase Performance Advisor y corrección de índices de claves foráneas.
- Security Advisor sin hallazgos; Performance Advisor quedó solo con avisos informativos de índices aún no usados porque no hay carga productiva.

**Pendientes detectados:**
- Usuarios reales, prueba cruzada entre tenants y hosting privado.

## 2026-09-28 - Aprovisionamiento inicial

**Cambios realizados:**
- Se creó la organización Soluciones Conectadas en Supabase.
- Se registraron `mbetancourt` como `owner` y `areyes` y `orojas` como `commercial`.
- Las cuentas quedaron activas, con identidad email confirmada y cambio obligatorio de contraseña inicial.
- Se bloqueó el uso del portal hasta completar ese cambio; el diálogo no puede cerrarse mediante botón, fondo ni teclado.
- No se guardaron contraseñas ni tokens en el repositorio.

**Validaciones realizadas:**
- Inicio de sesión real aprobado para los tres usuarios.
- Cada sesión recuperó exactamente una membresía de Soluciones Conectadas mediante RLS.
- Se verificaron perfil activo, rol efectivo e identidad Auth para cada cuenta.
- Se validó sintaxis, HTML, flujo demo y bloqueo de contraseña con una sesión real.
- Security Advisor sin hallazgos de RLS o exposición; mantiene un aviso por protección de contraseñas filtradas desactivada.

**Pendientes detectados:**
- Confirmar el cambio de las contraseñas temporales.
- Probar aislamiento RLS con una segunda empresa y usuarios independientes.

## 2026-09-29 - Perfiles, equipo y formularios

**Cambios realizados:**
- Se rediseñó la barra lateral para escritorio, tablet y móvil, con cierre, fondo, foco restaurado y desplazamiento interno controlado.
- Se incorporaron perfiles profesionales con foto privada, cargo, teléfono, email y biografía.
- El propietario puede editar los datos, rol y estado de cada integrante sin dejar a la empresa sin un propietario activo.
- Se renovaron formularios, selectores, modales y animaciones, respetando `prefers-reduced-motion`.
- Se corrigió el cierre de formularios creados dinámicamente mediante delegación de eventos.
- Se corrigió el estado de `mbetancourt` para que no vuelva a pedir el cambio inicial ya completado; `areyes` y `orojas` permanecen pendientes.

**Archivos modificados:**
- `index.html`, `assets/css/app.css`, `assets/js/app.js`.
- `supabase/migrations/20260929105003_team_profiles.sql`.
- `supabase/migrations/20260929105610_team_profile_visibility.sql`.
- `tests/app-shell.spec.js`.

**Validaciones realizadas:**
- Sintaxis JavaScript, validación HTML y pruebas Playwright responsive.
- Ejecución reversible de `update_team_member` con sesión autenticada y rol propietario.
- Verificación visual de equipo, perfil y barra lateral en escritorio y móvil.
- Supabase Security Advisor: conserva el aviso esperado por la RPC `security definer` y el aviso de protección de contraseñas filtradas pendiente.
- Supabase Performance Advisor: sin políticas permisivas duplicadas; solo informa índices aún no utilizados por falta de tráfico productivo.

**Pendientes detectados:**
- Limpiar una foto recién subida si una actualización posterior del perfil falla.
- Confirmar el cambio inicial de contraseña de `areyes` y `orojas`.

## 2026-09-29 - Permisos, colaboración, comunicaciones y Agent Studio

**Cambios realizados:**
- Se agregó administración multiempresa de datos de empresa, usuarios, roles, permisos y preferencias de notificación.
- Se incorporaron comentarios, menciones, seguidores y notificaciones de tareas asignadas o vencidas.
- Se implementaron comunicaciones con historial, plantillas y envío autenticado mediante Resend.
- Se agregó generación y descarga de PDF internos no fiscales con logo proporcionado, marca visible y almacenamiento privado.
- Se creó Agent Studio para definir prompts, contexto, herramientas, aprobación humana y versiones publicadas.
- Se actualizó la interfaz con menús de creación, notificaciones, usuario, configuración y microinteracciones con movimiento reducido accesible.
- Se separaron visualmente los permisos de lectura y escritura por módulo.

**Archivos modificados:**
- `index.html`, `agents.html`, `assets/css/app.css`, `assets/css/agents-studio.css`.
- `assets/js/app.js`, `assets/js/workspace.js`, `assets/js/agents.js`.
- `supabase/functions/ai-agent/index.ts`, `supabase/functions/communications/index.ts`.
- Migraciones `20260929133000` a `20260929144000`.

**Validaciones realizadas:**
- `npm run check`, `npm run lint:html` y Playwright en escritorio y móvil.
- Inicio autenticado con rol comercial para comprobar módulos ocultos y ejecución de agentes publicada.
- Supabase Security y Performance Advisor después de aplicar índices y consolidar políticas.

**Pendientes detectados:**
- Configurar Resend y validar un envío controlado.
- Activar protección contra contraseñas filtradas desde Supabase Auth.
- Completar prueba de aislamiento con una segunda empresa real.

## 2026-09-29 - Robustez de perfiles y avisos de vencimiento

**Cambios realizados:**
- La carga de avatares conserva la ruta temporal y elimina el archivo nuevo si falla la persistencia del perfil.
- Cuando el reemplazo se confirma, se elimina de forma segura el avatar anterior para evitar archivos huérfanos.
- Se programó `enqueue_overdue_task_notifications()` todos los días a las 08:15 de Argentina.
- Los avisos omiten usuarios o membresías inactivas y respetan la preferencia personal `in_app`.

**Archivos modificados:**
- `assets/js/app.js`.
- `supabase/migrations/20260929150000_schedule_overdue_notifications.sql`.

**Validaciones realizadas:**
- Job `sc-overdue-task-notifications` confirmado como activo en `cron.job`.
- Validación de sintaxis, HTML y pruebas E2E.

## 2026-09-29 - Checklist y subtareas

**Cambios realizados:**
- El detalle de tarea incorpora pasos comprobables con progreso, alta, marcado y eliminación.
- Se pueden crear subtareas heredando oportunidad, prioridad y vencimiento de la tarea principal.
- Las subtareas permiten responsable, acceso a su propio detalle y cambio rápido de estado.
- La composición se adapta a una columna en móvil sin desborde horizontal.

**Archivos modificados:**
- `assets/js/workspace.js`, `assets/css/app.css` y `tests/app-shell.spec.js`.

**Validaciones realizadas:**
- Playwright cubre alta y completado de checklist y alta de subtarea en modo demo.
