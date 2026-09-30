# Deploy e Infraestructura

## Repositorios

- Portal operativo: `https://github.com/Scsolucionesconectadas/SC-Gestion`, repositorio público.
- Sitio comercial: repositorio separado `Scsolucionesconectadas/Ventas`.
- URL productiva: `https://erp.scsolucionesconectadas.com.ar/`.

## Supabase

- Proyecto: `sc-crm-comercial`.
- Región: `sa-east-1`.
- Edge Functions: `ai-agent` v6 y `communications` con JWT; `chatgpt-oauth` v2 con callback público y autenticación manual para acciones POST.
- Migraciones aplicadas hasta `20260930005207_chatgpt_oauth_indexes.sql`.
- Bucket privado `profile-avatars`: máximo 2 MB, JPEG/PNG/WebP y acceso controlado por membresías.
- Bucket privado `generated-pdfs`: documentos internos no fiscales accesibles por permisos de facturación y comunicaciones.

## Requisitos antes de producción

1. Confirmar el reemplazo de todas las contraseñas temporales por claves fuertes y únicas.
2. Activar recuperación de contraseña, MFA y protección contra contraseñas filtradas.
3. Ejecutar prueba multi-tenant con usuarios reales.
4. Definir backups, monitoreo y rollback.
5. Configurar un dominio remitente de Resend y validar un envío controlado.
6. Obtener el `client_id` aprobado por OpenAI para Sign in with ChatGPT.
7. Configurar los secretos `CHATGPT_*`, conectar una cuenta desde Integraciones y ejecutar un agente controlado.

## Jobs

- `sc-overdue-task-notifications`: diario a las `11:15 UTC`, equivalente a `08:15` de Argentina; ejecuta una función interna sin acceso para `anon` ni `authenticated`.

## Estado de GitHub Pages

GitHub Pages publica desde `main` y `/`, utiliza `CNAME`, fuerza HTTPS y sirve `erp.scsolucionesconectadas.com.ar`. El frontend y su código son públicos; solo los usuarios autenticados pueden consultar información y toda operación continúa controlada por permisos y RLS.

La aplicación declara una CSP mediante `<meta>`, `noindex` y `robots.txt`. GitHub Pages no permite configurar libremente todas las cabeceras HTTP, por lo que una futura necesidad de cabeceras como `frame-ancestors`, HSTS personalizado o `Permissions-Policy` requerirá Cloudflare o un hosting configurable delante del sitio.
