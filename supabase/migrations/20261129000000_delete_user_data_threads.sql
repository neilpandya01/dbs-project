-- Wingmates: account deletion now also clears everything a person has in the community threads. Run once in Supabase -> SQL Editor.
--
-- Replaces delete_user_data() (see 20261121000000_delete_user_data.sql). Added since then:
--   * their COMMENTS on other people's threads (these carried their username and name, and were left behind before)
--   * their live-tracking "watcher" row
--   * flag counts on other people's threads are recounted once the person's flags are gone
-- Their own threads were already deleted (comments and votes on them go with them). Their uploaded PHOTOS live in
-- storage, not in the database, so the Clerk webhook (app/api/webhooks/clerk/route.ts) removes those files.
-- Nobody else can run this: it is not granted to anon or signed-in users.
create or replace function public.delete_user_data(p_user_id text)
returns void
language plpgsql security definer set search_path = '' as $$
declare flagged uuid[];
begin
  if p_user_id is null or p_user_id = '' then return; end if;

  select coalesce(array_agg(report_id), '{}') into flagged from public.report_flags where user_id = p_user_id;

  delete from public.report_votes      where user_id = p_user_id;   -- "helpful" counts on others' threads recount by trigger
  delete from public.report_flags      where user_id = p_user_id;
  update public.reports r set flags = (select count(*) from public.report_flags f where f.report_id = r.id) where r.id = any (flagged);
  delete from public.report_comments   where user_id = p_user_id;   -- comment counts on others' threads recount by trigger
  delete from public.reports           where user_id = p_user_id;   -- their threads (comments, votes and flags on them cascade)
  delete from public.tracked_flights   where user_id = p_user_id;
  delete from public.live_watchers     where user_id = p_user_id;
  delete from public.flights           where user_id = p_user_id;   -- tracked stars and live positions on them cascade
  delete from public.friendships       where requester = p_user_id or addressee = p_user_id;
  delete from public.flight_lookup_log where user_id = p_user_id;
  delete from public.profiles          where user_id = p_user_id;
end $$;

revoke all on function public.delete_user_data(text) from public, anon, authenticated;
grant execute on function public.delete_user_data(text) to service_role;
