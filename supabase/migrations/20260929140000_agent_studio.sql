-- SC Gestion - configurable and versioned AI agent catalog.

create table if not exists public.agent_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text,
  instructions text not null check (char_length(trim(instructions)) between 20 and 20000),
  model text not null default 'gpt-5-mini' check (model ~ '^[a-zA-Z0-9._-]+$'),
  tools jsonb not null default '[]'::jsonb,
  context_sources jsonb not null default '[]'::jsonb,
  input_schema jsonb not null default '{}'::jsonb,
  output_schema jsonb not null default '{}'::jsonb,
  requires_approval boolean not null default true,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  current_version integer not null default 0 check (current_version >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  unique (id, organization_id)
);

create table if not exists public.agent_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  unique (agent_id, version),
  foreign key (agent_id, organization_id)
    references public.agent_definitions(id, organization_id) on delete cascade
);

alter table public.agent_runs drop constraint if exists agent_runs_agent_type_check;
alter table public.agent_runs
  add column if not exists agent_id uuid,
  add column if not exists agent_version integer,
  add column if not exists duration_ms integer,
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer;

alter table public.agent_runs drop constraint if exists agent_runs_definition_org_fkey;
alter table public.agent_runs add constraint agent_runs_definition_org_fkey
  foreign key (agent_id, organization_id)
  references public.agent_definitions(id, organization_id) on delete restrict;

create index if not exists agent_definitions_org_status_idx on public.agent_definitions(organization_id, status, updated_at desc);
create index if not exists agent_versions_agent_idx on public.agent_versions(organization_id, agent_id, version desc);

drop trigger if exists agent_definitions_set_updated_at on public.agent_definitions;
create trigger agent_definitions_set_updated_at before update on public.agent_definitions
for each row execute function public.set_updated_at();

alter table public.agent_definitions enable row level security;
alter table public.agent_versions enable row level security;

revoke all on public.agent_definitions, public.agent_versions from anon, authenticated;
grant select, insert, update, delete on public.agent_definitions to authenticated;
grant select on public.agent_versions to authenticated;

drop policy if exists agent_definitions_select on public.agent_definitions;
create policy agent_definitions_select on public.agent_definitions for select to authenticated
using (private.is_org_member(organization_id));
drop policy if exists agent_definitions_insert on public.agent_definitions;
create policy agent_definitions_insert on public.agent_definitions for insert to authenticated
with check (created_by = (select auth.uid()) and private.has_org_permission(organization_id, 'agents.manage'));
drop policy if exists agent_definitions_update on public.agent_definitions;
create policy agent_definitions_update on public.agent_definitions for update to authenticated
using (private.has_org_permission(organization_id, 'agents.manage'))
with check (private.has_org_permission(organization_id, 'agents.manage'));
drop policy if exists agent_definitions_delete on public.agent_definitions;
create policy agent_definitions_delete on public.agent_definitions for delete to authenticated
using (private.has_org_permission(organization_id, 'agents.manage'));

drop policy if exists agent_versions_select on public.agent_versions;
create policy agent_versions_select on public.agent_versions for select to authenticated
using (private.is_org_member(organization_id));

create or replace function public.publish_agent_definition(target_agent_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  definition public.agent_definitions%rowtype;
  next_version integer;
begin
  select * into definition from public.agent_definitions
  where id = target_agent_id for update;
  if definition.id is null then raise exception 'Agent not found'; end if;
  if not private.has_org_permission(definition.organization_id, 'agents.manage') then
    raise exception 'Permission denied';
  end if;
  next_version := definition.current_version + 1;
  insert into public.agent_versions(
    organization_id, agent_id, version, snapshot, published_by
  ) values (
    definition.organization_id,
    definition.id,
    next_version,
    jsonb_build_object(
      'slug', definition.slug,
      'name', definition.name,
      'description', definition.description,
      'instructions', definition.instructions,
      'model', definition.model,
      'tools', definition.tools,
      'context_sources', definition.context_sources,
      'input_schema', definition.input_schema,
      'output_schema', definition.output_schema,
      'requires_approval', definition.requires_approval
    ),
    (select auth.uid())
  );
  update public.agent_definitions
  set current_version = next_version, status = 'active', updated_by = (select auth.uid())
  where id = definition.id;
  return next_version;
end;
$$;

revoke all on function public.publish_agent_definition(uuid) from public, anon;
grant execute on function public.publish_agent_definition(uuid) to authenticated;

insert into public.agent_definitions(
  organization_id, slug, name, description, instructions, model, tools,
  context_sources, requires_approval, status, current_version
)
select organization.id, seed.slug, seed.name, seed.description, seed.instructions,
  'gpt-5-mini', seed.tools::jsonb, seed.context_sources::jsonb, true, 'active', 1
from public.organizations organization
cross join (values
  (
    'prospecting', 'Agente Comercial', 'Investiga oportunidades y prepara un contacto inicial.',
    'Investiga negocios reales y fuentes publicas. Separa hechos confirmados de hipotesis. No inventes datos de contacto y prepara borradores para revision humana.',
    '["web_search"]', '["prospects"]'
  ),
  (
    'quote', 'Agente de Presupuestos', 'Convierte un relevamiento en una estimacion interna.',
    'Usa solamente el catalogo interno disponible. Explicita supuestos, riesgos, exclusiones y datos faltantes. Nunca inventes precios ni apruebes una propuesta.',
    '[]', '["prospects","pricing_catalog"]'
  )
) as seed(slug, name, description, instructions, tools, context_sources)
on conflict (organization_id, slug) do nothing;

insert into public.agent_versions(organization_id, agent_id, version, snapshot, published_by)
select definition.organization_id, definition.id, 1,
  jsonb_build_object(
    'slug', definition.slug,
    'name', definition.name,
    'description', definition.description,
    'instructions', definition.instructions,
    'model', definition.model,
    'tools', definition.tools,
    'context_sources', definition.context_sources,
    'input_schema', definition.input_schema,
    'output_schema', definition.output_schema,
    'requires_approval', definition.requires_approval
  ),
  null
from public.agent_definitions definition
where definition.current_version = 1
on conflict (agent_id, version) do nothing;
