# Deploy e Infraestructura

## Repositorios

- Portal interno: `https://github.com/Scsolucionesconectadas/SC-Gestion` privado.
- Sitio comercial: repositorio separado `Scsolucionesconectadas/Ventas`.

## Supabase

- Proyecto: `sc-crm-comercial`.
- Región: `sa-east-1`.
- Edge Functions: `ai-agent` y `communications`, JWT obligatorio.
- Migraciones aplicadas hasta `20260929150000_schedule_overdue_notifications.sql`.
- Bucket privado `profile-avatars`: máximo 2 MB, JPEG/PNG/WebP y acceso controlado por membresías.
- Bucket privado `generated-pdfs`: documentos internos no fiscales accesibles por permisos de facturación y comunicaciones.

## Requisitos antes de producción

1. Confirmar el reemplazo de todas las contraseñas temporales por claves fuertes y únicas.
2. Activar recuperación de contraseña, MFA y protección contra contraseñas filtradas.
3. Ejecutar prueba multi-tenant con usuarios reales.
4. Elegir un hosting que permita acceso privado y variables de entorno.
5. Configurar dominio en `ALLOWED_ORIGINS`.
6. Definir backups, monitoreo y rollback.
7. Configurar un dominio remitente de Resend y validar un envío controlado.

## Jobs

- `sc-overdue-task-notifications`: diario a las `11:15 UTC`, equivalente a `08:15` de Argentina; ejecuta una función interna sin acceso para `anon` ni `authenticated`.

No publicar el portal interno como GitHub Pages abierto. La autenticación protege datos, pero el hosting privado reduce superficie y evita exponer innecesariamente la aplicación operativa.

## Estado de GitHub Pages

El intento de activar Pages desde el repositorio privado devolvió `422`: el plan actual no lo soporta. El repositorio continúa privado y el frontend no fue expuesto. GitHub Pages, incluso cuando se origina en un repositorio privado, publica un sitio accesible en Internet; no debe confundirse con un sitio privado.
