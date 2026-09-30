-- SC Gestion - commercial quote builder with stages, concepts and controlled versions.

insert into public.permission_catalog(code, module, label, description, position) values
  ('quotes.view', 'Presupuestos', 'Ver presupuestos', 'Consultar presupuestos comerciales y sus conceptos.', 24),
  ('quotes.write', 'Presupuestos', 'Gestionar presupuestos', 'Crear y editar presupuestos comerciales.', 25),
  ('quotes.approve', 'Presupuestos', 'Aprobar presupuestos', 'Aprobar presupuestos antes de su envio.', 26)
on conflict (code) do update set
  module = excluded.module,
  label = excluded.label,
  description = excluded.description,
  position = excluded.position;

insert into public.role_permission_defaults(role, permission_code, allowed) values
  ('owner', 'quotes.view', true),
  ('owner', 'quotes.write', true),
  ('owner', 'quotes.approve', true),
  ('admin', 'quotes.view', true),
  ('admin', 'quotes.write', true),
  ('admin', 'quotes.approve', true),
  ('commercial', 'quotes.view', true),
  ('commercial', 'quotes.write', true),
  ('project_manager', 'quotes.view', true),
  ('accounting', 'quotes.view', true),
  ('viewer', 'quotes.view', true)
on conflict (role, permission_code) do update set allowed = excluded.allowed;

alter table public.proposals
  add column if not exists document_code text,
  add column if not exists version integer not null default 1 check (version > 0),
  add column if not exists project_name text,
  add column if not exists scope text,
  add column if not exists exclusions text,
  add column if not exists payment_terms text,
  add column if not exists delivery_weeks integer check (delivery_weeks is null or delivery_weeks between 1 and 520),
  add column if not exists issue_date date not null default current_date,
  add column if not exists tax_percent numeric(7,2) not null default 0 check (tax_percent between 0 and 100),
  add column if not exists discount_percent numeric(7,2) not null default 0 check (discount_percent between 0 and 100),
  add column if not exists subtotal_cost numeric(14,2) not null default 0 check (subtotal_cost >= 0),
  add column if not exists subtotal_sale numeric(14,2) not null default 0 check (subtotal_sale >= 0),
  add column if not exists tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz;

alter table public.proposals drop constraint if exists proposals_status_check;
alter table public.proposals add constraint proposals_status_check check (status in (
  'borrador', 'revision', 'aprobada', 'enviada', 'aceptada', 'rechazada', 'vencida'
));

update public.proposals
set document_code = coalesce(document_code, 'PRE-' || extract(year from created_at)::integer || '-' || upper(substr(id::text, 1, 8))),
    project_name = coalesce(project_name, title),
    issue_date = coalesce(issue_date, created_at::date);

alter table public.proposals alter column document_code set not null;
alter table public.proposals drop constraint if exists proposals_business_org_unique;
alter table public.proposals add constraint proposals_business_org_unique unique (id, organization_id);
create unique index if not exists proposals_org_code_version_idx
  on public.proposals(organization_id, document_code, version);

create table if not exists public.proposal_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null,
  title text not null check (char_length(trim(title)) between 2 and 160),
  description text,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (proposal_id, organization_id)
    references public.proposals(id, organization_id) on delete cascade
);

create table if not exists public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null,
  section_id uuid not null,
  category text not null default 'General',
  description text not null check (char_length(trim(description)) between 2 and 500),
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit text not null default 'unidad' check (char_length(trim(unit)) between 1 and 30),
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  margin_percent numeric(8,2) not null default 0 check (margin_percent between 0 and 1000),
  unit_price numeric(14,2) generated always as (round(unit_cost * (1 + margin_percent / 100), 2)) stored,
  subtotal_cost numeric(14,2) generated always as (round(quantity * unit_cost, 2)) stored,
  subtotal_sale numeric(14,2) generated always as (round(quantity * unit_cost * (1 + margin_percent / 100), 2)) stored,
  notes text,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  foreign key (proposal_id, organization_id)
    references public.proposals(id, organization_id) on delete cascade,
  foreign key (section_id, organization_id)
    references public.proposal_sections(id, organization_id) on delete cascade
);

create table if not exists public.proposal_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  change_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (proposal_id, version),
  foreign key (proposal_id, organization_id)
    references public.proposals(id, organization_id) on delete cascade
);

create index if not exists proposal_sections_proposal_idx
  on public.proposal_sections(organization_id, proposal_id, position);
create index if not exists proposal_items_proposal_idx
  on public.proposal_items(organization_id, proposal_id, position);
create index if not exists proposal_items_section_idx
  on public.proposal_items(organization_id, section_id, position);
create index if not exists proposal_versions_proposal_idx
  on public.proposal_versions(organization_id, proposal_id, version desc);

drop trigger if exists proposal_sections_set_updated_at on public.proposal_sections;
create trigger proposal_sections_set_updated_at before update on public.proposal_sections
for each row execute function public.set_updated_at();

alter table public.proposal_sections enable row level security;
alter table public.proposal_items enable row level security;
alter table public.proposal_versions enable row level security;

revoke all on public.proposal_sections, public.proposal_items, public.proposal_versions from anon, authenticated;
grant select on public.proposal_sections, public.proposal_items, public.proposal_versions to authenticated;

do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'proposals'
  loop
    execute format('drop policy if exists %I on public.proposals', policy_row.policyname);
  end loop;
end $$;

revoke insert, update, delete on public.proposals from authenticated;
grant select on public.proposals to authenticated;

create policy proposals_select_quotes on public.proposals for select to authenticated
using (private.has_org_permission(organization_id, 'quotes.view'));

create policy proposal_sections_select_quotes on public.proposal_sections for select to authenticated
using (private.has_org_permission(organization_id, 'quotes.view'));

create policy proposal_items_select_quotes on public.proposal_items for select to authenticated
using (private.has_org_permission(organization_id, 'quotes.view'));

create policy proposal_versions_select_quotes on public.proposal_versions for select to authenticated
using (private.has_org_permission(organization_id, 'quotes.view'));

create or replace function public.enforce_proposal_status_transition()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if new.status is distinct from old.status then
    if old.status in ('aceptada', 'rechazada', 'vencida') then
      raise exception 'El presupuesto esta cerrado. Crea una nueva version para modificarlo.' using errcode = '23514';
    end if;
    if new.status = 'aprobada' and not private.has_org_permission(new.organization_id, 'quotes.approve') then
      raise exception 'No tenes permiso para aprobar presupuestos.' using errcode = '42501';
    end if;
    if not (
      (old.status = 'borrador' and new.status in ('revision', 'aprobada'))
      or (old.status = 'revision' and new.status in ('borrador', 'aprobada'))
      or (old.status = 'aprobada' and new.status = 'enviada')
      or (old.status = 'enviada' and new.status in ('aceptada', 'rechazada', 'vencida'))
    ) then
      raise exception 'Cambio de estado no permitido: % -> %.', old.status, new.status using errcode = '23514';
    end if;
  end if;
  if new.status = 'aprobada' and new.approved_at is null then
    new.approved_at := now();
    new.approved_by := (select auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_proposal_status_transition() from public, anon, authenticated;
drop trigger if exists proposals_enforce_status on public.proposals;
create trigger proposals_enforce_status before update on public.proposals
for each row execute function public.enforce_proposal_status_transition();

create or replace function public.save_commercial_proposal(
  p_proposal jsonb,
  p_sections jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_proposal_id uuid := nullif(p_proposal->>'id', '')::uuid;
  v_organization_id uuid := (p_proposal->>'organization_id')::uuid;
  section_data jsonb;
  item_data jsonb;
  section_id uuid;
  calculated_cost numeric(14,2) := 0;
  calculated_sale numeric(14,2) := 0;
  calculated_tax numeric(14,2) := 0;
  calculated_total numeric(14,2) := 0;
  requested_status text := coalesce(nullif(p_proposal->>'status', ''), 'borrador');
begin
  if (select auth.uid()) is null or not private.has_org_permission(v_organization_id, 'quotes.write') then
    raise exception 'No autorizado para guardar presupuestos.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_sections) <> 'array' or jsonb_array_length(p_sections) = 0 then
    raise exception 'El presupuesto necesita al menos una etapa.' using errcode = '22023';
  end if;
  if requested_status = 'aprobada' and not private.has_org_permission(v_organization_id, 'quotes.approve') then
    raise exception 'No tenes permiso para aprobar presupuestos.' using errcode = '42501';
  end if;
  if v_proposal_id is null and requested_status not in ('borrador', 'revision') then
    raise exception 'Un presupuesto nuevo debe comenzar como borrador o en revision.' using errcode = '23514';
  end if;

  if v_proposal_id is null then
    insert into public.proposals(
      organization_id, prospect_id, created_by, title, project_name, document_code, version,
      currency, status, valid_until, issue_date, scope, exclusions, payment_terms,
      delivery_weeks, tax_percent, discount_percent, notes
    ) values (
      v_organization_id, (p_proposal->>'prospect_id')::uuid, (select auth.uid()),
      trim(p_proposal->>'title'), nullif(trim(p_proposal->>'project_name'), ''),
      trim(p_proposal->>'document_code'), coalesce((p_proposal->>'version')::integer, 1),
      coalesce(nullif(p_proposal->>'currency', ''), 'ARS'), requested_status,
      nullif(p_proposal->>'valid_until', '')::date, coalesce(nullif(p_proposal->>'issue_date', '')::date, current_date),
      nullif(trim(p_proposal->>'scope'), ''), nullif(trim(p_proposal->>'exclusions'), ''),
      nullif(trim(p_proposal->>'payment_terms'), ''), nullif(p_proposal->>'delivery_weeks', '')::integer,
      coalesce((p_proposal->>'tax_percent')::numeric, 0), coalesce((p_proposal->>'discount_percent')::numeric, 0),
      nullif(trim(p_proposal->>'notes'), '')
    ) returning id into v_proposal_id;
  else
    if not exists (select 1 from public.proposals p where p.id = v_proposal_id and p.organization_id = v_organization_id) then
      raise exception 'Presupuesto inexistente o de otra empresa.' using errcode = 'P0002';
    end if;
    if exists (
      select 1 from public.proposals p
      where p.id = v_proposal_id
        and p.organization_id = v_organization_id
        and p.status in ('aceptada', 'rechazada', 'vencida')
    ) then
      raise exception 'El presupuesto esta cerrado. Crea una nueva version para modificarlo.' using errcode = '23514';
    end if;
    update public.proposals p set
      prospect_id = (p_proposal->>'prospect_id')::uuid,
      title = trim(p_proposal->>'title'),
      project_name = nullif(trim(p_proposal->>'project_name'), ''),
      document_code = trim(p_proposal->>'document_code'),
      version = coalesce((p_proposal->>'version')::integer, version),
      currency = coalesce(nullif(p_proposal->>'currency', ''), currency),
      status = requested_status,
      valid_until = nullif(p_proposal->>'valid_until', '')::date,
      issue_date = coalesce(nullif(p_proposal->>'issue_date', '')::date, issue_date),
      scope = nullif(trim(p_proposal->>'scope'), ''),
      exclusions = nullif(trim(p_proposal->>'exclusions'), ''),
      payment_terms = nullif(trim(p_proposal->>'payment_terms'), ''),
      delivery_weeks = nullif(p_proposal->>'delivery_weeks', '')::integer,
      tax_percent = coalesce((p_proposal->>'tax_percent')::numeric, 0),
      discount_percent = coalesce((p_proposal->>'discount_percent')::numeric, 0),
      notes = nullif(trim(p_proposal->>'notes'), '')
    where p.id = v_proposal_id and p.organization_id = v_organization_id;

    delete from public.proposal_items where proposal_items.proposal_id = v_proposal_id and proposal_items.organization_id = v_organization_id;
    delete from public.proposal_sections where proposal_sections.proposal_id = v_proposal_id and proposal_sections.organization_id = v_organization_id;
  end if;

  for section_data in select value from jsonb_array_elements(p_sections)
  loop
    section_id := gen_random_uuid();
    insert into public.proposal_sections(id, organization_id, proposal_id, title, description, position)
    values (
      section_id, v_organization_id, v_proposal_id, trim(section_data->>'title'),
      nullif(trim(section_data->>'description'), ''), coalesce((section_data->>'position')::integer, 0)
    );

    for item_data in select value from jsonb_array_elements(coalesce(section_data->'items', '[]'::jsonb))
    loop
      insert into public.proposal_items(
        organization_id, proposal_id, section_id, category, description, quantity,
        unit, unit_cost, margin_percent, notes, position
      ) values (
        v_organization_id, v_proposal_id, section_id, coalesce(nullif(trim(item_data->>'category'), ''), 'General'),
        trim(item_data->>'description'), (item_data->>'quantity')::numeric,
        coalesce(nullif(trim(item_data->>'unit'), ''), 'unidad'), (item_data->>'unit_cost')::numeric,
        coalesce((item_data->>'margin_percent')::numeric, 0), nullif(trim(item_data->>'notes'), ''),
        coalesce((item_data->>'position')::integer, 0)
      );
    end loop;
  end loop;

  if not exists (
    select 1 from public.proposal_items item
    where item.proposal_id = v_proposal_id and item.organization_id = v_organization_id
  ) then
    raise exception 'El presupuesto necesita al menos un concepto.' using errcode = '22023';
  end if;

  select coalesce(sum(subtotal_cost), 0), coalesce(sum(subtotal_sale), 0)
    into calculated_cost, calculated_sale
  from public.proposal_items
  where proposal_items.proposal_id = v_proposal_id
    and proposal_items.organization_id = v_organization_id;

  calculated_sale := round(calculated_sale * (1 - coalesce((p_proposal->>'discount_percent')::numeric, 0) / 100), 2);
  calculated_tax := round(calculated_sale * coalesce((p_proposal->>'tax_percent')::numeric, 0) / 100, 2);
  calculated_total := calculated_sale + calculated_tax;

  update public.proposals p set
    subtotal_cost = calculated_cost,
    subtotal_sale = calculated_sale,
    tax_amount = calculated_tax,
    amount = calculated_total,
    approved_by = case when requested_status = 'aprobada' then (select auth.uid()) else approved_by end,
    approved_at = case when requested_status = 'aprobada' then coalesce(approved_at, now()) else approved_at end,
    sent_at = case when requested_status = 'enviada' then coalesce(sent_at, now()) else sent_at end
  where p.id = v_proposal_id and p.organization_id = v_organization_id;

  insert into public.proposal_versions(organization_id, proposal_id, version, snapshot, change_reason, created_by)
  values (
    v_organization_id, v_proposal_id, coalesce((p_proposal->>'version')::integer, 1),
    jsonb_build_object('proposal', p_proposal, 'sections', p_sections, 'totals', jsonb_build_object(
      'cost', calculated_cost, 'sale', calculated_sale, 'tax', calculated_tax, 'total', calculated_total
    )), nullif(trim(p_proposal->>'change_reason'), ''), (select auth.uid())
  )
  on conflict (proposal_id, version) do update set
    snapshot = excluded.snapshot,
    change_reason = excluded.change_reason,
    created_by = excluded.created_by,
    created_at = now();

  if requested_status = 'enviada' then
    update public.prospects set status = 'Propuesta enviada', next_action = 'Esperar respuesta'
    where id = (p_proposal->>'prospect_id')::uuid and prospects.organization_id = v_organization_id;
  elsif requested_status = 'aceptada' then
    update public.prospects set status = 'Negociación', next_action = 'Convertir en cliente'
    where id = (p_proposal->>'prospect_id')::uuid and prospects.organization_id = v_organization_id;
  end if;

  return v_proposal_id;
end;
$$;

revoke all on function public.save_commercial_proposal(jsonb, jsonb) from public, anon;
grant execute on function public.save_commercial_proposal(jsonb, jsonb) to authenticated;
