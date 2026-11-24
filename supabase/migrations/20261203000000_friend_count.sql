-- Wingmates: show how many friends someone has, on their profile. Run once in Supabase -> SQL Editor.
--
-- Only the NUMBER is shared, never who the friends are (the friendships table stays private). You can see the number
-- for yourself and for your accepted friends; for anyone else you get nothing back (null).

create or replace function public.friend_count(p_user text) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare me text := auth.jwt() ->> 'sub';
begin
  if me is null then return null; end if;
  if p_user <> me and not exists (
    select 1 from public.friendships f
    where f.status = 'accepted' and ((f.requester = me and f.addressee = p_user) or (f.requester = p_user and f.addressee = me))
  ) then
    return null;
  end if;
  return (select count(*)::int from public.friendships f where f.status = 'accepted' and (f.requester = p_user or f.addressee = p_user));
end $$;
revoke all on function public.friend_count(text) from public, anon;
grant execute on function public.friend_count(text) to authenticated;

-- To undo:  drop function public.friend_count(text);
