-- Owners must retain visibility of inactive members so access can be restored.

drop policy if exists profiles_select_colleague on public.profiles;
create policy profiles_select_colleague on public.profiles
for select to authenticated
using (
  private.shares_org(id)
  or private.can_manage_profile(id)
);

drop policy if exists profile_avatars_select on storage.objects;
create policy profile_avatars_select on storage.objects
for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and (
    private.shares_org(private.object_profile_id(name))
    or private.can_manage_profile(private.object_profile_id(name))
  )
);
