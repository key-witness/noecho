create table if not exists public.model_rooms (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  goal_run_id uuid references public.goal_runs(id) on delete set null,
  title text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_participants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.model_rooms(id) on delete cascade,
  kind text not null check (kind in ('user', 'agent')),
  label text not null,
  agent text not null,
  status text not null default 'idle',
  created_at timestamptz not null default now()
);

create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.model_rooms(id) on delete cascade,
  work_id uuid,
  author_kind text not null check (author_kind in ('user', 'agent', 'system')),
  author_label text not null,
  agent text,
  body text not null,
  priority text not null default 'normal' check (priority in ('high', 'normal')),
  created_at timestamptz not null default now()
);

create table if not exists public.room_work_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.model_rooms(id) on delete cascade,
  message_id uuid not null references public.room_messages(id) on delete cascade,
  participant_id uuid not null references public.room_participants(id) on delete cascade,
  agent text not null,
  prompt text not null,
  priority text not null default 'normal' check (priority in ('high', 'normal')),
  status text not null default 'pending' check (status in ('pending', 'claimed', 'completed', 'failed')),
  claimed_by text,
  claimed_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.machines
  add column if not exists machine_token_hash text,
  add column if not exists revoked_at timestamptz;

alter table public.model_rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.room_messages enable row level security;
alter table public.room_work_items enable row level security;

drop policy if exists "own model rooms" on public.model_rooms;
create policy "own model rooms" on public.model_rooms
  for all using (public.noecho_owns_profile(profile_id))
  with check (public.noecho_owns_profile(profile_id));

drop policy if exists "own room participants" on public.room_participants;
create policy "own room participants" on public.room_participants
  for all using (public.noecho_owns_profile(profile_id))
  with check (public.noecho_owns_profile(profile_id));

drop policy if exists "own room messages" on public.room_messages;
create policy "own room messages" on public.room_messages
  for all using (public.noecho_owns_profile(profile_id))
  with check (public.noecho_owns_profile(profile_id));

drop policy if exists "own room work items" on public.room_work_items;
create policy "own room work items" on public.room_work_items
  for all using (public.noecho_owns_profile(profile_id))
  with check (public.noecho_owns_profile(profile_id));
