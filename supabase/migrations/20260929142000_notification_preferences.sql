-- SC Gestion - self-service notification preferences.

create or replace function public.update_my_notification_preferences(
  target_organization_id uuid,
  new_preferences jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not private.is_org_member(target_organization_id) then raise exception 'Permission denied'; end if;
  if jsonb_typeof(coalesce(new_preferences, '{}'::jsonb)) <> 'object' then
    raise exception 'Invalid preferences';
  end if;

  normalized := jsonb_build_object(
    'in_app', coalesce((new_preferences ->> 'in_app')::boolean, true),
    'email', coalesce((new_preferences ->> 'email')::boolean, true),
    'daily_digest', coalesce((new_preferences ->> 'daily_digest')::boolean, false)
  );

  update public.memberships
  set notification_preferences = normalized, updated_at = now()
  where organization_id = target_organization_id
    and user_id = (select auth.uid())
    and active = true;

  if not found then raise exception 'Active membership not found'; end if;
  return normalized;
end;
$$;

revoke all on function public.update_my_notification_preferences(uuid, jsonb) from public, anon;
grant execute on function public.update_my_notification_preferences(uuid, jsonb) to authenticated;
