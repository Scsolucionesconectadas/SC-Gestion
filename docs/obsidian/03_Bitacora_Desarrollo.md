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

## 2026-09-29 - Dominio productivo y endurecimiento del frontend

**Cambios realizados:**
- Se confirmó GitHub Pages activo con HTTPS en `erp.scsolucionesconectadas.com.ar`.
- Las Edge Functions ahora autorizan el dominio productivo y rechazan orígenes ajenos.
- Se agregaron CSP, política de referencia, `noindex`, `robots.txt`, favicon y página 404 con identidad SC.
- Se actualizó la documentación para reflejar que el repositorio y el frontend son públicos.

**Validaciones realizadas:**
- GitHub Pages respondió `200`, certificado aprobado y HTTPS forzado.
- CORS devolvió `204` para el dominio productivo y `403` para un origen no autorizado.
- Lint, validación HTML y Playwright con cobertura de la página 404.

## 2026-09-29 - Configuración y diagnóstico de agentes IA

**Cambios realizados:**
- Se corrigió el corte vertical de Agent Studio con una composición flexible, editor desplazable y acciones fijas.
- Se incorporó un selector de modelos ampliado y alimentado por los modelos autorizados y disponibles en el proyecto de OpenAI.
- La cabecera de agentes muestra conexión y etiqueta de cuenta solo a quienes administran agentes; Integraciones permite verificar y abrir un asistente de configuración seguro.
- La Edge Function valida la credencial con `GET /v1/models`, informa cuenta, proyecto y modelos sin exponer secretos.
- Los errores de credencial, cuota, permisos y modelo ahora llegan al usuario como mensajes claros en lugar de `Edge Function returned a non-2xx status code`.
- Se compactó la barra superior y se adaptaron sus controles por resolución.

**Archivos modificados:**
- `agents.html`, `index.html`, `assets/css/app.css`, `assets/css/agents-studio.css`.
- `assets/js/app.js`, `assets/js/workspace.js`, `assets/js/agents.js`.
- `supabase/functions/ai-agent/index.ts`, `.env.example`, documentación y pruebas.

**Validaciones realizadas:**
- Sintaxis JavaScript y validación HTML.
- Playwright en escritorio, pantalla baja y móvil.
- Logs de Supabase: el `503` ocurrió antes de crear una corrida porque faltaba `OPENAI_API_KEY`.

**Pendientes detectados:**
- Este pendiente quedó reemplazado por la habilitación OAuth de ChatGPT documentada en la entrada siguiente.

## 2026-09-29 - OAuth de ChatGPT y refinamiento de Configuración

**Cambios realizados:**
- Se reemplazó el flujo de clave API por conexión oficial de ChatGPT con OAuth, PKCE y OIDC por empresa.
- Se agregaron cifrado de tokens, renovación rotativa, catálogo de modelos, reconexión, cambio de cuenta, revocación y desconexión.
- `ai-agent` usa el token de la empresa, entrada estructurada, `store: false`, `stream: true` y espera `response.completed`.
- Configuración y Agent Studio muestran cuenta y modelos reales sin secretos; mientras falta aprobación del proveedor se informa el bloqueo.
- Se eliminó la barra vertical de las pestañas y se mejoraron botones, campos e integraciones con microinteracciones accesibles.

**Archivos modificados:**
- `supabase/functions/_shared/chatgpt-plan.ts`, `supabase/functions/chatgpt-oauth/index.ts`, `supabase/functions/ai-agent/index.ts`.
- `supabase/migrations/20260930005036_chatgpt_oauth_connections.sql`, `supabase/config.toml`.
- `assets/js/workspace.js`, `assets/js/agents.js`, `assets/css/app.css`, `.env.example` y pruebas.

**Validaciones realizadas:**
- `npm run lint`: correcto.
- Playwright: 5 pruebas aprobadas en escritorio, móvil y pantalla baja.
- Búsqueda de referencias runtime a `OPENAI_API_KEY`: sin coincidencias.
- Migraciones de conexión e índices aplicadas en Supabase; `ai-agent` v6 y `chatgpt-oauth` v2 activos.
- Acción OAuth sin JWT rechazada con `401`; callback sin estado redirigido como error controlado.
- `anon` y `authenticated` sin privilegio de lectura; Performance Advisor sin claves foráneas nuevas sin índice.
- Revisión visual a 1650 x 790 y 390 x 844 sin desborde ni scrollbar vertical en las pestañas.

**Pendientes detectados:**
- Obtener el `client_id` aprobado por OpenAI, configurar secretos y realizar el recorrido OAuth real.

## 2026-09-29 - Migración comercial y refinamiento visual global

**Cambios realizados:**
- Se migraron 65 oportunidades y 65 seguimientos desde el CRM provisorio hacia `prospects` e `interactions`.
- Se preservaron responsables, fechas, contactos, necesidades, próximos pasos y observaciones sin almacenar la fuente en el repositorio.
- Se corrigió definitivamente el scrollbar lateral de Configuración con recorte vertical y desplazamiento horizontal solo en pantallas pequeñas.
- Se unificó la escala tipográfica de navegación, tablas, formularios, tarjetas, modales e Integraciones.
- Se incorporaron transiciones de entrada, foco, hover y selección con desactivación mediante `prefers-reduced-motion`.
- Se registró que OpenAI recibió la solicitud comercial y prevé ampliar el acceso durante el cuarto trimestre.

**Archivos modificados:**
- `assets/css/app.css`, `tests/app-shell.spec.js` y documentación Obsidian.

**Validaciones realizadas:**
- Auditoría posterior: 65 oportunidades, 65 interacciones, cero duplicados y cero relaciones huérfanas.
- `npm run lint`: correcto.
- Playwright: 5 pruebas aprobadas.
- Revisión visual en 1440 x 900 y 390 x 844, sin desborde horizontal; cabecera de 64 px y 56 px respectivamente.

**Pendientes detectados:**
- Esperar la respuesta de OpenAI antes de configurar credenciales o ejecutar el primer agente real.

## 2026-09-30 - Constructor de presupuestos comerciales

**Cambios realizados:**
- Se incorporó el módulo Presupuestos con KPIs, filtros, estados, edición, nueva versión y acceso desde creación rápida.
- El constructor organiza identificación, alcance, exclusiones, etapas, conceptos, cantidades, unidades, costos, márgenes, descuentos, impuestos, condiciones y control previo.
- El PDF comercial muestra alcance, conceptos, precios y condiciones sin exponer costos internos ni márgenes.
- PostgreSQL recalcula los totales, conserva snapshots, impide saltos de estado y bloquea la edición de documentos cerrados.
- Se retiró el formulario antiguo que escribía directamente en `proposals` y se limitaron las tablas comerciales a lectura desde el navegador.

**Archivos modificados:**
- `index.html`, `assets/css/app.css`, `assets/js/app.js`, `assets/js/workspace.js`, `assets/js/quotes.js`.
- `supabase/migrations/20260930024955_commercial_quote_builder.sql` y `supabase/migrations/20260930111554_commercial_quote_fk_indexes.sql`.
- `package.json`, `tests/app-shell.spec.js` y documentación Obsidian.

**Validaciones realizadas:**
- `npm run lint`: correcto.
- Playwright: 6 pruebas aprobadas; creación, cálculo, PDF, versión y responsive a 390 x 844 incluidos.
- Prueba transaccional real en Supabase: total calculado por servidor, recorrido completo de estados y bloqueo posterior a aceptación; todos los datos temporales se revirtieron.
- Security Advisor revisado; la RPC `security definer` es intencional, valida sesión, empresa y permisos. Performance Advisor quedó sin claves foráneas sin índice.

**Pendientes detectados:**
- Validar el primer presupuesto real con un usuario autenticado y definir si la aceptación abrirá un asistente de conversión a cliente y proyecto.

## 2026-09-30 - Filtros de pipeline y control comercial por empresa

**Cambios realizados:**
- Se agregaron búsqueda y filtros por responsable, rubro y estado del seguimiento, junto con limpieza, conteo de resultados y ocultamiento de etapas vacías.
- Cada etapa limita sus tarjetas y usa scroll interno, evitando que una columna numerosa extienda toda la página.
- Se incorporó la pestaña exclusiva para propietarios `Comercial y documentos` con preferencias de pipeline y valores iniciales de presupuestos.
- Los nuevos presupuestos toman prefijo, vigencia, impuesto, margen, plazo y condición de pago de la empresa activa.
- Se corrigió un desborde horizontal causado por el checkbox visual de Configuración y se ajustaron filtros para notebook, tablet y móvil.

**Archivos modificados:**
- `index.html`, `assets/css/app.css`, `assets/js/app.js`, `assets/js/workspace.js`, `assets/js/quotes.js`.
- `tests/app-shell.spec.js` y documentación Obsidian.

**Validaciones realizadas:**
- `npm run lint`: correcto.
- Playwright: 7 pruebas aprobadas, incluida persistencia de preferencias y valores iniciales del presupuesto.
- Revisión visual en 1440 x 900 y 390 x 844; ancho del documento estable y controles sin superposiciones.

**Pendientes detectados:**
- Diseñar vistas guardadas, etapas configurables y conversión asistida de oportunidad aceptada a cliente y proyecto.

## 2026-09-30 - Propuestas conceptuales y rediseño de PDF

**Cambios realizados:**
- Se incorporó el tipo `Propuesta conceptual` sin retirar el presupuesto detallado.
- El editor agrega portada opcional, resumen ejecutivo, objetivo, módulos, funcionalidades por concepto y presentación de precios configurable.
- El PDF se rediseñó con identidad SC, logo sin deformación, portada, metadatos, módulos, inversión, condiciones, próximos pasos, pie consistente y marca de agua clara por encima del contenido.
- Supabase guarda y valida los nuevos campos mediante la RPC transaccional existente.

**Archivos modificados:**
- `assets/js/quotes.js`, `assets/js/app.js`, `assets/css/app.css`.
- `supabase/migrations/20260930214821_conceptual_proposals.sql`.
- `tests/app-shell.spec.js` y documentación Obsidian.

**Validaciones realizadas:**
- `npm run lint`: correcto.
- Playwright: 8 pruebas aprobadas; incluye creación, persistencia demo, PDF y reapertura responsive de una propuesta conceptual a 390 x 844.
- Revisión visual del editor en escritorio/móvil y de las tres páginas del PDF de ejemplo.
- Migración `conceptual_proposals` aplicada a `sc-crm-comercial`; columnas, restricciones y función `security definer` verificadas.
- Security y Performance Advisors revisados: no se introdujeron alertas nuevas atribuibles a esta migración.

**Pendientes detectados:**
- Validar una propuesta conceptual con datos reales y un usuario autenticado.
- Implementar la conversión guiada de propuesta aceptada a cliente y proyecto, con confirmación para evitar duplicados.

## 2026-09-30 - Pipeline avanzado y conversión asistida

**Cambios realizados:**
- Se agregaron valor estimado, moneda, probabilidad, antigüedad por etapa, motivo de pérdida e historial comercial.
- El pipeline muestra valor abierto y ponderado, oportunidades estancadas, propuestas listas para convertir y filtros por probabilidad, moneda y resultado.
- Se incorporó un asistente de tres pasos para revisar coincidencias, vincular o crear cliente, abrir opcionalmente un proyecto y generar tareas iniciales.
- La conversión exige una propuesta aceptada, no se ejecuta automáticamente y queda protegida contra reintentos duplicados.

**Archivos modificados:**
- `index.html`, `assets/css/app.css`, `assets/js/app.js`, `assets/js/quotes.js`, `assets/js/conversion.js`.
- `supabase/migrations/20260930224548_pipeline_conversion_workflow.sql` y `supabase/migrations/20261001004835_pipeline_conversion_indexes.sql`.
- `package.json`, `tests/app-shell.spec.js` y documentación Obsidian.

**Validaciones realizadas:**
- Migraciones aplicadas a `sc-crm-comercial`; 65 movimientos iniciales de etapa, cero oportunidades sin fecha de etapa o probabilidad y cero cierres sin motivo.
- RPC de conversión verificada como `security invoker`; índices revisados con Performance Advisor sin nuevas claves foráneas pendientes.
- Revisión visual del pipeline y del asistente en escritorio y móvil; Playwright aprobó 9 de 9 pruebas, incluida la conversión completa y el control de desborde a 390 x 844.

**Pendientes detectados:**
- Ejecutar una conversión controlada con una propuesta real y un usuario autenticado.
- Diseñar vistas guardadas, etapas configurables y combinación asistida de duplicados.
