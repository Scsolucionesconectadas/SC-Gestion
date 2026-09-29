-- SC Gestion - granular permissions and owner-managed organizations.

alter table public.organizations
  add column if not exists contact_email text,
  add column if not exists phone text,
  add column if not exists timezone text not null default 'America/Argentina/Buenos_Aires',
  add column if not exists brand_color text not null default '#0360BD',
  add column if not exists settings jsonb not null default '{}'::jsonb;

alter table public.memberships
  add column if not exists permission_overrides jsonb not null default '{}'::jsonb,
  add column if not exists notification_preferences jsonb not null default '{"in_app":true,"email":true,"daily_digest":false}'::jsonb;

create table if not exists public.permission_catalog (
  code text primary key,
  module text not null,
  label text not null,
  description text,
  position integer not null default 0
);

create table if not exists public.role_permission_defaults (
  role text not null check (role in (
    'owner', 'admin', 'commercial', 'project_manager', 'accounting', 'collaborator', 'viewer'
  )),
  permission_code text not null references public.permission_catalog(code) on delete cascade,
  allowed boolean not null default true,
  primary key (role, permission_code)
);

insert into public.permission_catalog(code, module, label, description, position) values
  ('dashboard.view', 'General', 'Ver inicio', 'Acceder al resumen operativo.', 10),
  ('crm.view', 'Comercial', 'Ver oportunidades', 'Consultar oportunidades y pipeline.', 20),
  ('crm.write', 'Comercial', 'Gestionar oportunidades', 'Crear y actualizar oportunidades.', 21),
  ('clients.view', 'Clientes', 'Ver clientes', 'Consultar fichas de clientes.', 30),
  ('clients.write', 'Clientes', 'Gestionar clientes', 'Crear y actualizar clientes.', 31),
  ('projects.view', 'Proyectos', 'Ver proyectos', 'Consultar proyectos y avance.', 40),
  ('projects.write', 'Proyectos', 'Gestionar proyectos', 'Crear y actualizar proyectos.', 41),
  ('tasks.view', 'Trabajo', 'Ver tareas', 'Consultar tareas de la empresa.', 50),
  ('tasks.write', 'Trabajo', 'Gestionar tareas', 'Crear, asignar y actualizar tareas.', 51),
  ('tasks.comment', 'Trabajo', 'Comentar tareas', 'Agregar comentarios y menciones.', 52),
  ('documents.view', 'Documentos', 'Ver documentos', 'Consultar documentos privados.', 60),
  ('documents.write', 'Documentos', 'Gestionar documentos', 'Subir y actualizar documentos.', 61),
  ('billing.view', 'Administracion', 'Ver administracion', 'Consultar comprobantes y pagos.', 70),
  ('billing.write', 'Administracion', 'Gestionar comprobantes', 'Crear comprobantes y pagos.', 71),
  ('billing.approve', 'Administracion', 'Aprobar comprobantes', 'Aprobar y emitir documentos internos.', 72),
  ('communications.send', 'Comunicaciones', 'Enviar comunicaciones', 'Preparar y enviar correos autorizados.', 80),
  ('agents.run', 'IA', 'Ejecutar agentes', 'Ejecutar agentes publicados.', 90),
  ('agents.manage', 'IA', 'Configurar agentes', 'Crear, probar y publicar agentes.', 91),
  ('reports.view', 'Reportes', 'Ver reportes', 'Acceder a indicadores y reportes.', 100),
  ('team.manage', 'Configuracion', 'Administrar equipo', 'Asignar usuarios, roles y permisos.', 110),
  ('organization.manage', 'Configuracion', 'Administrar empresa', 'Editar datos y preferencias de empresa.', 111),
  ('audit.view', 'Configuracion', 'Ver auditoria', 'Consultar actividad sensible.', 112)
on conflict (code) do update set
  module = excluded.module,
  label = excluded.label,
  description = excluded.description,
  position = excluded.position;

insert into public.role_permission_defaults(role, permission_code, allowed)
select 'owner', permission.code, true
from public.permission_catalog permission
on conflict (role, permission_code) do update set allowed = excluded.allowed;

insert into public.role_permission_defaults(role, permission_code, allowed)
select 'admin', permission.code, true
from public.permission_catalog permission
where permission.code <> 'organization.manage'
on conflict (role, permission_code) do update set allowed = excluded.allowed;

insert into public.role_permission_defaults(role, permission_code, allowed)
select 'commercial', permission_code, true from unnest(array[
  'dashboard.view','crm.view','crm.write','clients.view','clients.write','projects.view',
  'tasks.view','tasks.write','tasks.comment','documents.view','documents.write',
  'communications.send','agents.run','reports.view'
]) permission_code
on conflict (role, permission_code) do update set allowed = excluded.allowed;

insert into public.role_permission_defaults(role, permission_code, allowed)
select 'project_manager', permission_code, true from unnest(array[
  'dashboard.view','crm.view','clients.view','projects.view','projects.write',
  'tasks.view','tasks.write','tasks.comment','documents.view','documents.write',
  'communications.send','agents.run','reports.view'
]) permission_code
on conflict (role, permission_code) do update set allowed = excluded.allowed;

insert into public.role_permission_defaults(role, permission_code, allowed)
select 'accounting', permission_code, true from unnest(array[
  'dashboard.view','clients.view','projects.view','tasks.view','tasks.write','tasks.comment',
  'documents.view','documents.write','billing.view','billing.write','billing.approve',
  'communications.send','agents.run','reports.view'
]) permission_code
on conflict (role, permission_code) do update set allowed = excluded.allowed;

insert into public.role_permission_defaults(role, permission_code, allowed)
select 'collaborator', permission_code, true from unnest(array[
  'dashboard.view','crm.view','clients.view','projects.view','projects.write',
  'tasks.view','tasks.write','tasks.comment','documents.view','documents.write','reports.view'
]) permission_code
on conflict (role, permission_code) do update set allowed = excluded.allowed;

insert into public.role_permission_defaults(role, permission_code, allowed)
select 'viewer', permission_code, true from unnest(array[
  'dashboard.view','crm.view','clients.view','projects.view','tasks.view',
  'documents.view','reports.view'
]) permission_code
on conflict (role, permission_code) do update set allowed = excluded.allowed;

alter table public.permission_catalog enable row level security;
alter table public.role_permission_defaults enable row level security;

revoke all on public.permission_catalog, public.role_permission_defaults from anon, authenticated;
grant select on public.permission_catalog, public.role_permission_defaults to authenticated;

drop policy if exists permission_catalog_select on public.permission_catalog;
create policy permission_catalog_select on public.permission_catalog
for select to authenticated using (true);

drop policy if exists role_permission_defaults_select on public.role_permission_defaults;
create policy role_permission_defaults_select on public.role_permission_defaults
for select to authenticated using (true);

create or replace function private.has_org_permission(
  target_organization_id uuid,
  requested_permission text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.memberships membership
    join public.organizations organization on organization.id = membership.organization_id
    join public.profiles profile on profile.id = membership.user_id
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.active = true
      and organization.status = 'active'
      and profile.active = true
      and (
        membership.role = 'owner'
        or case
          when membership.permission_overrides ? requested_permission
            then coalesce((membership.permission_overrides ->> requested_permission)::boolean, false)
          else exists (
            select 1
            from public.role_permission_defaults defaults
            where defaults.role = membership.role
              and defaults.permission_code = requested_permission
              and defaults.allowed = true
          )
        end
      )
  );
$$;

revoke all on function private.has_org_permission(uuid, text) from public, anon;
grant execute on function private.has_org_permission(uuid, text) to authenticated;

create or replace function public.current_user_has_permission(
  target_organization_id uuid,
  requested_permission text
)
returns boolean
language sql
stable
set search_path = pg_catalog, public, private
as $$
  select private.has_org_permission(target_organization_id, requested_permission);
$$;

revoke all on function public.current_user_has_permission(uuid, text) from public, anon;
grant execute on function public.current_user_has_permission(uuid, text) to authenticated;

create or replace function public.create_organization(
  new_name text,
  new_slug text,
  new_currency text default 'ARS'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  requester_id uuid := (select auth.uid());
  organization_id uuid;
begin
  if requester_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.memberships
    where user_id = requester_id and role = 'owner' and active = true
  ) then raise exception 'Only an owner can create organizations'; end if;
  if nullif(trim(new_name), '') is null then raise exception 'Organization name is required'; end if;
  if trim(new_slug) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'Invalid organization slug'; end if;
  if new_currency not in ('ARS','USD') then raise exception 'Invalid currency'; end if;

  insert into public.organizations(name, slug, default_currency)
  values (trim(new_name), trim(new_slug), new_currency)
  returning id into organization_id;

  insert into public.memberships(organization_id, user_id, role, active)
  values (organization_id, requester_id, 'owner', true);

  return organization_id;
end;
$$;

revoke all on function public.create_organization(text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text) to authenticated;

create or replace function public.search_profiles_for_membership(
  target_organization_id uuid,
  search_text text
)
returns table(id uuid, username text, full_name text, email text, avatar_url text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.has_org_permission(target_organization_id, 'team.manage') then
    raise exception 'Permission denied';
  end if;
  if char_length(trim(search_text)) < 2 then
    return;
  end if;
  return query
  select profile.id, profile.username, profile.full_name, profile.email, profile.avatar_url
  from public.profiles profile
  where profile.active = true
    and (
      profile.username ilike '%' || trim(search_text) || '%'
      or profile.full_name ilike '%' || trim(search_text) || '%'
      or coalesce(profile.email, '') ilike '%' || trim(search_text) || '%'
    )
  order by profile.full_name
  limit 12;
end;
$$;

revoke all on function public.search_profiles_for_membership(uuid, text) from public, anon;
grant execute on function public.search_profiles_for_membership(uuid, text) to authenticated;

create or replace function public.upsert_organization_member(
  target_organization_id uuid,
  target_username text,
  new_role text,
  new_active boolean,
  new_permission_overrides jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  requester_id uuid := (select auth.uid());
  requester_role text;
  target_user_id uuid;
  previous_role text;
  active_owner_count integer;
begin
  if not private.has_org_permission(target_organization_id, 'team.manage') then
    raise exception 'Permission denied';
  end if;
  if new_role not in ('owner','admin','commercial','project_manager','accounting','collaborator','viewer') then
    raise exception 'Invalid role';
  end if;
  if jsonb_typeof(coalesce(new_permission_overrides, '{}'::jsonb)) <> 'object' then
    raise exception 'Invalid permission overrides';
  end if;
  if exists (
    select 1 from jsonb_each(coalesce(new_permission_overrides, '{}'::jsonb)) item
    where jsonb_typeof(item.value) <> 'boolean'
      or not exists (select 1 from public.permission_catalog where code = item.key)
  ) then raise exception 'Unknown permission override'; end if;

  select profile.id into target_user_id
  from public.profiles profile
  where lower(profile.username) = lower(trim(target_username)) and profile.active = true;
  if target_user_id is null then raise exception 'User not found'; end if;

  select membership.role into previous_role
  from public.memberships membership
  where membership.organization_id = target_organization_id
    and membership.user_id = target_user_id
  for update;

  select membership.role into requester_role
  from public.memberships membership
  where membership.organization_id = target_organization_id
    and membership.user_id = requester_id
    and membership.active = true;

  if (new_role = 'owner' or previous_role = 'owner') and requester_role <> 'owner' then
    raise exception 'Only an owner can manage owner access';
  end if;

  if coalesce(new_permission_overrides, '{}'::jsonb) ? 'organization.manage'
     and requester_role <> 'owner' then
    raise exception 'Only an owner can grant organization management';
  end if;

  if target_user_id = requester_id and (new_role <> 'owner' or new_active = false) then
    raise exception 'The current owner cannot remove their own access';
  end if;

  if previous_role = 'owner' and (new_role <> 'owner' or new_active = false) then
    select count(*) into active_owner_count
    from public.memberships membership
    where membership.organization_id = target_organization_id
      and membership.role = 'owner' and membership.active = true;
    if active_owner_count <= 1 then
      raise exception 'The organization must keep at least one active owner';
    end if;
  end if;

  insert into public.memberships(
    organization_id, user_id, role, active, permission_overrides
  ) values (
    target_organization_id, target_user_id, new_role, new_active,
    coalesce(new_permission_overrides, '{}'::jsonb)
  )
  on conflict (organization_id, user_id) do update set
    role = excluded.role,
    active = excluded.active,
    permission_overrides = excluded.permission_overrides,
    updated_at = now();

  return jsonb_build_object(
    'organization_id', target_organization_id,
    'user_id', target_user_id,
    'role', new_role,
    'active', new_active
  );
end;
$$;

revoke all on function public.upsert_organization_member(uuid, text, text, boolean, jsonb) from public, anon;
grant execute on function public.upsert_organization_member(uuid, text, text, boolean, jsonb) to authenticated;

-- Membership changes must pass through audited security-definer functions.
revoke insert, update, delete on public.memberships from authenticated;

grant update (name, slug, logo_url, tax_identifier, default_currency, status, contact_email, phone, timezone, brand_color, settings)
on public.organizations to authenticated;
