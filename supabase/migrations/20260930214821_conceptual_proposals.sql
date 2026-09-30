-- SC Gestion - conceptual proposals and PDF presentation metadata.

alter table public.proposals
  add column if not exists proposal_type text not null default 'detailed',
  add column if not exists pricing_display text not null default 'itemized',
  add column if not exists cover_enabled boolean not null default false,
  add column if not exists cover_subtitle text,
  add column if not exists executive_summary text,
  add column if not exists objective text;

alter table public.proposals drop constraint if exists proposals_proposal_type_check;
alter table public.proposals add constraint proposals_proposal_type_check
  check (proposal_type in ('detailed', 'conceptual'));

alter table public.proposals drop constraint if exists proposals_pricing_display_check;
alter table public.proposals add constraint proposals_pricing_display_check
  check (pricing_display in ('itemized', 'section_total', 'total_only'));

alter table public.proposals drop constraint if exists proposals_cover_subtitle_length_check;
alter table public.proposals add constraint proposals_cover_subtitle_length_check
  check (cover_subtitle is null or char_length(cover_subtitle) <= 300);

alter table public.proposals drop constraint if exists proposals_executive_summary_length_check;
alter table public.proposals add constraint proposals_executive_summary_length_check
  check (executive_summary is null or char_length(executive_summary) <= 8000);

alter table public.proposals drop constraint if exists proposals_objective_length_check;
alter table public.proposals add constraint proposals_objective_length_check
  check (objective is null or char_length(objective) <= 4000);

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
  requested_proposal_type text := coalesce(nullif(p_proposal->>'proposal_type', ''), 'detailed');
  requested_pricing_display text := coalesce(nullif(p_proposal->>'pricing_display', ''), 'itemized');
begin
  if (select auth.uid()) is null or not private.has_org_permission(v_organization_id, 'quotes.write') then
    raise exception 'No autorizado para guardar presupuestos.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_sections) <> 'array' or jsonb_array_length(p_sections) = 0 then
    raise exception 'El presupuesto necesita al menos una etapa o modulo.' using errcode = '22023';
  end if;
  if requested_proposal_type not in ('detailed', 'conceptual') then
    raise exception 'Tipo de propuesta invalido.' using errcode = '23514';
  end if;
  if requested_pricing_display not in ('itemized', 'section_total', 'total_only') then
    raise exception 'Presentacion de precios invalida.' using errcode = '23514';
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
      proposal_type, pricing_display, cover_enabled, cover_subtitle, executive_summary, objective,
      currency, status, valid_until, issue_date, scope, exclusions, payment_terms,
      delivery_weeks, tax_percent, discount_percent, notes
    ) values (
      v_organization_id, (p_proposal->>'prospect_id')::uuid, (select auth.uid()),
      trim(p_proposal->>'title'), nullif(trim(p_proposal->>'project_name'), ''),
      trim(p_proposal->>'document_code'), coalesce((p_proposal->>'version')::integer, 1),
      requested_proposal_type, requested_pricing_display,
      coalesce((p_proposal->>'cover_enabled')::boolean, false),
      nullif(trim(p_proposal->>'cover_subtitle'), ''),
      nullif(trim(p_proposal->>'executive_summary'), ''),
      nullif(trim(p_proposal->>'objective'), ''),
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
      proposal_type = requested_proposal_type,
      pricing_display = requested_pricing_display,
      cover_enabled = coalesce((p_proposal->>'cover_enabled')::boolean, false),
      cover_subtitle = nullif(trim(p_proposal->>'cover_subtitle'), ''),
      executive_summary = nullif(trim(p_proposal->>'executive_summary'), ''),
      objective = nullif(trim(p_proposal->>'objective'), ''),
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
