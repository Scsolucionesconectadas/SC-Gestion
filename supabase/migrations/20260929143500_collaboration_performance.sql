-- Cover relationship lookups used by collaboration, communications and Agent Studio.
create index if not exists agent_definitions_created_by_idx
  on public.agent_definitions(created_by);
create index if not exists agent_definitions_updated_by_idx
  on public.agent_definitions(updated_by);
create index if not exists agent_runs_agent_org_idx
  on public.agent_runs(agent_id, organization_id);
create index if not exists agent_versions_agent_org_idx
  on public.agent_versions(agent_id, organization_id);
create index if not exists agent_versions_published_by_idx
  on public.agent_versions(published_by);
create index if not exists email_messages_created_by_idx
  on public.email_messages(created_by);
create index if not exists email_templates_created_by_idx
  on public.email_templates(created_by);
create index if not exists email_templates_organization_idx
  on public.email_templates(organization_id);
create index if not exists generated_documents_created_by_idx
  on public.generated_documents(created_by);
create index if not exists generated_documents_invoice_org_idx
  on public.generated_documents(invoice_id, organization_id);
create index if not exists role_permission_defaults_permission_idx
  on public.role_permission_defaults(permission_code);
create index if not exists task_comments_author_idx
  on public.task_comments(author_id);
create index if not exists task_comments_task_org_idx
  on public.task_comments(task_id, organization_id);
create index if not exists task_watchers_task_org_idx
  on public.task_watchers(task_id, organization_id);
create index if not exists task_watchers_user_idx
  on public.task_watchers(user_id);
create index if not exists tasks_parent_org_idx
  on public.tasks(parent_task_id, organization_id);

-- Keep read and write paths separate so SELECT evaluates a single permissive policy.
drop policy if exists email_templates_write on public.email_templates;
drop policy if exists email_templates_insert on public.email_templates;
create policy email_templates_insert on public.email_templates for insert to authenticated
with check (private.has_org_permission(organization_id, 'communications.send'));
drop policy if exists email_templates_update on public.email_templates;
create policy email_templates_update on public.email_templates for update to authenticated
using (private.has_org_permission(organization_id, 'communications.send'))
with check (private.has_org_permission(organization_id, 'communications.send'));
drop policy if exists email_templates_delete on public.email_templates;
create policy email_templates_delete on public.email_templates for delete to authenticated
using (private.has_org_permission(organization_id, 'communications.send'));
