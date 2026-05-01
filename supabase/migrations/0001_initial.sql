create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_identities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  chain text not null,
  address text not null,
  created_at timestamptz not null default now(),
  unique (chain, address)
);

create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  public_key text not null,
  status text not null default 'pairing',
  created_at timestamptz not null default now()
);

create table if not exists public.agent_tabs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  machine_id uuid references public.machines(id) on delete set null,
  agent text not null,
  mode text not null,
  repo text not null,
  branch text,
  status text not null default 'idle',
  risk text not null default 'safe',
  spend_usd numeric(12, 4) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tab_id uuid not null references public.agent_tabs(id) on delete cascade,
  kind text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.goal_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tab_id uuid not null references public.agent_tabs(id) on delete cascade,
  prompt text not null,
  runtime_budget_minutes int not null,
  spend_budget_usd numeric(12, 4) not null default 0,
  checkpoint_interval_minutes int not null default 15,
  status text not null default 'idle',
  created_at timestamptz not null default now()
);

create table if not exists public.mpp_receipts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  amount_usd numeric(12, 4) not null,
  receipt jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.wallet_identities enable row level security;
alter table public.machines enable row level security;
alter table public.agent_tabs enable row level security;
alter table public.agent_events enable row level security;
alter table public.goal_runs enable row level security;
alter table public.mpp_receipts enable row level security;

-- RLS policies are completed once hosted auth is implemented.
-- The scaffold intentionally avoids permissive policies.
