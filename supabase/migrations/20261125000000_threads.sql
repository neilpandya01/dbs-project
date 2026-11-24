-- Wingmates: community news as threads. Run once in Supabase -> SQL Editor.
--
--   reports   become threads: several airport tags (up to 5), a comment count, and a last-activity time.
--             The old single `airport` column is kept in sync with the first tag.
--   report_comments  replies on a thread (anyone signed in can read and reply; you can delete your own).
-- Votes ("helpful") and flags keep working as before.

-- ---- threads: tags, counts, longer text -------------------------------------------------------------
alter table public.reports
  add column if not exists airports text[] not null default '{}',
  add column if not exists comment_count integer not null default 0,
  add column if not exists last_activity_at timestamptz not null default now();

update public.reports set airports = array[airport] where airport is not null and airports = '{}';
create index if not exists reports_airports_gin on public.reports using gin (airports);

-- allow longer thread text (was 500): replace whatever check limits the body
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'public.reports'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%char_length(body)%'
  loop execute format('alter table public.reports drop constraint %I', c.conname); end loop;
end $$;
alter table public.reports add constraint reports_body_len check (char_length(body) <= 2000);

-- the author's username comes from their token; tags are checked here, never trusted from the browser
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
  new.comment_count := 0;
  new.last_activity_at := now();
  -- tags: upper-case, no repeats, at most 5, each a real airport
  new.airports := coalesce((select array_agg(distinct upper(btrim(t))) from unnest(coalesce(new.airports, '{}')) t where btrim(t) <> ''), '{}');
  if cardinality(new.airports) > 5 then raise exception 'You can tag up to 5 airports.'; end if;
  if exists (select 1 from unnest(new.airports) t where not exists (select 1 from public.airports a where a.code = t)) then
    raise exception 'One of the tagged airports is not recognised.';
  end if;
  new.airport := new.airports[1];
  return new;
end $$;

-- ---- comments ----------------------------------------------------------------------------------------
create table if not exists public.report_comments (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references public.reports (id) on delete cascade,
  user_id         text not null default (auth.jwt() ->> 'sub'),
  author_username text not null,
  author_name     text not null default '',
  body            text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at      timestamptz not null default now()
);
create index if not exists report_comments_thread on public.report_comments (report_id, created_at);

create or replace function public.comments_before_insert() returns trigger
language plpgsql set search_path = '' as $$
declare claim text := auth.jwt() ->> 'username';
begin
  if claim is null or claim = '' then
    raise exception 'Your sign-in token has no username claim (see the profiles migration notes).';
  end if;
  new.author_username := claim;
  select coalesce(p.display_name, '') into new.author_name from public.profiles p where p.user_id = (auth.jwt() ->> 'sub');
  new.body := btrim(new.body);
  return new;
end $$;
drop trigger if exists report_comments_author on public.report_comments;
create trigger report_comments_author before insert on public.report_comments for each row execute function public.comments_before_insert();

-- keep the thread's comment count and "last activity" up to date
create or replace function public.recount_comments() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rid uuid := coalesce(new.report_id, old.report_id);
begin
  update public.reports r set
    comment_count = (select count(*) from public.report_comments where report_id = rid),
    last_activity_at = case when tg_op = 'INSERT' then now() else r.last_activity_at end
  where r.id = rid;
  return null;
end $$;
drop trigger if exists report_comments_recount on public.report_comments;
create trigger report_comments_recount after insert or delete on public.report_comments for each row execute function public.recount_comments();

alter table public.report_comments enable row level security;
revoke all on public.report_comments from anon;
grant select, insert, delete on public.report_comments to authenticated; -- no update: comments can't be edited after posting

-- you can read comments on any thread you can read, reply to any such thread, and delete your own comments
drop policy if exists "read comments" on public.report_comments;
create policy "read comments" on public.report_comments for select to authenticated
  using (exists (select 1 from public.reports r where r.id = report_comments.report_id));
drop policy if exists "post comments" on public.report_comments;
create policy "post comments" on public.report_comments for insert to authenticated
  with check (user_id = (select auth.jwt() ->> 'sub') and exists (select 1 from public.reports r where r.id = report_comments.report_id));
drop policy if exists "delete my comments" on public.report_comments;
create policy "delete my comments" on public.report_comments for delete to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

-- To undo:
--   drop table public.report_comments; drop function public.comments_before_insert(), public.recount_comments();
--   alter table public.reports drop column airports, drop column comment_count, drop column last_activity_at;
