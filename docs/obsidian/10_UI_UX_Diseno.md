# UI UX y Diseño

## Sistema visual

- Colores SC: azul, cian y grafito con fondos neutros.
- Tipografías: Sora para títulos e Inter para interfaz.
- Iconos: Lucide.
- Cards con radio máximo moderado, tablas en escritorio y listas en móvil.

## Patrones

- Navegación lateral con empresa activa visible.
- Acciones principales por módulo.
- Estados mediante texto y color.
- Modales para altas y cambios breves.
- Feedback por toast.
- Soporte de tema oscuro y `prefers-reduced-motion`.

## Responsive y accesibilidad

- Sidebar desplegable en móvil.
- Sin desborde horizontal a 390 px.
- Botones e inputs con tipos explícitos.
- Landmarks nombrados, labels y navegación por teclado.
- `[hidden]` tiene una regla global para evitar superposición de pantallas.

## Acceso inicial seguro

- Las cuentas con `must_change_password` ven un diálogo bloqueante antes de operar.
- El diálogo no ofrece cancelar y no cierra con el botón superior, el fondo ni `Escape`.
- La nueva contraseña requiere al menos ocho caracteres y no puede coincidir con el usuario.
- Tras actualizar Auth y el perfil, la interfaz se libera sin recargar la página.

## Navegación y formularios

- En escritorio la barra lateral conserva ancho estable y desplazamiento propio; en móvil funciona como drawer con fondo, cierre explícito, `Escape` y devolución del foco.
- Los formularios usan una grilla de dos columnas en escritorio y una columna en móvil, campos de 44 px y foco visible.
- Los selectores, toggles, previews de foto y acciones mantienen estados hover, focus, disabled, error y carga.
- Los modales entran con movimiento breve y se convierten en panel inferior en teléfonos angostos.

## Equipo

- La vista resume integrantes activos, responsables comerciales y propietarios.
- Cada ficha presenta foto o iniciales, contacto, cargo, rol, estado y edición contextual.
- El propietario edita los perfiles profesionales. Quienes reciben `team.manage` administran membresías y permisos; los demás roles conservan una vista informativa. La base impide que un administrador delegue propiedad o permisos que no posee.

## Espacio de trabajo conectado

- Menú de creación rápida, centro de notificaciones y menú de usuario en la barra superior.
- Configuración separada en Empresa, Roles y permisos, Notificaciones e Integraciones.
- Detalle de tareas con conversación, menciones y seguimiento sin anidar cards decorativas.
- Historial de comunicaciones y compositor de correo con estados de envío visibles.
- Agent Studio usa selector lateral y editor enfocado, con historial de versiones.
- Los botones emplean brillo y presión breves inspirados en patrones públicos de Uiverse, adaptados al sistema SC y desactivados con `prefers-reduced-motion`.
- Lectura y escritura se reflejan por permiso específico; una persona puede consultar un módulo sin recibir acciones de edición.
