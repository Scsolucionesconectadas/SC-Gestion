# Errores y Soluciones

## 2026-09-28 - Migración de vistas

**Síntoma:** PostgreSQL rechazó `create or replace view` por cambio de columnas.

**Causa:** una vista existente no puede cambiar su firma mediante reemplazo directo.

**Solución aplicada:** eliminar y recrear las vistas dentro de la migración.

**Cómo evitarlo:** usar `drop view if exists` cuando cambie nombre, orden o tipo de columnas.

## 2026-09-28 - Login y aplicación apilados

**Síntoma:** la captura completa mostraba login y panel simultáneamente.

**Causa:** reglas de `display` del autor anulaban el atributo `hidden`.

**Solución aplicada:** regla global `[hidden]{display:none!important}` y aserción Playwright.

**Cómo evitarlo:** verificar capturas completas además de visibilidad de componentes aislados.

## 2026-09-28 - GitHub Pages no disponible para repositorio privado

**Síntoma:** la API de Pages respondió `422` al intentar publicar `SC-Gestion`.

**Causa:** el plan actual de la cuenta no permite GitHub Pages desde este repositorio privado.

**Solución aplicada:** se mantuvo el repositorio privado y no se expuso el código interno.

**Cómo resolverlo:** usar GitHub Pro, un hosting externo compatible con repositorios privados o aprobar explícitamente una publicación pública del frontend.

## 2026-09-28 - Alta pública rechazada para emails internos

**Síntoma:** el endpoint público de registro rechazó las cuentas con dominio `crm.sc.local` e intentó enviar confirmaciones por email.

**Causa:** la confirmación de email está activa y las cuentas internas no utilizan casillas de correo entregables.

**Solución aplicada:** se realizó un aprovisionamiento administrativo transaccional compatible con el esquema Auth instalado, creando también identidades, perfiles y membresías. Una incompatibilidad inicial con la columna generada `auth.identities.email` produjo rollback completo y se corrigió antes del alta definitiva.

**Cómo evitarlo:** usar `scripts/create-users.mjs` con una `service_role` disponible solo en un entorno administrativo, nunca desde el navegador, y validar el esquema Auth antes de cualquier importación excepcional.

## 2026-09-29 - Cancelar no cerraba formularios dinámicos

**Síntoma:** el botón `Cancelar` se veía correctamente, pero no cerraba algunos modales creados después de cargar la página.

**Causa:** los listeners se asignaban solo a los botones existentes durante la inicialización.

**Solución aplicada:** se centralizó el cierre con delegación de eventos desde el contenedor estable de la aplicación y se agregó cobertura E2E.

**Cómo evitarlo:** enlazar por delegación los controles que se generan mediante `innerHTML` o volver a inicializarlos explícitamente.

## 2026-09-29 - Cambio de contraseña ya realizado seguía bloqueando

**Síntoma:** `mbetancourt` había actualizado la contraseña de Auth, pero el portal volvía a mostrar el diálogo obligatorio.

**Causa:** `profiles.must_change_password` seguía en `true`; cambiar Auth y actualizar el perfil son operaciones separadas.

**Solución aplicada:** se corrigió el indicador del perfil y la actualización ahora exige devolver exactamente una fila, evitando mostrar éxito si RLS impide persistir el cambio.

**Cómo evitarlo:** tratar Auth y el indicador del perfil como una operación compuesta y verificar la respuesta de ambas actualizaciones.

## 2026-09-29 - Políticas de lectura duplicadas en plantillas

**Síntoma:** Performance Advisor informó dos políticas permisivas para `SELECT` sobre `email_templates`.

**Causa:** una política `FOR ALL` se superponía con la política específica de lectura.

**Solución aplicada:** reemplazar `FOR ALL` por políticas separadas para `INSERT`, `UPDATE` y `DELETE`, conservando una única política de lectura.

**Cómo evitarlo:** preferir políticas por operación cuando lectura y escritura requieren capacidades diferentes.

**Archivos relacionados:** `supabase/migrations/20260929143500_collaboration_performance.sql`.

## 2026-09-29 - Identificador temporal en comentarios

**Síntoma:** el modo demo necesitaba un ID local, pero el insert remoto podía incluir un valor `undefined`.

**Causa:** se reutilizaba el mismo objeto para estado local y persistencia.

**Solución aplicada:** separar explícitamente el payload remoto y dejar que PostgreSQL genere el UUID.

**Cómo evitarlo:** construir payloads de persistencia sin propiedades auxiliares ni valores indefinidos.
