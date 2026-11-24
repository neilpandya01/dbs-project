-- Wingmates: friends-only threads. Run once in Supabase -> SQL Editor.
--
-- A thread can be marked "friends only": then only its author and the author's accepted friends can see it, its
-- comments, and (by extension) vote, flag or reply to it. Everyone else gets nothing back, as if it didn't exist.
-- The author can switch it on or off when posting or editing.

alter table public.reports add column if not exists friends_only boolean not null default false;

-- who can read a thread: the usual rules (hidden once 3+ people flag it, except for its author), plus friends-only
drop policy if exists "read reports" on public.reports;
create policy "read reports" on public.reports for select to authenticated
  using (
    (flags < 3 or user_id = (select auth.jwt() ->> 'sub'))
    and (not friends_only or user_id = (select auth.jwt() ->> 'sub') or public.is_friend(user_id))
  );

-- the author may change the setting later (alongside the other fields they can already edit)
grant update (friends_only) on public.reports to authenticated;

-- votes: you can only vote on a thread you can see (comments already follow this through "read comments" / "post comments")
drop policy if exists "my votes" on public.report_votes;
drop policy if exists "read my votes" on public.report_votes;
drop policy if exists "remove my votes" on public.report_votes;
drop policy if exists "vote on visible threads" on public.report_votes;
create policy "read my votes" on public.report_votes for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));
create policy "remove my votes" on public.report_votes for delete to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));
create policy "vote on visible threads" on public.report_votes for insert to authenticated
  with check (user_id = (select auth.jwt() ->> 'sub') and exists (select 1 from public.reports r where r.id = report_votes.report_id));

-- flags: same rule. (This function runs with owner rights, so it checks visibility itself.)
create or replace function public.flag_report(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me text := auth.jwt() ->> 'sub';
begin
  if me is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from public.reports r where r.id = p_id and (not r.friends_only or r.user_id = me or public.is_friend(r.user_id))) then
    raise exception 'Thread not found';
  end if;
  insert into public.report_flags (report_id, user_id) values (p_id, me) on conflict do nothing;
  update public.reports set flags = (select count(*) from public.report_flags where report_id = p_id) where id = p_id;
end $$;
revoke all on function public.flag_report(uuid) from public, anon;
grant execute on function public.flag_report(uuid) to authenticated;

-- To undo:
--   alter table public.reports drop column friends_only;  (and re-run the earlier "read reports" policy)
