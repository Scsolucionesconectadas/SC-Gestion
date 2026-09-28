-- Security and performance hardening applied after Supabase advisors review.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.log_crm_change() from public, anon, authenticated;
revoke all on function public.is_active_member() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.is_admin() to authenticated;

drop policy if exists pricing_catalog_admin_write on public.pricing_catalog;

drop policy if exists pricing_catalog_admin_insert on public.pricing_catalog;
create policy pricing_catalog_admin_insert on public.pricing_catalog
for insert to authenticated
with check (public.is_admin());

drop policy if exists pricing_catalog_admin_update on public.pricing_catalog;
create policy pricing_catalog_admin_update on public.pricing_catalog
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists pricing_catalog_admin_delete on public.pricing_catalog;
create policy pricing_catalog_admin_delete on public.pricing_catalog
for delete to authenticated
using (public.is_admin());

create index if not exists activity_log_actor_idx on public.activity_log(actor_id);
create index if not exists interactions_user_idx on public.interactions(user_id);
create index if not exists meetings_owner_idx on public.meetings(owner_id);
create index if not exists meetings_prospect_idx on public.meetings(prospect_id);
create index if not exists pricing_catalog_created_by_idx on public.pricing_catalog(created_by);
create index if not exists proposals_created_by_idx on public.proposals(created_by);
create index if not exists prospects_created_by_idx on public.prospects(created_by);
create index if not exists quote_estimates_created_by_idx on public.quote_estimates(created_by);
create index if not exists tasks_assigned_to_idx on public.tasks(assigned_to);
create index if not exists tasks_created_by_idx on public.tasks(created_by);
create index if not exists tasks_prospect_idx on public.tasks(prospect_id);
