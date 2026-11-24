-- Wingmates: @mentions in threads and comments. Run once in Supabase -> SQL Editor.
--
-- A mention is just "@username" in the text (nothing extra is stored). The database enforces who can be mentioned:
--   * a post (thread or comment) can mention at most 5 people;
--   * in a PUBLIC thread you can mention anyone;
--   * in a FRIENDS-ONLY thread you can mention only people who can actually see it: the thread's author, or someone
--     who is friends with the author AND with you (so nobody can probe an author's friend list by trying names).
-- An "@word" that isn't a real username is just text and is never checked.

-- usernames mentioned in some text, lower-cased and de-duplicated
create or replace function public.mentions_in(p_text text) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct lower(m[1])), '{}')
  from regexp_matches(coalesce(p_text, ''), '(?<![A-Za-z0-9_])@([A-Za-z0-9_-]{1,64})', 'g') as m;
$$;

-- are these two people accepted friends? (internal helper for the checks below; not callable from the browser)
create or replace function public.pair_are_friends(a text, b text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted' and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  );
$$;
revoke all on function public.pair_are_friends(text, text) from public, anon, authenticated;

-- raise an error if `actor` may not write these mentions into a post in a thread by `author`
create or replace function public.check_mentions(p_body text, p_author text, p_actor text, p_friends_only boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  names text[] := public.mentions_in(p_body);
  r record;
begin
  if coalesce(array_length(names, 1), 0) = 0 then return; end if;
  if array_length(names, 1) > 5 then raise exception 'You can mention at most 5 people in one post.'; end if;
  for r in select p.user_id, p.username from public.profiles p where lower(p.username) = any (names) loop
    if p_friends_only
       and r.user_id <> p_author
       and r.user_id <> p_actor
       and not (public.pair_are_friends(r.user_id, p_author) and (p_actor = p_author or public.pair_are_friends(r.user_id, p_actor)))
    then
      raise exception 'In a friends-only thread you can only mention its author and friends you share with them (@%).', r.username;
    end if;
  end loop;
end $$;
revoke all on function public.check_mentions(text, text, text, boolean) from public, anon, authenticated;

-- thread: check on post, and again whenever the text or the friends-only switch changes
create or replace function public.reports_check_mentions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.body is distinct from old.body or new.friends_only is distinct from old.friends_only then
    perform public.check_mentions(new.body, new.user_id, new.user_id, new.friends_only);
  end if;
  return new;
end $$;
drop trigger if exists zz_reports_mentions on public.reports;
create trigger zz_reports_mentions before insert or update on public.reports for each row execute function public.reports_check_mentions();

-- comment: checked against the thread it's on
create or replace function public.comments_check_mentions() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t public.reports;
begin
  if tg_op = 'INSERT' or new.body is distinct from old.body then
    select * into t from public.reports where id = new.report_id;
    if found then perform public.check_mentions(new.body, t.user_id, new.user_id, t.friends_only); end if;
  end if;
  return new;
end $$;
drop trigger if exists zz_comments_mentions on public.report_comments;
create trigger zz_comments_mentions before insert or update on public.report_comments for each row execute function public.comments_check_mentions();

-- who the picker may suggest in a friends-only thread you're replying to: the author, plus people who are friends with
-- both of you. Returns nothing for a public thread (the app suggests your friends and a username search there).
create or replace function public.thread_mention_candidates(p_thread uuid)
returns table (username text, display_name text)
language plpgsql stable security definer set search_path = '' as $$
declare
  me text := auth.jwt() ->> 'sub';
  t public.reports;
begin
  if me is null then return; end if;
  select * into t from public.reports where id = p_thread;
  if not found or not t.friends_only then return; end if;
  if t.user_id <> me and not public.pair_are_friends(t.user_id, me) then return; end if; -- can't see it, so no names
  return query
    select p.username, p.display_name from public.profiles p
    where p.user_id <> me
      and (p.user_id = t.user_id
           or (public.pair_are_friends(p.user_id, t.user_id) and (t.user_id = me or public.pair_are_friends(p.user_id, me))))
    order by p.username limit 50;
end $$;
revoke all on function public.thread_mention_candidates(uuid) from public, anon;
grant execute on function public.thread_mention_candidates(uuid) to authenticated;

-- To undo:
--   drop trigger zz_reports_mentions on public.reports; drop trigger zz_comments_mentions on public.report_comments;
--   drop function public.reports_check_mentions(), public.comments_check_mentions(), public.check_mentions(text,text,text,boolean),
--     public.pair_are_friends(text,text), public.mentions_in(text), public.thread_mention_candidates(uuid);
