# Pendientes

## Pendientes activos

- [ ] Confirmar que `areyes` reemplazó su contraseña temporal por una clave fuerte y única.
- [ ] Probar RLS con dos empresas y al menos un usuario por empresa.
- [ ] Configurar recuperación de contraseña y segundo factor para propietarios.
- [ ] Activar la protección de Supabase Auth contra contraseñas filtradas antes del uso productivo.
- [ ] Configurar backup y restauración probada.
- [ ] Completar identidad legal, CUIT y domicilio solo cuando estén formalmente disponibles.
- [ ] Revisión legal argentina de privacidad, términos y cookies del sitio público.
- [ ] Configurar `RESEND_API_KEY`, remitente verificado y ejecutar un envío controlado.
- [ ] Esperar la respuesta de OpenAI a la solicitud comercial de Sign in with ChatGPT; el formulario informa una ampliación de acceso prevista para comienzos del cuarto trimestre.
- [ ] Configurar `CHATGPT_CLIENT_ID`, `CHATGPT_REDIRECT_URI` y `CHATGPT_TOKEN_ENCRYPTION_KEY` en Supabase Secrets; agregar secreto y método de autenticación solo si el registro lo exige.
- [ ] Conectar una cuenta real de ChatGPT, validar el catálogo de modelos y ejecutar un agente controlado con `store: false` y `stream: true`.
- [ ] Validar el primer presupuesto detallado y la primera propuesta conceptual real con un usuario autenticado.
- [ ] Ejecutar una conversión controlada de propuesta aceptada con un usuario autenticado y datos reales.
- [ ] Diseñar vistas compartidas del pipeline con gobierno por rol, si el uso real demuestra que son necesarias.
- [ ] Incorporar acciones masivas con vista previa, confirmación y registro de auditoría.

## Configuración propuesta

- [ ] Seguridad: MFA, sesiones activas, cierre remoto, historial de accesos y políticas de contraseña.
- [ ] Administración: numeración interna, condiciones de pago, vencimientos, impuestos informativos y plantillas PDF.
- [ ] Comunicaciones: remitentes, firmas, plantillas, horarios silenciosos y reglas de notificación por evento.
- [ ] Datos: retención, exportación, importación, backups y restauración verificada.
- [ ] Automatizaciones: webhooks, n8n, reintentos, alertas y bitácora de ejecuciones.
- [ ] Marca y localización: logo, idioma, formatos de fecha, zona horaria, moneda y colores por empresa.
- [ ] IA: límites por rol, aprobación humana por agente, consumo visible y políticas de herramientas por empresa.

## Resueltos

- [x] Etapas configurables por empresa con claves estables, RLS, validación de transiciones, auditoría y editor responsive - 2026-10-01.
- [x] Cliente 360° con actividad, operación, administración y comunicaciones relacionadas - 2026-10-01.
- [x] Vistas personales y predeterminadas del pipeline aisladas por usuario y empresa - 2026-10-01.
- [x] Unificación asistida y auditable de clientes duplicados para propietarios - 2026-10-01.
- [x] Conversión asistida de propuesta aceptada a cliente, proyecto y tareas, con detección previa de coincidencias - 2026-09-30.
- [x] Pipeline con valor, probabilidad, antigüedad, historial, motivo de pérdida y filtros de resultado - 2026-09-30.
- [x] Propuestas conceptuales con portada, módulos, niveles de precio y PDF SC profesional - 2026-09-30.
- [x] Pipeline con búsqueda, filtros, conteo, límite por columna, scroll interno y ocultamiento de etapas vacías - 2026-09-30.
- [x] Configuración comercial por empresa para pipeline y valores iniciales de presupuestos - 2026-09-30.
- [x] Constructor de presupuestos por etapas, conceptos, margen, aprobación, versiones y PDF comercial - 2026-09-30.
- [x] Presentar a OpenAI la solicitud comercial para Sign in with ChatGPT - 2026-09-29.
- [x] Migrar el CRM provisorio: 65 oportunidades y 65 interacciones sin duplicados ni huérfanos - 2026-09-29.
- [x] Unificar tipografías, microinteracciones y eliminar scrollbars técnicos visibles en Configuración - 2026-09-29.
- [x] Corregir el indicador de cambio inicial para `mbetancourt` y verificar que no vuelva a bloquear el acceso - 2026-09-29.
- [x] Incorporar perfiles profesionales y administración del equipo por el propietario - 2026-09-29.
- [x] Rediseñar sidebar, formularios y modales responsive - 2026-09-29.
- [x] Aprovisionar Soluciones Conectadas y validar login, perfiles y membresías de los tres usuarios iniciales - 2026-09-28.
- [x] Separación multiempresa y roles - 2026-09-28.
- [x] Módulos de clientes, proyectos, documentos y administración - 2026-09-28.
- [x] Agente IA aislado por empresa - 2026-09-28.
- [x] Permisos granulares, administración de empresas y excepciones por usuario - 2026-09-29.
- [x] Comentarios, menciones, seguidores y notificaciones de tareas - 2026-09-29.
- [x] Generación de PDF internos no fiscales y almacenamiento privado - 2026-09-29.
- [x] Agent Studio con prompts, modelos autorizados y versiones publicadas - 2026-09-29.
- [x] Limpieza compensatoria de avatares y reemplazo sin archivos huérfanos - 2026-09-29.
- [x] Avisos diarios de tareas vencidas mediante `pg_cron` - 2026-09-29.
- [x] Checklist y subtareas integrados al detalle de tareas - 2026-09-29.
- [x] GitHub Pages con dominio propio, HTTPS y despliegue desde `main` - 2026-09-29.
- [x] Dominio productivo autorizado en Edge Functions y orígenes antiguos retirados - 2026-09-29.
- [x] CSP, `noindex`, `robots.txt` y página 404 propia - 2026-09-29.
- [x] Diagnóstico accionable de agentes, selector ampliado de modelos e interfaz de configuración de integraciones - 2026-09-29.
