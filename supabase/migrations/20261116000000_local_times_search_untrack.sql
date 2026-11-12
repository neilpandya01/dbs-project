-- Wingmates: exact flight times, safer friend search, and no more "tracked" stars on the map.
-- Run once in Supabase -> SQL Editor, after the earlier migrations.

-- ---- exact times for flights found by the lookup ---------------------------------------------------
-- dep_at / arr_at are the real moments (UTC); dep_tz / arr_tz are each airport's time zone. With these
-- the app can show each time as the clock at that airport, whoever is looking, and know exactly when
-- a flight is in the air. Flights typed in by hand leave them empty.
alter table public.flights
  add column if not exists dep_at timestamptz,
  add column if not exists arr_at timestamptz,
  add column if not exists dep_tz text,
  add column if not exists arr_tz text;
alter table public.flights drop constraint if exists flights_tz_check;
alter table public.flights add constraint flights_tz_check check (
  coalesce(char_length(dep_tz), 0) <= 64 and coalesce(char_length(arr_tz), 0) <= 64
);

-- ---- friend search: only after most of the username is typed -----------------------------------------
-- Returns people whose username STARTS WITH what was typed, but only if the typed text is at least 80%
-- of their username. So typing "ne" never lists everyone starting with "ne"; nobody can browse or scrape
-- the user list. (Exact requests still work through send_friend_request.)
create or replace function public.find_profiles(p_query text)
returns table (user_id text, username text, display_name text)
language sql stable security definer set search_path = '' as $$
  with q as (select lower(trim(both '@' from trim(p_query))) as t)
  select p.user_id, p.username, p.display_name
  from public.profiles p, q
  where (auth.jwt() ->> 'sub') is not null
    and p.user_id <> (auth.jwt() ->> 'sub')
    and char_length(q.t) >= 3
    and starts_with(lower(p.username), q.t)
    and char_length(q.t)::numeric >= 0.8 * char_length(p.username)
  order by p.username
  limit 5;
$$;
revoke all on function public.find_profiles(text) from public, anon;
grant execute on function public.find_profiles(text) to authenticated;

-- ---- the map no longer has starred flights ----------------------------------------------------------
drop table if exists public.tracked_flights;
