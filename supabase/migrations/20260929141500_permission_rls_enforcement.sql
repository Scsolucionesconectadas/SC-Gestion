-- SC Gestion - enforce granular permissions at the database boundary.

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_manager on public.organizations
for update to authenticated
using (private.has_org_permission(id, 'organization.manage'))
with check (private.has_org_permission(id, 'organization.manage'));

do $$
declare
  rule record;
begin
  for rule in
    select * from (values
      ('prospects', 'crm.view', 'crm.write'),
      ('interactions', 'crm.view', 'crm.write'),
      ('meetings', 'crm.view', 'crm.write'),
      ('proposals', 'crm.view', 'crm.write'),
      ('clients', 'clients.view', 'clients.write'),
      ('projects', 'projects.view', 'projects.write'),
      ('project_comments', 'projects.view', 'projects.write'),
      ('tasks', 'tasks.view', 'tasks.write'),
      ('documents', 'documents.view', 'documents.write'),
      ('invoices', 'billing.view', 'billing.write'),
      ('invoice_items', 'billing.view', 'billing.write'),
      ('payments', 'billing.view', 'billing.write'),
      ('pricing_catalog', 'billing.view', 'billing.write'),
      ('quote_estimates', 'agents.run', 'agents.run'),
      ('agent_runs', 'agents.run', 'agents.run')
    ) as permissions(table_name, view_permission, write_permission)
  loop
    execute (
      select string_agg(format('drop policy if exists %I on public.%I', policyname, tablename), '; ')
      from pg_policies
      where schemaname = 'public' and tablename = rule.table_name
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.has_org_permission(organization_id, %L))',
      rule.table_name || '_select_permission', rule.table_name, rule.view_permission
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.has_org_permission(organization_id, %L))',
      rule.table_name || '_insert_permission', rule.table_name, rule.write_permission
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.has_org_permission(organization_id, %L)) with check (private.has_org_permission(organization_id, %L))',
      rule.table_name || '_update_permission', rule.table_name, rule.write_permission, rule.write_permission
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.has_org_role(organization_id, array[''owner'',''admin'']))',
      rule.table_name || '_delete_manager', rule.table_name
    );
  end loop;
end $$;

drop policy if exists activity_log_select_member on public.activity_log;
create policy activity_log_select_auditor on public.activity_log
for select to authenticated
using (private.has_org_permission(organization_id, 'audit.view'));

-- Keep notifications private to their recipient.
drop policy if exists notifications_insert_admin on public.notifications;
create policy notifications_insert_manager on public.notifications
for insert to authenticated
with check (
  private.has_org_permission(organization_id, 'team.manage')
  or private.has_org_permission(organization_id, 'tasks.write')
);
