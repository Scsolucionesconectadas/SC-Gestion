-- Generate one in-app reminder per overdue task and day at 08:15 America/Argentina/Buenos_Aires.
create extension if not exists pg_cron with schema extensions;

create or replace function public.enqueue_overdue_task_notifications()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare inserted_count integer;
begin
  insert into public.notifications(
    organization_id, user_id, title, body, kind, entity_type, entity_id, action_url, dedupe_key
  )
  select task.organization_id, task.assigned_to, 'Tarea atrasada', task.title, 'warning',
    'task', task.id, '#tasks', 'task-overdue:' || task.id::text || ':' || current_date::text
  from public.tasks task
  join public.memberships membership
    on membership.organization_id = task.organization_id
   and membership.user_id = task.assigned_to
   and membership.active = true
  join public.profiles profile
    on profile.id = task.assigned_to
   and profile.active = true
  where task.assigned_to is not null
    and task.due_at < now()
    and task.status not in ('completada','cancelada')
    and coalesce((membership.notification_preferences ->> 'in_app')::boolean, true)
  on conflict (dedupe_key) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.enqueue_overdue_task_notifications() from public, anon, authenticated;

do $$
declare existing_job bigint;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'sc-overdue-task-notifications'
  loop
    perform cron.unschedule(existing_job);
  end loop;
end;
$$;

select cron.schedule(
  'sc-overdue-task-notifications',
  '15 11 * * *',
  $job$select public.enqueue_overdue_task_notifications();$job$
);
