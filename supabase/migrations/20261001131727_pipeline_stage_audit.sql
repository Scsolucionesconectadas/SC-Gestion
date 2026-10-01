-- Register pipeline configuration changes in the existing tenant activity log.

create trigger audit_pipeline_stages
after insert or update on public.pipeline_stages
for each row execute function public.log_crm_change();
