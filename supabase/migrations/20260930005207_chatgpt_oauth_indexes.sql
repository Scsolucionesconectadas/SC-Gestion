create index if not exists chatgpt_connections_connected_by_idx
on public.chatgpt_connections(connected_by);

create index if not exists chatgpt_oauth_transactions_organization_idx
on public.chatgpt_oauth_transactions(organization_id);

create index if not exists chatgpt_oauth_transactions_user_idx
on public.chatgpt_oauth_transactions(user_id);
