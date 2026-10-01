-- SC Gestion - configurable, tenant-scoped and auditable pipeline stages.

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stage_key text not null,
  label text not null,
  stage_type text not null default 'open',
  probability smallint not null default 10,
  color text not null default 'gray',
  position smallint not null,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, stage_key),
  constraint pipeline_stages_key_check check (
    char_length(trim(stage_key)) between 1 and 80
    and (is_system or stage_key ~ '^custom-[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  ),
  constraint pipeline_stages_label_check check (char_length(trim(label)) between 2 and 60),
  constraint pipeline_stages_type_check check (stage_type in ('open', 'won', 'lost')),
  constraint pipeline_stages_custom_type_check check (is_system or stage_type = 'open'),
  constraint pipeline_stages_probability_check check (probability between 0 and 100),
  constraint pipeline_stages_color_check check (color in ('gray', 'blue', 'cyan', 'amber', 'purple', 'green', 'red')),
  constraint pipeline_stages_position_check check (position between 1 and 1000)
);

create unique index pipeline_stages_label_idx
  on public.pipeline_stages(organization_id, lower(label));
create unique index pipeline_stages_won_idx
  on public.pipeline_stages(organization_id)
  where stage_type = 'won' and is_active;
create unique index pipeline_stages_lost_idx
  on public.pipeline_stages(organization_id)
  where stage_type = 'lost' and is_active;

create trigger pipeline_stages_set_updated_at
before update on public.pipeline_stages
for each row execute function public.set_updated_at();

create or replace function private.seed_pipeline_stages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.pipeline_stages(
    organization_id, stage_key, label, stage_type, probability, color, position, is_system
  ) values
    (new.id, 'Prospecto', 'Prospecto', 'open', 10, 'gray', 10, true),
    (new.id, 'Visitado', 'Visitado', 'open', 15, 'blue', 20, true),
    (new.id, 'Contactado', 'Contactado', 'open', 25, 'cyan', 30, true),
    (new.id, 'Respondió', 'Respondió', 'open', 35, 'purple', 40, true),
    (new.id, 'Interesado', 'Interesado', 'open', 50, 'amber', 50, true),
    (new.id, 'Reunión pendiente', 'Reunión pendiente', 'open', 60, 'amber', 60, true),
    (new.id, 'Reunión realizada', 'Reunión realizada', 'open', 70, 'green', 70, true),
    (new.id, 'Propuesta enviada', 'Propuesta enviada', 'open', 75, 'purple', 80, true),
    (new.id, 'Negociación', 'Negociación', 'open', 85, 'amber', 90, true),
    (new.id, 'Cliente', 'Cliente', 'won', 100, 'green', 100, true),
    (new.id, 'No interesado', 'No interesado', 'lost', 0, 'red', 110, true)
  on conflict (organization_id, stage_key) do nothing;
  return new;
end;
$$;

revoke all on function private.seed_pipeline_stages() from public, anon, authenticated;

drop trigger if exists organizations_seed_pipeline_stages on public.organizations;
create trigger organizations_seed_pipeline_stages
after insert on public.organizations
for each row execute function private.seed_pipeline_stages();

insert into public.pipeline_stages(
  organization_id, stage_key, label, stage_type, probability, color, position, is_system
)
select organization.id, stage.stage_key, stage.label, stage.stage_type, stage.probability, stage.color, stage.position, true
from public.organizations organization
cross join (values
  ('Prospecto', 'Prospecto', 'open', 10, 'gray', 10),
  ('Visitado', 'Visitado', 'open', 15, 'blue', 20),
  ('Contactado', 'Contactado', 'open', 25, 'cyan', 30),
  ('Respondió', 'Respondió', 'open', 35, 'purple', 40),
  ('Interesado', 'Interesado', 'open', 50, 'amber', 50),
  ('Reunión pendiente', 'Reunión pendiente', 'open', 60, 'amber', 60),
  ('Reunión realizada', 'Reunión realizada', 'open', 70, 'green', 70),
  ('Propuesta enviada', 'Propuesta enviada', 'open', 75, 'purple', 80),
  ('Negociación', 'Negociación', 'open', 85, 'amber', 90),
  ('Cliente', 'Cliente', 'won', 100, 'green', 100),
  ('No interesado', 'No interesado', 'lost', 0, 'red', 110)
) as stage(stage_key, label, stage_type, probability, color, position)
on conflict (organization_id, stage_key) do nothing;

create or replace function private.validate_pipeline_stage_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id
       or new.stage_key is distinct from old.stage_key
       or new.is_system is distinct from old.is_system then
      raise exception 'La identidad técnica de una etapa no puede modificarse.' using errcode = '23514';
    end if;
    if old.is_system and new.stage_type is distinct from old.stage_type then
      raise exception 'Las etapas del sistema no pueden cambiar de tipo.' using errcode = '23514';
    end if;
    if old.stage_key in ('Prospecto', 'Propuesta enviada', 'Negociación', 'Cliente', 'No interesado')
       and new.is_active is false then
      raise exception 'Esta etapa participa en un flujo automático y debe permanecer activa.' using errcode = '23514';
    end if;
    if old.is_active and not new.is_active and exists (
      select 1 from public.prospects prospect
      where prospect.organization_id = old.organization_id
        and prospect.status = old.stage_key
    ) then
      raise exception 'Mové las oportunidades antes de desactivar esta etapa.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.validate_pipeline_stage_change() from public, anon, authenticated;

create trigger pipeline_stages_validate_change
before update on public.pipeline_stages
for each row execute function private.validate_pipeline_stage_change();

alter table public.pipeline_stages enable row level security;
revoke all on table public.pipeline_stages from anon, authenticated;
grant select, insert, update on table public.pipeline_stages to authenticated;

create policy pipeline_stages_select_permission on public.pipeline_stages
for select to authenticated
using (private.has_org_permission(organization_id, 'crm.view'));

create policy pipeline_stages_insert_owner on public.pipeline_stages
for insert to authenticated
with check (
  is_system = false
  and private.has_org_role(organization_id, array['owner'])
  and private.has_org_permission(organization_id, 'organization.manage')
);

create policy pipeline_stages_update_owner on public.pipeline_stages
for update to authenticated
using (
  private.has_org_role(organization_id, array['owner'])
  and private.has_org_permission(organization_id, 'organization.manage')
)
with check (
  private.has_org_role(organization_id, array['owner'])
  and private.has_org_permission(organization_id, 'organization.manage')
);

create or replace function public.save_pipeline_stages(
  p_organization_id uuid,
  p_stages jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stage jsonb;
  v_stage_key text;
  v_stage_label text;
  v_stage_type text;
  v_stage_color text;
  v_stage_probability smallint;
  v_stage_position smallint;
  v_stage_active boolean;
  existing public.pipeline_stages%rowtype;
  supplied_keys text[] := array[]::text[];
begin
  if (select auth.uid()) is null then
    raise exception 'Necesitás iniciar sesión para configurar etapas.' using errcode = '42501';
  end if;
  if not private.has_org_role(p_organization_id, array['owner'])
     or not private.has_org_permission(p_organization_id, 'organization.manage') then
    raise exception 'Solo el propietario puede configurar el pipeline.' using errcode = '42501';
  end if;
  if p_stages is null or jsonb_typeof(p_stages) <> 'array'
     or jsonb_array_length(p_stages) < 3 or jsonb_array_length(p_stages) > 20 then
    raise exception 'El pipeline debe contener entre 3 y 20 etapas.' using errcode = '22023';
  end if;

  for stage in select value from jsonb_array_elements(p_stages)
  loop
    if jsonb_typeof(stage) <> 'object'
       or stage - array['key','label','type','probability','color','position','active']::text[] <> '{}'::jsonb then
      raise exception 'La configuración de etapas contiene campos no permitidos.' using errcode = '22023';
    end if;

    v_stage_key := trim(coalesce(stage->>'key', ''));
    v_stage_label := trim(regexp_replace(coalesce(stage->>'label', ''), '\s+', ' ', 'g'));
    v_stage_type := coalesce(stage->>'type', 'open');
    v_stage_color := coalesce(stage->>'color', 'gray');
    v_stage_probability := coalesce((stage->>'probability')::smallint, 10);
    v_stage_position := coalesce((stage->>'position')::smallint, 10);
    v_stage_active := coalesce((stage->>'active')::boolean, true);

    if v_stage_key = '' or v_stage_key = any(supplied_keys) then
      raise exception 'Cada etapa debe tener una clave única.' using errcode = '22023';
    end if;
    supplied_keys := array_append(supplied_keys, v_stage_key);

    existing.id := null;
    select * into existing
    from public.pipeline_stages configured_stage
    where configured_stage.organization_id = p_organization_id
      and configured_stage.stage_key = v_stage_key;

    if existing.id is null then
      if v_stage_key !~ '^custom-[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         or v_stage_type <> 'open' then
        raise exception 'Las etapas nuevas deben usar una identidad válida y permanecer abiertas.' using errcode = '22023';
      end if;
      insert into public.pipeline_stages(
        organization_id, stage_key, label, stage_type, probability, color, position, is_active, is_system
      ) values (
        p_organization_id, v_stage_key, v_stage_label, 'open', v_stage_probability,
        v_stage_color, v_stage_position, v_stage_active, false
      );
    else
      update public.pipeline_stages
      set label = v_stage_label,
          stage_type = case when existing.is_system then existing.stage_type else 'open' end,
          probability = case when existing.stage_type = 'won' then 100 when existing.stage_type = 'lost' then 0 else v_stage_probability end,
          color = v_stage_color,
          position = v_stage_position,
          is_active = case when existing.stage_type in ('won', 'lost') then true else v_stage_active end
      where id = existing.id;
    end if;
  end loop;

  update public.pipeline_stages
  set is_active = false
  where organization_id = p_organization_id
    and not is_system
    and not (stage_key = any(supplied_keys));

  if not exists (
    select 1 from public.pipeline_stages
    where organization_id = p_organization_id and stage_type = 'open' and is_active
  ) then
    raise exception 'El pipeline necesita al menos una etapa abierta.' using errcode = '23514';
  end if;

  return (
    select jsonb_agg(jsonb_build_object(
      'id', id, 'organization_id', organization_id, 'stage_key', stage_key,
      'label', label, 'stage_type', stage_type, 'probability', probability,
      'color', color, 'position', position, 'is_active', is_active, 'is_system', is_system
    ) order by position, label)
    from public.pipeline_stages
    where organization_id = p_organization_id
  );
end;
$$;

revoke all on function public.save_pipeline_stages(uuid, jsonb) from public, anon;
grant execute on function public.save_pipeline_stages(uuid, jsonb) to authenticated;

create or replace function private.prepare_prospect_stage_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_stage public.pipeline_stages%rowtype;
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    select * into target_stage
    from public.pipeline_stages
    where organization_id = new.organization_id
      and stage_key = new.status
      and is_active;

    if target_stage.id is null then
      raise exception 'La etapa seleccionada no existe o está desactivada.' using errcode = '23514';
    end if;
    if target_stage.stage_type = 'lost' and nullif(trim(new.lost_reason), '') is null then
      raise exception 'Indicá el motivo por el que se cierra la oportunidad.' using errcode = '23514';
    end if;
    new.stage_entered_at := now();
    if target_stage.stage_type <> 'lost' then
      new.lost_reason := null;
    end if;
    if tg_op = 'INSERT' or new.probability = old.probability then
      new.probability := target_stage.probability;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.prepare_prospect_stage_change() from public, anon, authenticated;
