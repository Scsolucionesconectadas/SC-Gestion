-- Cover foreign-key lookup order used during updates and deletes.

create index if not exists clients_source_prospect_org_fk_idx
  on public.clients(source_prospect_id, organization_id)
  where source_prospect_id is not null;
create index if not exists clients_source_proposal_org_fk_idx
  on public.clients(source_proposal_id, organization_id)
  where source_proposal_id is not null;
create index if not exists proposals_converted_client_org_fk_idx
  on public.proposals(converted_client_id, organization_id)
  where converted_client_id is not null;
create index if not exists proposals_converted_project_org_fk_idx
  on public.proposals(converted_project_id, organization_id)
  where converted_project_id is not null;
create index if not exists proposals_converted_by_fk_idx
  on public.proposals(converted_by)
  where converted_by is not null;
create index if not exists prospect_stage_history_changed_by_fk_idx
  on public.prospect_stage_history(changed_by)
  where changed_by is not null;
create index if not exists prospect_stage_history_prospect_org_fk_idx
  on public.prospect_stage_history(prospect_id, organization_id, changed_at desc);
