-- Keep a single permissive UPDATE policy so PostgreSQL evaluates one authorization path.
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_update_org_admin on public.profiles;

create policy profiles_update_authorized on public.profiles
for update to authenticated
using (
  (select auth.uid()) = id
  or private.can_manage_profile(id)
)
with check (
  (select auth.uid()) = id
  or private.can_manage_profile(id)
);
