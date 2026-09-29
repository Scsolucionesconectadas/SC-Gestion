-- SC Gestion - rich profiles, owner-managed teams and private avatars.

alter table public.profiles
  add column if not exists email text
    check (email is null or char_length(trim(email)) between 3 and 180),
  add column if not exists phone text
    check (phone is null or char_length(trim(phone)) <= 40),
  add column if not exists job_title text
    check (job_title is null or char_length(trim(job_title)) <= 100),
  add column if not exists bio text
    check (bio is null or char_length(trim(bio)) <= 600);

update public.profiles profile
set email = auth_user.email
from auth.users auth_user
where profile.id = auth_user.id
  and profile.email is null;

grant update (full_name, email, phone, job_title, bio, avatar_url)
on public.profiles to authenticated;

create or replace function private.can_manage_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select target_user_id = (select auth.uid()) or exists (
    select 1
    from public.memberships manager
    join public.memberships target
      on target.organization_id = manager.organization_id
    where manager.user_id = (select auth.uid())
      and manager.role in ('owner', 'admin')
      and manager.active = true
      and target.user_id = target_user_id
  );
$$;

revoke all on function private.can_manage_profile(uuid) from public, anon;
grant execute on function private.can_manage_profile(uuid) to authenticated;

drop policy if exists profiles_update_org_admin on public.profiles;
create policy profiles_update_org_admin on public.profiles
for update to authenticated
using (private.can_manage_profile(id))
with check (private.can_manage_profile(id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.object_profile_id(object_name text)
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

revoke all on function private.object_profile_id(text) from public, anon;
grant execute on function private.object_profile_id(text) to authenticated;

drop policy if exists profile_avatars_select on storage.objects;
create policy profile_avatars_select on storage.objects
for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and private.shares_org(private.object_profile_id(name))
);

drop policy if exists profile_avatars_insert on storage.objects;
create policy profile_avatars_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and private.can_manage_profile(private.object_profile_id(name))
);

drop policy if exists profile_avatars_update on storage.objects;
create policy profile_avatars_update on storage.objects
for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and private.can_manage_profile(private.object_profile_id(name))
)
with check (
  bucket_id = 'profile-avatars'
  and private.can_manage_profile(private.object_profile_id(name))
);

drop policy if exists profile_avatars_delete on storage.objects;
create policy profile_avatars_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and private.can_manage_profile(private.object_profile_id(name))
);

create or replace function public.update_team_member(
  target_organization_id uuid,
  target_user_id uuid,
  new_full_name text,
  new_email text,
  new_phone text,
  new_job_title text,
  new_bio text,
  new_avatar_url text,
  new_role text,
  new_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  requester_id uuid := (select auth.uid());
  previous_role text;
  active_owner_count integer;
begin
  if requester_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.memberships membership
    join public.organizations organization on organization.id = membership.organization_id
    join public.profiles profile on profile.id = membership.user_id
    where membership.organization_id = target_organization_id
      and membership.user_id = requester_id
      and membership.role = 'owner'
      and membership.active = true
      and organization.status = 'active'
      and profile.active = true
  ) then
    raise exception 'Only an active owner can manage the team';
  end if;

  if new_role not in ('owner', 'admin', 'commercial', 'project_manager', 'accounting', 'collaborator', 'viewer') then
    raise exception 'Invalid team role';
  end if;

  if nullif(trim(new_full_name), '') is null then
    raise exception 'Full name is required';
  end if;

  select membership.role
  into previous_role
  from public.memberships membership
  where membership.organization_id = target_organization_id
    and membership.user_id = target_user_id
  for update;

  if previous_role is null then
    raise exception 'Team member not found';
  end if;

  if target_user_id = requester_id and (new_role <> 'owner' or new_active = false) then
    raise exception 'The current owner cannot remove their own access';
  end if;

  if previous_role = 'owner' and (new_role <> 'owner' or new_active = false) then
    select count(*)
    into active_owner_count
    from public.memberships membership
    where membership.organization_id = target_organization_id
      and membership.role = 'owner'
      and membership.active = true;

    if active_owner_count <= 1 then
      raise exception 'The organization must keep at least one active owner';
    end if;
  end if;

  update public.profiles
  set full_name = trim(new_full_name),
      email = nullif(trim(new_email), ''),
      phone = nullif(trim(new_phone), ''),
      job_title = nullif(trim(new_job_title), ''),
      bio = nullif(trim(new_bio), ''),
      avatar_url = coalesce(nullif(trim(new_avatar_url), ''), avatar_url)
  where id = target_user_id;

  update public.memberships
  set role = new_role,
      active = new_active,
      updated_at = now()
  where organization_id = target_organization_id
    and user_id = target_user_id;

  return jsonb_build_object(
    'user_id', target_user_id,
    'organization_id', target_organization_id,
    'role', new_role,
    'active', new_active
  );
end;
$$;

revoke all on function public.update_team_member(
  uuid, uuid, text, text, text, text, text, text, text, boolean
) from public, anon;
grant execute on function public.update_team_member(
  uuid, uuid, text, text, text, text, text, text, text, boolean
) to authenticated;
