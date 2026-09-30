# Arquitectura

## Capas

1. `index.html` y `assets/`: aplicación estática autenticada.
2. Supabase Auth: sesión y usuario.
3. `organizations` + `memberships`: tenant y rol efectivo.
4. PostgreSQL: datos operativos con `organization_id` obligatorio.
5. Storage privado: documentos bajo la ruta `{organization_id}/archivo`.
6. Edge Function `chatgpt-oauth`: OAuth/OIDC con PKCE, validación de identidad y administración de la cuenta ChatGPT por empresa.
7. Tablas privadas `chatgpt_connections` y `chatgpt_oauth_transactions`: tokens cifrados y transacciones de un solo uso, accesibles solo por `service_role`.
8. Edge Function `ai-agent`: ejecución de versiones publicadas con el token OAuth de la empresa, streaming y almacenamiento desactivado.
9. Edge Function `communications`: entrega autenticada de emails mediante Resend.
10. Storage privado `profile-avatars`: fotos bajo la ruta `{user_id}/archivo` con acceso entre miembros y administración autorizada.
11. Storage privado `generated-pdfs`: comprobantes internos no fiscales versionados por empresa.

## Módulos

Oportunidades, interacciones, reuniones, propuestas, clientes, proyectos, tareas colaborativas con checklist y subtareas, documentos, comprobantes internos, pagos, comunicaciones, notificaciones, reportes, equipo, configuración y agentes IA.

## Límite de confianza

La interfaz oculta acciones según el rol, pero la seguridad real se aplica con grants y RLS. Nunca se confía en un filtro del navegador como control de autorización.

La edición del equipo usa `public.update_team_member`: valida que quien llama sea propietario activo, actualiza perfil y membresía en una operación y evita dejar a la empresa sin propietario.

Los permisos efectivos combinan los valores predeterminados de `role_permission_defaults` con `memberships.permission_overrides`. Las RPC administrativas vuelven a validar la sesión y la capacidad solicitada dentro de PostgreSQL. El frontend replica esas decisiones para mostrar una interfaz coherente, pero no es el límite de seguridad.

El callback OAuth es público porque el proveedor debe abrirlo sin JWT de Supabase. Su confianza se basa en `state` hasheado y de un solo uso, PKCE, `nonce`, firma OIDC, emisor y audiencia. Las acciones iniciadas desde el portal sí exigen sesión y `agents.manage`.
