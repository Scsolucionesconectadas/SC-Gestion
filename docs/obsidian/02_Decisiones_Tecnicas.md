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
