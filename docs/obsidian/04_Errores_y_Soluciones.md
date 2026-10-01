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

**Solución aplicada inicialmente:** se mantuvo el repositorio privado y no se expuso el código interno.

**Estado posterior:** se aprobó la publicación del frontend, el repositorio pasó a público y GitHub Pages quedó activo con dominio propio y HTTPS. Los datos continúan protegidos por Auth y RLS.

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

## 2026-09-29 - Avatares huérfanos tras una actualización fallida

**Síntoma:** una imagen podía subirse a Storage y quedar sin referencia si luego fallaba la actualización del perfil o la membresía.

**Causa:** la carga del archivo y la persistencia de datos son operaciones separadas.

**Solución aplicada:** conservar la ruta recién subida, eliminarla ante error y borrar el avatar reemplazado únicamente después de confirmar la actualización.

**Cómo evitarlo:** implementar compensación explícita cuando Storage y base de datos no comparten una transacción.

## 2026-09-29 - Agente mostraba un error genérico non-2xx

**Síntoma:** al buscar oportunidades, la interfaz mostraba `Edge Function returned a non-2xx status code` sin explicar cómo resolverlo.

**Causa:** `OPENAI_API_KEY` no estaba configurada en Supabase Secrets. La función devolvía `503` antes de registrar una fila en `agent_runs` y el cliente descartaba el cuerpo JSON de la respuesta.

**Solución aplicada en esa versión:** la Edge Function devolvió códigos y mensajes públicos seguros y el cliente comenzó a leer el cuerpo de `FunctionsHttpError`. La autenticación por clave quedó reemplazada luego por OAuth de ChatGPT.

**Cómo evitarlo actualmente:** verificar la cuenta ChatGPT, su sesión y catálogo de modelos desde Integraciones; no volver a solicitar claves API manuales para este flujo.

**Archivos relacionados:** `supabase/functions/ai-agent/index.ts`, `assets/js/agents.js`, `assets/js/workspace.js`.

## 2026-09-29 - Agent Studio cortaba las acciones inferiores

**Síntoma:** en pantallas de poca altura, el pie del formulario quedaba debajo del límite visual del modal.

**Causa:** el cuerpo usaba una altura calculada rígida que no coincidía siempre con la altura real de la cabecera.

**Solución aplicada:** el modal ahora es una columna flexible; el layout ocupa el espacio restante, el editor desplaza su contenido y las acciones permanecen visibles en el borde inferior.

**Cómo evitarlo:** usar `flex: 1` y `min-height: 0` para regiones desplazables dentro de diálogos, y probar también resoluciones con poca altura.

## 2026-09-29 - Integración de IA no coincidía con el acceso disponible

**Síntoma:** la interfaz pedía una `OPENAI_API_KEY`, pero SC necesita autorizar una cuenta normal de ChatGPT y usar su plan.

**Causa:** la primera implementación estaba diseñada para la API de plataforma y no para el programa Sign in with ChatGPT.

**Solución aplicada:** se sustituyó por OAuth/OIDC oficial con PKCE, conexión por empresa, tokens cifrados en servidor y ejecución por streaming. La interfaz ya no solicita ni documenta claves API.

**Cómo evitarlo:** confirmar el producto de autenticación y facturación antes de implementar una integración de IA; no confundir una suscripción de ChatGPT con una credencial estándar de API.

**Archivos relacionados:** `supabase/functions/chatgpt-oauth/index.ts`, `supabase/functions/ai-agent/index.ts`, `assets/js/workspace.js`, `assets/js/agents.js`.

## 2026-09-29 - Scrollbar vertical en pestañas de Configuración

**Síntoma:** junto a las pestañas aparecía una barra vertical pequeña aunque el contenido cabía en altura.

**Causa:** `overflow-x: auto` permitía que el navegador resolviera el eje vertical como desplazable alrededor del indicador activo.

**Solución aplicada:** en escritorio se usa `overflow: clip`; en pantallas pequeñas se habilita solo el desplazamiento horizontal y se recorta el eje vertical. El scrollbar del menú lateral también queda oculto sin impedir rueda, teclado o gesto táctil.

**Cómo evitarlo:** declarar ambos ejes en barras de pestañas responsivas y probar su `scrollHeight` en Playwright.

**Archivos relacionados:** `assets/css/app.css`, `tests/app-shell.spec.js`.

## 2026-09-30 - El constructor de presupuestos no abría

**Síntoma:** al pulsar Nuevo presupuesto el modal permanecía oculto y la consola informaba `dayjs is not defined`.

**Causa:** `assets/js/quotes.js` utilizaba fechas y numeración anual mediante Day.js sin importar el módulo.

**Solución aplicada:** importar la misma versión fijada de Day.js usada por la aplicación y agregar el archivo al chequeo de sintaxis y al recorrido E2E.

**Cómo evitarlo:** ejecutar la interacción completa en navegador, capturar `pageerror` y mantener cada módulo ES con dependencias explícitas.

**Archivos relacionados:** `assets/js/quotes.js`, `package.json`, `tests/app-shell.spec.js`.
# Errores y Soluciones

## 2026-10-01 - Desborde horizontal en el editor móvil de etapas

**Síntoma:**
Configuración medía 672 px dentro de un viewport de 390 px aunque las filas visibles parecían ajustadas.

**Causa:**
La regla general de inputs del editor sobrescribía el ancho de 1 px usado para ocultar los checkbox accesibles de los toggles. Cada checkbox invisible crecía al 100% y extendía el documento.

**Solución aplicada:**
Se limitó el estilo de ancho, borde y foco a `input:not([type="checkbox"])`, preservando la implementación del toggle.

**Cómo evitarlo:**
Excluir controles ocultos al crear reglas globales para inputs y mantener una prueba de `scrollWidth` en viewport móvil.

**Archivos relacionados:**
- `assets/css/app.css`
- `tests/app-shell.spec.js`
