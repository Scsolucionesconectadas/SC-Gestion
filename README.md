# SC CRM Comercial

CRM interno de **SC Soluciones Conectadas** y **Click**, pensado para gestionar prospectos, seguimientos, reuniones, propuestas y clientes.

## Stack

- GitHub Pages / frontend estático.
- Supabase Auth.
- PostgreSQL.
- Row Level Security (RLS).
- Supabase JS.
- Chart.js para analítica.
- SortableJS para pipeline drag & drop.
- Day.js para fechas.
- Lucide para iconografía.

## Usuarios previstos

- \`mbetancourt\` — Maikol Betancourt — administrador.
- \`areyes\` — Alexis Reyes — comercial.
- \`orojas\` — Oriana Rojas — comercial.

El login visible usa nombre de usuario. Internamente se transforma a \`usuario@crm.sc.local\` para Supabase Auth.

> Las contraseñas iniciales no se guardan en el repositorio. Se cargan como variables de entorno al crear los usuarios.

## Base de datos

La migración principal está en:

\`supabase/migrations/001_crm_schema.sql\`

Incluye:

- perfiles;
- prospectos;
- interacciones;
- tareas;
- reuniones;
- propuestas;
- auditoría;
- vistas de dashboard;
- índices;
- RLS;
- políticas para equipo autenticado.

## Crear usuarios

Después de aplicar la migración:

\`\`\`bash
npm install
cp .env.example .env
# completar variables
set -a && source .env && set +a
npm run users:create
\`\`\`

La \`SUPABASE_SERVICE_ROLE_KEY\` se usa únicamente en un entorno de administración. Nunca debe enviarse al navegador ni subirse a GitHub.

## Configurar frontend

Editar \`assets/js/config.js\`:

\`\`\`js
window.SC_CONFIG = {
  SUPABASE_URL: 'https://....supabase.co',
  SUPABASE_PUBLISHABLE_KEY: '...',
  AUTH_DOMAIN: 'crm.sc.local'
};
\`\`\`

La publishable key está diseñada para usarse en clientes; el acceso a datos queda protegido por autenticación y RLS.

## Publicación

No activar GitHub Pages hasta terminar la conexión con Supabase, migrar los datos del CRM actual y validar usuarios.
