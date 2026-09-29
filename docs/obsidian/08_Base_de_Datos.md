# Base de Datos

## Motor

PostgreSQL 17 en Supabase.

## Entidades principales

- Acceso: `profiles`, `organizations`, `memberships`.
- Comercial: `prospects`, `interactions`, `meetings`, `proposals`.
- Operación: `clients`, `projects`, `project_comments`, `tasks`, `documents`.
- Administración: `invoices`, `invoice_items`, `payments`.
- IA y control: `pricing_catalog`, `quote_estimates`, `agent_runs`, `activity_log`, `notifications`.

## Integridad

Las relaciones operativas usan claves compuestas con `organization_id` para impedir referencias entre empresas. Finanzas se limita a `owner`, `admin` y `accounting`.

## Migraciones

- Migraciones heredadas: esquema CRM e IA.
- `20260928215846_multi_company_core.sql`: tenant, módulos, seguridad e índices.
- `20260928224400_cover_foreign_keys.sql`: índices de cobertura para las 27 claves foráneas señaladas por el Performance Advisor.
- `20260929105003_team_profiles.sql`: campos profesionales, bucket privado de avatares, políticas y RPC de administración del equipo.
- `20260929105610_team_profile_visibility.sql`: visibilidad de integrantes inactivos y sus fotos para propietarios.
- `20260929111500_consolidate_profile_update_policy.sql`: política única para autoedición y administración de perfiles.

## Perfiles y membresías

`profiles` contiene identidad global: nombre, email de contacto, teléfono, cargo, biografía y ruta de foto. `memberships` contiene rol, empresa y estado activo. La función `update_team_member` es `security definer`, revoca acceso anónimo, exige sesión autenticada y propietario activo, y evita desactivar o degradar al último propietario.
