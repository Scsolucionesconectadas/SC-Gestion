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
- Checklist y subtareas comparten el detalle, muestran progreso y pasan de dos columnas a una en móvil.
- Historial de comunicaciones y compositor de correo con estados de envío visibles.
- Agent Studio usa selector lateral y editor enfocado, con historial de versiones.
- Agent Studio mantiene cabecera y acciones visibles, desplaza solo el editor y no corta los controles en pantallas bajas o móviles.
- El selector de modelo muestra únicamente opciones disponibles para la cuenta de ChatGPT asociada a la empresa activa.
- La barra superior usa una altura compacta de 64 px en escritorio y 56 px en móvil, con búsqueda y acciones que se simplifican por resolución.
- Integraciones permite conectar, reconectar, cambiar, verificar o desconectar ChatGPT sin pedir claves manuales; si falta aprobación del proveedor muestra el requisito real.
- Los botones emplean brillo y presión breves inspirados en patrones públicos de Uiverse, adaptados al sistema SC y desactivados con `prefers-reduced-motion`.
- Campos, integraciones y pestañas suman foco, hover y transiciones sobrias; la barra de pestañas permite desplazamiento táctil horizontal sin scrollbar vertical.
- La escala tipográfica usa Inter para lectura y controles, Sora para jerarquía, tamaños mínimos legibles en tablas y metadatos, y espaciado de letras neutro.
- Tarjetas, paneles y estados activos usan movimiento breve con la misma curva de aceleración; el menú conserva desplazamiento funcional sin una barra lateral visible.
- Lectura y escritura se reflejan por permiso específico; una persona puede consultar un módulo sin recibir acciones de edición.
- La preferencia `in_app` controla también los recordatorios automáticos de tareas vencidas.
- Las rutas inexistentes muestran una página 404 breve, coherente con SC y con retorno directo al acceso principal.

## Presupuestos comerciales

- La vista combina KPIs, filtro por estado, tabla para escritorio y fichas compactas en móvil.
- El constructor de formato amplio separa identificación, alcance, costeo y condiciones; un resumen económico y un control previo acompañan la edición.
- Cada etapa admite conceptos con categoría, descripción, cantidad, unidad, costo y margen. Los totales se actualizan sin recargar la página.
- El selector de tipo conserva el presupuesto detallado y activa una experiencia conceptual con resumen, objetivo, módulos, funcionalidades y control de precios visibles.
- La propuesta conceptual puede usar portada ejecutiva y mostrar importes por concepto, por módulo o únicamente como inversión total.
- En pantallas de hasta 840 px el modal ocupa el viewport, usa una sola columna, conserva las acciones visibles y desplaza únicamente su contenido.
- El PDF oculta costo y margen, respeta el logo sin deformarlo y diferencia borradores antes de la emisión. La composición usa cabecera SC, metadatos, módulos, cierre comercial, pie por página y una marca de agua clara dibujada sobre el contenido.

## Pipeline comercial

- La franja de filtros combina búsqueda, responsable, rubro, seguimiento, probabilidad, moneda, resultado, límite por etapa y ocultamiento de vacías; en notebooks usa varias filas compactas y en móvil una sola columna.
- Una banda de indicadores resume valor abierto, valor ponderado, oportunidades estancadas y propuestas aceptadas listas para convertir.
- El tablero conserva desplazamiento horizontal entre etapas, pero cada lista tiene altura acotada y scroll vertical propio para que una etapa numerosa no extienda el documento.
- Las tarjetas muestran probabilidad, valor y días en etapa; las oportunidades estancadas reciben una señal textual y visual, y los cierres perdidos exigen un motivo.
- El conteo indica resultados filtrados sobre el total y el estado sin coincidencias reemplaza las columnas vacías por un mensaje único.
- La configuración `Comercial y documentos` mantiene secciones sin cards anidadas, acciones fijas y reglas de gobierno visibles.
- Los controles conservan foco visible, etiquetas accesibles, estados deshabilitados y soporte de `prefers-reduced-motion`.

## Conversión comercial

- El asistente usa tres pasos visibles: revisión, cliente y proyecto, y confirmación.
- Antes de crear un cliente presenta coincidencias por nombre, email o teléfono y permite vincular una existente.
- La creación de proyecto y las tareas iniciales son decisiones explícitas; aceptar una propuesta por sí solo no genera registros.
- En móvil ocupa el viewport sin desborde horizontal y conserva acciones alcanzables mediante desplazamiento interno.
