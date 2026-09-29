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
