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
  phonetic             text,
  source_url           text,        -- reserved for Phase 2 (browser extension)
  difficulty           text        not null default 'unrated'
                                   check (difficulty in ('unrated', 'easy', 'medium', 'hard')),
  next_review_at       timestamptz not null default now(),
  interval_days        integer     not null default 1,
  review_count         integer     not null default 0,
  last_reviewed_at     timestamptz,
  created_at           timestamptz not null default now()
);

comment on column public.words.source_url is
  'Reserved for Phase 2: URL of the webpage where this word was captured by the browser extension.';

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
