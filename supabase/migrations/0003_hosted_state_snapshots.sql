create table if not exists public.noecho_state_snapshots (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.noecho_state_snapshots enable row level security;

drop policy if exists "own state snapshots" on public.noecho_state_snapshots;
create policy "own state snapshots" on public.noecho_state_snapshots
  for all using (public.noecho_owns_profile(profile_id))
  with check (public.noecho_owns_profile(profile_id));

comment on table public.noecho_state_snapshots is
  'Hosted snapshot mirror for the full Noecho server state.';
