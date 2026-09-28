-- SC CRM Comercial - AI agents, pricing catalog and saved estimates

create table if not exists public.pricing_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  category text not null default 'general',
  unit text not null default 'unidad',
  currency text not null default 'ARS',
  cost_amount numeric(14,2),
  sell_amount numeric(14,2),
  billing_cycle text check (billing_cycle in ('one_time','monthly','annual') or billing_cycle is null),
  active boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete set null,
  agent_type text not null check (agent_type in ('prospecting','quote')),
  request jsonb not null default '{}'::jsonb,
  response jsonb,
  status text not null default 'completed' check (status in ('running','completed','failed')),
  error_message text,
  model text,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_estimates (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.prospects(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  requirements jsonb not null default '{}'::jsonb,
  estimate jsonb not null default '{}'::jsonb,
  currency text not null default 'ARS',
  one_time_total numeric(14,2),
  recurring_monthly_total numeric(14,2),
  status text not null default 'draft' check (status in ('draft','reviewed','converted_to_proposal','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_runs_user_created_idx on public.agent_runs(user_id, created_at desc);
create index if not exists agent_runs_prospect_idx on public.agent_runs(prospect_id, created_at desc);
create index if not exists quote_estimates_prospect_idx on public.quote_estimates(prospect_id, created_at desc);
create index if not exists pricing_catalog_active_idx on public.pricing_catalog(active, category);

drop trigger if exists pricing_catalog_set_updated_at on public.pricing_catalog;
create trigger pricing_catalog_set_updated_at before update on public.pricing_catalog
for each row execute function public.set_updated_at();

drop trigger if exists quote_estimates_set_updated_at on public.quote_estimates;
create trigger quote_estimates_set_updated_at before update on public.quote_estimates
for each row execute function public.set_updated_at();

alter table public.pricing_catalog enable row level security;
alter table public.agent_runs enable row level security;
alter table public.quote_estimates enable row level security;

revoke all on table public.pricing_catalog, public.agent_runs, public.quote_estimates from anon, authenticated;

grant select on public.pricing_catalog to authenticated;
grant insert, update, delete on public.pricing_catalog to authenticated;
grant select, insert, update on public.agent_runs to authenticated;
grant select, insert, update, delete on public.quote_estimates to authenticated;

drop policy if exists pricing_catalog_select_team on public.pricing_catalog;
create policy pricing_catalog_select_team on public.pricing_catalog
for select to authenticated using (public.is_active_member());

drop policy if exists pricing_catalog_admin_write on public.pricing_catalog;
create policy pricing_catalog_admin_write on public.pricing_catalog
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists agent_runs_select_own_or_admin on public.agent_runs;
create policy agent_runs_select_own_or_admin on public.agent_runs
for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists agent_runs_insert_own on public.agent_runs;
create policy agent_runs_insert_own on public.agent_runs
for insert to authenticated
with check (user_id = (select auth.uid()) and public.is_active_member());

drop policy if exists agent_runs_update_own on public.agent_runs;
create policy agent_runs_update_own on public.agent_runs
for update to authenticated
using (user_id = (select auth.uid()) and public.is_active_member())
with check (user_id = (select auth.uid()) and public.is_active_member());

drop policy if exists quote_estimates_select_team on public.quote_estimates;
create policy quote_estimates_select_team on public.quote_estimates
for select to authenticated using (public.is_active_member());

drop policy if exists quote_estimates_insert_team on public.quote_estimates;
create policy quote_estimates_insert_team on public.quote_estimates
for insert to authenticated
with check (created_by = (select auth.uid()) and public.is_active_member());

drop policy if exists quote_estimates_update_team on public.quote_estimates;
create policy quote_estimates_update_team on public.quote_estimates
for update to authenticated
using (public.is_active_member())
with check (public.is_active_member());

drop policy if exists quote_estimates_delete_admin on public.quote_estimates;
create policy quote_estimates_delete_admin on public.quote_estimates
for delete to authenticated using (public.is_admin());

-- No artificial prices are seeded here.
-- The budget agent must not invent SC internal rates: an admin fills this catalog first.
