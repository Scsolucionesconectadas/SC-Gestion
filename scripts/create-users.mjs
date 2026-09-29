import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const organizationName = process.env.SC_ORGANIZATION_NAME || 'Soluciones Conectadas';
const organizationSlug = process.env.SC_ORGANIZATION_SLUG || 'soluciones-conectadas';
const defaultCurrency = process.env.SC_DEFAULT_CURRENCY || 'ARS';

if (!url || !serviceRoleKey) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organizationSlug)) {
  console.error('SC_ORGANIZATION_SLUG debe usar minúsculas, números y guiones.');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const users = [
  { username: 'mbetancourt', fullName: 'Maikol Betancourt', membershipRole: 'owner', password: process.env.SC_PASSWORD_MBETANCOURT },
  { username: 'areyes', fullName: 'Alexis Reyes', membershipRole: 'commercial', password: process.env.SC_PASSWORD_AREYES },
  { username: 'orojas', fullName: 'Oriana Rojas', membershipRole: 'commercial', password: process.env.SC_PASSWORD_OROJAS }
];

const missingPasswords = users.filter(user => !user.password).map(user => user.username);
if (missingPasswords.length) {
  console.error('Faltan contraseñas iniciales para: ' + missingPasswords.join(', '));
  process.exit(1);
}

const organizationResult = await supabase.from('organizations').upsert({
  name: organizationName,
  slug: organizationSlug,
  default_currency: defaultCurrency,
  status: 'active'
}, { onConflict: 'slug' }).select('id,name,slug').single();

if (organizationResult.error) {
  console.error('No se pudo crear o actualizar la empresa:', organizationResult.error.message);
  process.exit(1);
}

const organization = organizationResult.data;
const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listed.error) {
  console.error('No se pudieron consultar los usuarios:', listed.error.message);
  process.exit(1);
}

for (const spec of users) {
  const email = spec.username + '@crm.sc.local';
  let authUser = listed.data.users.find(user => user.email?.toLowerCase() === email);

  if (!authUser) {
    const created = await supabase.auth.admin.createUser({
      email,
      password: spec.password,
      email_confirm: true,
      user_metadata: { username: spec.username, full_name: spec.fullName },
      app_metadata: { must_change_password: true }
    });
    if (created.error) {
      console.error(spec.username + ': ' + created.error.message);
      continue;
    }
    authUser = created.data.user;
  }

  const profile = await supabase.from('profiles').upsert({
    id: authUser.id,
    username: spec.username,
    full_name: spec.fullName,
    role: 'commercial',
    active: true,
    must_change_password: true
  }, { onConflict: 'id' });
  if (profile.error) {
    console.error(spec.username + ' perfil: ' + profile.error.message);
    continue;
  }

  const membership = await supabase.from('memberships').upsert({
    organization_id: organization.id,
    user_id: authUser.id,
    role: spec.membershipRole,
    active: true
  }, { onConflict: 'organization_id,user_id' });
  if (membership.error) {
    console.error(spec.username + ' membresía: ' + membership.error.message);
    continue;
  }

  console.log('Listo:', spec.username, '->', organization.name, '(' + spec.membershipRole + ')');
}

console.log('Aprovisionamiento finalizado. Las contraseñas no se guardaron en el repositorio.');
