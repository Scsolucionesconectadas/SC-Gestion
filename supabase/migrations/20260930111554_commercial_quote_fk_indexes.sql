-- Cover quote foreign keys in their declared column order.

create index if not exists proposal_sections_proposal_org_fk_idx
  on public.proposal_sections(proposal_id, organization_id);
create index if not exists proposal_items_proposal_org_fk_idx
  on public.proposal_items(proposal_id, organization_id);
create index if not exists proposal_items_section_org_fk_idx
  on public.proposal_items(section_id, organization_id);
create index if not exists proposal_versions_proposal_org_fk_idx
  on public.proposal_versions(proposal_id, organization_id);
create index if not exists proposal_versions_created_by_fk_idx
  on public.proposal_versions(created_by);
create index if not exists proposals_approved_by_fk_idx
  on public.proposals(approved_by);
