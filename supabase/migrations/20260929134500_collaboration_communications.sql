-- SC Gestion - collaborative work, notifications, email and generated documents.

alter table public.tasks
  add column if not exists parent_task_id uuid,
  add column if not exists start_at timestamptz,
  add column if not exists estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 0 and 100000),
  add column if not exists position integer not null default 0,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists checklist jsonb not null default '[]'::jsonb;

alter table public.tasks drop constraint if exists tasks_business_org_unique;
alter table public.tasks add constraint tasks_business_org_unique unique (id, organization_id);
alter table public.tasks drop constraint if exists tasks_parent_org_fkey;
alter table public.tasks add constraint tasks_parent_org_fkey
  foreign key (parent_task_id, organization_id)
  references public.tasks(id, organization_id) on delete cascade;

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  mentions uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (task_id, organization_id)
    references public.tasks(id, organization_id) on delete cascade
);

create table if not exists public.task_watchers (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id),
  foreign key (task_id, organization_id)
    references public.tasks(id, organization_id) on delete cascade
);

alter table public.notifications
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists action_url text,
  add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_key_idx
  on public.notifications(dedupe_key) where dedupe_key is not null;

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  subject text not null check (char_length(trim(subject)) between 1 and 240),
  html_body text not null,
  category text not null default 'general',
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  to_addresses text[] not null check (cardinality(to_addresses) between 1 and 20),
  cc_addresses text[] not null default '{}'::text[],
  subject text not null check (char_length(trim(subject)) between 1 and 240),
  html_body text not null,
  text_body text,
  attachment_paths text[] not null default '{}'::text[],
  related_type text,
  related_id uuid,
  status text not null default 'draft' check (status in ('draft','queued','sent','failed','cancelled')),
  provider text not null default 'resend',
  provider_id text,
  error_message text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid,
  document_type text not null default 'invoice_pdf' check (document_type in ('invoice_pdf','quote_pdf','receipt_pdf','report_pdf')),
  version integer not null default 1 check (version > 0),
  storage_path text not null,
  file_name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, storage_path),
  foreign key (invoice_id, organization_id)
    references public.invoices(id, organization_id) on delete cascade
);

create index if not exists task_comments_task_created_idx on public.task_comments(organization_id, task_id, created_at);
create index if not exists task_watchers_user_idx on public.task_watchers(organization_id, user_id);
create index if not exists email_messages_org_status_idx on public.email_messages(organization_id, status, created_at desc);
create index if not exists generated_documents_invoice_idx on public.generated_documents(organization_id, invoice_id, version desc);

drop trigger if exists task_comments_set_updated_at on public.task_comments;
create trigger task_comments_set_updated_at before update on public.task_comments
for each row execute function public.set_updated_at();
drop trigger if exists email_templates_set_updated_at on public.email_templates;
create trigger email_templates_set_updated_at before update on public.email_templates
for each row execute function public.set_updated_at();
drop trigger if exists email_messages_set_updated_at on public.email_messages;
create trigger email_messages_set_updated_at before update on public.email_messages
for each row execute function public.set_updated_at();

alter table public.task_comments enable row level security;
alter table public.task_watchers enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_messages enable row level security;
alter table public.generated_documents enable row level security;

revoke all on public.task_comments, public.task_watchers, public.email_templates, public.email_messages, public.generated_documents from anon, authenticated;
grant select, insert, update, delete on public.task_comments, public.task_watchers to authenticated;
grant select, insert, update, delete on public.email_templates, public.email_messages to authenticated;
grant select, insert, delete on public.generated_documents to authenticated;

drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments for select to authenticated
using (private.has_org_permission(organization_id, 'tasks.view'));
drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert on public.task_comments for insert to authenticated
with check (author_id = (select auth.uid()) and private.has_org_permission(organization_id, 'tasks.comment'));
drop policy if exists task_comments_update on public.task_comments;
create policy task_comments_update on public.task_comments for update to authenticated
using (author_id = (select auth.uid()) and private.has_org_permission(organization_id, 'tasks.comment'))
with check (author_id = (select auth.uid()) and private.has_org_permission(organization_id, 'tasks.comment'));
drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete on public.task_comments for delete to authenticated
using (author_id = (select auth.uid()) or private.has_org_role(organization_id, array['owner','admin']));

drop policy if exists task_watchers_select on public.task_watchers;
create policy task_watchers_select on public.task_watchers for select to authenticated
using (private.has_org_permission(organization_id, 'tasks.view'));
drop policy if exists task_watchers_insert on public.task_watchers;
create policy task_watchers_insert on public.task_watchers for insert to authenticated
with check (private.has_org_permission(organization_id, 'tasks.write'));
drop policy if exists task_watchers_delete on public.task_watchers;
create policy task_watchers_delete on public.task_watchers for delete to authenticated
using (user_id = (select auth.uid()) or private.has_org_permission(organization_id, 'tasks.write'));

drop policy if exists email_templates_select on public.email_templates;
create policy email_templates_select on public.email_templates for select to authenticated
using (private.is_org_member(organization_id));
drop policy if exists email_templates_write on public.email_templates;
create policy email_templates_write on public.email_templates for all to authenticated
using (private.has_org_permission(organization_id, 'communications.send'))
with check (private.has_org_permission(organization_id, 'communications.send'));

drop policy if exists email_messages_select on public.email_messages;
create policy email_messages_select on public.email_messages for select to authenticated
using (private.has_org_permission(organization_id, 'communications.send'));
drop policy if exists email_messages_insert on public.email_messages;
create policy email_messages_insert on public.email_messages for insert to authenticated
with check (created_by = (select auth.uid()) and private.has_org_permission(organization_id, 'communications.send'));
drop policy if exists email_messages_update on public.email_messages;
create policy email_messages_update on public.email_messages for update to authenticated
using (private.has_org_permission(organization_id, 'communications.send'))
with check (private.has_org_permission(organization_id, 'communications.send'));

drop policy if exists generated_documents_select on public.generated_documents;
create policy generated_documents_select on public.generated_documents for select to authenticated
using (private.has_org_permission(organization_id, 'billing.view'));
drop policy if exists generated_documents_insert on public.generated_documents;
create policy generated_documents_insert on public.generated_documents for insert to authenticated
with check (created_by = (select auth.uid()) and private.has_org_permission(organization_id, 'billing.write'));
drop policy if exists generated_documents_delete on public.generated_documents;
create policy generated_documents_delete on public.generated_documents for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin']));

create or replace function public.notify_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.assigned_to is not null and (
    tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to
  ) then
    insert into public.notifications(
      organization_id, user_id, title, body, kind, entity_type, entity_id, action_url, dedupe_key
    ) values (
      new.organization_id, new.assigned_to, 'Nueva tarea asignada', new.title, 'info',
      'task', new.id, '#tasks', 'task-assigned:' || new.id::text || ':' || new.assigned_to::text || ':' || extract(epoch from now())::bigint::text
    ) on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists task_assignment_notification on public.tasks;
create trigger task_assignment_notification
after insert or update of assigned_to on public.tasks
for each row execute function public.notify_task_assignment();

create or replace function public.notify_task_comment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.notifications(
    organization_id, user_id, title, body, kind, entity_type, entity_id, action_url, dedupe_key
  )
  select distinct new.organization_id, recipient.user_id, 'Nuevo comentario en una tarea',
    left(new.body, 240), 'info', 'task', new.task_id, '#tasks',
    'task-comment:' || new.id::text || ':' || recipient.user_id::text
  from (
    select task.assigned_to as user_id from public.tasks task
      where task.id = new.task_id and task.organization_id = new.organization_id
    union
    select watcher.user_id from public.task_watchers watcher
      where watcher.task_id = new.task_id and watcher.organization_id = new.organization_id
    union
    select unnest(new.mentions) as user_id
  ) recipient
  where recipient.user_id is not null and recipient.user_id is distinct from new.author_id
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

drop trigger if exists task_comment_notification on public.task_comments;
create trigger task_comment_notification
after insert on public.task_comments
for each row execute function public.notify_task_comment();

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
  where task.assigned_to is not null
    and task.due_at < now()
    and task.status not in ('completada','cancelada')
  on conflict (dedupe_key) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.notify_task_assignment() from public, anon, authenticated;
revoke all on function public.notify_task_comment() from public, anon, authenticated;
revoke all on function public.enqueue_overdue_task_notifications() from public, anon, authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('generated-pdfs', 'generated-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists generated_pdfs_select on storage.objects;
create policy generated_pdfs_select on storage.objects for select to authenticated
using (
  bucket_id = 'generated-pdfs'
  and private.has_org_permission(private.object_organization_id(name), 'billing.view')
);
drop policy if exists generated_pdfs_insert on storage.objects;
create policy generated_pdfs_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'generated-pdfs'
  and private.has_org_permission(private.object_organization_id(name), 'billing.write')
);
drop policy if exists generated_pdfs_delete on storage.objects;
create policy generated_pdfs_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'generated-pdfs'
  and private.has_org_role(private.object_organization_id(name), array['owner','admin'])
);
