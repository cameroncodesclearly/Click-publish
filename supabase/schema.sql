-- Click Publish — Supabase schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → paste → Run.
-- It creates the per-user state store, a lightweight profiles table, and the
-- Row Level Security policies that make each account's data private.

-- ── Per-user app state (the whole app blob lives here) ─────────────────────
create table if not exists public.app_states (
  user_id     uuid primary key references auth.users on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.app_states enable row level security;

drop policy if exists "own row select" on public.app_states;
drop policy if exists "own row insert" on public.app_states;
drop policy if exists "own row update" on public.app_states;

create policy "own row select" on public.app_states
  for select using (auth.uid() = user_id);
create policy "own row insert" on public.app_states
  for insert with check (auth.uid() = user_id);
create policy "own row update" on public.app_states
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- keep updated_at fresh on every write
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists app_states_touch on public.app_states;
create trigger app_states_touch
  before update on public.app_states
  for each row execute function public.touch_updated_at();

-- ── Profiles (roles from day one; enables a future coach dashboard) ────────
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  display_name text,
  role         text not null default 'owner',   -- owner | client | coach
  coach_id     uuid references auth.users,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profile select" on public.profiles;
drop policy if exists "profile insert" on public.profiles;
drop policy if exists "profile update" on public.profiles;

create policy "profile select" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profile insert" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profile update" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
