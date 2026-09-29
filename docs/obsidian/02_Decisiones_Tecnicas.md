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
