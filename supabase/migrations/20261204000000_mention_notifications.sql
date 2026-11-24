-- Wingmates: "you were tagged" notifications. Run once in Supabase -> SQL Editor, AFTER 20261202000000_mentions.sql.
--
-- Every "@username" in a thread or comment becomes a row in public.mentions for that person. The rows stay as long as
-- the thread/comment exists (they are a lasting list you can come back to), and only the "seen" flag changes:
-- unseen ones drive the red dot on the News tab. Editing a post adds rows for newly tagged people and removes them for
-- people no longer tagged; deleting the post (or the thread) deletes its rows. Nobody can create or delete these rows
-- from the browser, and you can only ever read (and mark seen) your own.

create table if not exists public.mentions (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,                                            -- who was tagged
  report_id  uuid not null references public.reports (id) on delete cascade,
  comment_id uuid references public.report_comments (id) on delete cascade, -- null = tagged in the thread itself
  seen       boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists mentions_unique on public.mentions (user_id, report_id, coalesce(comment_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists mentions_user on public.mentions (user_id, created_at desc);

alter table public.mentions enable row level security;
revoke all on public.mentions from anon, authenticated;
grant select on public.mentions to authenticated;
grant update (seen) on public.mentions to authenticated;

-- you read your own, and only while you can still see the thread (a thread turned friends-only drops out for non-friends)
drop policy if exists "read my mentions" on public.mentions;
create policy "read my mentions" on public.mentions for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub') and exists (select 1 from public.reports r where r.id = mentions.report_id));
drop policy if exists "mark my mentions seen" on public.mentions;
create policy "mark my mentions seen" on public.mentions for update to authenticated
  using (user_id = (select auth.jwt() ->> 'sub')) with check (user_id = (select auth.jwt() ->> 'sub'));

-- make the rows match the text of one post (add new tags, drop removed ones; never notify yourself)
create or replace function public.sync_mentions(p_report uuid, p_comment uuid, p_body text, p_author text) returns void
language plpgsql security definer set search_path = '' as $$
declare names text[] := public.mentions_in(p_body);
begin
  insert into public.mentions (user_id, report_id, comment_id)
    select p.user_id, p_report, p_comment from public.profiles p
    where lower(p.username) = any (names) and p.user_id <> p_author
    on conflict do nothing;
  delete from public.mentions m
    where m.report_id = p_report and m.comment_id is not distinct from p_comment
      and m.user_id not in (select p.user_id from public.profiles p where lower(p.username) = any (names));
end $$;
revoke all on function public.sync_mentions(uuid, uuid, text, text) from public, anon, authenticated;

create or replace function public.reports_sync_mentions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.body is distinct from old.body then
    perform public.sync_mentions(new.id, null, new.body, new.user_id);
  end if;
  return null;
end $$;
drop trigger if exists reports_mentions_sync on public.reports;
create trigger reports_mentions_sync after insert or update on public.reports for each row execute function public.reports_sync_mentions();

create or replace function public.comments_sync_mentions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.body is distinct from old.body then
    perform public.sync_mentions(new.report_id, new.id, new.body, new.user_id);
  end if;
  return null;
end $$;
drop trigger if exists comments_mentions_sync on public.report_comments;
create trigger comments_mentions_sync after insert or update on public.report_comments for each row execute function public.comments_sync_mentions();

-- tags that already exist in older posts show up in the list too, but as already seen (no sudden red dot)
do $$
declare r record;
begin
  for r in select id, body, user_id from public.reports loop perform public.sync_mentions(r.id, null, r.body, r.user_id); end loop;
  for r in select id, report_id, body, user_id from public.report_comments loop perform public.sync_mentions(r.report_id, r.id, r.body, r.user_id); end loop;
  update public.mentions set seen = true;
end $$;

-- account deletion also removes the notifications of the person leaving (replaces the version from
-- 20261129000000_delete_user_data_threads.sql with one extra line)
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
  delete from public.flights           where user_id = p_user_id;
  delete from public.friendships       where requester = p_user_id or addressee = p_user_id;
  delete from public.flight_lookup_log where user_id = p_user_id;
  delete from public.profiles          where user_id = p_user_id;
end $$;
revoke all on function public.delete_user_data(text) from public, anon, authenticated;
grant execute on function public.delete_user_data(text) to service_role;

-- To undo:
--   drop trigger reports_mentions_sync on public.reports; drop trigger comments_mentions_sync on public.report_comments;
--   drop function public.reports_sync_mentions(), public.comments_sync_mentions(), public.sync_mentions(uuid,uuid,text,text);
--   drop table public.mentions;  (and re-run 20261129000000 to restore the earlier delete_user_data)
