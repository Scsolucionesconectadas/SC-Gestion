# Arquitectura

## Capas

1. `index.html` y `assets/`: aplicación estática autenticada.
2. Supabase Auth: sesión y usuario.
3. `organizations` + `memberships`: tenant y rol efectivo.
4. PostgreSQL: datos operativos con `organization_id` obligatorio.
5. Storage privado: documentos bajo la ruta `{organization_id}/archivo`.
6. Edge Function `ai-agent`: acceso autenticado a OpenAI.
7. Storage privado `profile-avatars`: fotos bajo la ruta `{user_id}/archivo` con acceso entre miembros y administración del propietario.

## Módulos

Oportunidades, interacciones, reuniones, propuestas, clientes, proyectos, tareas, documentos, comprobantes internos, pagos, reportes, equipo y agentes IA.

## Límite de confianza

La interfaz oculta acciones según el rol, pero la seguridad real se aplica con grants y RLS. Nunca se confía en un filtro del navegador como control de autorización.

La edición del equipo usa `public.update_team_member`: valida que quien llama sea propietario activo, actualiza perfil y membresía en una operación y evita dejar a la empresa sin propietario.
