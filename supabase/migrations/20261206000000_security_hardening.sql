-- Wingmates: security hardening. Run once in Supabase -> SQL Editor.
--
-- 1. Post and comment author names come from the person's (locked) profile, not the sign-in token, so renaming
--    yourself in Clerk can no longer change who a post appears to be from.
-- 2. live_claim_refresh(): a per-person cooldown for the Map's "where are my friends right now" refresh.
-- 3. claim_flight_lookup(): records a flight lookup against the person's daily allowance atomically, so many
--    simultaneous requests can't all slip under the limit.

-- ---- 1. author names from the profile -------------------------------------------------------
create or replace function public.reports_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  select p.username, coalesce(p.display_name, '') into new.author_username, new.author_name
  from public.profiles p where p.user_id = (auth.jwt() ->> 'sub');
  if new.author_username is null then
    raise exception 'Finish setting up your profile before posting.';
  end if;
  new.helpful := 0;
  new.flags := 0;
  new.comment_count := 0;
  new.last_activity_at := now();
  new.edited_at := null;
  return public.reports_normalize_row(new);
end $$;

create or replace function public.comments_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  select p.username, coalesce(p.display_name, '') into new.author_username, new.author_name
  from public.profiles p where p.user_id = (auth.jwt() ->> 'sub');
  if new.author_username is null then
    raise exception 'Finish setting up your profile before commenting.';
  end if;
  new.body := btrim(new.body);
  new.edited_at := null;
  perform public.check_images(new.images, new.user_id, 2);
  return new;
end $$;

-- ---- 2. refresh cooldown --------------------------------------------------------------------
create table if not exists public.live_refresh_cooldown (
  user_id text primary key,
  last_at timestamptz not null default now()
);
alter table public.live_refresh_cooldown enable row level security;
revoke all on public.live_refresh_cooldown from anon, authenticated;

-- true = go ahead (and the clock restarts); false = this person refreshed less than p_seconds ago
create or replace function public.live_claim_refresh(p_user text, p_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare got int;
begin
  insert into public.live_refresh_cooldown (user_id, last_at) values (p_user, now())
  on conflict (user_id) do update set last_at = now()
    where public.live_refresh_cooldown.last_at <= now() - make_interval(secs => p_seconds);
  get diagnostics got = row_count;
  return got > 0;
end $$;
revoke all on function public.live_claim_refresh(text, int) from public, anon, authenticated;
grant execute on function public.live_claim_refresh(text, int) to service_role;

-- ---- 3. atomic daily lookup allowance -------------------------------------------------------
-- true = one lookup was recorded for this person; false = they already used their allowance in the last 24 hours.
create or replace function public.claim_flight_lookup(p_user text, p_limit int) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('flight_lookup:' || p_user, 0)); -- one claim per person at a time
  if (select count(*) from public.flight_lookup_log where user_id = p_user and created_at >= now() - interval '24 hours') >= p_limit then
    return false;
  end if;
  insert into public.flight_lookup_log (user_id) values (p_user);
  return true;
end $$;
revoke all on function public.claim_flight_lookup(text, int) from public, anon, authenticated;
grant execute on function public.claim_flight_lookup(text, int) to service_role;

-- delete_user_data should also clear the cooldown row
create or replace function public.delete_user_data(p_user_id text)
returns void
language plpgsql security definer set search_path = '' as $$
declare flagged uuid[];
begin
  if p_user_id is null or p_user_id = '' then return; end if;

  select coalesce(array_agg(report_id), '{}') into flagged from public.report_flags where user_id = p_user_id;

  delete from public.mentions          where user_id = p_user_id;
  delete from public.report_votes      where user_id = p_user_id;
  delete from public.report_flags      where user_id = p_user_id;
  update public.reports r set flags = (select count(*) from public.report_flags f where f.report_id = r.id) where r.id = any (flagged);
  delete from public.report_comments   where user_id = p_user_id;
  delete from public.reports           where user_id = p_user_id;
  delete from public.tracked_flights   where user_id = p_user_id;
  delete from public.live_watchers     where user_id = p_user_id;
  delete from public.live_refresh_cooldown where user_id = p_user_id;
  delete from public.flights           where user_id = p_user_id;
  delete from public.friendships       where requester = p_user_id or addressee = p_user_id;
  delete from public.flight_lookup_log where user_id = p_user_id;
  delete from public.profiles          where user_id = p_user_id;
end $$;
revoke all on function public.delete_user_data(text) from public, anon, authenticated;
grant execute on function public.delete_user_data(text) to service_role;

-- To undo: re-run the earlier definitions of reports_before_insert / comments_before_insert, then
--   drop function public.live_claim_refresh(text, int), public.claim_flight_lookup(text, int);
--   drop table public.live_refresh_cooldown;
