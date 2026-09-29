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

## 2026-09-28 - Aprovisionamiento inicial

**Cambios realizados:**
- Se creó la organización Soluciones Conectadas en Supabase.
- Se registraron `mbetancourt` como `owner` y `areyes` y `orojas` como `commercial`.
- Las cuentas quedaron activas, con identidad email confirmada y cambio obligatorio de contraseña inicial.
- Se bloqueó el uso del portal hasta completar ese cambio; el diálogo no puede cerrarse mediante botón, fondo ni teclado.
- No se guardaron contraseñas ni tokens en el repositorio.

**Validaciones realizadas:**
- Inicio de sesión real aprobado para los tres usuarios.
- Cada sesión recuperó exactamente una membresía de Soluciones Conectadas mediante RLS.
- Se verificaron perfil activo, rol efectivo e identidad Auth para cada cuenta.
- Se validó sintaxis, HTML, flujo demo y bloqueo de contraseña con una sesión real.
- Security Advisor sin hallazgos de RLS o exposición; mantiene un aviso por protección de contraseñas filtradas desactivada.

**Pendientes detectados:**
- Confirmar el cambio de las contraseñas temporales.
- Probar aislamiento RLS con una segunda empresa y usuarios independientes.

## 2026-09-29 - Perfiles, equipo y formularios

**Cambios realizados:**
- Se rediseñó la barra lateral para escritorio, tablet y móvil, con cierre, fondo, foco restaurado y desplazamiento interno controlado.
- Se incorporaron perfiles profesionales con foto privada, cargo, teléfono, email y biografía.
- El propietario puede editar los datos, rol y estado de cada integrante sin dejar a la empresa sin un propietario activo.
- Se renovaron formularios, selectores, modales y animaciones, respetando `prefers-reduced-motion`.
- Se corrigió el cierre de formularios creados dinámicamente mediante delegación de eventos.
- Se corrigió el estado de `mbetancourt` para que no vuelva a pedir el cambio inicial ya completado; `areyes` y `orojas` permanecen pendientes.

**Archivos modificados:**
- `index.html`, `assets/css/app.css`, `assets/js/app.js`.
- `supabase/migrations/20260929105003_team_profiles.sql`.
- `supabase/migrations/20260929105610_team_profile_visibility.sql`.
- `tests/app-shell.spec.js`.

**Validaciones realizadas:**
- Sintaxis JavaScript, validación HTML y pruebas Playwright responsive.
- Ejecución reversible de `update_team_member` con sesión autenticada y rol propietario.
- Verificación visual de equipo, perfil y barra lateral en escritorio y móvil.
- Supabase Security Advisor: conserva el aviso esperado por la RPC `security definer` y el aviso de protección de contraseñas filtradas pendiente.
- Supabase Performance Advisor: sin políticas permisivas duplicadas; solo informa índices aún no utilizados por falta de tráfico productivo.

**Pendientes detectados:**
- Limpiar una foto recién subida si una actualización posterior del perfil falla.
- Confirmar el cambio inicial de contraseña de `areyes` y `orojas`.
