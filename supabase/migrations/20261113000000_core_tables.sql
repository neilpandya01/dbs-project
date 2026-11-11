-- Wingmates core tables: airports, flights, friendships, tracked flights, reports, news.
-- Run AFTER 20261112000000_profiles.sql. Review, then run once in Supabase -> SQL Editor.
--
-- Security model (every table has row-level security ON):
--   * you can always read and change your own rows;
--   * a friend can read your profile and your flights that aren't marked hidden, only after the
--     request was ACCEPTED (pending requests grant nothing);
--   * friend requests are changed only through the functions below, never by writing the table;
--   * strangers and signed-out visitors can read nothing personal.
-- Clerk user ids are text ('user_2abc...'), so ids are compared with auth.jwt()->>'sub'.

-- =================================================================================================
-- profiles: extra columns for the app's profile screen + size limits on the picture fields
-- =================================================================================================
alter table public.profiles add column if not exists avatar_color text not null default '#3d96ff';

alter table public.profiles drop constraint if exists profiles_photo_size;
alter table public.profiles add constraint profiles_photo_size check (photo_url is null or char_length(photo_url) <= 200000);
alter table public.profiles drop constraint if exists profiles_banner_size;
alter table public.profiles add constraint profiles_banner_size check (banner is null or char_length(banner::text) <= 700000);
alter table public.profiles drop constraint if exists profiles_color_format;
alter table public.profiles add constraint profiles_color_format check (avatar_color ~ '^#[0-9a-fA-F]{6}$');

-- =================================================================================================
-- airports: reference data (loaded by `npm run import:airports`). Readable by signed-in users,
-- writable only with the service key.
-- =================================================================================================
create table if not exists public.airports (
  code         text primary key,                 -- 3-letter airline code, e.g. 'ORD'
  name         text not null,
  city         text not null default '',
  country      text not null default '',
  country_code text not null default '',
  continent    text not null default '',
  lat          double precision not null,
  lon          double precision not null,
  kind         text not null default 'small'     -- large | medium | small
);
alter table public.airports enable row level security;
revoke all on public.airports from anon;
revoke insert, update, delete on public.airports from authenticated;
grant select on public.airports to authenticated;
drop policy if exists "airports readable" on public.airports;
create policy "airports readable" on public.airports for select to authenticated using (true);

-- =================================================================================================
-- friendships (+ the helper every friends-only rule uses)
-- =================================================================================================
create table if not exists public.friendships (
  id              uuid primary key default gen_random_uuid(),
  requester       text not null,
  addressee       text not null,
  status          text not null default 'pending' check (status in ('pending', 'accepted')),
  requester_seen  boolean not null default true,   -- false after acceptance, until the requester opens Friends
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  constraint friendships_not_self check (requester <> addressee)
);
-- one relationship per pair of people, whichever way round it was asked
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_requester on public.friendships (requester);
create index if not exists friendships_addressee on public.friendships (addressee);

alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;    -- NO insert/update/delete: use the functions below
drop policy if exists "see my friendships" on public.friendships;
create policy "see my friendships" on public.friendships
  for select to authenticated
  using (requester = (select auth.jwt() ->> 'sub') or addressee = (select auth.jwt() ->> 'sub'));

-- "is this person my accepted friend?" Runs with owner rights so it can look at friendships without
-- tripping over its own row-level security; it only ever answers about the CALLER.
create or replace function public.is_friend(other text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = (select auth.jwt() ->> 'sub') and f.addressee = other)
        or (f.addressee = (select auth.jwt() ->> 'sub') and f.requester = other))
  );
$$;
revoke all on function public.is_friend(text) from public, anon;
grant execute on function public.is_friend(text) to authenticated;

-- friends can read each other's full profile (strangers and pending requests cannot)
drop policy if exists "friends read profile" on public.profiles;
create policy "friends read profile" on public.profiles
  for select to authenticated
  using (public.is_friend(user_id));

-- ---- friend request functions ----------------------------------------------------------------
create or replace function public.send_friend_request(p_username text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me text := auth.jwt() ->> 'sub';
  target text;
  ex public.friendships;
  new_id uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select user_id into target from public.profiles where lower(username) = lower(trim(p_username));
  if target is null then raise exception 'No user @% found', trim(p_username); end if;
  if target = me then raise exception 'That''s you!'; end if;

  select * into ex from public.friendships
   where least(requester, addressee) = least(me, target) and greatest(requester, addressee) = greatest(me, target);
  if found then
    if ex.status = 'accepted' then raise exception 'You''re already friends'; end if;
    if ex.requester = me then raise exception 'You already sent a request to @%', trim(p_username); end if;
    -- they had already asked me, so asking back simply accepts
    update public.friendships set status = 'accepted', accepted_at = now(), requester_seen = false where id = ex.id;
    return ex.id;
  end if;

  insert into public.friendships (requester, addressee) values (me, target) returning id into new_id;
  return new_id;
end $$;

create or replace function public.respond_friend_request(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me text := auth.jwt() ->> 'sub';
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_accept then
    update public.friendships set status = 'accepted', accepted_at = now(), requester_seen = false
     where id = p_id and addressee = me and status = 'pending';
  else
    delete from public.friendships where id = p_id and addressee = me and status = 'pending';
  end if;
  if not found then raise exception 'That request isn''t waiting for you'; end if;
end $$;

-- cancel a request you sent, or remove a friend (either person can)
create or replace function public.remove_friendship(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me text := auth.jwt() ->> 'sub';
begin
  if me is null then raise exception 'Not signed in'; end if;
  delete from public.friendships where id = p_id and (requester = me or addressee = me);
end $$;

create or replace function public.mark_friend_accepts_seen() returns void
language plpgsql security definer set search_path = '' as $$
declare me text := auth.jwt() ->> 'sub';
begin
  if me is null then return; end if;
  update public.friendships set requester_seen = true where requester = me and status = 'accepted' and not requester_seen;
end $$;

-- Everyone I have a relationship with, with only SAFE profile fields (no bio, no home city), so a pending
-- request can show who it is without exposing anything private.
create or replace function public.friend_summaries()
returns table (friendship_id uuid, status text, direction text, other_user_id text, username text,
               display_name text, avatar_color text, requester_seen boolean, created_at timestamptz, accepted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select f.id, f.status,
         case when f.requester = (select auth.jwt() ->> 'sub') then 'outgoing' else 'incoming' end,
         p.user_id, p.username, p.display_name, p.avatar_color, f.requester_seen, f.created_at, f.accepted_at
  from public.friendships f
  join public.profiles p
    on p.user_id = case when f.requester = (select auth.jwt() ->> 'sub') then f.addressee else f.requester end
  where f.requester = (select auth.jwt() ->> 'sub') or f.addressee = (select auth.jwt() ->> 'sub')
  order by f.created_at desc;
$$;

revoke all on function public.send_friend_request(text), public.respond_friend_request(uuid, boolean),
  public.remove_friendship(uuid), public.mark_friend_accepts_seen(), public.friend_summaries() from public, anon;
grant execute on function public.send_friend_request(text), public.respond_friend_request(uuid, boolean),
  public.remove_friendship(uuid), public.mark_friend_accepts_seen(), public.friend_summaries() to authenticated;

-- =================================================================================================
-- flights
-- =================================================================================================
create table if not exists public.flights (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null default (auth.jwt() ->> 'sub'),
  flown_on      date not null,
  dep_time      text,                       -- local clock time like '7:45 AM'; optional
  flight_number text,
  airline       text,
  from_airport  text not null references public.airports (code),
  to_airport    text not null references public.airports (code),
  aircraft      text,
  hidden        boolean not null default false,   -- true = friends can't see this flight
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint flights_distinct check (from_airport <> to_airport),
  constraint flights_text_len check (
    coalesce(char_length(dep_time), 0) <= 12 and coalesce(char_length(flight_number), 0) <= 12
    and coalesce(char_length(airline), 0) <= 60 and coalesce(char_length(aircraft), 0) <= 60)
);
create index if not exists flights_user_date on public.flights (user_id, flown_on desc);

drop trigger if exists flights_touch on public.flights;
create trigger flights_touch before update on public.flights for each row execute function public.touch_updated_at();

alter table public.flights enable row level security;
revoke all on public.flights from anon;
grant select, insert, update, delete on public.flights to authenticated;

drop policy if exists "read my flights and my friends' visible flights" on public.flights;
create policy "read my flights and my friends' visible flights" on public.flights
  for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub') or (not hidden and public.is_friend(user_id)));

drop policy if exists "add my flights" on public.flights;
create policy "add my flights" on public.flights
  for insert to authenticated with check (user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "change my flights" on public.flights;
create policy "change my flights" on public.flights
  for update to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'))
  with check (user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "delete my flights" on public.flights;
create policy "delete my flights" on public.flights
  for delete to authenticated using (user_id = (select auth.jwt() ->> 'sub'));

-- =================================================================================================
-- tracked flights (the stars on the map): private to you
-- =================================================================================================
create table if not exists public.tracked_flights (
  user_id   text not null default (auth.jwt() ->> 'sub'),
  flight_id uuid not null references public.flights (id) on delete cascade,
  primary key (user_id, flight_id)
);
alter table public.tracked_flights enable row level security;
revoke all on public.tracked_flights from anon;
grant select, insert, delete on public.tracked_flights to authenticated;
drop policy if exists "my tracked flights" on public.tracked_flights;
create policy "my tracked flights" on public.tracked_flights
  for all to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'))
  with check (user_id = (select auth.jwt() ->> 'sub'));

-- =================================================================================================
-- reports (community posts in the News tab)
-- =================================================================================================
create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null default (auth.jwt() ->> 'sub'),
  author_username text not null,
  author_name     text not null default '',
  airport         text references public.airports (code),
  title           text not null check (char_length(title) between 3 and 120),
  body            text not null default '' check (char_length(body) <= 500),
  helpful         integer not null default 0,
  flags           integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists reports_created on public.reports (created_at desc);

-- the author's username comes from their token (never from the browser); the name from their profile
create or replace function public.reports_before_insert() returns trigger
language plpgsql set search_path = '' as $$
declare claim text := auth.jwt() ->> 'username';
begin
  if claim is null or claim = '' then
    raise exception 'Your sign-in token has no username claim (see the profiles migration notes).';
  end if;
  new.author_username := claim;
  select coalesce(p.display_name, '') into new.author_name from public.profiles p where p.user_id = (auth.jwt() ->> 'sub');
  new.helpful := 0;
  new.flags := 0;
  return new;
end $$;
drop trigger if exists reports_author on public.reports;
create trigger reports_author before insert on public.reports for each row execute function public.reports_before_insert();

create table if not exists public.report_votes (
  report_id uuid not null references public.reports (id) on delete cascade,
  user_id   text not null default (auth.jwt() ->> 'sub'),
  primary key (report_id, user_id)
);
create table if not exists public.report_flags (
  report_id uuid not null references public.reports (id) on delete cascade,
  user_id   text not null default (auth.jwt() ->> 'sub'),
  primary key (report_id, user_id)
);

create or replace function public.recount_helpful() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rid uuid := coalesce(new.report_id, old.report_id);
begin
  update public.reports set helpful = (select count(*) from public.report_votes where report_id = rid) where id = rid;
  return null;
end $$;
drop trigger if exists votes_recount on public.report_votes;
create trigger votes_recount after insert or delete on public.report_votes for each row execute function public.recount_helpful();

create or replace function public.flag_report(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (auth.jwt() ->> 'sub') is null then raise exception 'Not signed in'; end if;
  insert into public.report_flags (report_id, user_id) values (p_id, (auth.jwt() ->> 'sub')) on conflict do nothing;
  update public.reports set flags = (select count(*) from public.report_flags where report_id = p_id) where id = p_id;
end $$;
revoke all on function public.flag_report(uuid) from public, anon;
grant execute on function public.flag_report(uuid) to authenticated;

alter table public.reports enable row level security;
alter table public.report_votes enable row level security;
alter table public.report_flags enable row level security;
revoke all on public.reports, public.report_votes, public.report_flags from anon;
grant select, insert, delete on public.reports to authenticated;       -- no update: reports can't be edited after posting
grant select, insert, delete on public.report_votes to authenticated;
grant select on public.report_flags to authenticated;                   -- flagging goes through flag_report()

-- every signed-in user can read the community feed, except reports that 3+ people flagged (the author still sees theirs)
drop policy if exists "read reports" on public.reports;
create policy "read reports" on public.reports for select to authenticated
  using (flags < 3 or user_id = (select auth.jwt() ->> 'sub'));
drop policy if exists "post reports" on public.reports;
create policy "post reports" on public.reports for insert to authenticated
  with check (user_id = (select auth.jwt() ->> 'sub'));
drop policy if exists "delete my reports" on public.reports;
create policy "delete my reports" on public.reports for delete to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "my votes" on public.report_votes;
create policy "my votes" on public.report_votes for all to authenticated
  using (user_id = (select auth.jwt() ->> 'sub')) with check (user_id = (select auth.jwt() ->> 'sub'));
drop policy if exists "my flags" on public.report_flags;
create policy "my flags" on public.report_flags for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

-- =================================================================================================
-- news_items: headlines and airport alerts, filled by background workers (service key) later
-- =================================================================================================
create table if not exists public.news_items (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('headline', 'alert')),
  severity     text check (severity in ('info', 'delay', 'stop')),
  title        text not null,
  summary      text not null default '',
  source       text not null,
  url          text,
  tags         text[] not null default '{}',
  published_at timestamptz not null default now(),
  expires_at   timestamptz
);
create index if not exists news_items_published on public.news_items (published_at desc);
alter table public.news_items enable row level security;
revoke all on public.news_items from anon;
revoke insert, update, delete on public.news_items from authenticated;
grant select on public.news_items to authenticated;
drop policy if exists "read news" on public.news_items;
create policy "read news" on public.news_items for select to authenticated
  using (expires_at is null or expires_at > now());

-- To undo everything in this file (this deletes the data in these tables):
--   drop table public.news_items, public.report_flags, public.report_votes, public.reports,
--              public.tracked_flights, public.flights, public.friendships, public.airports cascade;
--   drop function public.friend_summaries(), public.mark_friend_accepts_seen(), public.remove_friendship(uuid),
--                 public.respond_friend_request(uuid, boolean), public.send_friend_request(text), public.is_friend(text),
--                 public.reports_before_insert(), public.recount_helpful(), public.flag_report(uuid);
--   drop policy "friends read profile" on public.profiles;
