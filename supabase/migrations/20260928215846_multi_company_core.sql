-- SC Gestion - multi-company core, operational modules and tenant isolation.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  logo_url text,
  tax_identifier text,
  default_currency text not null default 'ARS' check (default_currency in ('ARS', 'USD')),
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'collaborator' check (role in (
    'owner', 'admin', 'commercial', 'project_manager', 'accounting', 'collaborator', 'viewer'
  )),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index memberships_user_active_idx
  on public.memberships(user_id, active, organization_id);
create index memberships_organization_role_idx
  on public.memberships(organization_id, role, active);

create or replace function private.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    join public.profiles p on p.id = m.user_id
    where m.organization_id = target_organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and o.status = 'active'
      and p.active = true
  );
$$;

create or replace function private.has_org_role(target_organization_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    join public.profiles p on p.id = m.user_id
    where m.organization_id = target_organization_id
      and m.user_id = (select auth.uid())
      and m.role = any(allowed_roles)
      and m.active = true
      and o.status = 'active'
      and p.active = true
  );
$$;

create or replace function private.shares_org(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select target_user_id = (select auth.uid()) or exists (
    select 1
    from public.memberships mine
    join public.memberships theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = target_user_id
      and mine.active = true
      and theirs.active = true
  );
$$;

revoke all on function private.is_org_member(uuid) from public, anon;
revoke all on function private.has_org_role(uuid, text[]) from public, anon;
revoke all on function private.shares_org(uuid) from public, anon;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;
grant execute on function private.shares_org(uuid) to authenticated;

-- Authorization never comes from user-editable user_metadata.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, username, full_name, role, must_change_password)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'commercial',
    coalesce((new.raw_app_meta_data->>'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

alter table public.prospects add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.interactions add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.tasks add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.meetings add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.proposals add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.activity_log add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.pricing_catalog add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.agent_runs add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.quote_estimates add column organization_id uuid references public.organizations(id) on delete cascade;

alter table public.prospects alter column organization_id set not null;
alter table public.interactions alter column organization_id set not null;
alter table public.tasks alter column organization_id set not null;
alter table public.meetings alter column organization_id set not null;
alter table public.proposals alter column organization_id set not null;
alter table public.activity_log alter column organization_id set not null;
alter table public.pricing_catalog alter column organization_id set not null;
alter table public.agent_runs alter column organization_id set not null;
alter table public.quote_estimates alter column organization_id set not null;

alter table public.prospects drop constraint if exists prospects_business_org_unique;
alter table public.prospects add constraint prospects_business_org_unique unique (id, organization_id);

alter table public.interactions
  add constraint interactions_prospect_org_fkey
  foreign key (prospect_id, organization_id)
  references public.prospects(id, organization_id) on delete cascade;

alter table public.tasks
  add constraint tasks_prospect_org_fkey
  foreign key (prospect_id, organization_id)
  references public.prospects(id, organization_id) on delete cascade;

alter table public.meetings
  add constraint meetings_prospect_org_fkey
  foreign key (prospect_id, organization_id)
  references public.prospects(id, organization_id) on delete cascade;

alter table public.proposals
  add constraint proposals_prospect_org_fkey
  foreign key (prospect_id, organization_id)
  references public.prospects(id, organization_id) on delete cascade;

alter table public.agent_runs
  add constraint agent_runs_prospect_org_fkey
  foreign key (prospect_id, organization_id)
  references public.prospects(id, organization_id);

alter table public.quote_estimates
  add constraint quote_estimates_prospect_org_fkey
  foreign key (prospect_id, organization_id)
  references public.prospects(id, organization_id);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_name text not null,
  tax_identifier text,
  contact_name text,
  email text,
  phone text,
  address text,
  city text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid,
  prospect_id uuid,
  name text not null,
  description text,
  status text not null default 'planned' check (status in (
    'planned', 'in_progress', 'waiting', 'review', 'completed', 'cancelled'
  )),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  owner_id uuid references public.profiles(id) on delete set null,
  start_date date,
  due_date date,
  budget numeric(14,2),
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  progress smallint not null default 0 check (progress between 0 and 100),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (client_id, organization_id)
    references public.clients(id, organization_id),
  foreign key (prospect_id, organization_id)
    references public.prospects(id, organization_id)
);

alter table public.tasks add column project_id uuid;
alter table public.tasks
  add constraint tasks_project_org_fkey
  foreign key (project_id, organization_id)
  references public.projects(id, organization_id) on delete cascade;

create table public.project_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid,
  project_id uuid,
  title text not null,
  category text not null default 'general' check (category in (
    'general', 'contract', 'proposal', 'invoice', 'receipt', 'technical', 'legal'
  )),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'expired', 'archived')),
  storage_path text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  expires_at date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, organization_id)
    references public.clients(id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid,
  project_id uuid,
  document_type text not null default 'invoice' check (document_type in (
    'quote', 'invoice', 'credit_note', 'debit_note', 'receipt'
  )),
  internal_number text not null,
  description text,
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  status text not null default 'draft' check (status in (
    'draft', 'pending_approval', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled'
  )),
  issue_date date,
  due_date date,
  is_fiscal boolean not null default false,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, internal_number),
  unique (id, organization_id),
  foreign key (client_id, organization_id)
    references public.clients(id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null,
  description text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  subtotal numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (invoice_id, organization_id)
    references public.invoices(id, organization_id) on delete cascade
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  paid_at timestamptz not null default now(),
  method text not null default 'transfer' check (method in ('cash', 'transfer', 'card', 'other')),
  reference text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (invoice_id, organization_id)
    references public.invoices(id, organization_id) on delete cascade
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  kind text not null default 'info' check (kind in ('info', 'success', 'warning', 'error')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index prospects_org_status_idx on public.prospects(organization_id, status, updated_at desc);
create index interactions_org_prospect_idx on public.interactions(organization_id, prospect_id, happened_at desc);
create index tasks_org_status_due_idx on public.tasks(organization_id, status, due_at);
create index meetings_org_start_idx on public.meetings(organization_id, starts_at);
create index proposals_org_status_idx on public.proposals(organization_id, status, created_at desc);
create index activity_log_org_created_idx on public.activity_log(organization_id, created_at desc);
create index pricing_catalog_org_active_idx on public.pricing_catalog(organization_id, active, category);
create index agent_runs_org_created_idx on public.agent_runs(organization_id, created_at desc);
create index quote_estimates_org_created_idx on public.quote_estimates(organization_id, created_at desc);
create index clients_org_name_idx on public.clients(organization_id, business_name);
create index projects_org_status_idx on public.projects(organization_id, status, due_date);
create index documents_org_status_idx on public.documents(organization_id, status, expires_at);
create index invoices_org_status_idx on public.invoices(organization_id, status, due_date);
create index payments_org_paid_idx on public.payments(organization_id, paid_at desc);
create index notifications_user_unread_idx on public.notifications(user_id, read_at, created_at desc);

create trigger organizations_set_updated_at before update on public.organizations
for each row execute function public.set_updated_at();
create trigger memberships_set_updated_at before update on public.memberships
for each row execute function public.set_updated_at();
create trigger clients_set_updated_at before update on public.clients
for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents
for each row execute function public.set_updated_at();
create trigger invoices_set_updated_at before update on public.invoices
for each row execute function public.set_updated_at();

-- Remove policies that granted every active user team-wide access.
do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'prospects', 'interactions', 'tasks', 'meetings', 'proposals',
        'activity_log', 'pricing_catalog', 'agent_runs', 'quote_estimates'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_comments enable row level security;
alter table public.documents enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;

revoke all on table
  public.organizations, public.memberships, public.profiles, public.prospects,
  public.interactions, public.tasks, public.meetings, public.proposals,
  public.activity_log, public.pricing_catalog, public.agent_runs,
  public.quote_estimates, public.clients, public.projects, public.project_comments,
  public.documents, public.invoices, public.invoice_items, public.payments,
  public.notifications
from anon, authenticated;

grant select on table
  public.organizations, public.memberships, public.profiles, public.prospects,
  public.interactions, public.tasks, public.meetings, public.proposals,
  public.activity_log, public.pricing_catalog, public.agent_runs,
  public.quote_estimates, public.clients, public.projects, public.project_comments,
  public.documents, public.invoices, public.invoice_items, public.payments,
  public.notifications
to authenticated;

grant insert, update, delete on table
  public.memberships, public.prospects, public.interactions, public.tasks,
  public.meetings, public.proposals, public.pricing_catalog, public.agent_runs,
  public.quote_estimates, public.clients, public.projects, public.project_comments,
  public.documents, public.invoices, public.invoice_items, public.payments,
  public.notifications
to authenticated;

grant update (name, slug, logo_url, tax_identifier, default_currency, status)
on public.organizations to authenticated;
grant update (full_name, avatar_url, must_change_password)
on public.profiles to authenticated;

create policy organizations_select_member on public.organizations
for select to authenticated
using (private.is_org_member(id));

create policy organizations_update_admin on public.organizations
for update to authenticated
using (private.has_org_role(id, array['owner', 'admin']))
with check (private.has_org_role(id, array['owner', 'admin']));

create policy memberships_select_member on public.memberships
for select to authenticated
using (private.is_org_member(organization_id));

create policy memberships_insert_admin on public.memberships
for insert to authenticated
with check (private.has_org_role(organization_id, array['owner', 'admin']));

create policy memberships_update_admin on public.memberships
for update to authenticated
using (private.has_org_role(organization_id, array['owner', 'admin']))
with check (private.has_org_role(organization_id, array['owner', 'admin']));

create policy memberships_delete_admin on public.memberships
for delete to authenticated
using (private.has_org_role(organization_id, array['owner', 'admin']));

create policy profiles_select_colleague on public.profiles
for select to authenticated
using (private.shares_org(id));

create policy profiles_update_self on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'prospects', 'interactions', 'tasks', 'meetings', 'proposals',
    'clients', 'projects', 'project_comments', 'documents'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.is_org_member(organization_id))',
      table_name || '_select_member', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.has_org_role(organization_id, array[''owner'',''admin'',''commercial'',''project_manager'',''accounting'',''collaborator'']))',
      table_name || '_insert_contributor', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.has_org_role(organization_id, array[''owner'',''admin'',''commercial'',''project_manager'',''accounting'',''collaborator''])) with check (private.has_org_role(organization_id, array[''owner'',''admin'',''commercial'',''project_manager'',''accounting'',''collaborator'']))',
      table_name || '_update_contributor', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.has_org_role(organization_id, array[''owner'',''admin'']))',
      table_name || '_delete_admin', table_name
    );
  end loop;
end $$;

create policy activity_log_select_member on public.activity_log
for select to authenticated
using (private.is_org_member(organization_id));

create policy pricing_catalog_select_finance on public.pricing_catalog
for select to authenticated
using (private.has_org_role(organization_id, array['owner', 'admin', 'accounting', 'commercial']));
create policy pricing_catalog_insert_finance on public.pricing_catalog
for insert to authenticated
with check (private.has_org_role(organization_id, array['owner', 'admin', 'accounting']));
create policy pricing_catalog_update_finance on public.pricing_catalog
for update to authenticated
using (private.has_org_role(organization_id, array['owner', 'admin', 'accounting']))
with check (private.has_org_role(organization_id, array['owner', 'admin', 'accounting']));
create policy pricing_catalog_delete_admin on public.pricing_catalog
for delete to authenticated
using (private.has_org_role(organization_id, array['owner', 'admin']));

create policy quote_estimates_select_member on public.quote_estimates
for select to authenticated
using (private.is_org_member(organization_id));
create policy quote_estimates_insert_commercial on public.quote_estimates
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_org_role(organization_id, array['owner', 'admin', 'commercial', 'accounting'])
);
create policy quote_estimates_update_commercial on public.quote_estimates
for update to authenticated
using (private.has_org_role(organization_id, array['owner', 'admin', 'commercial', 'accounting']))
with check (private.has_org_role(organization_id, array['owner', 'admin', 'commercial', 'accounting']));
create policy quote_estimates_delete_admin on public.quote_estimates
for delete to authenticated
using (private.has_org_role(organization_id, array['owner', 'admin']));

do $$
declare table_name text;
begin
  foreach table_name in array array['invoices', 'invoice_items', 'payments']
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.has_org_role(organization_id, array[''owner'',''admin'',''accounting'']))',
      table_name || '_select_finance', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.has_org_role(organization_id, array[''owner'',''admin'',''accounting'']))',
      table_name || '_insert_finance', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.has_org_role(organization_id, array[''owner'',''admin'',''accounting''])) with check (private.has_org_role(organization_id, array[''owner'',''admin'',''accounting'']))',
      table_name || '_update_finance', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.has_org_role(organization_id, array[''owner'',''admin'']))',
      table_name || '_delete_admin', table_name
    );
  end loop;
end $$;

create policy agent_runs_select_own_or_admin on public.agent_runs
for select to authenticated
using (
  private.is_org_member(organization_id)
  and (user_id = (select auth.uid()) or private.has_org_role(organization_id, array['owner', 'admin']))
);
create policy agent_runs_insert_own on public.agent_runs
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and private.has_org_role(organization_id, array['owner', 'admin', 'commercial', 'accounting'])
);
create policy agent_runs_update_own on public.agent_runs
for update to authenticated
using (
  user_id = (select auth.uid())
  and private.has_org_role(organization_id, array['owner', 'admin', 'commercial', 'accounting'])
)
with check (
  user_id = (select auth.uid())
  and private.has_org_role(organization_id, array['owner', 'admin', 'commercial', 'accounting'])
);

create policy notifications_select_own on public.notifications
for select to authenticated
using (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy notifications_insert_admin on public.notifications
for insert to authenticated
with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy notifications_update_own on public.notifications
for update to authenticated
using (user_id = (select auth.uid()) and private.is_org_member(organization_id))
with check (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy notifications_delete_own on public.notifications
for delete to authenticated
using (user_id = (select auth.uid()) and private.is_org_member(organization_id));

create or replace function public.log_crm_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entity_uuid uuid;
  tenant_uuid uuid;
begin
  entity_uuid := coalesce(new.id, old.id);
  tenant_uuid := coalesce(new.organization_id, old.organization_id);
  insert into public.activity_log(organization_id, actor_id, entity_type, entity_id, action, metadata)
  values (tenant_uuid, (select auth.uid()), tg_table_name, entity_uuid, tg_op, jsonb_build_object('at', now()));
  return coalesce(new, old);
end;
$$;
revoke all on function public.log_crm_change() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['clients', 'projects', 'documents', 'invoices', 'payments']
  loop
    execute format('drop trigger if exists %I on public.%I', 'audit_' || table_name, table_name);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.log_crm_change()',
      'audit_' || table_name, table_name
    );
  end loop;
end $$;

drop view if exists public.crm_pipeline_summary;
drop view if exists public.crm_sector_summary;

create view public.crm_pipeline_summary
with (security_invoker = true)
as
select organization_id, status, count(*)::integer as total
from public.prospects
group by organization_id, status;

create view public.crm_sector_summary
with (security_invoker = true)
as
select
  organization_id,
  coalesce(sector, 'Sin rubro') as sector,
  count(*)::integer as prospects,
  count(*) filter (where status in ('Respondió', 'Interesado', 'Reunión pendiente', 'Reunión realizada', 'Propuesta enviada', 'Negociación', 'Cliente'))::integer as responses,
  count(*) filter (where status in ('Interesado', 'Reunión pendiente', 'Reunión realizada', 'Propuesta enviada', 'Negociación', 'Cliente'))::integer as opportunities,
  count(*) filter (where status = 'Cliente')::integer as clients
from public.prospects
group by organization_id, coalesce(sector, 'Sin rubro');

create or replace view public.project_status_summary
with (security_invoker = true)
as
select organization_id, status, count(*)::integer as total, coalesce(avg(progress), 0)::numeric(5,2) as average_progress
from public.projects
group by organization_id, status;

create or replace view public.billing_summary
with (security_invoker = true)
as
select
  organization_id,
  currency,
  count(*) filter (where status not in ('cancelled', 'draft'))::integer as issued_documents,
  coalesce(sum(total) filter (where status not in ('cancelled', 'draft')), 0)::numeric(14,2) as issued_total,
  coalesce(sum(total) filter (where status in ('issued', 'partially_paid', 'overdue')), 0)::numeric(14,2) as pending_total,
  coalesce(sum(total) filter (where status = 'paid'), 0)::numeric(14,2) as paid_total
from public.invoices
group by organization_id, currency;

grant select on public.crm_pipeline_summary, public.crm_sector_summary, public.project_status_summary to authenticated;
grant select on public.billing_summary to authenticated;

revoke all on function public.is_active_member() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-documents',
  'organization-documents',
  false,
  15728640,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/csv']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.object_organization_id(object_name text)
returns uuid
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then split_part(object_name, '/', 1)::uuid
    else null
  end;
$$;
revoke all on function private.object_organization_id(text) from public, anon;
grant execute on function private.object_organization_id(text) to authenticated;

drop policy if exists organization_documents_select on storage.objects;
create policy organization_documents_select on storage.objects
for select to authenticated
using (
  bucket_id = 'organization-documents'
  and private.is_org_member(private.object_organization_id(name))
);

drop policy if exists organization_documents_insert on storage.objects;
create policy organization_documents_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'organization-documents'
  and private.has_org_role(
    private.object_organization_id(name),
    array['owner', 'admin', 'project_manager', 'accounting', 'collaborator']
  )
);

drop policy if exists organization_documents_update on storage.objects;
create policy organization_documents_update on storage.objects
for update to authenticated
using (
  bucket_id = 'organization-documents'
  and private.has_org_role(
    private.object_organization_id(name),
    array['owner', 'admin', 'project_manager', 'accounting', 'collaborator']
  )
)
with check (
  bucket_id = 'organization-documents'
  and private.has_org_role(
    private.object_organization_id(name),
    array['owner', 'admin', 'project_manager', 'accounting', 'collaborator']
  )
);

drop policy if exists organization_documents_delete on storage.objects;
create policy organization_documents_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'organization-documents'
  and private.has_org_role(private.object_organization_id(name), array['owner', 'admin'])
);
