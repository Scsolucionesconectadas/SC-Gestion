-- The existing organization/user index does not cover the user_id foreign key.
create index if not exists task_watchers_user_fk_idx
  on public.task_watchers(user_id);
