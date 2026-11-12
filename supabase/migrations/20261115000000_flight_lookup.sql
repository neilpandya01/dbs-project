-- Wingmates: flight lookup (AeroDataBox) support, plus more details on a logged flight.
--
-- Run once in Supabase -> SQL Editor, after the earlier migrations.
--
-- The three new tables are only ever touched by the server (the Next.js route handler uses the
-- service-role key). Row-level security is ON with NO policies and no grants, so the browser,
-- even signed in, can neither read nor write them.

-- ---- more detail on a flight ---------------------------------------------------------------------
alter table public.flights
  add column if not exists registration  text,                       -- tail number, e.g. N806VL
  add column if not exists sched_arr_time text,                      -- local clock time like '6:54 PM'
  add column if not exists seat          text,
  add column if not exists notes         text,
  add column if not exists source        text not null default 'manual';

alter table public.flights drop constraint if exists flights_extra_check;
alter table public.flights add constraint flights_extra_check check (
  source in ('manual', 'lookup')
  and coalesce(char_length(registration), 0) <= 12
  and coalesce(char_length(sched_arr_time), 0) <= 12
  and coalesce(char_length(seat), 0) <= 8
  and coalesce(char_length(notes), 0) <= 500
);

-- ---- how much of the API allowance is left (one row per provider) ---------------------------------
create table if not exists public.api_quota (
  provider        text primary key,
  units_limit     integer not null,
  units_remaining integer not null,
  updated_at      timestamptz not null default now()
);

-- ---- cached lookups: the same flight number + date is only fetched once in a while ----------------
create table if not exists public.flight_lookup_cache (
  cache_key  text primary key,               -- e.g. 'UA2679|2026-11-11'
  found      boolean not null,
  payload    jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null
);
create index if not exists flight_lookup_cache_expiry on public.flight_lookup_cache (expires_at);

-- ---- one row per lookup that really used the API, to give each person a daily allowance -----------
create table if not exists public.flight_lookup_log (
  id         bigint generated always as identity primary key,
  user_id    text not null,
  created_at timestamptz not null default now()
);
create index if not exists flight_lookup_log_user_time on public.flight_lookup_log (user_id, created_at desc);

alter table public.api_quota           enable row level security;
alter table public.flight_lookup_cache enable row level security;
alter table public.flight_lookup_log   enable row level security;
revoke all on public.api_quota, public.flight_lookup_cache, public.flight_lookup_log from anon, authenticated;

-- To undo:
--   drop table public.api_quota, public.flight_lookup_cache, public.flight_lookup_log;
--   alter table public.flights drop constraint flights_extra_check,
--     drop column registration, drop column sched_arr_time, drop column seat, drop column notes, drop column source;
