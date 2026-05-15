alter table public.profiles
  add column if not exists auth_user_id uuid unique;

create table if not exists public.repo_connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  repo_full_name text not null,
  branch text not null default 'main',
  created_at timestamptz not null default now()
);

create table if not exists public.terminal_chunks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tab_id uuid not null references public.agent_tabs(id) on delete cascade,
  stream text not null check (stream in ('stdout', 'stderr', 'meta')),
  chunk text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tab_id uuid not null references public.agent_tabs(id) on delete cascade,
  title text not null,
  detail text not null,
  risk text not null,
  amount_usd numeric(12, 4) not null default 0,
  status text not null default 'pending',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.prompt_macros (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  voice_phrases jsonb not null default '[]'::jsonb,
  target_agents jsonb not null default '[]'::jsonb,
  risk text not null default 'safe',
  template text not null,
  mpp_price_usd numeric(12, 4),
  created_at timestamptz not null default now()
);

create table if not exists public.goal_checkpoints (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  goal_run_id uuid not null references public.goal_runs(id) on delete cascade,
  label text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.spend_limits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  hourly_usd numeric(12, 4) not null default 0,
  goal_usd numeric(12, 4) not null default 0,
  action_usd numeric(12, 4) not null default 0,
  require_approval_above_usd numeric(12, 4) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  provider text not null,
  amount_usd numeric(12, 4) not null,
  note text,
  created_at timestamptz not null default now()
);

create or replace function public.noecho_owns_profile(target_profile_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target_profile_id
      and p.auth_user_id = auth.uid()
  );
$$;

alter table public.repo_connections enable row level security;
alter table public.terminal_chunks enable row level security;
alter table public.approval_requests enable row level security;
alter table public.prompt_macros enable row level security;
alter table public.goal_checkpoints enable row level security;
alter table public.spend_limits enable row level security;
alter table public.donations enable row level security;

drop policy if exists "own repo connections" on public.repo_connections;
create policy "own repo connections" on public.repo_connections
  for all using (public.noecho_owns_profile(profile_id))
  with check (public.noecho_owns_profile(profile_id));

drop policy if exists "own terminal chunks" on public.terminal_chunks;
create policy "own terminal chunks" on public.terminal_chunks
  for all using (public.noecho_owns_profile(profile_id))
  with check (public.noecho_owns_profile(profile_id));

drop policy if exists "own approval requests" on public.approval_requests;
create policy "own approval requests" on public.approval_requests
  for all using (public.noecho_owns_profile(profile_id))
  with check (public.noecho_owns_profile(profile_id));

drop policy if exists "own prompt macros" on public.prompt_macros;
create policy "own prompt macros" on public.prompt_macros
  for all using (public.noecho_owns_profile(profile_id))
  with check (public.noecho_owns_profile(profile_id));

drop policy if exists "own goal checkpoints" on public.goal_checkpoints;
create policy "own goal checkpoints" on public.goal_checkpoints
  for all using (public.noecho_owns_profile(profile_id))
  with check (public.noecho_owns_profile(profile_id));

drop policy if exists "own spend limits" on public.spend_limits;
create policy "own spend limits" on public.spend_limits
  for all using (public.noecho_owns_profile(profile_id))
  with check (public.noecho_owns_profile(profile_id));

drop policy if exists "own donations" on public.donations;
create policy "own donations" on public.donations
  for all using (profile_id is null or public.noecho_owns_profile(profile_id))
  with check (profile_id is null or public.noecho_owns_profile(profile_id));

comment on column public.profiles.auth_user_id is
  'Bound to Supabase auth.users.id once wallet login is implemented.';
