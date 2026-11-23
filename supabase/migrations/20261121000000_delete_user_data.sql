-- Wingmates: erase everything a person has when their Clerk account is deleted. Run once in Supabase -> SQL Editor.
--
-- The app calls this (from a Clerk "user.deleted" webhook, with the service-role key) so that deleting an
-- account in the app's account settings clears their profile, flights, friendships, community posts and
-- lookup history. Their username becomes free again, and the same email can sign up and onboard from scratch.
-- Nobody else can run it: it is not granted to anon or signed-in users.
create or replace function public.delete_user_data(p_user_id text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user_id is null or p_user_id = '' then return; end if;
  delete from public.report_votes      where user_id = p_user_id;
  delete from public.report_flags      where user_id = p_user_id;
  delete from public.reports           where user_id = p_user_id;   -- their posts (votes/flags on them cascade)
  delete from public.tracked_flights   where user_id = p_user_id;
  delete from public.flights           where user_id = p_user_id;   -- tracked stars on them cascade
  delete from public.friendships       where requester = p_user_id or addressee = p_user_id;
  delete from public.flight_lookup_log where user_id = p_user_id;
  delete from public.profiles          where user_id = p_user_id;
end $$;

revoke all on function public.delete_user_data(text) from public, anon, authenticated;
grant execute on function public.delete_user_data(text) to service_role;
