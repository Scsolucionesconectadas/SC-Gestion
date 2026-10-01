# Decisiones Técnicas

## 2026-09-28 - Aislamiento multiempresa por fila

**Decisión:** todas las entidades operativas usan `organization_id` y políticas RLS basadas en membresías.

**Motivo:** una persona puede trabajar con varias empresas sin mezclar información.

**Impacto:** toda consulta y mutación del frontend incluye la empresa activa.

**Alternativas consideradas:** una base por empresa; una aplicación separada por cliente.

**Archivos relacionados:** `supabase/migrations/20260928215846_multi_company_core.sql`, `assets/js/app.js`.

## 2026-09-28 - Autorización fuera de user_metadata

**Decisión:** el rol efectivo vive en `memberships.role`.

**Motivo:** `user_metadata` puede ser editado por el usuario y no es una fuente segura de autorización.

**Impacto:** el trigger crea un perfil básico y RLS verifica membresías activas.

## 2026-09-28 - Administración interna no fiscal

**Decisión:** comprobantes y pagos son registros internos con `is_fiscal=false`.

**Motivo:** el módulo organiza operación y cobranzas, pero no reemplaza ARCA ni un sistema fiscal homologado.

## 2026-09-28 - Repositorio y despliegue separados

**Decisión:** sitio comercial en `Ventas`; portal operativo en `SC-Gestion` con ciclos de publicación separados.

**Motivo:** separar código público, datos internos y ciclo de despliegue.

## 2026-09-29 - Frontend público con datos protegidos

**Decisión:** publicar la interfaz estática en GitHub Pages bajo `erp.scsolucionesconectadas.com.ar`, manteniendo toda autorización y aislamiento de datos en Supabase Auth, permisos y RLS.

**Motivo:** GitHub Pages no ofrece control de acceso al frontend; la aplicación no contiene secretos y el límite de confianza ya está en backend.

**Impacto:** el repositorio y los archivos estáticos son públicos. Se agrega `noindex`, `robots.txt`, CSP, 404 propia y CORS limitado al dominio real. Ningún secreto puede formar parte del bundle.

**Alternativas consideradas:** hosting privado con repositorio privado; queda como evolución posible si se requiere ocultar también el código de interfaz.

**Archivos relacionados:** `index.html`, `agents.html`, `404.html`, `robots.txt`, `supabase/functions/ai-agent/index.ts`, `supabase/functions/communications/index.ts`.

## 2026-09-28 - Cambio obligatorio de contraseña inicial

**Decisión:** las cuentas aprovisionadas con una contraseña temporal no pueden cerrar el diálogo ni operar el portal hasta establecer una clave nueva de al menos ocho caracteres y diferente del usuario.

**Motivo:** las claves iniciales conocidas son útiles solo para el primer acceso y no deben permanecer como credenciales operativas.

**Impacto:** botón de cierre, fondo y tecla `Escape` respetan el bloqueo. El portal se libera únicamente después de actualizar Supabase Auth y limpiar `profiles.must_change_password`.

**Alternativas consideradas:** mostrar solo una recomendación descartable; descartada porque permite conservar credenciales predecibles.

**Archivos relacionados:** `assets/js/app.js`, `docs/obsidian/10_UI_UX_Diseno.md`.

## 2026-09-29 - Perfil global y permisos por empresa

**Decisión:** los datos personales y profesionales se mantienen en `profiles`, mientras que el rol y el estado de acceso pertenecen a `memberships` para cada empresa.

**Motivo:** una persona puede participar en más de una empresa con responsabilidades distintas sin duplicar su identidad.

**Impacto:** el propietario administra perfiles, roles y estado mediante `update_team_member`; las fotos se guardan en el bucket privado `profile-avatars` y se muestran mediante URLs firmadas.

**Alternativas consideradas:** guardar el rol en `profiles` o permitir edición directa desde el navegador; ambas se descartaron porque romperían el modelo multiempresa o debilitarían las validaciones.

**Archivos relacionados:** `supabase/migrations/20260929105003_team_profiles.sql`, `supabase/migrations/20260929105610_team_profile_visibility.sql`, `assets/js/app.js`.

La RPC es deliberadamente `security definer` porque actualiza perfil y membresía en forma atómica. Solo se concede a `authenticated`, vuelve a validar la sesión y el rol `owner` dentro de PostgreSQL, fija `search_path` y no confía en datos del navegador.

## 2026-09-29 - Permisos granulares por empresa

**Decisión:** combinar permisos predeterminados por rol con excepciones JSON por membresía y validarlos tanto en RLS como en las RPC.

**Motivo:** una misma persona puede tener capacidades diferentes según la empresa, sin multiplicar roles rígidos.

**Impacto:** la interfaz oculta acciones por módulo y PostgreSQL continúa siendo la autoridad final. Solo un propietario puede delegar propiedad o capacidades de administración equivalentes.

**Archivos relacionados:** `supabase/migrations/20260929133000_permissions_and_organizations.sql`, `supabase/migrations/20260929141500_permission_rls_enforcement.sql`, `assets/js/app.js`.

## 2026-09-29 - Versionado de agentes y secretos solo en servidor

**Decisión histórica:** separar definiciones editables de versiones publicadas inmutables. La restricción posterior por variable de modelos quedó reemplazada el 2026-09-29 por el catálogo de la cuenta ChatGPT conectada.

**Motivo:** conservar trazabilidad, permitir rollback conceptual y evitar que un valor del navegador elija modelos o credenciales no autorizados.

**Impacto:** `agents.manage` configura y publica; `agents.run` ejecuta. Cada ejecución registra versión, duración y uso informado por la API.

**Archivos relacionados:** `supabase/migrations/20260929140000_agent_studio.sql`, `supabase/functions/ai-agent/index.ts`, `assets/js/agents.js`.

## 2026-09-29 - Comunicaciones y documentos internos

**Decisión:** generar PDF no fiscales en el navegador, almacenarlos de forma privada y enviar correos mediante una Edge Function con Resend e idempotencia.

**Motivo:** la clave del proveedor y el acceso a adjuntos no deben llegar al navegador; los documentos necesitan historial y aislamiento por empresa.

**Impacto:** los envíos requieren `communications.send`; los PDF mantienen marca no fiscal, versión y trazabilidad.

**Alternativas consideradas:** `mailto:` sin trazabilidad y claves de proveedor en el frontend; ambas se descartaron.

**Archivos relacionados:** `assets/js/workspace.js`, `supabase/functions/communications/index.ts`, `supabase/migrations/20260929134500_collaboration_communications.sql`.

## 2026-09-29 - Plan de ChatGPT mediante OAuth por empresa

**Decisión:** reemplazar la autenticación con clave API por Sign in with ChatGPT usando Authorization Code, PKCE y OIDC. Cada empresa mantiene una sola cuenta conectada y Agent Studio usa únicamente sus modelos disponibles.

**Motivo:** SC usará el plan de ChatGPT autorizado por la persona, sin solicitar claves API, copiar cookies ni almacenar contraseñas.

**Impacto:** los tokens se cifran con AES-GCM y se guardan solo en tablas privadas; el callback valida estado, nonce, firma, emisor y audiencia. `ai-agent` ejecuta con `store: false` y `stream: true` y confirma solo `response.completed`.

**Alternativas consideradas:** clave de proyecto OpenAI y automatización de la sesión web. La primera no coincide con el modelo de acceso requerido; la segunda se descarta por insegura y no oficial.

**Archivos relacionados:** `supabase/functions/chatgpt-oauth/index.ts`, `supabase/functions/_shared/chatgpt-plan.ts`, `supabase/functions/ai-agent/index.ts`, `supabase/migrations/20260930005036_chatgpt_oauth_connections.sql`.

## 2026-09-29 - Microinteracciones sin nueva dependencia

**Decisión:** adaptar patrones de feedback visual de Uiverse con CSS propio y el sistema SC, sin copiar un componente completo ni agregar una librería.

**Motivo:** botones, campos y pestañas necesitan mejor respuesta visual, pero las transiciones existentes cubren el caso con menor peso y mantenimiento.

**Impacto:** foco visible, hover, presión, brillo y movimiento breve respetan `prefers-reduced-motion`; las pestañas de Configuración no muestran scrollbar vertical.

**Archivos relacionados:** `assets/css/app.css`, `assets/js/workspace.js`.

## 2026-09-29 - Importación privada e idempotente del CRM provisorio

**Decisión:** migrar los datos operativos directamente desde la hoja autorizada hacia Supabase mediante una única transacción idempotente, sin crear una migración de datos ni guardar el contenido de la hoja en Git.

**Motivo:** los contactos contienen datos personales y comerciales reales; el repositorio público debe conservar solo código y documentación no sensible.

**Impacto:** se incorporaron 65 oportunidades y 65 interacciones a Soluciones Conectadas. La carga evita duplicados por empresa y negocio, conserva responsables y fechas, y revierte el lote completo ante cualquier restricción inválida.

**Alternativas consideradas:** versionar los registros en SQL o importarlos manualmente desde el navegador. Se descartaron por exposición de datos y mayor riesgo de errores parciales.

**Archivos relacionados:** ninguno; la operación se ejecutó de forma controlada contra Supabase y solo se documentan sus conteos.

## 2026-09-30 - Presupuestos guiados separados de facturación

**Decisión:** modelar el presupuesto como una propuesta comercial versionada, compuesta por etapas y conceptos, sin convertir la planilla de referencia en una pantalla ni mezclarla con comprobantes internos.

**Motivo:** el equipo necesita construir alcance y precio desde el requerimiento del cliente, conservar el costo y margen para uso interno y entregar un PDF que muestre únicamente valores comerciales.

**Impacto:** `proposals` conserva la cabecera; `proposal_sections`, `proposal_items` y `proposal_versions` agregan desglose e historial. Solo `save_commercial_proposal` escribe estas tablas, recalcula totales y controla la secuencia `borrador/revisión/aprobada/enviada/aceptada o rechazada`.

**Alternativas consideradas:** replicar el Excel completo y permitir escrituras directas desde el navegador. Se descartaron por complejidad visual, riesgo de datos parciales y manipulación de importes.

**Archivos relacionados:** `assets/js/quotes.js`, `supabase/migrations/20260930024955_commercial_quote_builder.sql`, `supabase/migrations/20260930111554_commercial_quote_fk_indexes.sql`.

## 2026-09-30 - Pipeline acotado y configuración comercial por empresa

**Decisión:** mantener todas las etapas disponibles para arrastrar oportunidades, limitar la cantidad visible por columna y desplazar cada lista internamente. Los valores operativos se guardan en `organizations.settings` bajo `pipeline` y `quotes`.

**Motivo:** el volumen importado hacía crecer la página completa y volvía difícil comparar etapas. A la vez, los criterios documentales deben pertenecer a cada empresa y no quedar fijos en el navegador.

**Impacto:** el propietario define límite por etapa, días sin actividad, ocultamiento de vacías, prefijo, vigencia, impuesto, margen, plazo y condición de pago. El pipeline aplica esos valores inmediatamente y los nuevos presupuestos los toman como base editable.

**Alternativas consideradas:** paginar todo el tablero o crear nuevas tablas de preferencias. Se descartaron por cortar la lectura transversal del kanban y por agregar una migración innecesaria para una configuración estructurada de bajo volumen.

**Archivos relacionados:** `index.html`, `assets/css/app.css`, `assets/js/app.js`, `assets/js/workspace.js`, `assets/js/quotes.js`.

## 2026-09-30 - Propuestas conceptuales sobre el mismo núcleo comercial

**Decisión:** extender `proposals` con un tipo conceptual y metadatos de presentación, manteniendo el presupuesto detallado y la misma escritura transaccional.

**Motivo:** las propuestas reales de SKAL y Hospital combinan relato ejecutivo, módulos, funcionalidades, alternativas e inversión; duplicar el módulo produciría estados, permisos y versiones inconsistentes.

**Impacto:** cada documento elige portada, resumen, objetivo y visibilidad de precios por concepto, módulo o solo total. El PDF adopta una composición administrativa SC inspirada en el recibo de referencia, preserva la proporción del logo, agrega pie por página y superpone una marca de agua clara mientras el documento no fue enviado.

**Alternativas consideradas:** generar un PDF fijo fuera del sistema o crear tablas separadas para propuestas conceptuales. Se descartaron por falta de reutilización, trazabilidad y control de versiones.

**Archivos relacionados:** `assets/js/quotes.js`, `assets/css/app.css`, `supabase/migrations/20260930214821_conceptual_proposals.sql`.

## 2026-09-30 - Conversión asistida y auditoría del pipeline

**Decisión:** convertir una propuesta aceptada únicamente mediante confirmación humana, con búsqueda previa de clientes similares, selección entre vincular o crear y una operación atómica en PostgreSQL.

**Motivo:** aceptar una propuesta expresa intención comercial, pero no garantiza que deba duplicarse un cliente, abrirse un proyecto o crearse siempre el mismo conjunto de tareas.

**Impacto:** el pipeline incorpora valor, probabilidad, antigüedad e historial por etapa. Los cierres perdidos requieren motivo y la conversión deja vínculos de origen en propuesta, cliente y proyecto. `convert_accepted_proposal` es idempotente, usa `security invoker` y vuelve a validar organización y permisos.

**Alternativas consideradas:** conversión automática al aceptar y escrituras separadas desde el navegador. Se descartaron por riesgo de duplicados y estados parciales.

**Archivos relacionados:** `assets/js/conversion.js`, `assets/js/app.js`, `assets/js/quotes.js`, `supabase/migrations/20260930224548_pipeline_conversion_workflow.sql`, `supabase/migrations/20261001004835_pipeline_conversion_indexes.sql`.
