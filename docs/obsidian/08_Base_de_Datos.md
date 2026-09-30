# Base de Datos

## Motor

PostgreSQL 17 en Supabase.

## Entidades principales

- Acceso: `profiles`, `organizations`, `memberships`.
- Comercial: `prospects`, `interactions`, `meetings`, `proposals`, `proposal_sections`, `proposal_items`, `proposal_versions`.
- Operación: `clients`, `projects`, `project_comments`, `tasks`, `task_comments`, `task_watchers`, `documents`.
- Administración: `invoices`, `invoice_items`, `payments`.
- Comunicaciones: `email_templates`, `email_messages`, `generated_documents`.
- IA y control: `agent_definitions`, `agent_versions`, `agent_runs`, `pricing_catalog`, `quote_estimates`, `chatgpt_connections`, `chatgpt_oauth_transactions`, `activity_log`, `notifications`.
- Autorización: `permission_catalog`, `role_permission_defaults` y excepciones en `memberships.permission_overrides`.

## Integridad

Las relaciones operativas usan claves compuestas con `organization_id` para impedir referencias entre empresas. Finanzas se limita a `owner`, `admin` y `accounting`.

Los presupuestos usan columnas generadas para precio unitario y subtotales. La RPC `save_commercial_proposal` vuelve a calcular descuento, impuesto y total dentro de PostgreSQL, guarda un snapshot por versión y deja las tablas de detalle en modo de lectura para `authenticated`.

## Configuración comercial

`organizations.settings` conserva preferencias de bajo volumen separadas por dominio. `pipeline` incluye `card_limit`, `hide_empty` y `stale_days`; `quotes` incluye `document_prefix`, `validity_days`, `tax_percent`, `margin_percent`, `delivery_weeks` y `payment_terms`. La interfaz mezcla estos valores con predeterminados seguros y solo el propietario puede actualizarlos.

## Migraciones

- Migraciones heredadas: esquema CRM e IA.
- `20260928215846_multi_company_core.sql`: tenant, módulos, seguridad e índices.
- `20260928224400_cover_foreign_keys.sql`: índices de cobertura para las 27 claves foráneas señaladas por el Performance Advisor.
- `20260929105003_team_profiles.sql`: campos profesionales, bucket privado de avatares, políticas y RPC de administración del equipo.
- `20260929105610_team_profile_visibility.sql`: visibilidad de integrantes inactivos y sus fotos para propietarios.
- `20260929111500_consolidate_profile_update_policy.sql`: política única para autoedición y administración de perfiles.
- `20260929133000_permissions_and_organizations.sql`: catálogo de permisos, preferencias y RPC administrativas.
- `20260929134500_collaboration_communications.sql`: colaboración, comunicaciones, PDF privados y notificaciones.
- `20260929140000_agent_studio.sql`: definiciones y versiones inmutables de agentes.
- `20260929141500_permission_rls_enforcement.sql`: RLS granular por módulo.
- `20260929142000_notification_preferences.sql`: actualización segura de preferencias personales.
- `20260929143500_collaboration_performance.sql`: índices de claves foráneas y políticas sin superposición.
- `20260929144000_task_watcher_user_index.sql`: cobertura específica de la relación entre seguidores y perfiles.
- `20260929150000_schedule_overdue_notifications.sql`: `pg_cron` diario para avisos de tareas vencidas, filtrado por preferencias y membresías activas.
- `20260930005036_chatgpt_oauth_connections.sql`: conexión ChatGPT por empresa y transacciones OAuth de un solo uso, sin acceso para `anon` ni `authenticated`.
- `20260930005207_chatgpt_oauth_indexes.sql`: índices de cobertura para usuario y empresa detectados por Performance Advisor.
- `20260930024955_commercial_quote_builder.sql`: permisos, cabecera extendida, etapas, conceptos, versiones, RLS, estados y guardado transaccional de presupuestos.
- `20260930111554_commercial_quote_fk_indexes.sql`: índices de cobertura en el orden exacto de las claves foráneas del módulo comercial.

## Perfiles y membresías

`profiles` contiene identidad global: nombre, email de contacto, teléfono, cargo, biografía y ruta de foto. `memberships` contiene rol, empresa y estado activo. La función `update_team_member` es `security definer`, revoca acceso anónimo, exige sesión autenticada y propietario activo, y evita desactivar o degradar al último propietario.

## Credenciales ChatGPT

`chatgpt_connections` mantiene una fila por empresa, metadatos públicos de la cuenta, modelos disponibles y tokens cifrados. `chatgpt_oauth_transactions` conserva durante diez minutos el estado hasheado, PKCE cifrado y nonce; cada fila se consume una sola vez. Ambas tablas tienen RLS sin políticas de navegador y privilegios exclusivos para `service_role`.

## Importaciones controladas

- 2026-09-29: importación transaccional del CRM provisorio para Soluciones Conectadas.
- Resultado: 65 filas en `prospects` y 65 filas relacionadas en `interactions`.
- Control posterior: cero negocios duplicados por nombre normalizado y cero interacciones huérfanas.
- Trazabilidad: las oportunidades importadas usan `source = 'Google Sheets · CRM Comercial SC y Click'`.
- Privacidad: la carga no se almacena en migraciones, scripts ni documentación del repositorio público.
