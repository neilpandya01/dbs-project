-- Wingmates: close four friend functions to signed-out visitors. Run once in Supabase -> SQL Editor.
--
-- These functions were already safe: each one works only on the signed-in caller's own rows and does nothing
-- (or raises "Not signed in") without a sign-in. But Postgres lets everyone run a new function unless told otherwise,
-- so this states it outright: only signed-in users may call them. Nothing changes for people using the app.

revoke all on function public.friend_summaries() from public, anon;
revoke all on function public.mark_friend_accepts_seen() from public, anon;
revoke all on function public.remove_friendship(uuid) from public, anon;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;

grant execute on function public.friend_summaries() to authenticated;
grant execute on function public.mark_friend_accepts_seen() to authenticated;
grant execute on function public.remove_friendship(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- To undo:  grant execute on function public.friend_summaries(), public.mark_friend_accepts_seen(),
--             public.remove_friendship(uuid), public.respond_friend_request(uuid, boolean) to public, anon;
