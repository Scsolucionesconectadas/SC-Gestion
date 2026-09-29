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

**Decisión:** sitio comercial en `Ventas`; portal privado en `SC-Gestion`.

**Motivo:** separar código público, datos internos y ciclo de despliegue.

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

**Decisión:** separar definiciones editables de versiones publicadas inmutables y aceptar únicamente modelos incluidos en `OPENAI_ALLOWED_MODELS`.

**Motivo:** conservar trazabilidad, permitir rollback conceptual y evitar que un valor del navegador elija modelos o credenciales no autorizados.

**Impacto:** `agents.manage` configura y publica; `agents.run` ejecuta. Cada ejecución registra versión, duración y uso informado por la API.

**Archivos relacionados:** `supabase/migrations/20260929140000_agent_studio.sql`, `supabase/functions/ai-agent/index.ts`, `assets/js/agents.js`.

## 2026-09-29 - Comunicaciones y documentos internos

**Decisión:** generar PDF no fiscales en el navegador, almacenarlos de forma privada y enviar correos mediante una Edge Function con Resend e idempotencia.

**Motivo:** la clave del proveedor y el acceso a adjuntos no deben llegar al navegador; los documentos necesitan historial y aislamiento por empresa.

**Impacto:** los envíos requieren `communications.send`; los PDF mantienen marca no fiscal, versión y trazabilidad.

**Alternativas consideradas:** `mailto:` sin trazabilidad y claves de proveedor en el frontend; ambas se descartaron.

**Archivos relacionados:** `assets/js/workspace.js`, `supabase/functions/communications/index.ts`, `supabase/migrations/20260929134500_collaboration_communications.sql`.
