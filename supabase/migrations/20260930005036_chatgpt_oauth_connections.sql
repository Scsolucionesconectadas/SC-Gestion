create table if not exists public.chatgpt_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  provider text not null default 'chatgpt' check (provider = 'chatgpt'),
  account_subject text not null,
  account_email text,
  account_name text,
  client_id text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  id_token_encrypted text not null,
  expires_at timestamptz not null,
  scopes text[] not null default '{}'::text[],
  models jsonb not null default '[]'::jsonb check (jsonb_typeof(models) = 'array'),
  status text not null default 'connected' check (status in ('connected', 'attention_required')),
  token_version integer not null default 1 check (token_version > 0),
  last_verified_at timestamptz,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chatgpt_oauth_transactions (
  id uuid primary key,
  state_hash text not null unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pkce_verifier_encrypted text not null,
  nonce text not null,
  client_id text not null,
  redirect_uri text not null,
  return_to text not null,
  switch_account boolean not null default false,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists chatgpt_connections_expires_idx
on public.chatgpt_connections(expires_at);

create index if not exists chatgpt_oauth_transactions_expiry_idx
on public.chatgpt_oauth_transactions(expires_at)
where consumed_at is null;

drop trigger if exists chatgpt_connections_set_updated_at on public.chatgpt_connections;
create trigger chatgpt_connections_set_updated_at before update on public.chatgpt_connections
for each row execute function public.set_updated_at();

alter table public.chatgpt_connections enable row level security;
alter table public.chatgpt_oauth_transactions enable row level security;

revoke all on table public.chatgpt_connections from public, anon, authenticated;
revoke all on table public.chatgpt_oauth_transactions from public, anon, authenticated;
grant all on table public.chatgpt_connections to service_role;
grant all on table public.chatgpt_oauth_transactions to service_role;

comment on table public.chatgpt_connections is
'Credenciales OAuth de ChatGPT cifradas por empresa. Solo Edge Functions con service_role pueden acceder.';

comment on table public.chatgpt_oauth_transactions is
'Estado temporal y de un solo uso para Authorization Code con PKCE.';
