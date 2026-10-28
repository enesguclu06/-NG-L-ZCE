-- ============================================================
-- YOKDILHUNTER — Supabase Schema + RLS
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- Enable the pgcrypto extension (for gen_random_uuid — usually already enabled)
create extension if not exists "pgcrypto";

-- ── Create words table ──────────────────────────────────────────
create table public.words (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references auth.users(id) on delete cascade,
  english_word         text        not null,
  turkish_translation  text,
  synonyms             text[],
  definition           text,
  example_sentence     text,        -- Example usage sentence from dictionary API
  phonetic             text,
  source_url           text,        -- reserved for Phase 2 (browser extension)
  difficulty           text        not null default 'unrated'
                                   check (difficulty in ('unrated', 'easy', 'medium', 'hard', 'mastered')),
  -- SM-2 Spaced Repetition fields
  next_review_at       timestamptz not null default now(),
  interval_days        integer     not null default 1,
  review_count         integer     not null default 0,
  repetitions          integer     not null default 0,   -- SM-2: consecutive correct answers
  ease_factor          float       not null default 2.5, -- SM-2: difficulty multiplier (min 1.3)
  last_reviewed_at     timestamptz,
  created_at           timestamptz not null default now()
);

comment on column public.words.source_url is
  'Reserved for Phase 2: URL of the webpage where this word was captured by the browser extension.';
comment on column public.words.ease_factor is
  'SM-2 ease factor. Starts at 2.5, min 1.3. Higher = longer intervals between reviews.';
comment on column public.words.repetitions is
  'SM-2 consecutive successful reviews. Resets to 0 on failure (hard rating).';

-- ── Indexes ─────────────────────────────────────────────────────
create index words_user_id_idx       on public.words(user_id);
create index words_next_review_idx   on public.words(user_id, next_review_at);
create index words_difficulty_idx    on public.words(user_id, difficulty);
create index words_created_at_idx    on public.words(user_id, created_at desc);

-- ── Row Level Security ──────────────────────────────────────────
alter table public.words enable row level security;

create policy "Users can view their own words"
  on public.words
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own words"
  on public.words
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own words"
  on public.words
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their own words"
  on public.words
  for delete
  using (auth.uid() = user_id);

-- ── Push Notifications Subscriptions Table ─────────────────────
create table if not exists public.push_subscriptions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  endpoint    text        not null unique,
  p256dh      text        not null,
  auth        text        not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_subs_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy "Users can view their own push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own push subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own push subscriptions"
  on public.push_subscriptions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own push subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- Table Permissions (Required for PostgREST & Service Role)
grant all on table public.push_subscriptions to postgres, service_role, authenticated, anon;

-- Security Definer RPC Functions for Cron Reminders
create or replace function get_all_push_subscriptions()
returns setof public.push_subscriptions
language sql
security definer
set search_path = public
as $$
  select * from public.push_subscriptions;
$$;

grant execute on function get_all_push_subscriptions to anon, authenticated, service_role;

create or replace function delete_expired_push_subscriptions(endpoints text[])
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions where endpoint = any(endpoints);
$$;

grant execute on function delete_expired_push_subscriptions to anon, authenticated, service_role;


