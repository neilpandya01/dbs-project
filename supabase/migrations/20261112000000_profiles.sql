-- Wingmates: profiles (one row per Clerk user), with row-level security
--
-- Clerk user ids are text like 'user_2abc...', NOT uuids, so:
--   * user_id is text, filled from the signed-in token's `sub` claim
--   * row-level security compares against auth.jwt()->>'sub' (auth.uid() would be null/invalid)
--
-- BEFORE RUNNING: in Clerk Dashboard -> Sessions -> "Customize session token", make the claims:
--     { "username": "{{user.username}}" }
-- The database takes a user's username ONLY from that token claim, so nobody can claim someone
-- else's username by sending a different value from the browser.
--
-- Review this, then run it once in Supabase -> SQL Editor.

create table if not exists public.profiles (
  user_id      text primary key default (auth.jwt() ->> 'sub'),
  username     text not null,
  display_name text not null default '',
  bio          text not null default '',
  home_city    text not null default '',
  home_lat     double precision,
  home_lon     double precision,
  photo_url    text,
  banner       jsonb,          -- {"kind":"preset","id":"clouds"} or {"kind":"photo","path":"..."}
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_username_len check (char_length(username) between 1 and 64),
  constraint profiles_display_name_len check (char_length(display_name) <= 80),
  constraint profiles_bio_len check (char_length(bio) <= 300)
);

-- usernames are unique regardless of capitalisation
create unique index if not exists profiles_username_key on public.profiles (lower(username));

-- ---- triggers --------------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- For a signed-in user, the username can only be the one Clerk signed into their token.
-- (Server-side maintenance with the service role has no user token and is left alone.)
create or replace function public.username_from_token() returns trigger
language plpgsql set search_path = '' as $$
declare
  claim text := auth.jwt() ->> 'username';
begin
  if (auth.jwt() ->> 'sub') is not null then
    if claim is null or claim = '' then
      raise exception 'Your sign-in token has no username claim. Add {"username": "{{user.username}}"} under Clerk -> Sessions -> Customize session token.';
    end if;
    new.username := claim;
  end if;
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_username_from_token on public.profiles;
create trigger profiles_username_from_token before insert or update on public.profiles
  for each row execute function public.username_from_token();

-- ---- row-level security ----------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Signed-out visitors get nothing. Signed-in users only ever see and change their OWN row.
-- There is deliberately no delete grant: removing an account is done server-side.
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "create own profile" on public.profiles;
create policy "create own profile" on public.profiles
  for insert to authenticated
  with check (user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'))
  with check (user_id = (select auth.jwt() ->> 'sub'));

-- ---- finding a person to add as a friend -----------------------------------------------------
-- Bio and home city stay private. This returns ONE person's public bits for an EXACT username, so
-- signed-in users can send a friend request but nobody can list or scrape everyone.
create or replace function public.lookup_profile(p_username text)
returns table (user_id text, username text, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.username, p.display_name
  from public.profiles p
  where lower(p.username) = lower(trim(p_username))
  limit 1;
$$;

revoke all on function public.lookup_profile(text) from public, anon;
grant execute on function public.lookup_profile(text) to authenticated;

-- To undo everything:
--   drop function public.lookup_profile(text);  drop table public.profiles;
--   drop function public.username_from_token();  drop function public.touch_updated_at();
