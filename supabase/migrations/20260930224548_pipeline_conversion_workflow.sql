-- SC Gestion - pipeline intelligence, auditable stage changes and assisted conversion.

alter table public.prospects
  add column if not exists estimated_value numeric(14,2),
  add column if not exists currency text not null default 'ARS',
  add column if not exists probability smallint not null default 10,
  add column if not exists lost_reason text,
  add column if not exists stage_entered_at timestamptz not null default now();

alter table public.prospects drop constraint if exists prospects_estimated_value_check;
alter table public.prospects add constraint prospects_estimated_value_check
  check (estimated_value is null or estimated_value >= 0);
alter table public.prospects drop constraint if exists prospects_currency_check;
alter table public.prospects add constraint prospects_currency_check
  check (currency in ('ARS', 'USD'));
alter table public.prospects drop constraint if exists prospects_probability_check;
alter table public.prospects add constraint prospects_probability_check
  check (probability between 0 and 100);
alter table public.prospects drop constraint if exists prospects_lost_reason_length_check;
alter table public.prospects add constraint prospects_lost_reason_length_check
  check (lost_reason is null or char_length(trim(lost_reason)) between 3 and 1000);

update public.prospects
set lost_reason = 'Sin motivo historico registrado'
where status = 'No interesado' and nullif(trim(lost_reason), '') is null;

alter table public.prospects drop constraint if exists prospects_closed_reason_check;
alter table public.prospects add constraint prospects_closed_reason_check
  check (status <> 'No interesado' or nullif(trim(lost_reason), '') is not null);

update public.prospects
set stage_entered_at = coalesce(updated_at, created_at, now()),
    probability = case status
      when 'Prospecto' then 10 when 'Visitado' then 15 when 'Contactado' then 25
      when 'Respondió' then 35 when 'Interesado' then 50
      when 'Reunión pendiente' then 60 when 'Reunión realizada' then 70
      when 'Propuesta enviada' then 75 when 'Negociación' then 85
      when 'Cliente' then 100 when 'No interesado' then 0 else 10 end;

update public.prospects prospect
set estimated_value = proposal.amount,
    currency = proposal.currency
from (
  select distinct on (organization_id, prospect_id)
    organization_id, prospect_id, amount, currency
  from public.proposals
  where amount > 0
  order by organization_id, prospect_id, created_at desc
) proposal
where proposal.organization_id = prospect.organization_id
  and proposal.prospect_id = prospect.id
  and prospect.estimated_value is null;

create table if not exists public.prospect_stage_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  prospect_id uuid not null,
  from_status text,
  to_status text not null,
  reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  foreign key (prospect_id, organization_id)
    references public.prospects(id, organization_id) on delete cascade
);

create index if not exists prospect_stage_history_prospect_idx
  on public.prospect_stage_history(organization_id, prospect_id, changed_at desc);
create index if not exists prospects_org_stage_age_idx
  on public.prospects(organization_id, status, stage_entered_at);
create index if not exists prospects_org_value_idx
  on public.prospects(organization_id, currency, estimated_value)
  where estimated_value is not null;

insert into public.prospect_stage_history(
  organization_id, prospect_id, from_status, to_status, reason, changed_at
)
select organization_id, id, null, status,
  case when status = 'No interesado' then coalesce(lost_reason, 'Estado previo a la auditoria de etapas') end,
  coalesce(created_at, now())
from public.prospects
where not exists (
  select 1 from public.prospect_stage_history history
  where history.organization_id = prospects.organization_id
    and history.prospect_id = prospects.id
);

create or replace function private.prepare_prospect_stage_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    if new.status = 'No interesado' and nullif(trim(new.lost_reason), '') is null then
      raise exception 'Indicá el motivo por el que se cierra la oportunidad.' using errcode = '23514';
    end if;
    new.stage_entered_at := now();
    if new.status <> 'No interesado' then
      new.lost_reason := null;
    end if;
    if tg_op = 'UPDATE' and new.probability = old.probability then
      new.probability := case new.status
        when 'Prospecto' then 10 when 'Visitado' then 15 when 'Contactado' then 25
        when 'Respondió' then 35 when 'Interesado' then 50
        when 'Reunión pendiente' then 60 when 'Reunión realizada' then 70
        when 'Propuesta enviada' then 75 when 'Negociación' then 85
        when 'Cliente' then 100 when 'No interesado' then 0 else new.probability end;
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.log_prospect_stage_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.prospect_stage_history(
      organization_id, prospect_id, from_status, to_status, reason, changed_by, changed_at
    ) values (
      new.organization_id,
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      case when new.status = 'No interesado' then new.lost_reason else null end,
      (select auth.uid()),
      new.stage_entered_at
    );
  end if;
  return new;
end;
$$;

revoke all on function private.prepare_prospect_stage_change() from public, anon, authenticated;
revoke all on function private.log_prospect_stage_change() from public, anon, authenticated;

drop trigger if exists prospects_prepare_stage_change on public.prospects;
create trigger prospects_prepare_stage_change
before insert or update of status, lost_reason on public.prospects
for each row execute function private.prepare_prospect_stage_change();

drop trigger if exists prospects_log_stage_change on public.prospects;
create trigger prospects_log_stage_change
after insert or update of status on public.prospects
for each row execute function private.log_prospect_stage_change();

alter table public.prospect_stage_history enable row level security;
revoke all on table public.prospect_stage_history from anon, authenticated;
grant select on table public.prospect_stage_history to authenticated;
drop policy if exists prospect_stage_history_select_permission on public.prospect_stage_history;
create policy prospect_stage_history_select_permission on public.prospect_stage_history
for select to authenticated
using (private.has_org_permission(organization_id, 'crm.view'));

alter table public.clients
  add column if not exists source_prospect_id uuid,
  add column if not exists source_proposal_id uuid;

alter table public.proposals
  add column if not exists converted_client_id uuid,
  add column if not exists converted_project_id uuid,
  add column if not exists converted_at timestamptz,
  add column if not exists converted_by uuid references public.profiles(id) on delete set null;

alter table public.clients drop constraint if exists clients_source_prospect_org_fkey;
alter table public.clients add constraint clients_source_prospect_org_fkey
  foreign key (source_prospect_id, organization_id)
  references public.prospects(id, organization_id) on delete set null (source_prospect_id);
alter table public.clients drop constraint if exists clients_source_proposal_org_fkey;
alter table public.clients add constraint clients_source_proposal_org_fkey
  foreign key (source_proposal_id, organization_id)
  references public.proposals(id, organization_id) on delete set null (source_proposal_id);
alter table public.proposals drop constraint if exists proposals_converted_client_org_fkey;
alter table public.proposals add constraint proposals_converted_client_org_fkey
  foreign key (converted_client_id, organization_id)
  references public.clients(id, organization_id) on delete set null (converted_client_id);
alter table public.proposals drop constraint if exists proposals_converted_project_org_fkey;
alter table public.proposals add constraint proposals_converted_project_org_fkey
  foreign key (converted_project_id, organization_id)
  references public.projects(id, organization_id) on delete set null (converted_project_id);

create index if not exists clients_org_source_prospect_idx
  on public.clients(organization_id, source_prospect_id)
  where source_prospect_id is not null;
create index if not exists proposals_org_conversion_idx
  on public.proposals(organization_id, converted_at)
  where converted_at is not null;

create or replace function public.convert_accepted_proposal(
  p_proposal_id uuid,
  p_conversion jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  proposal_record public.proposals%rowtype;
  prospect_record public.prospects%rowtype;
  client_record public.clients%rowtype;
  project_record public.projects%rowtype;
  existing_client_id uuid := nullif(p_conversion->>'client_id', '')::uuid;
  create_project boolean := coalesce((p_conversion->>'create_project')::boolean, false);
  tasks_payload jsonb := coalesce(p_conversion->'tasks', '[]'::jsonb);
  task_payload jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Necesitás iniciar sesión para convertir la oportunidad.' using errcode = '42501';
  end if;

  select * into proposal_record
  from public.proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'La propuesta no existe o no está disponible.' using errcode = 'P0002';
  end if;
  if not private.has_org_permission(proposal_record.organization_id, 'crm.write')
     or not private.has_org_permission(proposal_record.organization_id, 'clients.write') then
    raise exception 'No tenés permisos para convertir esta oportunidad.' using errcode = '42501';
  end if;
  if proposal_record.status <> 'aceptada' then
    raise exception 'La propuesta debe estar aceptada antes de convertirla.' using errcode = '23514';
  end if;
  if proposal_record.converted_client_id is not null then
    return jsonb_build_object(
      'client_id', proposal_record.converted_client_id,
      'project_id', proposal_record.converted_project_id,
      'already_converted', true
    );
  end if;
  if create_project and not private.has_org_permission(proposal_record.organization_id, 'projects.write') then
    raise exception 'No tenés permisos para crear el proyecto.' using errcode = '42501';
  end if;
  if jsonb_typeof(tasks_payload) <> 'array' then
    raise exception 'Las tareas iniciales deben enviarse como una lista.' using errcode = '22023';
  end if;
  if jsonb_array_length(tasks_payload) > 0 and not create_project then
    raise exception 'Las tareas iniciales requieren crear un proyecto.' using errcode = '22023';
  end if;
  if jsonb_array_length(tasks_payload) > 0
     and not private.has_org_permission(proposal_record.organization_id, 'tasks.write') then
    raise exception 'No tenés permisos para crear tareas iniciales.' using errcode = '42501';
  end if;

  select * into prospect_record
  from public.prospects
  where id = proposal_record.prospect_id
    and organization_id = proposal_record.organization_id
  for update;

  if existing_client_id is not null then
    select * into client_record
    from public.clients
    where id = existing_client_id
      and organization_id = proposal_record.organization_id;
    if not found then
      raise exception 'El cliente seleccionado no pertenece a esta empresa.' using errcode = '23503';
    end if;
  else
    insert into public.clients(
      organization_id, business_name, tax_identifier, contact_name, email, phone,
      address, city, status, notes, source_prospect_id, source_proposal_id, created_by
    ) values (
      proposal_record.organization_id,
      coalesce(nullif(trim(p_conversion->>'business_name'), ''), prospect_record.business_name),
      nullif(trim(p_conversion->>'tax_identifier'), ''),
      coalesce(nullif(trim(p_conversion->>'contact_name'), ''), prospect_record.contact_name),
      coalesce(nullif(trim(p_conversion->>'email'), ''), prospect_record.email),
      coalesce(nullif(trim(p_conversion->>'phone'), ''), prospect_record.phone),
      nullif(trim(p_conversion->>'address'), ''),
      coalesce(nullif(trim(p_conversion->>'city'), ''), prospect_record.city),
      'active', nullif(trim(p_conversion->>'notes'), ''),
      prospect_record.id, proposal_record.id, (select auth.uid())
    ) returning * into client_record;
  end if;

  if create_project then
    insert into public.projects(
      organization_id, client_id, prospect_id, name, description, status, priority,
      owner_id, start_date, due_date, budget, currency, progress, created_by
    ) values (
      proposal_record.organization_id, client_record.id, prospect_record.id,
      coalesce(nullif(trim(p_conversion->>'project_name'), ''), proposal_record.project_name, proposal_record.title),
      coalesce(nullif(trim(p_conversion->>'project_description'), ''), proposal_record.scope),
      'planned', coalesce(nullif(p_conversion->>'project_priority', ''), 'medium'),
      coalesce(nullif(p_conversion->>'owner_id', '')::uuid, prospect_record.owner_id, (select auth.uid())),
      current_date, nullif(p_conversion->>'due_date', '')::date,
      proposal_record.amount, proposal_record.currency, 0, (select auth.uid())
    ) returning * into project_record;
  end if;

  for task_payload in select value from jsonb_array_elements(tasks_payload)
  loop
    if nullif(trim(task_payload->>'title'), '') is not null then
      insert into public.tasks(
        organization_id, prospect_id, project_id, assigned_to, created_by,
        title, description, priority, status, due_at
      ) values (
        proposal_record.organization_id, prospect_record.id, project_record.id,
        coalesce(nullif(p_conversion->>'owner_id', '')::uuid, prospect_record.owner_id, (select auth.uid())),
        (select auth.uid()), trim(task_payload->>'title'), nullif(trim(task_payload->>'description'), ''),
        coalesce(nullif(task_payload->>'priority', ''), 'media'), 'pendiente',
        now() + make_interval(days => greatest(0, coalesce((task_payload->>'offset_days')::integer, 0)))
      );
    end if;
  end loop;

  update public.proposals
  set converted_client_id = client_record.id,
      converted_project_id = project_record.id,
      converted_at = now(),
      converted_by = (select auth.uid())
  where id = proposal_record.id
    and organization_id = proposal_record.organization_id;

  update public.prospects
  set status = 'Cliente', probability = 100,
      next_action = case when project_record.id is null then 'Completar alta del cliente' else 'Iniciar proyecto' end,
      next_followup = current_date
  where id = prospect_record.id
    and organization_id = proposal_record.organization_id;

  return jsonb_build_object(
    'client_id', client_record.id,
    'project_id', project_record.id,
    'already_converted', false
  );
end;
$$;

revoke all on function public.convert_accepted_proposal(uuid, jsonb) from public, anon;
grant execute on function public.convert_accepted_proposal(uuid, jsonb) to authenticated;
