-- Wingmates: edit your own threads and comments, and attach photos. Run once in Supabase -> SQL Editor.
--
--   * you can now edit the title, description, airport tags and photos of your own threads, and the text and photos
--     of your own comments (an "edited" time is kept and shown)
--   * threads can carry up to 4 photos and comments up to 2, stored in a "thread-images" storage bucket
--     (anyone signed in can see them; you can only upload into, and delete from, your own folder)

-- ---- new columns -------------------------------------------------------------------------------------
alter table public.reports
  add column if not exists images text[] not null default '{}',
  add column if not exists edited_at timestamptz;
alter table public.report_comments
  add column if not exists images text[] not null default '{}',
  add column if not exists edited_at timestamptz;

-- ---- checks shared by threads and comments ----------------------------------------------------------
-- every photo must be a file in the author's own folder of the bucket
create or replace function public.check_images(p_images text[], p_owner text, p_max int) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if cardinality(coalesce(p_images, '{}')) > p_max then raise exception 'You can attach up to % photos.', p_max; end if;
  if exists (select 1 from unnest(coalesce(p_images, '{}')) i where i is null or char_length(i) > 200 or i not like p_owner || '/%' or i like '%..%') then
    raise exception 'A photo is not one of your uploads.';
  end if;
end $$;

-- ---- threads: validate on insert (replaces the earlier version) and on edit -----------------------------
create or replace function public.reports_normalize() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.airports := coalesce((select array_agg(distinct upper(btrim(t))) from unnest(coalesce(new.airports, '{}')) t where btrim(t) <> ''), '{}');
  if cardinality(new.airports) > 5 then raise exception 'You can tag up to 5 airports.'; end if;
  if exists (select 1 from unnest(new.airports) t where not exists (select 1 from public.airports a where a.code = t)) then
    raise exception 'One of the tagged airports is not recognised.';
  end if;
  new.airport := new.airports[1];
  perform public.check_images(new.images, new.user_id, 4);
  return new;
end $$;

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
  new.edited_at := null;
  return public.reports_normalize_row(new);
end $$;

-- (a small wrapper so insert and update share the same checks)
create or replace function public.reports_normalize_row(r public.reports) returns public.reports
language plpgsql set search_path = '' as $$
begin
  r.airports := coalesce((select array_agg(distinct upper(btrim(t))) from unnest(coalesce(r.airports, '{}')) t where btrim(t) <> ''), '{}');
  if cardinality(r.airports) > 5 then raise exception 'You can tag up to 5 airports.'; end if;
  if exists (select 1 from unnest(r.airports) t where not exists (select 1 from public.airports a where a.code = t)) then
    raise exception 'One of the tagged airports is not recognised.';
  end if;
  r.airport := r.airports[1];
  perform public.check_images(r.images, r.user_id, 4);
  return r;
end $$;
drop function if exists public.reports_normalize();

create or replace function public.reports_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new := public.reports_normalize_row(new);
  if new.title is distinct from old.title or new.body is distinct from old.body or new.airports is distinct from old.airports or new.images is distinct from old.images then
    new.edited_at := now();
  end if;
  return new;
end $$;
drop trigger if exists reports_edit on public.reports;
create trigger reports_edit before update on public.reports for each row execute function public.reports_before_update();

-- ---- comments: validate on insert (replaces the earlier version) and on edit -------------------------
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
  new.edited_at := null;
  perform public.check_images(new.images, new.user_id, 2);
  return new;
end $$;

create or replace function public.comments_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.body := btrim(new.body);
  perform public.check_images(new.images, new.user_id, 2);
  if new.body is distinct from old.body or new.images is distinct from old.images then new.edited_at := now(); end if;
  return new;
end $$;
drop trigger if exists report_comments_edit on public.report_comments;
create trigger report_comments_edit before update on public.report_comments for each row execute function public.comments_before_update();

-- a comment needs words or a photo
alter table public.report_comments drop constraint if exists report_comments_body_check;
alter table public.report_comments add constraint report_comments_body_check check (char_length(btrim(body)) <= 1000 and (char_length(btrim(body)) >= 1 or cardinality(images) > 0));

-- ---- who may edit what ------------------------------------------------------------------------------
-- only these columns, and only on your own rows (author, counts and time can never be changed by you)
revoke update on public.reports from authenticated;
grant update (title, body, airports, images) on public.reports to authenticated;
drop policy if exists "edit my reports" on public.reports;
create policy "edit my reports" on public.reports for update to authenticated
  using (user_id = (select auth.jwt() ->> 'sub')) with check (user_id = (select auth.jwt() ->> 'sub'));

revoke update on public.report_comments from authenticated;
grant update (body, images) on public.report_comments to authenticated;
drop policy if exists "edit my comments" on public.report_comments;
create policy "edit my comments" on public.report_comments for update to authenticated
  using (user_id = (select auth.jwt() ->> 'sub')) with check (user_id = (select auth.jwt() ->> 'sub'));

-- ---- photo storage ----------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('thread-images', 'thread-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "thread images: read" on storage.objects;
create policy "thread images: read" on storage.objects for select to authenticated using (bucket_id = 'thread-images');
drop policy if exists "thread images: upload to my folder" on storage.objects;
create policy "thread images: upload to my folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'thread-images' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));
drop policy if exists "thread images: delete mine" on storage.objects;
create policy "thread images: delete mine" on storage.objects for delete to authenticated
  using (bucket_id = 'thread-images' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));

-- To undo:
--   drop trigger reports_edit on public.reports; drop trigger report_comments_edit on public.report_comments;
--   alter table public.reports drop column images, drop column edited_at;
--   alter table public.report_comments drop column images, drop column edited_at;
