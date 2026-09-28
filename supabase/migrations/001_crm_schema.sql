-- SC CRM Comercial - PostgreSQL/Supabase schema
-- Team-shared CRM with Auth + Row Level Security.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z][a-z0-9._-]{2,31}$'),
  full_name text not null,
  role text not null default 'commercial' check (role in ('admin','commercial')),
  avatar_url text,
  active boolean not null default true,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  sector text,
  city text default 'Cdelu',
  contact_name text,
  job_title text,
  phone text,
  email text,
  need_interest text,
  brand text not null default 'SC' check (brand in ('SC','Click','SC y Click')),
  status text not null default 'Prospecto' check (status in (
    'Prospecto','Visitado','Contactado','Respondió','Interesado',
    'Reunión pendiente','Reunión realizada','Propuesta enviada',
    'Negociación','Cliente','No interesado'
  )),
  next_action text,
  next_followup date,
  notes text,
  source text default 'Manual',
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('WhatsApp','Llamada','Visita','Email','Reunión','Videollamada','Nota')),
  result text,
  next_step text,
  next_date date,
  notes text,
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.prospects(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'media' check (priority in ('baja','media','alta','urgente')),
  status text not null default 'pendiente' check (status in ('pendiente','en_progreso','completada','cancelada')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  starts_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 10 and 480),
  modality text not null default 'Presencial' check (modality in ('Presencial','Videollamada','Llamada')),
  location text,
  agenda text,
  result text,
  next_step text,
  status text not null default 'programada' check (status in ('programada','realizada','cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  amount numeric(14,2),
  currency text not null default 'ARS',
  status text not null default 'borrador' check (status in ('borrador','enviada','aceptada','rechazada','vencida')),
  sent_at timestamptz,
  valid_until date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists prospects_status_idx on public.prospects(status);
create index if not exists prospects_owner_idx on public.prospects(owner_id);
create index if not exists prospects_next_followup_idx on public.prospects(next_followup);
create index if not exists prospects_sector_idx on public.prospects(sector);
create index if not exists interactions_prospect_idx on public.interactions(prospect_id, happened_at desc);
create index if not exists tasks_due_idx on public.tasks(status, due_at);
create index if not exists meetings_start_idx on public.meetings(starts_at);
create index if not exists proposals_prospect_idx on public.proposals(prospect_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists prospects_set_updated_at on public.prospects;
create trigger prospects_set_updated_at before update on public.prospects
for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists meetings_set_updated_at on public.meetings;
create trigger meetings_set_updated_at before update on public.meetings
for each row execute function public.set_updated_at();

drop trigger if exists proposals_set_updated_at on public.proposals;
create trigger proposals_set_updated_at before update on public.proposals
for each row execute function public.set_updated_at();

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
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role','commercial'),
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean,false)
  )
  on conflict (id) do update
  set username=excluded.username,
      full_name=excluded.full_name,
      role=excluded.role,
      must_change_password=excluded.must_change_password,
      updated_at=now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.is_active_member()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and active = true
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and active = true and role = 'admin'
  );
$$;

grant execute on function public.is_active_member() to authenticated;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.prospects enable row level security;
alter table public.interactions enable row level security;
alter table public.tasks enable row level security;
alter table public.meetings enable row level security;
alter table public.proposals enable row level security;
alter table public.activity_log enable row level security;

revoke all on table public.profiles, public.prospects, public.interactions, public.tasks, public.meetings, public.proposals, public.activity_log from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, avatar_url, must_change_password) on public.profiles to authenticated;
grant select, insert, update, delete on public.prospects, public.interactions, public.tasks, public.meetings, public.proposals to authenticated;
grant select on public.activity_log to authenticated;

drop policy if exists profiles_select_team on public.profiles;
create policy profiles_select_team on public.profiles
for select to authenticated
using (public.is_active_member());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using ((select auth.uid()) = id and public.is_active_member())
with check ((select auth.uid()) = id and public.is_active_member());

do $$
declare t text;
begin
  foreach t in array array['prospects','interactions','tasks','meetings','proposals']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_team', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_active_member())', t || '_select_team', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_team', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_active_member())', t || '_insert_team', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_team', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_active_member()) with check (public.is_active_member())', t || '_update_team', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_team', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_active_member())', t || '_delete_team', t);
  end loop;
end $$;

drop policy if exists activity_log_select_team on public.activity_log;
create policy activity_log_select_team on public.activity_log
for select to authenticated using (public.is_active_member());

create or replace function public.log_crm_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare eid uuid;
begin
  eid := coalesce(new.id, old.id);
  insert into public.activity_log(actor_id, entity_type, entity_id, action, metadata)
  values ((select auth.uid()), tg_table_name, eid, tg_op, jsonb_build_object('at', now()));
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['prospects','interactions','tasks','meetings','proposals']
  loop
    execute format('drop trigger if exists %I on public.%I', 'audit_' || t, t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.log_crm_change()', 'audit_' || t, t);
  end loop;
end $$;

-- Useful read-only dashboard views. security_invoker keeps RLS behavior.
create or replace view public.crm_pipeline_summary
with (security_invoker = true)
as
select status, count(*)::integer as total
from public.prospects
group by status;

create or replace view public.crm_sector_summary
with (security_invoker = true)
as
select
  coalesce(sector,'Sin rubro') as sector,
  count(*)::integer as prospects,
  count(*) filter (where status in ('Respondió','Interesado','Reunión pendiente','Reunión realizada','Propuesta enviada','Negociación','Cliente'))::integer as responses,
  count(*) filter (where status in ('Interesado','Reunión pendiente','Reunión realizada','Propuesta enviada','Negociación','Cliente'))::integer as opportunities,
  count(*) filter (where status='Cliente')::integer as clients
from public.prospects
group by coalesce(sector,'Sin rubro');

grant select on public.crm_pipeline_summary, public.crm_sector_summary to authenticated;
