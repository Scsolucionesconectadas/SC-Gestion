# Deploy e Infraestructura

## Repositorios

- Portal interno: `https://github.com/Scsolucionesconectadas/SC-Gestion` privado.
- Sitio comercial: repositorio separado `Scsolucionesconectadas/Ventas`.

## Supabase

- Proyecto: `sc-crm-comercial`.
- Región: `sa-east-1`.
- Edge Function: `ai-agent`, JWT obligatorio.

## Requisitos antes de producción

1. Aprovisionar propietarios con contraseñas fuertes.
2. Activar recuperación de contraseña y MFA.
3. Ejecutar prueba multi-tenant con usuarios reales.
4. Elegir un hosting que permita acceso privado y variables de entorno.
5. Configurar dominio en `ALLOWED_ORIGINS`.
6. Definir backups, monitoreo y rollback.

No publicar el portal interno como GitHub Pages abierto. La autenticación protege datos, pero el hosting privado reduce superficie y evita exponer innecesariamente la aplicación operativa.
