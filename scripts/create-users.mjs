import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

/**
 * No se guardan contraseñas reales en GitHub.
 * Definí:
 * SC_PASSWORD_MBETANCOURT
 * SC_PASSWORD_AREYES
 * SC_PASSWORD_OROJAS
 */
const users = [
  {
    username: 'mbetancourt',
    full_name: 'Maikol Betancourt',
    role: 'admin',
    password: process.env.SC_PASSWORD_MBETANCOURT
  },
  {
    username: 'areyes',
    full_name: 'Alexis Reyes',
    role: 'commercial',
    password: process.env.SC_PASSWORD_AREYES
  },
  {
    username: 'orojas',
    full_name: 'Oriana Rojas',
    role: 'commercial',
    password: process.env.SC_PASSWORD_OROJAS
  }
];

for (const user of users) {
  if (!user.password) {
    throw new Error('Falta la contraseña inicial para ' + user.username);
  }

  const email = user.username + '@crm.sc.local';

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      must_change_password: false
    }
  });

  if (error) {
    console.error(user.username, error.message);
    continue;
  }

  console.log('Creado:', user.username, data.user.id);
}
