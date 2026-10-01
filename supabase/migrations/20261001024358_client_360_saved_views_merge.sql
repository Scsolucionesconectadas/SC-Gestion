-- SC Gestion - personal pipeline views and auditable client consolidation.

create table public.pipeline_saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, name),
  constraint pipeline_saved_views_name_check
    check (char_length(trim(name)) between 2 and 60),
  constraint pipeline_saved_views_filters_object_check
    check (jsonb_typeof(filters) = 'object' and octet_length(filters::text) <= 10000)
);

create index pipeline_saved_views_user_idx
  on public.pipeline_saved_views(organization_id, user_id, updated_at desc);
create unique index pipeline_saved_views_default_idx
  on public.pipeline_saved_views(organization_id, user_id)
  where is_default;

create trigger pipeline_saved_views_set_updated_at
before update on public.pipeline_saved_views
for each row execute function public.set_updated_at();

alter table public.pipeline_saved_views enable row level security;
revoke all on table public.pipeline_saved_views from anon, authenticated;
grant select, insert, update, delete on table public.pipeline_saved_views to authenticated;

create policy pipeline_saved_views_select_own on public.pipeline_saved_views
for select to authenticated
using (
  user_id = (select auth.uid())
  and private.has_org_permission(organization_id, 'crm.view')
);

create policy pipeline_saved_views_insert_own on public.pipeline_saved_views
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and private.has_org_permission(organization_id, 'crm.view')
);

create policy pipeline_saved_views_update_own on public.pipeline_saved_views
for update to authenticated
using (
  user_id = (select auth.uid())
  and private.has_org_permission(organization_id, 'crm.view')
)
with check (
  user_id = (select auth.uid())
  and private.has_org_permission(organization_id, 'crm.view')
);

create policy pipeline_saved_views_delete_own on public.pipeline_saved_views
for delete to authenticated
using (
  user_id = (select auth.uid())
  and private.has_org_permission(organization_id, 'crm.view')
);

create or replace function public.save_pipeline_view(
  p_organization_id uuid,
  p_name text,
  p_filters jsonb,
  p_is_default boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_view public.pipeline_saved_views%rowtype;
  normalized_name text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  allowed_keys text[] := array[
    'search', 'owner', 'sector', 'followup', 'probability', 'currency',
    'outcome', 'limit', 'hide_empty'
  ];
begin
  if (select auth.uid()) is null then
    raise exception 'Necesitas iniciar sesion para guardar una vista.' using errcode = '42501';
  end if;
  if not private.has_org_permission(p_organization_id, 'crm.view') then
    raise exception 'No tenes acceso al pipeline de esta empresa.' using errcode = '42501';
  end if;
  if char_length(normalized_name) not between 2 and 60 then
    raise exception 'El nombre de la vista debe tener entre 2 y 60 caracteres.' using errcode = '22023';
  end if;
  if p_filters is null or jsonb_typeof(p_filters) <> 'object' then
    raise exception 'Los filtros de la vista no son validos.' using errcode = '22023';
  end if;
  if p_filters - allowed_keys <> '{}'::jsonb or octet_length(p_filters::text) > 10000 then
    raise exception 'La vista contiene filtros no permitidos.' using errcode = '22023';
  end if;

  if p_is_default then
    update public.pipeline_saved_views
    set is_default = false
    where organization_id = p_organization_id
      and user_id = (select auth.uid())
      and is_default;
  end if;

  insert into public.pipeline_saved_views(
    organization_id, user_id, name, filters, is_default
  ) values (
    p_organization_id, (select auth.uid()), normalized_name, p_filters, coalesce(p_is_default, false)
  )
  on conflict (organization_id, user_id, name)
  do update set
    filters = excluded.filters,
    is_default = excluded.is_default,
    updated_at = now()
  returning * into saved_view;

  return jsonb_build_object(
    'id', saved_view.id,
    'name', saved_view.name,
    'is_default', saved_view.is_default
  );
end;
$$;

revoke all on function public.save_pipeline_view(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.save_pipeline_view(uuid, text, jsonb, boolean) to authenticated;

alter table public.clients
  add column if not exists merged_into_id uuid,
  add column if not exists merged_at timestamptz,
  add column if not exists merged_by uuid references public.profiles(id) on delete set null;

alter table public.clients drop constraint if exists clients_merged_into_org_fkey;
alter table public.clients add constraint clients_merged_into_org_fkey
  foreign key (merged_into_id, organization_id)
  references public.clients(id, organization_id) on delete restrict;
alter table public.clients drop constraint if exists clients_merge_consistency_check;
alter table public.clients add constraint clients_merge_consistency_check
  check (
    merged_into_id is null
    or (merged_into_id <> id and merged_at is not null and status = 'inactive')
  );

create index clients_merged_into_fk_idx
  on public.clients(merged_into_id, organization_id)
  where merged_into_id is not null;
create index clients_merged_by_fk_idx
  on public.clients(merged_by)
  where merged_by is not null;
create index email_messages_client_relation_idx
  on public.email_messages(organization_id, related_id)
  where related_type = 'client';

create or replace function public.merge_clients(
  p_source_client_id uuid,
  p_target_client_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_client public.clients%rowtype;
  target_client public.clients%rowtype;
  projects_count integer := 0;
  documents_count integer := 0;
  invoices_count integer := 0;
  emails_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Necesitas iniciar sesion para unificar clientes.' using errcode = '42501';
  end if;
  if p_source_client_id is null or p_target_client_id is null
     or p_source_client_id = p_target_client_id then
    raise exception 'Selecciona dos clientes diferentes.' using errcode = '22023';
  end if;

  perform 1
  from public.clients
  where id in (p_source_client_id, p_target_client_id)
  order by id
  for update;

  select * into source_client from public.clients where id = p_source_client_id;
  select * into target_client from public.clients where id = p_target_client_id;

  if source_client.id is null or target_client.id is null
     or source_client.organization_id <> target_client.organization_id then
    raise exception 'Los clientes no existen o pertenecen a empresas diferentes.' using errcode = '23503';
  end if;
  if source_client.merged_into_id is not null or target_client.merged_into_id is not null then
    raise exception 'Uno de los clientes ya fue unificado.' using errcode = '23514';
  end if;
  if source_client.status <> 'active' or target_client.status <> 'active' then
    raise exception 'Solo se pueden unificar clientes activos.' using errcode = '23514';
  end if;
  if not private.has_org_role(source_client.organization_id, array['owner'])
     or not private.has_org_permission(source_client.organization_id, 'clients.write') then
    raise exception 'Solo el propietario puede unificar clientes.' using errcode = '42501';
  end if;

  select count(*) into projects_count
  from public.projects
  where organization_id = source_client.organization_id and client_id = source_client.id;
  select count(*) into documents_count
  from public.documents
  where organization_id = source_client.organization_id and client_id = source_client.id;
  select count(*) into invoices_count
  from public.invoices
  where organization_id = source_client.organization_id and client_id = source_client.id;
  select count(*) into emails_count
  from public.email_messages
  where organization_id = source_client.organization_id
    and related_type = 'client' and related_id = source_client.id;

  if projects_count > 0 and not private.has_org_permission(source_client.organization_id, 'projects.write') then
    raise exception 'Falta permiso para trasladar proyectos.' using errcode = '42501';
  end if;
  if documents_count > 0 and not private.has_org_permission(source_client.organization_id, 'documents.write') then
    raise exception 'Falta permiso para trasladar documentos.' using errcode = '42501';
  end if;
  if invoices_count > 0 and not private.has_org_permission(source_client.organization_id, 'billing.write') then
    raise exception 'Falta permiso para trasladar comprobantes.' using errcode = '42501';
  end if;
  if emails_count > 0 and not private.has_org_permission(source_client.organization_id, 'communications.send') then
    raise exception 'Falta permiso para trasladar comunicaciones.' using errcode = '42501';
  end if;

  update public.projects
  set client_id = target_client.id
  where organization_id = source_client.organization_id and client_id = source_client.id;

  update public.documents
  set client_id = target_client.id
  where organization_id = source_client.organization_id and client_id = source_client.id;

  update public.invoices
  set client_id = target_client.id
  where organization_id = source_client.organization_id and client_id = source_client.id;

  update public.email_messages
  set related_id = target_client.id
  where organization_id = source_client.organization_id
    and related_type = 'client' and related_id = source_client.id;

  update public.clients
  set tax_identifier = coalesce(nullif(target_client.tax_identifier, ''), source_client.tax_identifier),
      contact_name = coalesce(nullif(target_client.contact_name, ''), source_client.contact_name),
      email = coalesce(nullif(target_client.email, ''), source_client.email),
      phone = coalesce(nullif(target_client.phone, ''), source_client.phone),
      address = coalesce(nullif(target_client.address, ''), source_client.address),
      city = coalesce(nullif(target_client.city, ''), source_client.city),
      notes = coalesce(nullif(target_client.notes, ''), source_client.notes),
      source_prospect_id = coalesce(target_client.source_prospect_id, source_client.source_prospect_id),
      source_proposal_id = coalesce(target_client.source_proposal_id, source_client.source_proposal_id)
  where id = target_client.id and organization_id = target_client.organization_id;

  update public.clients
  set status = 'inactive', merged_into_id = target_client.id,
      merged_at = now(), merged_by = (select auth.uid())
  where id = source_client.id and organization_id = source_client.organization_id;

  return jsonb_build_object(
    'source_client_id', source_client.id,
    'target_client_id', target_client.id,
    'projects_moved', projects_count,
    'documents_moved', documents_count,
    'invoices_moved', invoices_count,
    'emails_moved', emails_count
  );
end;
$$;

revoke all on function public.merge_clients(uuid, uuid) from public, anon;
grant execute on function public.merge_clients(uuid, uuid) to authenticated;
