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
